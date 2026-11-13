import type { Lead } from "../rules/sheet";

// Demo rows only. They carry no prices, budgets or real people, and every screen that shows them
// is labelled "ข้อมูลสาธิต". Follow-up dates are examples for the due-queue screen.
export const DEMO_LEADS: Lead[] = [
  { row: 2, id: "ตัวอย่าง-01", stage: "ลีดใหม่", fields: { channel: "LINE OA", name: "ลูกค้าตัวอย่าง 1", follow: "2026-11-10" } },
  { row: 3, id: "ตัวอย่าง-02", stage: "คัดกรอง", fields: { channel: "Facebook", name: "ลูกค้าตัวอย่าง 2", level: "HOT", follow: "2026-11-12" } },
  { row: 4, id: "ตัวอย่าง-03", stage: "เสนอห้อง", fields: { channel: "Instagram", name: "ลูกค้าตัวอย่าง 3", level: "WARM" } },
  { row: 5, id: "ตัวอย่าง-04", stage: "วิดีโอคอล", fields: { channel: "เว็บไซต์", name: "ลูกค้าตัวอย่าง 4", follow: "2026-12-01" } },
  { row: 6, id: "ตัวอย่าง-05", stage: "นัดดูจริง", fields: { channel: "TikTok", name: "ลูกค้าตัวอย่าง 5", level: "HOT" } },
  { row: 7, id: "ตัวอย่าง-06", stage: "ปิดไม่ได้", fields: { channel: "LINE OA", name: "ลูกค้าตัวอย่าง 6", note: "ตัวอย่างเหตุผล" } },
];
