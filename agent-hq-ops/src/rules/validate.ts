// Form validation. Each error is keyed by field so the UI can tie it to the input.

export type Errors = Record<string, string>;

export interface NewLeadInput {
  channel: string;
  name: string;
  contact: string;
  budget: string;
  type: string;
  loc: string;
  movein: string;
}

export function validateNewLead(f: NewLeadInput): Errors {
  const e: Errors = {};
  if (!f.channel.trim()) e.channel = "เลือกช่องทางที่ลีดเข้ามา";
  if (!f.name.trim()) e.name = "ใส่ชื่อลูกค้า";
  if (!f.contact.trim()) e.contact = "ใส่ LINE หรือเบอร์โทร";
  if (f.budget.trim() && !/^\d+$/.test(f.budget.trim())) e.budget = "งบต้องเป็นตัวเลขจำนวนเต็ม (บาท)";
  if (f.movein.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(f.movein.trim())) e.movein = "ใช้รูปแบบวันที่ ปปปป-ดด-วว";
  return e;
}

export function validateLost(reason: string): Errors {
  return reason.trim() ? {} : { reason: "ต้องใส่เหตุผลที่ปิดไม่ได้" };
}

export interface CloseInput { sign: string; rent: string }

/** Both values are typed by a person; nothing is calculated (FR-07). */
export function validateClose(f: CloseInput): Errors {
  const e: Errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.sign.trim())) e.sign = "ใส่วันเซ็นสัญญา (ปปปป-ดด-วว)";
  if (!/^\d+$/.test(f.rent.trim())) e.rent = "ใส่ค่าเช่าที่ปิดได้เป็นตัวเลข (บาท)";
  return e;
}
