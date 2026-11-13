import { COLS, type Field } from "../rules/sheet";
import type { Role } from "../rules/roles";

// One row per successful write to a cell. Personal fields are never copied into the log:
// their before/after values are replaced with a marker.

export const AUDIT_HEAD = ["เวลา", "ผู้ทำ", "บทบาท", "การกระทำ", "รหัสลีด", "คอลัมน์", "ค่าเดิม", "ค่าใหม่"];
export const PII_FIELDS: readonly Field[] = ["name", "contact", "note"];
export const REDACTED = "(ข้อมูลส่วนตัว)";

export interface AuditEntry {
  at: string;
  actor: string;
  role: Role;
  action: "addLead" | "moveStage" | "closeDeal" | "markLost" | "setFollowUp";
  leadId: string;
  field: Field;
  before: string;
  after: string;
}

export function auditRow(e: AuditEntry): string[] {
  const pii = PII_FIELDS.includes(e.field);
  return [e.at, e.actor, e.role, e.action, e.leadId, COLS[e.field], pii && e.before ? REDACTED : e.before, pii && e.after ? REDACTED : e.after];
}
