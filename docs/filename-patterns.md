# Doorbell Recording Filename Patterns

## Reolink FTP Push Naming Convention

Files arrive via FTP from the Reolink D340P doorbell, configured with AI detection push (people, dog/cat, vehicle, visitor) 24/7.

### Event Files

**MP4 (video recording):**
```
Front garden doorbell_00_YYYYMMDDHHMMSS.mp4
```
- Timestamp = moment detection triggered recording start
- Encoding: H.264, 2560x1920 @ 20fps, variable bitrate (~4096kbps for main stream)
- Size: 7-11MB typical (30s recording)

**JPG (thumbnail):**
```
Front garden doorbell_00_YYYYMMDDHHMMSS.jpg
```
- Timestamp = ~5 seconds after the corresponding MP4 start
- Resolution: 2560x1920 baseline JPEG
- Size: 450-500KB typical

### JPG/MP4 Pairing

The JPG timestamp is consistently offset from the MP4 timestamp by ~5 seconds:

| MP4 Timestamp | JPG Timestamp | Delta |
|---------------|---------------|-------|
| 08:39:22 | 08:39:27 | +5s |
| 09:36:37 | 09:36:43 | +6s |
| 09:30:38 | 09:30:42 | +4s |
| 18:29:56 | 18:30:01 | +5s |
| 12:49:55 | 12:49:59 | +4s |

**Pairing algorithm**: For each JPG, find the MP4 with the closest earlier timestamp (within a 15-second window). This handles:
- Normal 1:1 pairs (most common)
- 1 MP4 → 2 JPGs (occurs at ~16:29:56 → 16:30:01 and 16:30:06)
- Edge case: JPG without a matching MP4 (shouldn't happen but defensive check needed)

```typescript
function pairEvents(mp4s: string[], jpgs: string[]): Event[] {
  // Parse timestamps from filenames
  // For each MP4, collect all JPGs where:
  //   jpgTimestamp > mp4Timestamp AND jpgTimestamp - mp4Timestamp < 15s
  // Sort by timestamp
  return events;
}
```

### Timelapse Files

**Frames** (one per minute during capture hours):
```
timelapse/Front garden doorbell_00-HH-MM.jpg
```
- ~20KB each, captured every minute
- Not relevant for the NVR card (only the compiled video matters)

**Daily video:**
```
timelapse/timelapse.mp4
```
- Compiled daily at 01:00 by `/opt/create_timelapse.sh` on storage LXC 107
- Located at `/mnt/media/security/doorbell/YYYY/MM/DD/timelapse/timelapse.mp4` on storage
- Accessible at `/media/local/security/doorbell/YYYY/MM/DD/timelapse/timelapse.mp4` from HA

### Directory Structure

```
/media/local/security/doorbell/
├── 2025/
│   ├── 02/
│   │   ├── 15/...
│   │   └── ...
│   └── ...
└── 2026/
    ├── 04/
    │   ├── 06/
    │   │   ├── Front garden doorbell_00_20260406083922.mp4
    │   │   ├── Front garden doorbell_00_20260406083927.jpg
    │   │   ├── ...
    │   │   └── timelapse/
    │   │       ├── Front garden doorbell_00-00.jpg
    │   │       ├── ...
    │   │       └── timelapse.mp4
    │   └── ...
    └── ...
```

### URL Encoding

Filenames contain spaces. When constructing media URLs, spaces must be encoded as `%20`:
```
/media/local/security/doorbell/2026/04/19/Front%20garden%20doorbell_00_20260419090013.mp4
```

### Storage Stats (as of 2026-04-19)

- **Total event MP4s**: ~1,580
- **Total storage**: ~29GB
- **Date range**: 2025-02 to present
- **Timelapse days**: 238
- **Typical events per day**: 2-10 (variable)
- **High-activity days**: 10-20 events