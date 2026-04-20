# Doorbell NVR Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom Lovelace card that provides NVR-like browsing of Reolink doorbell event recordings in Home Assistant.

**Architecture:** Single Lit 3 component for all UI rendering, with pure TypeScript modules for data logic (media browsing, filename parsing, JPG/MP4 pairing). Browsing uses `media_source/browse_media` websocket (no entity_id needed). Playback delegates to HA's browser media player via `media_player.play_media`.

**Tech Stack:** Lit 3, TypeScript, Vite + Rollup (single JS output), Vitest for testing

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `hacs.json`
- Create: `src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "doorbell-nvr-card",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lit": "^3.2.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/doorbell-nvr-card.ts"),
      formats: ["es"],
      fileName: () => "doorbell-nvr-card.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create hacs.json**

```json
{
  "name": "Doorbell NVR Card",
  "content_in_root": false,
  "filename": "doorbell-nvr-card.js",
  "country": []
}
```

- [ ] **Step 5: Create src/types.ts**

```typescript
export interface DoorbellNvrCardConfig {
  type: string;
  media_path: string;
  show_timelapse?: boolean;
  events_per_row?: number;
}

export interface BrowseMediaChild {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  can_play: boolean;
  can_expand: boolean;
  thumbnail: string | null;
  children_media_class: string | null;
}

export interface BrowseMediaResult {
  title: string;
  media_class: string;
  media_content_id: string;
  media_content_type: string;
  can_play: boolean;
  can_expand: boolean;
  children: BrowseMediaChild[];
  children_media_class: string | null;
  thumbnail: string | null;
}

export interface ParsedTimestamp {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  date: Date;
}

export interface DoorbellEvent {
  mp4Filename: string;
  jpgFilename: string | null;
  timestamp: ParsedTimestamp;
  mediaPath: string;
  thumbnailUrl: string;
  videoUrl: string;
  fileSize: number | null;
}

export interface DayData {
  date: Date;
  events: DoorbellEvent[];
  hasTimelapse: boolean;
  timelapseMediaId: string | null;
}

export interface WeekDay {
  date: Date;
  eventCount: number;
  isToday: boolean;
  isSelected: boolean;
  label: string;
}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

- [ ] **Step 7: Verify build works**

Run: `npx vite build`
Expected: Build completes (may warn about missing entry point — that's fine for now)

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold project with Lit 3, Vite, TypeScript"
```

---

### Task 2: Filename Parser — Timestamp Extraction

**Files:**
- Create: `src/filename-parser.ts`
- Create: `tests/filename-parser.test.ts`

- [ ] **Step 1: Write failing test for timestamp extraction**

```typescript
import { describe, it, expect } from "vitest";
import { parseFilenameTimestamp } from "../src/filename-parser";

describe("parseFilenameTimestamp", () => {
  it("extracts timestamp from MP4 filename", () => {
    const result = parseFilenameTimestamp(
      "Front garden doorbell_00_20260419090013.mp4"
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.month).toBe(4);
    expect(result!.day).toBe(19);
    expect(result!.hour).toBe(9);
    expect(result!.minute).toBe(0);
    expect(result!.second).toBe(13);
  });

  it("extracts timestamp from JPG filename", () => {
    const result = parseFilenameTimestamp(
      "Front garden doorbell_00_20260419090018.jpg"
    );
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.second).toBe(18);
  });

  it("returns null for filename without timestamp pattern", () => {
    const result = parseFilenameTimestamp("timelapse.mp4");
    expect(result).toBeNull();
  });

  it("parses midnight timestamp", () => {
    const result = parseFilenameTimestamp(
      "Front garden doorbell_00_20260401000000.mp4"
    );
    expect(result).not.toBeNull();
    expect(result!.hour).toBe(0);
    expect(result!.minute).toBe(0);
    expect(result!.second).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/filename-parser.test.ts`
Expected: FAIL — `parseFilenameTimestamp` not defined

- [ ] **Step 3: Implement parseFilenameTimestamp**

```typescript
import type { ParsedTimestamp } from "./types";

const FILENAME_TIMESTAMP_RE = /_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\./;

export function parseFilenameTimestamp(
  filename: string
): ParsedTimestamp | null {
  const match = filename.match(FILENAME_TIMESTAMP_RE);
  if (!match) return null;

  const [, yStr, moStr, dStr, hStr, miStr, sStr] = match;
  const year = parseInt(yStr, 10);
  const month = parseInt(moStr, 10);
  const day = parseInt(dStr, 10);
  const hour = parseInt(hStr, 10);
  const minute = parseInt(miStr, 10);
  const second = parseInt(sStr, 10);

  const date = new Date(year, month - 1, day, hour, minute, second);

  return { year, month, day, hour, minute, second, date };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/filename-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filename-parser.ts tests/filename-parser.test.ts && git commit -m "feat: add filename timestamp parser with tests"
```

---

### Task 3: Filename Parser — JPG/MP4 Pairing

**Files:**
- Modify: `src/filename-parser.ts`
- Modify: `tests/filename-parser.test.ts`

- [ ] **Step 1: Write failing test for event pairing**

```typescript
import { pairEvents } from "../src/filename-parser";
import type { BrowseMediaChild } from "../src/types";

function makeChild(filename: string, mediaClass: string): BrowseMediaChild {
  return {
    title: filename,
    media_class: mediaClass,
    media_content_type: mediaClass === "video" ? "video/mp4" : "image/jpeg",
    media_content_id: `media-source://media_source/local/security/doorbell/2026/04/19/${filename}`,
    can_play: true,
    can_expand: false,
    thumbnail: null,
    children_media_class: null,
  };
}

describe("pairEvents", () => {
  it("pairs one MP4 with one JPG (5s offset)", () => {
    const children = [
      makeChild("Front garden doorbell_00_20260419090013.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419090018.jpg", "image"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(1);
    expect(events[0].mp4Filename).toBe(
      "Front garden doorbell_00_20260419090013.mp4"
    );
    expect(events[0].jpgFilename).toBe(
      "Front garden doorbell_00_20260419090018.jpg"
    );
  });

  it("pairs MP4 with closest earlier JPG when multiple exist (1 MP4, 2 JPGs)", () => {
    const children = [
      makeChild("Front garden doorbell_00_20260419162956.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419163001.jpg", "image"),
      makeChild("Front garden doorbell_00_20260419163006.jpg", "image"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(1);
    expect(events[0].jpgFilename).toBe(
      "Front garden doorbell_00_20260419163001.jpg"
    );
  });

  it("handles MP4 with no matching JPG", () => {
    const children = [
      makeChild("Front garden doorbell_00_20260419120000.mp4", "video"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(1);
    expect(events[0].jpgFilename).toBeNull();
  });

  it("handles multiple independent events", () => {
    const children = [
      makeChild("Front garden doorbell_00_20260419090013.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419090018.jpg", "image"),
      makeChild("Front garden doorbell_00_20260419123038.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419123042.jpg", "image"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(2);
  });

  it("ignores JPGs without matching MP4 (orphan JPGs >15s away)", () => {
    const children = [
      makeChild("Front garden doorbell_00_20260419090013.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419090018.jpg", "image"),
      makeChild("Front garden doorbell_00_20260419100100.jpg", "image"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(1);
    expect(events[0].jpgFilename).toBe(
      "Front garden doorbell_00_20260419090018.jpg"
    );
  });

  it("skips directories and non-media children", () => {
    const children: BrowseMediaChild[] = [
      {
        title: "timelapse",
        media_class: "directory",
        media_content_type: "",
        media_content_id:
          "media-source://media_source/local/security/doorbell/2026/04/19/timelapse",
        can_play: false,
        can_expand: true,
        thumbnail: null,
        children_media_class: null,
      },
      makeChild("Front garden doorbell_00_20260419090013.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419090018.jpg", "image"),
    ];
    const events = pairEvents(children, "security/doorbell/2026/04/19");
    expect(events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/filename-parser.test.ts`
Expected: FAIL — `pairEvents` not defined

- [ ] **Step 3: Implement pairEvents**

Add to `src/filename-parser.ts`:

```typescript
import type { BrowseMediaChild, DoorbellEvent, ParsedTimestamp } from "./types";

const PAIRING_WINDOW_SECONDS = 15;

export function pairEvents(
  children: BrowseMediaChild[],
  mediaPath: string
): DoorbellEvent[] {
  const mp4s: { filename: string; ts: ParsedTimestamp }[] = [];
  const jpgs: { filename: string; ts: ParsedTimestamp }[] = [];

  for (const child of children) {
    if (child.media_class === "directory") continue;
    const ts = parseFilenameTimestamp(child.title);
    if (!ts) continue;

    if (child.title.endsWith(".mp4")) {
      mp4s.push({ filename: child.title, ts });
    } else if (child.title.endsWith(".jpg")) {
      jpgs.push({ filename: child.title, ts });
    }
  }

  mp4s.sort((a, b) => a.ts.date.getTime() - b.ts.date.getTime());
  jpgs.sort((a, b) => a.ts.date.getTime() - b.ts.date.getTime());

  const events: DoorbellEvent[] = [];

  for (const mp4 of mp4s) {
    const mp4Time = mp4.ts.date.getTime();
    const matchedJpgs = jpgs.filter((j) => {
      const delta = (j.ts.date.getTime() - mp4Time) / 1000;
      return delta > 0 && delta <= PAIRING_WINDOW_SECONDS;
    });

    const bestJpg =
      matchedJpgs.length > 0 ? matchedJpgs[0] : null;

    const encodedMediaPath = mediaPath
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
    const encodedMp4 = encodeURIComponent(mp4.filename);

    events.push({
      mp4Filename: mp4.filename,
      jpgFilename: bestJpg?.filename ?? null,
      timestamp: mp4.ts,
      mediaPath,
      thumbnailUrl: bestJpg
        ? `/media/local/${encodedMediaPath}/${encodeURIComponent(bestJpg.filename)}`
        : "",
      videoUrl: `/media/local/${encodedMediaPath}/${encodedMp4}`,
      fileSize: null,
    });
  }

  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/filename-parser.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/filename-parser.ts tests/filename-parser.test.ts && git commit -m "feat: add JPG/MP4 event pairing with 15s window"
```

---

### Task 4: Media Browser — Browse + Cache

**Files:**
- Create: `src/media-browser.ts`
- Create: `tests/media-browser.test.ts`

- [ ] **Step 1: Write failing test for browseMedia**

```typescript
import { describe, it, expect } from "vitest";
import { MediaBrowser } from "../src/media-browser";
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
  } as unknown as HomeAssistant;
}

const dayResponse = {
  title: "19",
  media_class: "directory",
  media_content_id:
    "media-source://media_source/local/security/doorbell/2026/04/19",
  media_content_type: "directory",
  can_play: false,
  can_expand: true,
  children: [
    {
      title: "timelapse",
      media_class: "directory",
      media_content_type: "",
      media_content_id:
        "media-source://media_source/local/security/doorbell/2026/04/19/timelapse",
      can_play: false,
      can_expand: true,
      thumbnail: null,
      children_media_class: null,
    },
    {
      title: "Front garden doorbell_00_20260419090013.mp4",
      media_class: "video",
      media_content_type: "video/mp4",
      media_content_id:
        "media-source://media_source/local/security/doorbell/2026/04/19/Front garden doorbell_00_20260419090013.mp4",
      can_play: true,
      can_expand: false,
      thumbnail: null,
      children_media_class: null,
    },
  ],
  children_media_class: null,
  thumbnail: null,
};

describe("MediaBrowser", () => {
  it("browses a day directory and returns BrowseMediaResult", async () => {
    const hass = mockHass({
      "media-source://media_source/local/security/doorbell/2026/04/19": dayResponse,
    });
    const browser = new MediaBrowser(hass, "security/doorbell");
    const result = await browser.browseDay(new Date(2026, 3, 19));
    expect(result.title).toBe("19");
    expect(result.children).toHaveLength(2);
  });

  it("caches day results — second call returns cached data", async () => {
    let callCount = 0;
    const hass = {
      callWS: async <T>(msg: Record<string, string>): Promise<T> => {
        callCount++;
        return dayResponse as T;
      },
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    await browser.browseDay(new Date(2026, 3, 19));
    await browser.browseDay(new Date(2026, 3, 19));
    expect(callCount).toBe(1);
  });

  it("does not cache today — always re-fetches", async () => {
    let callCount = 0;
    const hass = {
      callWS: async <T>(): Promise<T> => {
        callCount++;
        return dayResponse as T;
      },
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    const today = new Date();
    await browser.browseDay(today);
    await browser.browseDay(today);
    expect(callCount).toBe(2);
  });

  it("constructs correct media_content_id from date", async () => {
    let captured: Record<string, string> | null = null;
    const hass = {
      callWS: async <T>(msg: Record<string, string>): Promise<T> => {
        captured = msg;
        return dayResponse as T;
      },
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    await browser.browseDay(new Date(2026, 3, 19));
    expect(captured).not.toBeNull();
    expect(captured!.media_content_id).toBe(
      "media-source://media_source/local/security/doorbell/2026/04/19"
    );
    expect(captured!.type).toBe("media_source/browse_media");
  });

  it("browseDay returns null on API error", async () => {
    const hass = {
      callWS: async (): Promise<never> => {
        throw new Error("API error");
      },
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    const result = await browser.browseDay(new Date(2026, 3, 19));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/media-browser.test.ts`
Expected: FAIL — `MediaBrowser` not defined

- [ ] **Step 3: Implement MediaBrowser**

```typescript
import type { BrowseMediaResult, HomeAssistant } from "./types";

export class MediaBrowser {
  private hass: HomeAssistant;
  private basePath: string;
  private cache: Map<string, BrowseMediaResult> = new Map();

  constructor(hass: HomeAssistant, basePath: string) {
    this.hass = hass;
    this.basePath = basePath;
  }

  async browseDay(date: Date): Promise<BrowseMediaResult | null> {
    const key = this.dayKey(date);
    const isToday = this.isToday(date);

    if (!isToday && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const mediaContentId = `media-source://media_source/local/${this.basePath}/${this.formatDatePath(date)}`;

    try {
      const result = await this.hass.callWS<BrowseMediaResult>({
        type: "media_source/browse_media",
        media_content_id: mediaContentId,
      });
      this.cache.set(key, result);
      return result;
    } catch {
      return null;
    }
  }

  private dayKey(date: Date): string {
    return this.formatDatePath(date);
  }

  private formatDatePath(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  }

  private isToday(date: Date): boolean {
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }
}
```

- [ ] **Step 4: Add HomeAssistant type to types.ts**

Add to `src/types.ts`:

```typescript
export interface HomeAssistant {
  callWS<T>(msg: Record<string, string>): Promise<T>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown>
  ): Promise<unknown>;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/media-browser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/media-browser.ts src/types.ts tests/media-browser.test.ts && git commit -m "feat: add media browser with day caching and browse_media websocket"
```

---

### Task 5: Media Browser — Day Data Assembly

**Files:**
- Modify: `src/media-browser.ts`
- Modify: `tests/media-browser.test.ts`

- [ ] **Step 1: Write failing test for getDayData**

```typescript
describe("MediaBrowser.getDayData", () => {
  it("assembles DayData with events and timelapse detection", async () => {
    const hass = mockHass({
      "media-source://media_source/local/security/doorbell/2026/04/19": dayResponse,
    });
    const browser = new MediaBrowser(hass, "security/doorbell");
    const dayData = await browser.getDayData(new Date(2026, 3, 19));

    expect(dayData).not.toBeNull();
    expect(dayData!.events).toHaveLength(1);
    expect(dayData!.events[0].mp4Filename).toBe(
      "Front garden doorbell_00_20260419090013.mp4"
    );
    expect(dayData!.hasTimelapse).toBe(true);
  });

  it("returns null when browseDay returns null", async () => {
    const hass = mockHass({});
    const browser = new MediaBrowser(hass, "security/doorbell");
    const dayData = await browser.getDayData(new Date(2026, 3, 19));
    expect(dayData).toBeNull();
  });

  it("detects no timelapse when timelapse directory absent", async () => {
    const noTimelapseResponse = {
      ...dayResponse,
      children: dayResponse.children.filter(
        (c: { media_class: string }) => c.media_class !== "directory"
      ),
    };
    const hass = mockHass({
      "media-source://media_source/local/security/doorbell/2026/04/19": noTimelapseResponse,
    });
    const browser = new MediaBrowser(hass, "security/doorbell");
    const dayData = await browser.getDayData(new Date(2026, 3, 19));

    expect(dayData!.hasTimelapse).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/media-browser.test.ts`
Expected: FAIL — `getDayData` not defined on MediaBrowser

- [ ] **Step 3: Implement getDayData**

Add to `src/media-browser.ts`:

```typescript
import { pairEvents } from "./filename-parser";
import type { DayData } from "./types";

export class MediaBrowser {
  // ... existing methods ...

  async getDayData(date: Date): Promise<DayData | null> {
    const result = await this.browseDay(date);
    if (!result) return null;

    const children = result.children;
    const mediaPath = `${this.basePath}/${this.formatDatePath(date)}`;

    const events = pairEvents(children, mediaPath);

    const timelapseVideo = children.find(
      (c) => c.title === "timelapse.mp4" && c.media_class === "video"
    );

    return {
      date,
      events,
      hasTimelapse: !!timelapseVideo,
      timelapseMediaId: timelapseVideo
        ? timelapseVideo.media_content_id
        : null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/media-browser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media-browser.ts tests/media-browser.test.ts && git commit -m "feat: add getDayData assembling events and timelapse from browse results"
```

---

### Task 6: Card Component — Scaffold + Config

**Files:**
- Create: `src/doorbell-nvr-card.ts`

- [ ] **Step 1: Write the card class with config and registration**

```typescript
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { DoorbellNvrCardConfig, HomeAssistant } from "./types";

console.info(
  `%cDOORBELL-NVR-CARD %c0.1.0`,
  "color: green; font-weight: bold;",
  "color: default;"
);

@customElement("doorbell-nvr-card")
export class DoorbellNvrCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public _config?: DoorbellNvrCardConfig;

  static getStubConfig(): Record<string, unknown> {
    return {
      media_path: "security/doorbell",
      show_timelapse: true,
      events_per_row: 3,
    };
  }

  setConfig(config: DoorbellNvrCardConfig): void {
    if (!config.media_path) {
      throw new Error("media_path is required");
    }
    this._config = { ...DoorbellNvrCard.getStubConfig(), ...config };
  }

  protected render(): unknown {
    if (!this.hass || !this._config) {
      return html`<ha-card>Loading...</ha-card>`;
    }
    return html`<ha-card>Doorbell NVR Card</ha-card>`;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "doorbell-nvr-card": DoorbellNvrCard;
  }
}

export type { DoorbellNvrCardConfig };
```

- [ ] **Step 2: Verify card builds**

Run: `npm run build`
Expected: Build produces `dist/doorbell-nvr-card.js`

- [ ] **Step 3: Commit**

```bash
git add src/doorbell-nvr-card.ts && git commit -m "feat: add card component scaffold with config and registration"
```

---

### Task 7: Card Component — Day View Rendering

**Files:**
- Modify: `src/doorbell-nvr-card.ts`

- [ ] **Step 1: Add state properties and initial data loading**

Add to `DoorbellNvrCard` class — properties, constructor, and data loading:

```typescript
import { MediaBrowser } from "./media-browser";
import type { DayData, WeekDay } from "./types";

@customElement("doorbell-nvr-card")
export class DoorbellNvrCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public _config?: DoorbellNvrCardConfig;

  @property({ state: true }) private _selectedDate: Date = new Date();
  @property({ state: true }) private _dayData: DayData | null = null;
  @property({ state: true }) private _weekDays: WeekDay[] = [];
  @property({ state: true }) private _loading = false;
  @property({ state: true }) private _error: string | null = null;

  private _mediaBrowser: MediaBrowser | null = null;

  protected updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.hass && this._config) {
      if (!this._mediaBrowser) {
        this._mediaBrowser = new MediaBrowser(
          this.hass,
          this._config.media_path
        );
        this._loadDay(this._selectedDate);
      }
    }
  }

  private async _loadDay(date: Date): Promise<void> {
    if (!this._mediaBrowser) return;
    this._loading = true;
    this._error = null;
    this._selectedDate = date;

    try {
      const dayData = await this._mediaBrowser.getDayData(date);
      this._dayData = dayData;
      await this._loadWeekDays(date);
    } catch {
      this._error = "Failed to load events";
    } finally {
      this._loading = false;
    }
  }

  private async _loadWeekDays(centerDate: Date): Promise<void> {
    if (!this._mediaBrowser) return;

    const days: WeekDay[] = [];
    const dayMs = 86400000;
    const startOfWeek = new Date(
      centerDate.getTime() - 3 * dayMs
    );

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek.getTime() + i * dayMs);
      const dayData = await this._mediaBrowser.getDayData(d);
      days.push({
        date: d,
        eventCount: dayData?.events.length ?? 0,
        isToday: this._isToday(d),
        isSelected: this._isSameDay(d, centerDate),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
      });
    }

    this._weekDays = days;
  }

  private _isToday(d: Date): boolean {
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  private _isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
```

- [ ] **Step 2: Add render method with full day view**

Replace the stub render method:

```typescript
protected render(): unknown {
  if (!this.hass || !this._config) {
    return html`<ha-card>Loading...</ha-card>`;
  }

  const eventsPerRow = this._config.events_per_row ?? 3;

  return html`
    <ha-card>
      <div class="card-content">
        ${this._renderHeader()}
        ${this._renderWeekStrip()}
        ${this._loading
          ? html`<div class="loading"><ha-circular-progress active></ha-circular-progress></div>`
          : this._error
            ? html`<div class="error">${this._error}</div>`
            : this._dayData
              ? this._dayData.events.length === 0
                ? html`<div class="empty">No events found for this day</div>`
                : html`<div class="event-grid" style="grid-template-columns: repeat(${eventsPerRow}, 1fr)">
                    ${this._dayData.events.map((e) => this._renderEventCard(e))}
                  </div>`
              : html``
        }
      </div>
    </ha-card>
  `;
}
```

- [ ] **Step 3: Add header, week strip, and event card sub-renderers**

```typescript
private _renderHeader(): unknown {
  const dateStr = this._selectedDate.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const showTimelapse = this._config?.show_timelapse && this._dayData?.hasTimelapse;

  return html`
    <div class="header">
      <div class="date-nav">
        <ha-icon-button
          .path=${"M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"}
          @click=${this._prevDay}
          label="Previous day"
        ></ha-icon-button>
        <span class="date-label">${dateStr}</span>
        <ha-icon-button
          .path=${"M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"}
          @click=${this._nextDay}
          label="Next day"
        ></ha-icon-button>
      </div>
      ${showTimelapse
        ? html`<ha-button @click=${this._playTimelapse}>
            <ha-icon icon="mdi:play-speed"></ha-icon> Timelapse
          </ha-button>`
        : ""}
    </div>
  `;
}

private _renderWeekStrip(): unknown {
  return html`
    <div class="week-strip">
      ${this._weekDays.map(
        (wd) => html`
          <button
            class="week-day ${wd.isSelected ? "selected" : ""} ${wd.isToday ? "today" : ""}"
            @click=${() => this._loadDay(wd.date)}
          >
            <span class="day-label">${wd.label}</span>
            <span class="day-number">${wd.date.getDate()}</span>
            ${wd.eventCount > 0
              ? html`<span class="event-count">${wd.eventCount}</span>`
              : ""}
          </button>
        `
      )}
    </div>
  `;
}

private _renderEventCard(event: DoorbellEvent): unknown {
  const timeStr = `${String(event.timestamp.hour).padStart(2, "0")}:${String(event.timestamp.minute).padStart(2, "0")}:${String(event.timestamp.second).padStart(2, "0")}`;

  return html`
    <div class="event-card" @click=${() => this._playEvent(event)}>
      <div class="thumbnail">
        ${event.jpgFilename
          ? html`<img src=${event.thumbnailUrl} loading="lazy" alt=${timeStr} />`
          : html`<div class="no-thumbnail">No thumbnail</div>`}
      </div>
      <div class="event-info">
        <span class="event-time">${timeStr}</span>
        <span class="event-play">&#9654;</span>
      </div>
    </div>
  `;
}

private _prevDay(): void {
  const prev = new Date(this._selectedDate.getTime() - 86400000);
  this._loadDay(prev);
}

private _nextDay(): void {
  const next = new Date(this._selectedDate.getTime() + 86400000);
  this._loadDay(next);
}

private _playEvent(event: DoorbellEvent): void {
  if (!this.hass) return;
  const mediaContentId = `media-source://media_source/local/${event.mediaPath}/${event.mp4Filename}`;
  this.hass.callService("media_player", "play_media", {
    entity_id: "media_player.browser",
    media_content_type: "video/mp4",
    media_content_id: mediaContentId,
  });
}

private _playTimelapse(): void {
  if (!this.hass || !this._dayData?.timelapseMediaId) return;
  this.hass.callService("media_player", "play_media", {
    entity_id: "media_player.browser",
    media_content_type: "video/mp4",
    media_content_id: this._dayData.timelapseMediaId,
  });
}
```

- [ ] **Step 4: Add CSS styles**

```typescript
static styles = css`
  :host {
    display: block;
  }
  .card-content {
    padding: 16px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .date-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .date-label {
    font-size: 1.1em;
    font-weight: 500;
  }
  .week-strip {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 4px;
  }
  .week-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 4px 8px;
    cursor: pointer;
    min-width: 44px;
    color: var(--primary-text-color);
    opacity: 0.6;
  }
  .week-day:hover {
    background: var(--secondary-background-color);
  }
  .week-day.selected {
    opacity: 1;
    background: var(--primary-color);
    color: var(--text-primary-color);
    border-radius: 8px;
  }
  .week-day.today:not(.selected) {
    opacity: 0.9;
    font-weight: 600;
  }
  .day-label {
    font-size: 0.7em;
    text-transform: uppercase;
  }
  .day-number {
    font-size: 1em;
    font-weight: 500;
  }
  .event-count {
    font-size: 0.6em;
    background: var(--accent-color);
    color: var(--text-primary-color);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .event-grid {
    display: grid;
    gap: 12px;
  }
  .event-card {
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    background: var(--secondary-background-color);
    transition: transform 0.1s;
  }
  .event-card:hover {
    transform: scale(1.02);
  }
  .thumbnail img {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    display: block;
  }
  .no-thumbnail {
    width: 100%;
    aspect-ratio: 4/3;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--disabled-text-color);
    color: var(--text-primary-color);
    font-size: 0.8em;
  }
  .event-info {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 0.85em;
  }
  .event-time {
    color: var(--primary-text-color);
  }
  .event-play {
    opacity: 0.6;
  }
  .loading,
  .error,
  .empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--secondary-text-color);
  }
  .error {
    color: var(--error-color);
  }
`;
```

- [ ] **Step 5: Verify card builds**

Run: `npm run build`
Expected: Build produces `dist/doorbell-nvr-card.js` with no errors

- [ ] **Step 6: Commit**

```bash
git add src/doorbell-nvr-card.ts && git commit -m "feat: add full day view with header, week strip, event grid, playback"
```

---

### Task 8: Build Verification + Deploy Test

**Files:**
- Modify: `scripts/deploy.sh` (already exists)

- [ ] **Step 1: Run full build and verify output**

Run: `npm run build && ls -la dist/`
Expected: `dist/doorbell-nvr-card.js` exists and is a single JS file

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit any fixes**

If any issues found in steps 1-2, fix and commit.

---

## Self-Review Checklist

**Spec coverage:**
- Data source (media_source/browse_media websocket): Tasks 4-5
- Filename parsing + JPG/MP4 pairing: Tasks 2-3
- Day view with header, week strip, event grid: Task 7
- Playback via media_player.play_media: Task 7
- Timelapse button: Task 7
- Loading/error/empty states: Task 7
- Sliding 7-day week strip: Task 7
- Card config (media_path, show_timelapse, events_per_row): Task 6
- Caching (past days cached, today always fresh): Task 4
- Project structure (single component + data modules): Tasks 1-7
- Build + deploy: Task 8

**Placeholder scan:** No TBDs, TODOs, or "implement later" patterns. All code is complete.

**Type consistency:** `DoorbellEvent`, `DayData`, `WeekDay`, `BrowseMediaChild`, `BrowseMediaResult`, `ParsedTimestamp`, `HomeAssistant`, `DoorbellNvrCardConfig` — all defined in `types.ts` and used consistently across modules. `pairEvents` takes `BrowseMediaChild[]` and `string`, returns `DoorbellEvent[]`. `MediaBrowser.getDayData` returns `DayData | null`. `MediaBrowser.browseDay` returns `BrowseMediaResult | null`. All consistent.