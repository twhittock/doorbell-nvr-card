# Doorbell NVR Card — Download Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add download buttons to each event card and to the timelapse button so users can save event MP4s and the daily timelapse directly from the card.

**Architecture:** Reuse the existing `media_source/resolve_media` WebSocket flow to obtain a signed URL, then trigger a browser download via a temporary `<a download>` element. Extract the URL-resolution into a pure, testable helper module (`media-resolver.ts`) and the DOM download trigger into a thin helper (`download-media.ts`). The card component wires these together with new download buttons.

**Tech Stack:** Lit 3, TypeScript, Vite + Rollup (single JS output), Vitest for testing

---

### Task 1: Create the media URL resolver helper

**Files:**
- Create: `src/media-resolver.ts`
- Test: `tests/media-resolver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveMediaUrl } from "../src/media-resolver";
import type { HomeAssistant } from "../src/types";

function mockHass(responses: Record<string, unknown>): HomeAssistant {
  return {
    callWS: async <T>(msg: Record<string, string>): Promise<T> => {
      const key = msg.media_content_id ?? "";
      if (key in responses) {
        return responses[key] as T;
      }
      throw new Error(`Unexpected callWS: ${key}`);
    },
    callService: async () => {},
    states: {},
  } as unknown as HomeAssistant;
}

describe("resolveMediaUrl", () => {
  it("resolves a media_content_id to a signed URL", async () => {
    const mediaId =
      "media-source://media_source/local/security/doorbell/2026/04/19/Front garden doorbell_00_20260419090013.mp4";
    const hass = mockHass({
      [mediaId]: { url: "http://ha/api/media/abc?authSig=xyz", mime_type: "video/mp4" },
    });

    const url = await resolveMediaUrl(hass, mediaId);
    expect(url).toBe("http://ha/api/media/abc?authSig=xyz");
  });

  it("sends the correct resolve_media message", async () => {
    const mediaId = "media-source://media_source/local/security/doorbell/2026/04/19/timelapse.mp4";
    let captured: Record<string, string> | null = null;
    const hass = {
      callWS: async <T>(msg: Record<string, string>): Promise<T> => {
        captured = msg;
        return { url: "http://ha/api/media/abc", mime_type: "video/mp4" } as T;
      },
      callService: async () => {},
      states: {},
    } as unknown as HomeAssistant;

    await resolveMediaUrl(hass, mediaId);
    expect(captured).not.toBeNull();
    expect(captured!.type).toBe("media_source/resolve_media");
    expect(captured!.media_content_id).toBe(mediaId);
  });

  it("propagates errors when resolution fails", async () => {
    const hass = {
      callWS: async (): Promise<never> => {
        throw new Error("resolve failed");
      },
      callService: async () => {},
      states: {},
    } as unknown as HomeAssistant;

    await expect(
      resolveMediaUrl(hass, "media-source://media_source/local/security/doorbell/2026/04/19/x.mp4")
    ).rejects.toThrow("resolve failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/media-resolver.test.ts`
Expected: FAIL with "Failed to resolve import ... media-resolver" (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
import type { HomeAssistant, ResolvedMedia } from "./types";

export async function resolveMediaUrl(
  hass: HomeAssistant,
  mediaContentId: string
): Promise<string> {
  const resolved = await hass.callWS<ResolvedMedia>({
    type: "media_source/resolve_media",
    media_content_id: mediaContentId,
  });
  return resolved.url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/media-resolver.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/media-resolver.ts tests/media-resolver.test.ts
git commit --trailer "Pre-Commit-Gate=passed" -m "feat: add media URL resolver helper"
```

---

### Task 2: Create the download trigger helper

**Files:**
- Create: `src/download-media.ts`

- [ ] **Step 1: Write the implementation**

```ts
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/download-media.ts
git commit --trailer "Pre-Commit-Gate=passed" -m "feat: add download trigger helper"
```

---

### Task 3: Wire download buttons into the card

**Files:**
- Modify: `src/doorbell-nvr-card.ts`
- Test: `tests/media-resolver.test.ts` (already covers the resolver; no new test needed here)

- [ ] **Step 1: Add imports and the download method**

Add to the imports at the top of `src/doorbell-nvr-card.ts`:

```ts
import { resolveMediaUrl } from "./media-resolver";
import { downloadUrl } from "./download-media";
```

Add a `_downloadMedia` method after `_playTimelapse` (around line 188):

```ts
private async _downloadMedia(mediaContentId: string, filename: string): Promise<void> {
  if (!this.hass) return;
  try {
    const url = await resolveMediaUrl(this.hass, mediaContentId);
    downloadUrl(url, filename);
  } catch (e) {
    console.error("[doorbell-nvr] _downloadMedia failed:", e);
  }
}
```

- [ ] **Step 2: Add a download button to each event card**

In `_renderEventCard` (around line 285), add a download button inside the `.event-thumbnail` div, after the `.play-overlay`:

```ts
<button
  class="event-download-btn"
  title="Download"
  @click=${(e: Event) => {
    e.stopPropagation();
    this._downloadMedia(event.videoMediaId, event.mp4Filename);
  }}
>
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />
  </svg>
</button>
```

- [ ] **Step 3: Add a download button to the timelapse header**

In `_renderHeader`, change the timelapse block (around line 232) to include a download button beside the play button:

```ts
${showTimelapse
  ? html`
      <div class="timelapse-actions">
        <button class="timelapse-btn" @click=${this._playTimelapse}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          Timelapse
        </button>
        <button
          class="timelapse-download-btn"
          title="Download timelapse"
          @click=${() =>
            this._downloadMedia(
              this._dayData!.timelapseMediaId!,
              "timelapse.mp4"
            )}
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />
          </svg>
        </button>
      </div>
    `
  : html``}
```

- [ ] **Step 4: Add styles for the new buttons**

Add to the `static styles` block, after the `.timelapse-btn:hover` rule (around line 414):

```css
.timelapse-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.timelapse-download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--secondary-background-color);
  color: var(--primary-text-color);
  border: none;
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
}

.timelapse-download-btn:hover {
  background: var(--primary-color);
  color: white;
}

.event-download-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
}

.event-download-btn:hover {
  background: var(--primary-color);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test`
Expected: PASS (all existing + new tests)

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: PASS — produces `dist/doorbell-nvr-card.js`

- [ ] **Step 7: Commit**

```bash
git add src/doorbell-nvr-card.ts
git commit --trailer "Pre-Commit-Gate=passed" -m "feat: add download buttons to event cards and timelapse"
```

---

### Task 4: Deploy to Home Assistant

**Files:**
- None (deploy step)

- [ ] **Step 1: Deploy the built card**

Run: `bash scripts/deploy.sh`
Expected: SCPs `dist/doorbell-nvr-card.js` to HA and updates the lovelace resource cache tag via WebSocket.

- [ ] **Step 2: Verify deployment**

Confirm the deploy script output shows the new `?hacstag=` resource registered. Optionally reload the dashboard in a browser and confirm the download buttons render on event cards and beside the Timelapse button.

- [ ] **Step 3: Commit any deploy-related changes (if the script modified tracked files)**

If `scripts/deploy.sh` or `local_env.md` changed, stage and commit them:

```bash
git add -A
git commit --trailer "Pre-Commit-Gate=passed" -m "chore: deploy download buttons to HA"
```

If nothing changed, skip this step.
