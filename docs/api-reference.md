# Doorbell NVR Card API Reference

## HA Media Browse API

The primary data source for the card. Uses HA's `media_player/browse_media` service.

### Endpoint

```
POST /api/services/media_player/browse_media?return_response
```

### Authentication

Inside HA's Lovelace UI, the user's session cookie handles auth automatically. The card doesn't need to pass tokens — HA serves the API within the authenticated session.

For development/testing from outside HA (e.g., curl), use a long-lived access token:
```bash
source $HOMEASSISTANT_ENV
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" ...
```

See `local_env.md` for `HOMEASSISTANT_ENV` path.

### Browse Directory

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "{HA_URL}/api/services/media_player/browse_media?return_response" \
  -d '{
    "entity_id": "media_player.shield",
    "media_content_id": "media-source://media_source/local/security/doorbell/YYYY/MM/DD"
  }'
```

**Important**: The `entity_id` is required for the API call context but doesn't affect playback. Any `media_player` entity works.

### Response Structure

**Day with compiled timelapse (past day):**
```json
{
  "changed_states": [],
  "service_response": {
    "media_player.shield": {
      "title": "17",
      "media_class": "directory",
      "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/17",
      "children": [
        {
          "title": "timelapse.mp4",
          "media_class": "video",
          "media_content_type": "video/mp4",
          "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/17/timelapse.mp4",
          "can_play": true,
          "can_expand": false
        }
      ]
    }
  }
}
```

**Day with in-progress timelapse (today, frames only):**
```json
{
  "changed_states": [],
  "service_response": {
    "media_player.shield": {
      "title": "19",
      "media_class": "directory",
      "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/19",
      "children": [
        {
          "title": "timelapse",
          "media_class": "directory",
          "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/19/timelapse",
          "can_play": false,
          "can_expand": true
        },
        {
          "title": "Front garden doorbell_00_20260419090013.mp4",
          "media_class": "video",
          "media_content_type": "video/mp4",
          "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/19/Front garden doorbell_00_20260419090013.mp4",
          "can_play": true,
          "can_expand": false,
          "thumbnail": null
        },
        {
          "title": "Front garden doorbell_00_20260419090018.jpg",
          "media_class": "image",
          "media_content_type": "image/jpeg",
          "media_content_id": "media-source://media_source/local/security/doorbell/2026/04/19/Front garden doorbell_00_20260419090018.jpg",
          "can_play": true,
          "can_expand": false,
          "thumbnail": null
        }
      ]
    }
  }
}
```

**Note**: `thumbnail` is always `null` for local media files. The card must construct thumbnail URLs manually.

### Browse Levels

| Path | Returns |
|------|---------|
| `.../doorbell` | Year directories (2025, 2026) |
| `.../doorbell/YYYY` | Month directories (02, 03, ..., 12) |
| `.../doorbell/YYYY/MM` | Day directories (01, 02, ..., 31) |
| `.../doorbell/YYYY/MM/DD` | Event files + `timelapse.mp4` (if compiled) or `timelapse/` directory (if in-progress) |
| `.../doorbell/YYYY/MM/DD/timelapse` | Timelapse frames (only present before daily compilation) |

**Timelapse states:** After the daily cron compiles `timelapse.mp4` (01:00), `timelapse/` directory is replaced by `timelapse.mp4` at the day level as a playable video. Before compilation, only the `timelapse/` frame directory exists (not playable).

## Direct Media URLs

For serving thumbnails and video playback, use HA's media endpoint:

### Format

```
/media/local/security/doorbell/YYYY/MM/DD/filename.ext
```

### Examples

```
/media/local/security/doorbell/2026/04/19/Front%20garden%20doorbell_00_20260419090013.mp4
/media/local/security/doorbell/2026/04/19/Front%20garden%20doorbell_00_20260419090018.jpg
/media/local/security/doorbell/2026/04/19/timelapse/timelapse.mp4
```

### Auth Behavior

- **Inside HA session** (Lovelace card): Works automatically with session cookie
- **External (curl)**: Requires `Authorization: Bearer $TOKEN` header
- **Unauthenticated**: Returns `401 Unauthorized`

### Verified File Types

- JPG files: 2560x1920 baseline JPEG, ~450-500KB each
- MP4 files: ISO Media MP4 v2 (H.264), 7-11MB each
- Timelapse MP4: varies, typically <30MB

## Lovelace Resources API

### List resources
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "{HA_URL}/api/config/config_entries/entry" | jq '.'
```

Not directly useful — lovelace_resources are in storage, not config entries.

### Read lovelace resources
```bash
ssh root@{HA_SSH_HOST} 'cat /config/.storage/lovelace_resources' | python3 -m json.tool
```

### Add resource (via HA API — do NOT edit storage files directly)
Use the HA frontend or the `lovelace/resources` API endpoint to add custom card JS:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "{HA_URL}/api/lovelace/resources" \
  -d '{"res_type":"module","url":"/hacsfiles/doorbell-nvr-card/doorbell-nvr-card.js"}'
```

If that endpoint doesn't work (it may not exist in all HA versions), add via the storage API pattern or HA UI manually.

## Dashboard Configuration

The cameras dashboard config is at `/config/.storage/lovelace.{HA_DASHBOARD}` on the HA host. To update:

```bash
# Via ha-api script (preferred):
ha-api post lovelace/config/{HA_DASHBOARD} '<json>'

# Or via direct API:
source $HOMEASSISTANT_ENV
curl -s -H "Authorization: Bearer $HOMEASSISTANT_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "{HA_URL}/api/lovelace/config/{HA_DASHBOARD}" \
  -d '<config_json>'
```

**CRITICAL**: NEVER directly edit `/config/.storage/` files — always use the REST API.