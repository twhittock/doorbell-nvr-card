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
