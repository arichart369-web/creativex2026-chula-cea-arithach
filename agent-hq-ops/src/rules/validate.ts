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

const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** A real calendar date, today or later. Today is passed in so the rule is testable. */
export function validateFollowUp(date: string, today: string): Errors {
  const d = date.trim();
  const real = ISO.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
  if (!real) return { follow: "ใส่วันที่ติดตาม (ปปปป-ดด-วว)" };
  if (d < today) return { follow: "วันติดตามต้องเป็นวันนี้หรือหลังจากนี้" };
  return {};
}

export interface CloseInput { sign: string; rent: string }

/** Both values are typed by a person; nothing is calculated (FR-07). */
export function validateClose(f: CloseInput): Errors {
  const e: Errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.sign.trim())) e.sign = "ใส่วันเซ็นสัญญา (ปปปป-ดด-วว)";
  if (!/^\d+$/.test(f.rent.trim())) e.rent = "ใส่ค่าเช่าที่ปิดได้เป็นตัวเลข (บาท)";
  return e;
}
