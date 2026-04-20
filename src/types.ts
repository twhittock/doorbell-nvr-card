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
  thumbnailMediaId: string;
  videoMediaId: string;
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
  label: string;
}

export interface HomeAssistant {
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown>
  ): Promise<unknown>;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
}

export interface ResolvedMedia {
  url: string;
  mime_type: string;
}