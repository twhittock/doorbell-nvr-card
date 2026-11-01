#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CARD_NAME="doorbell-nvr-card"
CARD_FILE="${PROJECT_DIR}/dist/${CARD_NAME}.js"
HA_HOST="${HA_SSH_HOST:-homeassistant}"
HA_REMOTE_DIR="${HA_REMOTE_DIR:-/config/www/community/${CARD_NAME}}"
HA_REMOTE_FILE="${HA_REMOTE_DIR}/${CARD_NAME}.js"
RESOURCE_URL_BASE="${RESOURCE_URL_BASE:-/hacsfiles/${CARD_NAME}/${CARD_NAME}.js}"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Resolve HA credentials: explicit override, project-local secret, then the
# system repo's shared secret file.
ENV_FILE="${HOMEASSISTANT_ENV:-}"
if [[ -z "$ENV_FILE" ]]; then
    for candidate in \
        "${PROJECT_DIR}/secrets/homeassistant.env" \
        "${PROJECT_DIR}/../system/sysadmin/secrets/homeassistant.env"; do
        if [[ -f "$candidate" ]]; then
            ENV_FILE="$candidate"
            break
        fi
    done
fi
[[ -n "$ENV_FILE" && -f "$ENV_FILE" ]] || die \
    "homeassistant.env not found. Set HOMEASSISTANT_ENV or place it in secrets/homeassistant.env"
source "$ENV_FILE"
: "${HOMEASSISTANT_URL:?HOMEASSISTANT_URL is not set in $ENV_FILE}"
: "${HOMEASSISTANT_TOKEN:?HOMEASSISTANT_TOKEN is not set in $ENV_FILE}"

[[ -f "$CARD_FILE" ]] || die "build output not found at $CARD_FILE (run 'npm run build' first)"
[[ -d "${PROJECT_DIR}/node_modules/ws" ]] || die "missing ws dependency (run 'npm install')"

SSH_TARGET="$HA_HOST"
[[ "$SSH_TARGET" == *@* ]] || SSH_TARGET="root@${SSH_TARGET}"

WORK_FILE="$(mktemp)"
trap 'rm -f "$WORK_FILE"' EXIT

echo "Deploying ${CARD_NAME} to HA..."

echo "1. Copying card file..."
ssh "$SSH_TARGET" "mkdir -p '${HA_REMOTE_DIR}'"
REMOTE_TMP="${HA_REMOTE_FILE}.tmp.$$"
scp -q "$CARD_FILE" "${SSH_TARGET}:${REMOTE_TMP}"
ssh "$SSH_TARGET" "mv -f '${REMOTE_TMP}' '${HA_REMOTE_FILE}'"

echo "2. Verifying remote checksum..."
LOCAL_SHA="$(sha256sum "$CARD_FILE" | cut -d' ' -f1)"
REMOTE_SHA="$(ssh "$SSH_TARGET" "sha256sum '${HA_REMOTE_FILE}'" | cut -d' ' -f1)"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || die "remote file checksum does not match local build"

echo "3. Updating lovelace resource cache tag..."
HACSTAG="${LOCAL_SHA:0:12}"
RESOURCE_URL="${RESOURCE_URL_BASE}?hacstag=${HACSTAG}"
echo "   New URL: ${RESOURCE_URL}"
node "${PROJECT_DIR}/scripts/update-lovelace-resource.mjs" \
    "$HOMEASSISTANT_URL" "$HOMEASSISTANT_TOKEN" "$RESOURCE_URL" "$CARD_NAME"

echo "4. Verifying HA serves the deployed build..."
HTTP_CODE="$(curl -sSL -o "$WORK_FILE" -w '%{http_code}' \
    -H "Authorization: Bearer ${HOMEASSISTANT_TOKEN}" \
    "${HOMEASSISTANT_URL%/}${RESOURCE_URL}")" \
    || die "failed to fetch ${RESOURCE_URL} from HA"
[[ "$HTTP_CODE" == "200" ]] || die "HA returned HTTP ${HTTP_CODE} for ${RESOURCE_URL}"
SERVED_SHA="$(sha256sum "$WORK_FILE" | cut -d' ' -f1)"
[[ "$SERVED_SHA" == "$LOCAL_SHA" ]] || die "HA is serving a different build than the one deployed"

echo ""
echo "Deployment complete!"
echo "Hard-refresh the HA dashboard (Ctrl+Shift+R) to pick up changes."
