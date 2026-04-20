import { describe, it, expect } from "vitest";
import { MediaBrowser } from "../src/media-browser";
import type { HomeAssistant, BrowseMediaResult } from "../src/types";

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

const dayResponse: BrowseMediaResult = {
  title: "19",
  media_class: "directory",
  media_content_id:
    "media-source://media_source/local/security/doorbell/2026/04/19",
  media_content_type: "directory",
  can_play: false,
  can_expand: true,
  children: [
    {
      title: "timelapse.mp4",
      media_class: "video",
      media_content_type: "video/mp4",
      media_content_id:
        "media-source://media_source/local/security/doorbell/2026/04/17/timelapse.mp4",
      can_play: true,
      can_expand: false,
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
    {
      title: "Front garden doorbell_00_20260419090018.jpg",
      media_class: "image",
      media_content_type: "image/jpeg",
      media_content_id:
        "media-source://media_source/local/security/doorbell/2026/04/19/Front garden doorbell_00_20260419090018.jpg",
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
    expect(result).not.toBeNull();
    expect(result!.title).toBe("19");
    expect(result!.children).toHaveLength(3);
  });

  it("caches day results for past days", async () => {
    let callCount = 0;
    const hass = {
      callWS: async <T>(): Promise<T> => {
        callCount++;
        return dayResponse as T;
      },
      callService: async () => {},
      states: {},
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    const pastDate = new Date(2026, 3, 18);
    await browser.browseDay(pastDate);
    await browser.browseDay(pastDate);
    expect(callCount).toBe(1);
  });

  it("does not cache today — always re-fetches", async () => {
    let callCount = 0;
    const hass = {
      callWS: async <T>(): Promise<T> => {
        callCount++;
        return dayResponse as T;
      },
      callService: async () => {},
      states: {},
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
      callService: async () => {},
      states: {},
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    await browser.browseDay(new Date(2026, 3, 19));
    expect(captured).not.toBeNull();
    expect(captured!.media_content_id).toBe(
      "media-source://media_source/local/security/doorbell/2026/04/19"
    );
    expect(captured!.type).toBe("media_source/browse_media");
  });

  it("returns null on API error", async () => {
    const hass = {
      callWS: async (): Promise<never> => {
        throw new Error("API error");
      },
      callService: async () => {},
      states: {},
    } as unknown as HomeAssistant;
    const browser = new MediaBrowser(hass, "security/doorbell");

    const result = await browser.browseDay(new Date(2026, 3, 19));
    expect(result).toBeNull();
  });
});

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

  it("detects no timelapse when timelapse.mp4 absent", async () => {
    const noTimelapseResponse: BrowseMediaResult = {
      ...dayResponse,
      children: dayResponse.children.filter(
        (c) => c.title !== "timelapse.mp4"
      ),
    };
    const hass = mockHass({
      "media-source://media_source/local/security/doorbell/2026/04/19": noTimelapseResponse,
    });
    const browser = new MediaBrowser(hass, "security/doorbell");
    const dayData = await browser.getDayData(new Date(2026, 3, 19));

    expect(dayData!.hasTimelapse).toBe(false);
    expect(dayData!.timelapseMediaId).toBeNull();
  });
});