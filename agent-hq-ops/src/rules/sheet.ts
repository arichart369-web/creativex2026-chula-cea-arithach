import { type Stage, isStage } from "./stages";

// Column headers of the "ลีด" tab, as the current middle-agent-hq.html reads them.
export const COLS = {
  id: "รหัสลีด", date: "วันที่เข้า", time: "เวลาเข้า", channel: "ช่องทาง", name: "ชื่อลูกค้า", contact: "ติดต่อ (LINE/เบอร์)",
  budget: "งบต่อเดือน (฿)", type: "ประเภทห้อง", loc: "ทำเล / สถานี", movein: "วันย้ายเข้า", level: "ระดับ", stage: "ขั้น",
  resp: "ตอบแรก (นาที)", call: "วันวิดีโอคอล", view: "วันดูจริง", sign: "วันเซ็นสัญญา", rent: "ค่าเช่าที่ปิดได้ (฿)",
  follow: "ติดตามครั้งถัดไป", note: "หมายเหตุ / เหตุผลปิดไม่ได้",
} as const;

export type Field = keyof typeof COLS;

export interface Lead {
  row: number; // 1-based sheet row
  id: string;
  stage: Stage;
  fields: Partial<Record<Field, string>>;
}

export interface ParseResult { leads: Lead[]; missing: string[]; skipped: number }

/** Parse a values grid (first row = headers). Rows without an id or with an unknown stage are skipped, never guessed. */
export function parseSheet(values: string[][]): ParseResult {
  const [head = [], ...rows] = values;
  const ix = {} as Record<Field, number>;
  const missing: string[] = [];
  for (const k of Object.keys(COLS) as Field[]) {
    ix[k] = head.indexOf(COLS[k]);
    if (ix[k] < 0 && (k === "id" || k === "stage")) missing.push(COLS[k]);
  }
  if (missing.length) return { leads: [], missing, skipped: rows.length };
  const leads: Lead[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    const id = (r[ix.id] ?? "").trim();
    const st = (r[ix.stage] ?? "").trim();
    if (!id || !isStage(st)) { skipped++; return; }
    const fields: Partial<Record<Field, string>> = {};
    for (const k of Object.keys(COLS) as Field[]) if (ix[k] >= 0 && r[ix[k]] != null && r[ix[k]] !== "") fields[k] = String(r[ix[k]]);
    leads.push({ row: i + 2, id, stage: st, fields });
  });
  return { leads, missing, skipped };
}

/** FR-05: before writing to a row, the id read back from that row must match. */
export function rowStillMatches(readBackId: string | undefined, expectedId: string): boolean {
  return (readBackId ?? "").trim() === expectedId;
}

/** Leads whose follow-up date is today or earlier and still open, oldest first (FR-08). */
export function dueFollowUps(leads: Lead[], today: string): Lead[] {
  return leads
    .filter(l => l.stage !== "ปิดดีล" && l.stage !== "ปิดไม่ได้" && !!l.fields.follow && l.fields.follow <= today)
    .sort((a, b) => (a.fields.follow! < b.fields.follow! ? -1 : a.fields.follow! > b.fields.follow! ? 1 : 0));
}
