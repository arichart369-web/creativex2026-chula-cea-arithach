import { type Stage, isOpen, nextStage } from "./stages";

export type Role = "viewer" | "agent" | "lead";
export const ROLE_TEXT: Record<Role, string> = { viewer: "ผู้ชม", agent: "เอเจนต์", lead: "หัวหน้า" };

export type Action = "addLead" | "moveStage" | "closeDeal" | "markLost" | "setFollowUp";

export interface Check { ok: boolean; reason?: string }

const DENY = (reason: string): Check => ({ ok: false, reason });

/** Permission rule from the PRD (FR-03): viewer reads only; agent adds and moves one step; lead closes. */
export function can(role: Role, action: Action): Check {
  if (role === "viewer") return DENY("บทบาทผู้ชมดูได้อย่างเดียว");
  if ((action === "closeDeal" || action === "markLost") && role !== "lead") return DENY("เฉพาะหัวหน้าที่ปิดดีลหรือบันทึกปิดไม่ได้");
  return { ok: true };
}

/** Agent and lead may set the next follow-up date on an open lead (FR-08). */
export function canFollowUp(role: Role, stage: Stage): Check {
  const base = can(role, "setFollowUp");
  if (!base.ok) return base;
  return isOpen(stage) ? { ok: true } : DENY("ลีดนี้ปิดแล้ว");
}

/** Whether `role` may move a lead from `from` to `to` (one step forward only; closing goes through closeDeal). */
export function canMove(role: Role, from: Stage, to: Stage): Check {
  const base = can(role, "moveStage");
  if (!base.ok) return base;
  if (!isOpen(from)) return DENY("ลีดนี้ปิดแล้ว");
  if (to === "ปิดไม่ได้") return can(role, "markLost");
  if (to === "ปิดดีล") return can(role, "closeDeal");
  if (nextStage(from) !== to) return DENY("เลื่อนได้ทีละหนึ่งขั้นเท่านั้น");
  return { ok: true };
}
