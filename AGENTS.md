# Doorbell NVR Card — Project Context

## What

Custom Home Assistant Lovelace card that provides an NVR-like browsing experience for the Reolink doorbell's event recordings (MP4 clips + JPG thumbnails + daily timelapses).

## Environment Configuration

All environment-specific values (hostnames, paths, entity IDs, credentials file locations) are in **`local_env.md`** (gitignored). Create it from the structure described below:

| Key | Description |
|-----|-------------|
| `HA_URL` | Home Assistant base URL (e.g. `http://homeassistant:8123`) |
| `HA_SSH_HOST` | SSH alias or hostname for HA host |
| `HA_REMOTE_DIR` | Remote path for card JS file (typically `/config/www/community/doorbell-nvr-card`) |
| `HA_DASHBOARD` | Dashboard name containing the card view |
| `HA_DASHBOARD_VIEW` | View path within the dashboard |
| `HOMEASSISTANT_ENV` | Path to env file exporting `HOMEASSISTANT_URL` and `HOMEASSISTANT_TOKEN` |
| `HA_API_HELPER` | Path to `ha-api` helper script (optional) |
| `RTSP_URL` | Camera RTSP URL (e.g. `rtsp://admin:pass@camera-host:554/h264Preview_01_main`) |
| `DOORBELL_CAMERA_ENTITY` | HA camera entity ID |
| `DOORBELL_*_SENSOR` | HA binary sensor entity IDs for motion/person/visitor/vehicle/pet |

## Deploy Target

- Card JS file deploys to `{HA_REMOTE_DIR}/doorbell-nvr-card.js`
- Registered in `lovelace_resources` via HA WebSocket API (delete old + create new to update cache-busting `?hacstag=`)
- Dashboard: `{HA_DASHBOARD}` → `{HA_DASHBOARD_VIEW}` view

## Data Source

- **HA media_source API**: WebSocket `media_source/browse_media` (no entity_id required)
  - Browse directories: `media-source://media_source/local/security/doorbell/YYYY/MM/DD`
- **Thumbnails**: Resolved via `media_source/resolve_media` WebSocket to get signed URLs with `authSig` tokens
- **Video playback**: Resolved via `media_source/resolve_media`, displayed in a modal overlay with `<video controls playsinline autoplay>` inside the card. The `autoplay` attribute works because the video element is created fresh by Lit when `_playerUrl` changes, and the browser treats the initial load as autoplay-permitted.
- **Direct media URLs** don't work (401) — always use `resolve_media` for auth signing

## File Naming Convention (from Reolink FTP push)

- MP4: `Front garden doorbell_00_YYYYMMDDHHMMSS.mp4` — event recording starts at this timestamp
- JPG: `Front garden doorbell_00_YYYYMMDDHHMMSS.jpg` — thumbnail captured ~5 seconds after MP4 start
- **Timelapse frames**: `timelapse/Front garden doorbell_00-HH-MM.jpg` (in-progress, directory only)
- **Timelapse video**: `timelapse.mp4` at the day level (compiled at 01:00, replaces the timelapse directory)
- **Pairing**: JPG belongs to MP4 with closest earlier timestamp (within ~15s window); some MP4s have 2 JPGs
- **Timelapse detection**: Card looks for `timelapse.mp4` video file (`media_class: "video"`, `can_play: true`) in day directory. A `timelapse/` subdirectory means frames are still being collected — the timelapse button is not shown.

## HA Access

- REST API: Source `HOMEASSISTANT_ENV` for `HOMEASSISTANT_URL` and `HOMEASSISTANT_TOKEN`
- Helper script: `HA_API_HELPER` (optional, see `local_env.md`)
- SSH: `ssh root@{HA_SSH_HOST}`
- Media files: `{HA_REMOTE_DIR}/..` for custom card JS files
- NEVER directly edit `/config/.storage/` files — use WebSocket API

## Build & Deploy

```bash
npm run build          # Build doorbell-nvr-card.js
bash scripts/deploy.sh  # SCP to HA + update lovelace_resources cache tag via WebSocket API
```

The deploy script:
1. SCPs `dist/doorbell-nvr-card.js` to `root@{HA_SSH_HOST}:{HA_REMOTE_DIR}/`
2. Uses HA WebSocket API to delete old resource entry and create new one with updated `?hacstag=` cache-busting query string
3. `ws` npm package is used for WebSocket communication (dev dependency)

**IMPORTANT**: After any code change, you MUST deploy before considering work complete. A change that hasn't been deployed is not done. Run `npm run build && bash scripts/deploy.sh` after every modification. If you skip deploy, tell the user explicitly that the change is not yet deployed.

## Video Playback Architecture

When a user clicks an event thumbnail or the timelapse button:

1. **Resolve media**: Call `media_source/resolve_media` WebSocket to get a signed URL with `authSig` token
2. **Open inline player**: Set `_playerUrl`/`_playerTitle` state, which renders a modal overlay with `<video controls playsinline autoplay>` styled to match HA's native dialog look

The player overlay renders outside `<ha-card>` as a fixed-position modal (z-index 999) with a semi-transparent backdrop. Clicking the backdrop closes the player. The video element uses the resolved signed URL directly.

### Why not HA's native dialog?

HA's `hui-dialog-web-browser-play-media` is a lazy-loaded custom element that requires `show-dialog` events with a `dialogImport` function. Custom cards cannot provide a valid `dialogImport` (HA's internal module paths aren't accessible). The element may not be registered unless the user has visited the Media Browser panel. The inline overlay approach works reliably across all browsers and doesn't depend on HA's internal lazy-loading.

### Mobile playback note

Reolink doorbell MP4s may not be faststart-optimized (moov atom at end). On mobile, the browser must download the entire file before playback starts. This can cause significant delay on mobile. To fix: process files server-side with `ffmpeg -movflags +faststart` after FTP push.

## Technology Stack

- Lit 3 + TypeScript
- Vite + Rollup for single JS file output
- No external runtime dependencies — runs inside HA's session
- HACS-compatible `hacs.json` for future distribution

## Related Files in system/ Repo

Paths are environment-specific — see `local_env.md` for:
- Design spec
- HA machine doc
- Storage machine doc
- Reolink API skill
- HA API skill
- Dashboard config: `/config/.storage/lovelace.{HA_DASHBOARD}` (on HA host, read-only via API)

## Key HA Integration Points

- `go2rtc` integration: loaded, handles camera streaming
- `webrtc` custom component (AlexxIT v3.6.1): installed, provides `custom:webrtc-camera` card
- `media_index` custom component: installed but not configured
- `ha-media-card` HACS card: installed
- `frigate-hass-card` registered in lovelace_resources but JS file missing from disk — effectively broken (causes harmless 404 on dashboard load)

## Known Issues

- **Mobile video slow start**: Reolink MP4s may have moov atom at end. Server-side `ffmpeg -movflags +faststart` post-processing recommended.
- **Network outage sensitivity**: HA's `media_source/browse_media` WebSocket calls hang if the CIFS mount to storage is slow. The card handles this gracefully (error state, retry on navigation).
- **UTC vs local time**: `_selectedDate` uses UTC (`new Date()`), but directory names use local time. This may cause "Path does not exist" errors near midnight.

## Camera Entities

See `local_env.md` for entity IDs and RTSP URL specific to your HA instance.