import { describe, it, expect } from "vitest";
import { parseFilenameTimestamp, pairEvents } from "../src/filename-parser";
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

  it("uses earliest JPG when MP4 has 2 matching JPGs", () => {
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

  it("orders events most recent first", () => {
    const childrenSourcedOutOfOrder = [
      makeChild("Front garden doorbell_00_20260419123038.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419090013.mp4", "video"),
      makeChild("Front garden doorbell_00_20260419180000.mp4", "video"),
    ];
    const events = pairEvents(
      childrenSourcedOutOfOrder,
      "security/doorbell/2026/04/19"
    );
    expect(events.map((e) => e.mp4Filename)).toEqual([
      "Front garden doorbell_00_20260419180000.mp4",
      "Front garden doorbell_00_20260419123038.mp4",
      "Front garden doorbell_00_20260419090013.mp4",
    ]);
  });

  it("ignores orphan JPGs that have no MP4 within 15s window", () => {
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