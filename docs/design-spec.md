# Doorbell NVR Card — Design Specification

## Problem

The HA Cameras dashboard's Doorbell view has only a live camera feed and two markdown links to today's/yesterday's media directories. HA's built-in media browser shows doorbell recordings with:
- No thumbnails (the `.jpg` files exist but aren't used as thumbnails)
- Truncated filenames making events indistinguishable
- No date navigation beyond manual URL hacking
- No way to quickly play events or timelapses

The `frigate-hass-card` was installed but the JS file is missing from disk, and it requires a Frigate server backend we don't have.

## Solution

Build a custom Lovelace card (`custom:doorbell-nvr-card`) that provides an NVR-like browsing experience for the Reolink doorbell's FTP-pushed event recordings.

## Architecture

### Approach: Single Component + Data Modules

One Lit component handles all rendering, with pure TypeScript modules for data logic. This keeps the card simple while making the data layer independently testable.

The card's UI is modest — a header, week strip, and event grid — and doesn't warrant full Lit component boundaries per section. The real complexity is in API calls, filename parsing, and JPG/MP4 pairing, which are best as pure TS modules.

### Data Source

The card uses HA's **`media_source/browse_media` websocket command** to enumerate the directory structure. This is the same API the HA frontend media browser uses — it talks directly to the `media_source` integration, no `media_player` entity required.

```typescript
hass.callWS({
  type: "media_source/browse_media",
  media_content_id: "media-source://media_source/local/security/doorbell/YYYY/MM/DD"
})
```

Returns a `BrowseMediaSource` object with `title`, `media_class`, `can_play`, `can_expand`, and `children`.

**No `entity_id` is needed.** The `media_player/browse_media` service call (which does require an `entity_id`) is a different API that routes through a specific media player entity. We don't need it — `media_source/browse_media` browses the media source directly.

For thumbnail URLs, the card constructs direct paths:
- Thumbnails: `/media/local/security/doorbell/YYYY/MM/DD/{filename}.jpg`

These URLs are served by HA's built-in media server with authentication (session-based, works automatically inside HA).

### Media Playback

The card plays videos inline using a modal overlay with `<video controls playsinline autoplay>`. When a user clicks an event thumbnail or the timelapse button:

1. **Resolve media**: Call `media_source/resolve_media` WebSocket to get a signed URL with `authSig` token
2. **Open player**: Set `_playerUrl`/`_playerTitle` state, which renders a modal overlay with the video element

The `autoplay` attribute works because the video element is created fresh by Lit when `_playerUrl` changes from undefined to a URL, and the browser treats the initial load as autoplay-permitted.

The player overlay renders outside `<ha-card>` as a fixed-position modal (z-index 999) with a semi-transparent backdrop. Clicking the backdrop closes the player.

#### Why not HA's native dialog?

HA's `hui-dialog-web-browser-play-media` is a lazy-loaded custom element that requires `show-dialog` events with a `dialogImport` function. Custom cards cannot provide a valid `dialogImport` (HA's internal module paths aren't accessible). The element may not be registered unless the user has visited the Media Browser panel. The inline overlay approach works reliably across all browsers and doesn't depend on HA's internal lazy-loading.

#### Why not `media_player.play_media`?

The initial implementation used `media_player.play_media` with `entity_id: "media_player.browser"`. This proved unreliable — the browser entity may not exist, and the call fails silently. The inline player approach works without any external entity dependency.

**Note**: The timelapse path is `YYYY/MM/DD/timelapse.mp4` (video file at day level), NOT `YYYY/MM/DD/timelapse/timelapse.mp4`.

### File Naming Pattern

Files follow a consistent convention from the Reolink FTP push:
- **MP4**: `Front garden doorbell_00_YYYYMMDDHHMMSS.mp4` — recording starts at detection
- **JPG**: `Front garden doorbell_00_YYYYMMDDHHMMSS.jpg` — captured ~5 seconds after MP4 start
- **Timelapse**: `timelapse.mp4` at day level (compiled daily) + `timelapse/` frame directory (in-progress only)

**Pairing algorithm**: Each JPG belongs to the MP4 with the closest earlier timestamp (within a 15-second window). The MP4 timestamp is the canonical event time. Some MP4s may have 2 JPGs (use the earliest JPG as the thumbnail).

### Card Technology

- **Framework**: Lit 3 + TypeScript
- **Build**: Vite with Rollup output (single JS file)
- **Distribution**: Deploy to `/config/www/community/doorbell-nvr-card/` on HA
- **Registration**: Add to `lovelace_resources` via HA REST API
- **No external runtime dependencies**: Everything runs inside HA's authenticated session

### Dashboard Integration

The card replaces the markdown card in the `dashboard_cameras` dashboard's `doorbell` view. The live `picture-entity` card stays.

## Views

### Day View (Default)

```
+------------------------------------------------------+
| [<] Thu 19 Apr 2026 [>]     [Timelapse ▶]            |
+------------------------------------------------------+
| ←  Mon  Tue  Wed  *Thu*  Fri  Sat  Sun  →            |
|      ·    ·    3·    ·    ·    ·                     |
+------------------------------------------------------+
| 09:00 ┌──────────────┐ 09:30 ┌──────────────┐        |
|       │  [thumbnail]  │       │  [thumbnail]  │        |
|       │  09:00:13     │       │  09:30:38     │        |
|       │  ▶ 11MB       │       │  ▶ 7MB        │        |
|       └──────────────┘       └──────────────┘        |
|                                                        |
| 12:49 ┌──────────────┐                                 |
|       │  [thumbnail]  │                                 |
|       │  12:49:55     │                                 |
|       │  ▶ 7MB        │                                 |
|       └──────────────┘                                 |
+------------------------------------------------------+
```

- **Date navigation**: Arrow buttons (`<`/`>`) advance/retreat one day
- **Week strip**: Sliding 7-day window centered on the selected day. Each day shows a count badge. Clicking a day loads that day's events. The strip shifts by one day at a time when navigating, keeping context around the selected date.
- **Thumbnail cards**: Event time extracted from filename, JPG thumbnail displayed, MP4 file size shown
- **Click to play**: Calls `media_player.play_media` on `media_player.browser` — HA opens its built-in modal media player
- **Timelapse button**: Shown only when `timelapse.mp4` video exists at day level (`media_class: "video"`, `can_play: true`). A `timelapse/` directory (in-progress frames) is NOT playable and does NOT show the button.
- **Auto-select today**: Card defaults to today's date on load

### Live Feed

Not part of this card. The existing `custom:webrtc-camera` and `picture-entity` cards handle live view. The NVR card focuses on historical events and timelapses.

### States

- **Loading**: Simple spinner while fetching directory data
- **Error**: Inline message on API failure (e.g., "Unable to load events. Check that the media source is available.")
- **Empty day**: "No events found for this day"
- No skeleton placeholders or toast notifications — keep it simple

## Card Configuration

```yaml
type: custom:doorbell-nvr-card
media_path: security/doorbell        # Path under /media/local/
show_timelapse: true                  # Show timelapse button per day
events_per_row: 3                     # Grid columns
```

Note: no `media_player_entity` config needed. Browsing uses `media_source/browse_media` websocket (no entity). Playback uses `media_player.browser` (HA's built-in browser media player, always available).

## Data Flow

```
1. Card loads → set today's date → call media_source/browse_media for today
2. Parse response → build event list (MP4s paired with JPGs)
3. Render: header, week strip (fetch counts for 7 days in parallel), event grid
4. User clicks day arrow or week strip day → call media_source/browse_media for that day
5. User clicks thumbnail → call media_player.play_media → HA opens modal player
6. User clicks timelapse → call media_player.play_media with timelapse URI → HA opens modal player
```

## Performance Considerations

- Cache the directory listing per day (events don't change for past days)
- Lazy-load thumbnails as they scroll into view (Intersection Observer)
- Week strip event counts fetched in parallel (7 websocket calls on load, or fewer when sliding)
- No pagination needed — most days have 2-10 events, max ~20

## Project Structure

```
doorbell-nvr-card/
├── src/
│   ├── doorbell-nvr-card.ts    # Main Lit component (all UI)
│   ├── media-browser.ts        # media_source/browse_media websocket client
│   ├── filename-parser.ts      # Parse Reolink filenames + JPG/MP4 pairing
│   └── types.ts                 # Shared TypeScript interfaces
├── hacs.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── scripts/deploy.sh
```

## Testing Strategy

- **`filename-parser.ts`**: Unit tests for timestamp extraction from filenames, JPG/MP4 pairing (1:1, 1:2, edge cases like orphan JPGs)
- **`media-browser.ts`**: Unit tests for websocket response parsing, cache behavior
- **`doorbell-nvr-card.ts`**: Integration-level testing if needed via Lit's fixture pattern, but data modules are the priority

## Deployment Steps

1. Build the card: `npm run build` → produces `doorbell-nvr-card.js`
2. Copy to HA: `scp doorbell-nvr-card.js root@{HA_SSH_HOST}:/config/www/community/doorbell-nvr-card/` (see `local_env.md`)
3. Register in HA: Add to `lovelace_resources` via REST API (URL: `/hacsfiles/doorbell-nvr-card/doorbell-nvr-card.js`, type: JavaScript module)
4. Update dashboard: Replace markdown card with `custom:doorbell-nvr-card` config in the Doorbell view
5. Hard-refresh browser (Ctrl+Shift+R)

## Known Risks

1. **media_player.browser availability**: The card depends on `media_player.browser` existing for playback. This is HA's built-in browser media player and is always present when accessing HA from a browser. If unavailable (unlikely), the `play_media` call silently fails — no crash in the card.

2. **HA Auth for media files**: The `/media/local/...` URLs require auth. Inside HA's Lovelace, the user's session cookie handles this automatically.

3. **Large directories**: Daily directories have 2-20 events. Week-level browsing requires 7 parallel websocket calls. Acceptable.

4. **CIFS mount reliability**: If the CIFS mount to storage drops, the media browser returns empty results. The card shows "No events found" — no crash.

5. **File naming**: The naming pattern (`Front garden doorbell_00_YYYYMMDDHHMMSS.ext`) comes from Reolink FTP push. If the camera name changes, the prefix changes. The parser handles this dynamically by not hardcoding the prefix.