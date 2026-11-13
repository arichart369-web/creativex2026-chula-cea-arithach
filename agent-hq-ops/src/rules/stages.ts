// Stage names match the lead sheet's "ขั้น" column exactly.

export const STAGES = ["ลีดใหม่", "คัดกรอง", "เสนอห้อง", "วิดีโอคอล", "นัดดูจริง", "ปิดดีล", "ปิดไม่ได้"] as const;
export type Stage = (typeof STAGES)[number];

export const OPEN_FLOW: readonly Stage[] = ["ลีดใหม่", "คัดกรอง", "เสนอห้อง", "วิดีโอคอล", "นัดดูจริง"];

export const STAGE_TEAM: Record<Stage, string> = {
  "ลีดใหม่": "รับลีด",
  "คัดกรอง": "คัดกรอง",
  "เสนอห้อง": "ห้องและเจ้าของ",
  "วิดีโอคอล": "วิดีโอคอลดูห้อง",
  "นัดดูจริง": "วิดีโอคอลดูห้อง",
  "ปิดดีล": "ปิดดีล",
  "ปิดไม่ได้": "ปิดดีล",
};

export const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);
export const isOpen = (s: Stage) => s !== "ปิดดีล" && s !== "ปิดไม่ได้";

/** The next stage in the open flow, or null when the lead is closed or waiting to close. */
export function nextStage(s: Stage): Stage | null {
  const i = OPEN_FLOW.indexOf(s);
  if (i < 0) return null;
  return i < OPEN_FLOW.length - 1 ? OPEN_FLOW[i + 1] : "ปิดดีล";
}
