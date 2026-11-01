# Skill: Deploy Doorbell NVR Card to Home Assistant

## Overview

Build and deploy the `doorbell-nvr-card` custom Lovelace card to the Home Assistant instance.

## Environment

All hostnames, paths, and entity IDs are in **`local_env.md`** (gitignored, optional). Key variables:

| Key | Description |
|-----|-------------|
| `HA_URL` | Home Assistant base URL (e.g. `http://homeassistant:8123`) |
| `HA_SSH_HOST` | SSH alias or hostname for HA host |
| `HOMEASSISTANT_ENV` | Path to env file exporting `HOMEASSISTANT_URL` and `HOMEASSISTANT_TOKEN` |
| `HA_API_HELPER` | Path to `ha-api` helper script (optional) |

The deploy script resolves credentials without any manual setup from `$HOMEASSISTANT_ENV`, then `<project>/secrets/homeassistant.env`, then `<project>/../system/sysadmin/secrets/homeassistant.env`.

**CRITICAL**: NEVER directly edit `/config/.storage/` files — always use the HA REST API

## Build & Deploy (one command)

```bash
npm run build && bash scripts/deploy.sh
```

The deploy script:
1. SCPs `dist/doorbell-nvr-card.js` to `root@{HA_SSH_HOST}:/config/www/community/doorbell-nvr-card/` via a temp file and atomic rename
2. Verifies the remote SHA-256 matches the local build
3. Uses HA WebSocket API to update (or create) the lovelace resource with a content-hash `?hacstag=` cache-busting query string
4. Re-lists resources and fetches the served URL from HA, verifying the served SHA-256 matches the local build
5. Uses `ws` npm package (dev dependency) for WebSocket communication
6. Prints "Deployment complete!" only after all checks pass

## Verify Deployment

```bash
# Check file exists on HA host:
ssh root@{HA_SSH_HOST} 'ls -la /config/www/community/doorbell-nvr-card/doorbell-nvr-card.js'

# Check file is served:
source $HOMEASSISTANT_ENV
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" \
  "{HA_URL}/hacsfiles/doorbell-nvr-card/doorbell-nvr-card.js" \
  -o /dev/null -w "%{http_code}\n"
# Expected: 200

# Check lovelace_resources registration:
ssh root@{HA_SSH_HOST} 'cat /config/.storage/lovelace_resources' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); [print(i['url']) for i in d['data']['items'] if 'doorbell' in i.get('url','')]"
```

## Update Dashboard

To add the card to the Doorbell view, update the dashboard config via HA REST API:

```bash
# Read current config:
ssh root@{HA_SSH_HOST} 'cat /config/.storage/lovelace.{HA_DASHBOARD}' > /tmp/dashboard_backup.json

# Modify the config to replace the markdown card with the custom card
# (Use jq to modify — see docs/current-dashboard.md for structure)

# Write back via API — need to use the lovelace config endpoint
```

**IMPORTANT**: For modifying dashboard views, prefer the HA UI editor. Direct storage edits risk JSON corruption.

## Rollback

If the card breaks the dashboard:
1. Remove the card from the view via HA UI
2. Restore the original markdown card
3. Optionally remove the resource: HA UI → Settings → Dashboards → Resources → delete doorbell-nvr-card entry
4. Remove the file: `ssh root@{HA_SSH_HOST} 'rm /config/www/community/doorbell-nvr-card/doorbell-nvr-card.js'`

## Cleanup: Remove Broken Frigate Card

The `frigate-hass-card` resource is registered but the JS file doesn't exist on disk. This causes console errors. To clean up:

1. HA UI → Settings → Dashboards → Resources
2. Find `/hacsfiles/frigate-hass-card/frigate-hass-card.js`
3. Delete it
4. Or via API (if supported)

## Testing Media URLs

```bash
source $HOMEASSISTANT_ENV

# Test thumbnail URL:
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" \
  "{HA_URL}/media/local/security/doorbell/2026/04/19/Front%20garden%20doorbell_00_20260419090018.jpg" \
  -o /dev/null -w "%{http_code}\n"
# Expected: 200

# Test video URL:
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" \
  "{HA_URL}/media/local/security/doorbell/2026/04/19/Front%20garden%20doorbell_00_20260419090013.mp4" \
  -o /dev/null -w "%{http_code}\n"
# Expected: 200

# Test browse_media API:
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "{HA_URL}/api/services/media_player/browse_media?return_response" \
  -d '{"entity_id":"media_player.shield","media_content_id":"media-source://media_source/local/security/doorbell/2026/04/19"}' | \
  python3 -m json.tool | head -20
```