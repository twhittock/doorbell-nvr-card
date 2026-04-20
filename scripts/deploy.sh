#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CARD_FILE="${PROJECT_DIR}/dist/doorbell-nvr-card.js"
HA_HOST="${HA_SSH_HOST:-homeassistant}"
HA_REMOTE_DIR="/config/www/community/doorbell-nvr-card"
HA_REMOTE_FILE="${HA_REMOTE_DIR}/doorbell-nvr-card.js"
RESOURCE_URL_BASE="/hacsfiles/doorbell-nvr-card/doorbell-nvr-card.js"

# Source HA credentials — search project-local path first, then HOMEASSISTANT_ENV
ENV_FILE=""
if [[ -n "${HOMEASSISTANT_ENV:-}" ]] && [[ -f "$HOMEASSISTANT_ENV" ]]; then
    ENV_FILE="$HOMEASSISTANT_ENV"
elif [[ -f "${SCRIPT_DIR}/../secrets/homeassistant.env" ]]; then
    ENV_FILE="${SCRIPT_DIR}/../secrets/homeassistant.env"
else
    echo "ERROR: homeassistant.env not found. Set HOMEASSISTANT_ENV or create secrets/homeassistant.env" >&2
    exit 1
fi
source "$ENV_FILE"

if [[ ! -f "$CARD_FILE" ]]; then
    echo "ERROR: Build output not found at $CARD_FILE"
    echo "Run 'npm run build' first."
    exit 1
fi

echo "Deploying doorbell-nvr-card to HA..."

echo "1. Creating remote directory..."
ssh "root@${HA_HOST}" "mkdir -p ${HA_REMOTE_DIR}"

echo "2. Copying card file..."
scp "$CARD_FILE" "root@${HA_HOST}:${HA_REMOTE_FILE}"

echo "3. Verifying deployment..."
ssh "root@${HA_HOST}" "ls -la ${HA_REMOTE_FILE}"

echo "4. Updating lovelace resource cache tag..."
FILE_SIZE=$(wc -c < "$CARD_FILE")
HACSTAG="${FILE_SIZE}0000000000"
RESOURCE_URL="${RESOURCE_URL_BASE}?hacstag=${HACSTAG}"
echo "   New URL: ${RESOURCE_URL}"

UPDATE_SCRIPT="$(cat <<'NODEEOF'
const WebSocket = require('ws');
const args = JSON.parse(process.argv[1]);
const wsUrl = args.url.replace('http', 'ws').replace('https', 'wss') + '/api/websocket';
const ws = new WebSocket(wsUrl);
let id = 1;
let phase = 'list';

ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({type: 'auth', access_token: args.token}));
    } else if (msg.type === 'auth_ok') {
        ws.send(JSON.stringify({type: 'lovelace/resources', id: id++}));
        phase = 'list';
    } else if (msg.type === 'result') {
        const items = Array.isArray(msg.result) ? msg.result : [];
        const doorbell = items.find(r => r.url && r.url.includes('doorbell-nvr-card'));
        if (phase === 'list') {
            if (doorbell) {
                console.log('   Found existing resource, id:', doorbell.id);
                phase = 'delete';
                ws.send(JSON.stringify({
                    type: 'lovelace/resources/delete',
                    id: id++,
                    resource_id: doorbell.id
                }));
            } else {
                console.log('   No existing resource found, creating...');
                phase = 'create';
                ws.send(JSON.stringify({
                    type: 'lovelace/resources/create',
                    id: id++,
                    res_type: 'module',
                    url: args.resourceUrl
                }));
            }
        } else if (phase === 'delete') {
            if (!msg.success && msg.error?.code !== 'not_found') {
                console.error('   Failed to delete:', JSON.stringify(msg.error));
                ws.close();
                process.exit(1);
            }
            console.log('   Deleted old resource');
            phase = 'create';
            ws.send(JSON.stringify({
                type: 'lovelace/resources/create',
                id: id++,
                res_type: 'module',
                url: args.resourceUrl
            }));
        } else if (phase === 'create') {
            if (msg.success) {
                console.log('   Resource created successfully');
            } else {
                console.error('   Failed to create resource:', JSON.stringify(msg.error));
            }
            ws.close();
        }
    }
});
NODEEOF
)"

node -e "$UPDATE_SCRIPT" "{\"url\":\"${HOMEASSISTANT_URL}\",\"token\":\"${HOMEASSISTANT_TOKEN}\",\"resourceUrl\":\"${RESOURCE_URL}\"}"

echo ""
echo "Deployment complete!"
echo "Hard-refresh the HA dashboard (Ctrl+Shift+R) to pick up changes."