import type { Status } from "../config/status";

// What the utility-bar badge says. Config alone is not enough: a build marked live that could
// not read the sheet must say so instead of "ทำงานจริง".
export interface BadgeInput { config: Status; source: "live" | "demo" | "pending"; testSheet: boolean }
export interface Badge { text: string; tone: "live" | "warn" }

export function badgeFor({ config, source, testSheet }: BadgeInput): Badge {
  if (config !== "live") return { text: config === "demo" ? "ระบบ: ข้อมูลสาธิต" : "ระบบ: ยังไม่เชื่อมต่อ", tone: "warn" };
  if (source === "pending") return { text: "ระบบ: กำลังเชื่อมชีต…", tone: "warn" };
  if (source === "demo") return { text: "ระบบ: เชื่อมชีตไม่ได้ (แสดงข้อมูลสาธิต)", tone: "warn" };
  return { text: `ระบบ: ทำงานจริง${testSheet ? " (ชีตทดสอบ)" : ""}`, tone: "live" };
}
