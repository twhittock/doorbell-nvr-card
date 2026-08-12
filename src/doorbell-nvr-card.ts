import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MediaBrowser } from "./media-browser";
import { resolveMediaUrl } from "./media-resolver";
import { downloadUrl } from "./download-media";
import type {
  DoorbellNvrCardConfig,
  HomeAssistant,
  DayData,
  WeekDay,
  DoorbellEvent,
} from "./types";

console.info(
  `%cDOORBELL-NVR-CARD %c0.2.0`,
  "color: green; font-weight: bold;",
  "color: default;"
);

@customElement("doorbell-nvr-card")
export class DoorbellNvrCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public _config?: DoorbellNvrCardConfig;

  @state() private _selectedDate?: Date;
  @state() private _dayData?: DayData | null;
  @state() private _weekDays: WeekDay[] = [];
  @state() private _loading = false;
  @state() private _error?: string;
  @state() private _thumbnailUrls: Map<string, string> = new Map();
  @state() private _playerUrl?: string;
  @state() private _playerTitle?: string;
  private _mediaBrowser?: MediaBrowser;

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
    this._config = { ...DoorbellNvrCard.getStubConfig(), ...config } as DoorbellNvrCardConfig;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has("hass") && this.hass && this._config) {
      if (!this._selectedDate) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        this._selectedDate = d;
        this._loadDay();
      }
    }
  }

  private async _loadDay(): Promise<void> {
    if (!this.hass || !this._config || !this._selectedDate) return;

    this._loading = true;
    this._error = undefined;

    if (!this._mediaBrowser || this._mediaBrowser.hass !== this.hass) {
      this._mediaBrowser = new MediaBrowser(this.hass, this._config.media_path);
    }
    const browser = this._mediaBrowser;

    try {
      const dayData = await browser.getDayData(this._selectedDate);
      this._dayData = dayData;
      if (dayData) {
        await this._resolveThumbnails(dayData);
      }
      await this._loadWeekDays(browser);
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    } finally {
      this._loading = false;
    }
  }

  private async _loadWeekDays(browser: MediaBrowser): Promise<void> {
    if (!this._selectedDate) return;

    const selected = new Date(this._selectedDate);
    selected.setHours(0, 0, 0, 0);
    const days: WeekDay[] = [];

    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(selected);
      d.setDate(d.getDate() + offset);

      let eventCount = 0;
      const result = await browser.browseDay(d);
      if (result?.children) {
        eventCount = result.children.filter(
          (c) =>
            c.media_class !== "directory" && c.title.endsWith(".mp4") && c.title !== "timelapse.mp4"
        ).length;
      }

      days.push({
        date: d,
        eventCount,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
      });
    }

    this._weekDays = days;
  }

  private _prevDay(): void {
    if (!this._selectedDate) return;
    const d = new Date(this._selectedDate);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    this._selectedDate = d;
    this._loadDay();
  }

  private _nextDay(): void {
    if (!this._selectedDate) return;
    const d = new Date(this._selectedDate);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    this._selectedDate = d;
    this._loadDay();
  }

  private _selectDay(date: Date): void {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    this._selectedDate = d;
    this._loadDay();
  }

  private async _resolveThumbnails(dayData: DayData): Promise<void> {
    if (!this.hass) return;
    const urls = new Map<string, string>();
    const jpgEvents = dayData.events.filter((e) => e.jpgFilename);
    await Promise.all(
      jpgEvents.map(async (e) => {
        try {
          const url = await resolveMediaUrl(this.hass!, e.thumbnailMediaId);
          urls.set(e.thumbnailMediaId, url);
        } catch {
          // Skip thumbnails that fail to resolve
        }
      })
    );
    this._thumbnailUrls = urls;
  }

  private async _playMedia(mediaContentId: string, title?: string): Promise<void> {
    if (!this.hass) return;
    this._playerTitle = title;
    try {
      const url = await resolveMediaUrl(this.hass, mediaContentId);
      this._playerUrl = url;
    } catch (e) {
      console.error("[doorbell-nvr] _playMedia failed:", e);
      this._playerUrl = undefined;
      this._playerTitle = undefined;
    }
  }

  private _closePlayer(): void {
    this._playerUrl = undefined;
    this._playerTitle = undefined;
  }

  private _playEvent(event: DoorbellEvent): void {
    this._playMedia(event.videoMediaId, event.mp4Filename.replace(/\.mp4$/, ""));
  }

  private _playTimelapse(): void {
    if (!this._dayData?.timelapseMediaId) return;
    this._playMedia(this._dayData.timelapseMediaId, "Timelapse");
  }

  private async _downloadMedia(mediaContentId: string, filename: string): Promise<void> {
    if (!this.hass) return;
    try {
      const url = await resolveMediaUrl(this.hass, mediaContentId);
      downloadUrl(url, filename);
    } catch (e) {
      console.error("[doorbell-nvr] _downloadMedia failed:", e);
    }
  }

  private _formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  private _formatTime(ts: {
    hour: number;
    minute: number;
    second: number;
  }): string {
    return [ts.hour, ts.minute, ts.second]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  }

  private _renderHeader(): unknown {
    if (!this._selectedDate) return html``;

    const showTimelapse =
      this._config?.show_timelapse &&
      this._dayData?.hasTimelapse &&
      !!this._dayData.timelapseMediaId;

    return html`
      <div class="header">
        <div class="header-nav">
          <button class="nav-btn" @click=${this._prevDay} title="Previous day">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
            </svg>
          </button>
          <span class="date-label">${this._formatDate(this._selectedDate)}</span>
          <button class="nav-btn" @click=${this._nextDay} title="Next day">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor" />
            </svg>
          </button>
        </div>
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
      </div>
    `;
  }

  private _sameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private _renderWeekStrip(): unknown {
    if (this._weekDays.length === 0) return html``;

    const today = new Date();
    const selected = this._selectedDate;

    return html`
      <div class="week-strip">
        ${this._weekDays.map(
          (d) => html`
            <button
              class="week-day ${selected && this._sameDay(d.date, selected) ? "selected" : ""} ${this._sameDay(d.date, today) ? "today" : ""}"
              @click=${() => this._selectDay(d.date)}
            >
              <span class="week-day-label">${d.label}</span>
              <span class="week-day-number">${d.date.getDate()}</span>
              ${d.eventCount > 0
                ? html`<span class="event-badge">${d.eventCount}</span>`
                : html``}
            </button>
          `
        )}
      </div>
    `;
  }

  private _renderEventCard(event: DoorbellEvent): unknown {
    const thumbnailSrc = event.jpgFilename
      ? this._thumbnailUrls.get(event.thumbnailMediaId) || ""
      : "";

    return html`
      <div class="event-card" @click=${() => this._playEvent(event)}>
        <div class="event-thumbnail">
          ${event.jpgFilename && thumbnailSrc
            ? html`<img src="${thumbnailSrc}" alt="${event.mp4Filename}" loading="lazy" />`
            : html`<div class="no-thumbnail">No thumbnail</div>`}
          <div class="play-overlay">
            <svg viewBox="0 0 24 24" width="32" height="32">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </div>
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
        </div>
        <div class="event-time">${this._formatTime(event.timestamp)}</div>
      </div>
    `;
  }

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
                  : html`<div class="event-grid" style="--per-row: ${eventsPerRow}">
                      ${this._dayData.events.map((e) => this._renderEventCard(e))}
                    </div>`
                : html``}
        </div>
      </ha-card>
      ${this._playerUrl
        ? html`
            <div class="player-overlay" @click=${this._closePlayer}>
              <div class="player-dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="player-header">
                  <span class="player-title">${this._playerTitle || ""}</span>
                  <button class="player-close" @click=${this._closePlayer} title="Close">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                <video
                  controls
                  playsinline
                  autoplay
                  src="${this._playerUrl}"
                  @click=${(e: Event) => e.stopPropagation()}
                ></video>
              </div>
            </div>
          `
        : html``}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .card-content {
      padding: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .header-nav {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-btn {
      background: none;
      border: none;
      color: var(--primary-text-color);
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-btn:hover {
      background: var(--secondary-background-color);
    }

    .date-label {
      font-size: 16px;
      font-weight: 500;
      color: var(--primary-text-color);
      min-width: 140px;
      text-align: center;
    }

    .timelapse-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      cursor: pointer;
    }

    .timelapse-btn:hover {
      opacity: 0.9;
    }

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

    .week-strip {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 16px;
    }

    .week-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 4px;
      border: none;
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      border-radius: 8px;
      cursor: pointer;
      flex: 1;
      position: relative;
      font-size: 12px;
    }

    .week-day.selected {
      background: var(--primary-color);
      color: white;
    }

    .week-day.today {
      box-shadow: inset 0 0 0 2px var(--accent-color);
    }

    .week-day.selected.today {
      box-shadow: none;
    }

    .week-day-label {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
    }

    .week-day-number {
      font-size: 14px;
      font-weight: 500;
    }

    .event-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: var(--accent-color);
      color: white;
      font-size: 9px;
      min-width: 14px;
      height: 14px;
      line-height: 14px;
      border-radius: 7px;
      text-align: center;
      padding: 0 3px;
    }

    .event-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(var(--per-row, 3), 1fr);
    }

    @media (max-width: 600px) {
      .event-grid {
        grid-template-columns: 1fr;
      }

      .header {
        flex-wrap: wrap;
        gap: 8px;
      }

      .date-label {
        min-width: auto;
        font-size: 14px;
      }
    }

    .event-card {
      cursor: pointer;
      border-radius: 8px;
      overflow: hidden;
      background: var(--secondary-background-color);
      transition: transform 0.1s ease;
    }

    .event-card:hover {
      transform: scale(1.02);
    }

    .event-thumbnail {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      overflow: hidden;
    }

    .event-thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .no-thumbnail {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--secondary-text-color);
      font-size: 12px;
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
      background: rgba(0, 0, 0, 0.3);
      color: white;
    }

    .event-card:hover .play-overlay {
      opacity: 1;
    }

    .event-time {
      padding: 6px 8px;
      font-size: 13px;
      color: var(--primary-text-color);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }

    .error {
      color: var(--error-color);
      text-align: center;
      padding: 20px;
    }

    .empty {
      color: var(--secondary-text-color);
      text-align: center;
      padding: 40px 0;
      font-size: 14px;
    }

    .player-overlay {
      position: fixed;
      inset: 0;
      z-index: 999;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .player-dialog {
      background: var(--card-background-color, #fff);
      border-radius: var(--ha-border-radius-lg, 16px);
      overflow: hidden;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .player-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--divider-color);
    }

    .player-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .player-close {
      background: none;
      border: none;
      color: var(--primary-text-color);
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .player-close:hover {
      background: var(--secondary-background-color);
    }

    .player-dialog video {
      display: block;
      outline: none;
      max-width: 90vw;
      max-height: calc(90vh - 52px);
      width: 100%;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "doorbell-nvr-card": DoorbellNvrCard;
  }
}

export type { DoorbellNvrCardConfig };