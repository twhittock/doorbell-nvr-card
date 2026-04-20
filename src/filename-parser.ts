import type { ParsedTimestamp, BrowseMediaChild, DoorbellEvent } from "./types";

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

    const bestJpg = matchedJpgs.length > 0 ? matchedJpgs[0] : null;

    events.push({
      mp4Filename: mp4.filename,
      jpgFilename: bestJpg?.filename ?? null,
      timestamp: mp4.ts,
      mediaPath,
      thumbnailMediaId: bestJpg
        ? `media-source://media_source/local/${mediaPath}/${bestJpg.filename}`
        : "",
      videoMediaId: `media-source://media_source/local/${mediaPath}/${mp4.filename}`,
      fileSize: null,
    });
  }

  return events;
}