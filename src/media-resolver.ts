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
