// The only place that says whether a feature is live, demo or not connected.
// Everything in the UI reads from here; nothing else hard-codes a status.

export type Status = "live" | "demo" | "not_connected";

export interface FeatureStatus {
  status: Status;
  label: string;
  note: string;
}

export type FeatureKey = "leadSheet" | "addLead" | "moveStage" | "closeDeal" | "followUp" | "auditLog" | "roles";

const RELEASE: Record<FeatureKey, FeatureStatus> = {
  leadSheet: { status: "demo", label: "ชีตลีด", note: "แสดงข้อมูลตัวอย่าง ยังไม่ได้อ่านชีตจริง" },
  addLead: { status: "not_connected", label: "เพิ่มลีด", note: "ยังไม่ได้เชื่อมการเขียนลงชีต" },
  moveStage: { status: "not_connected", label: "เลื่อนขั้น", note: "ยังไม่ได้เชื่อมการเขียนลงชีต" },
  closeDeal: { status: "not_connected", label: "ปิดดีล / ปิดไม่ได้", note: "ยังไม่ได้เชื่อมการเขียนลงชีต" },
  followUp: { status: "not_connected", label: "นัดติดตาม", note: "ยังไม่ได้เชื่อมการเขียนลงชีต" },
  auditLog: { status: "not_connected", label: "บันทึกการเปลี่ยนแปลง", note: "ยังไม่มีแท็บ \"บันทึก\" ในชีต" },
  roles: { status: "demo", label: "บทบาท", note: "สลับบทบาทได้เพื่อทดลองเท่านั้น ยังไม่ยืนยันตัวตน" },
};

/**
 * True only in the `e2e-live` test build (vite --mode e2e-live), which runs the live path
 * against a fake in-page connector. That build is never published; the artifact e2e checks
 * the publish build still says not_connected.
 */
export const E2E_LIVE = import.meta.env.MODE === "e2e-live";

/**
 * True only in a build made with VITE_LIVE=1 and a VITE_SHEET_ID: the build published to the
 * owner's TEST sheet (npm run build:test-sheet). The repo default and the plain build stay off.
 */
export const TEST_SHEET_LIVE = import.meta.env.VITE_LIVE === "1" && !!import.meta.env.VITE_SHEET_ID;

const allLive = (note: string) =>
  Object.fromEntries(Object.entries(RELEASE).map(([k, v]) => [k, { ...v, status: "live", note }])) as Record<FeatureKey, FeatureStatus>;

export const FEATURES: Record<FeatureKey, FeatureStatus> = E2E_LIVE
  ? allLive("ทดสอบกับชีตจำลอง (build ทดสอบ)")
  : TEST_SHEET_LIVE
    ? { ...allLive("เชื่อมกับชีตทดสอบ ไม่ใช่ชีตลีดจริง"), roles: RELEASE.roles }
    : RELEASE;

export const STATUS_TEXT: Record<Status, string> = {
  live: "ทำงานจริง",
  demo: "ข้อมูลสาธิต",
  not_connected: "ยังไม่เชื่อมต่อ",
};

/** Overall system state for the utility-bar badge: the weakest status wins. */
export function systemStatus(features: Record<string, FeatureStatus> = FEATURES): Status {
  // The role switcher is labelled "ทดลอง" on its own; it says nothing about where the data comes from.
  const all = Object.entries(features).filter(([k]) => k !== "roles").map(([, f]) => f.status);
  if (all.every(s => s === "live")) return "live";
  if (all.some(s => s === "live")) return "demo";
  return all.includes("demo") ? "demo" : "not_connected";
}
