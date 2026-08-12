# Doorbell NVR Card — Download Buttons

## Overview

Add download capability to the `doorbell-nvr-card` custom Home Assistant Lovelace
card. Users can download event recording MP4s directly from each event card and
download the daily timelapse MP4, without opening the player.

## Problem

The card currently only lets users *play* event recordings and the daily
timelapse via an inline video player overlay. There is no way to save a
recording to the device. This is especially relevant on mobile, where tapping
to play and then saving is awkward.

## Approach

Reuse the existing `media_source/resolve_media` WebSocket flow (already used for
playback) to obtain a signed, authenticated URL for a media file, then trigger a
browser download by creating a temporary `<a download>` element and clicking it.

Because the media is served same-origin from Home Assistant, the `download`
attribute is honored and the browser saves the file under its original filename.

## Data flow

1. User clicks a download button.
2. Card calls `media_source/resolve_media` with the media's `media_content_id`
   (the same ID used for playback) to get a signed `url`.
3. Card creates a temporary `<a href="{url}" download="{filename}">`, appends it
   to the document, clicks it, and removes it.
4. Browser downloads the file with the given filename.

## Changes

### `src/doorbell-nvr-card.ts`

- Add `_downloadMedia(mediaContentId: string, filename: string): Promise<void>`:
  - Guards on `this.hass`.
  - Calls `this.hass.callWS<ResolvedMedia>({ type: "media_source/resolve_media", media_content_id: mediaContentId })`.
  - On success, triggers a browser download of `resolved.url` with the given
    `filename`.
  - On failure, logs the error and does nothing (consistent with `_playMedia`).
- **Event cards** (`_renderEventCard`): add an always-visible, compact download
  icon button positioned in the corner of the thumbnail. The button's click
  handler calls `event.stopPropagation()` so it does not trigger playback, then
  calls `_downloadMedia(event.videoMediaId, event.mp4Filename)`.
- **Timelapse** (`_renderHeader`): add a download icon button beside the existing
  Timelapse play button that calls
  `_downloadMedia(timelapseMediaId, "timelapse.mp4")`.
- Add styles for the event download button (`.event-download-btn`) and the
  timelapse download button (`.timelapse-download-btn`).

### `src/types.ts`

No changes required — reuses the existing `ResolvedMedia` interface.

### Tests

Add tests that verify the download URL-resolution path. Extract the URL
resolution into a small testable helper (a standalone function that, given a
`HomeAssistant` and `media_content_id`, returns the resolved URL), so tests can
assert:

- The correct `media_source/resolve_media` call is made with the right
  `media_content_id`.
- The resolved URL is returned.
- The helper rejects / propagates on resolution failure.

The DOM download trigger itself is a thin, hard-to-unit-test layer and is left
to the card component.

## Error handling

`resolve_media` failures are logged and swallowed — no download is triggered and
no user-visible error interrupts the card. This matches the existing `_playMedia`
behaviour.

## Out of scope

- No changes to the playback player overlay.
- No configuration options for controlling the download buttons; they are always
  available.
- No server-side handling (e.g. faststart re-encode) of downloaded files.
