import type { BrowseMediaResult, DayData, HomeAssistant } from "./types";
import { pairEvents } from "./filename-parser";

export class MediaBrowser {
  public readonly hass: HomeAssistant;
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