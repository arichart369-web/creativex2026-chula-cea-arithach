import { FEATURES, type FeatureKey } from "../config/status";
import { type Role, can, canMove } from "../rules/roles";
import type { Stage } from "../rules/stages";
import type { Lead } from "../rules/sheet";
import { type CloseInput, type Errors, type NewLeadInput, validateClose, validateLost, validateNewLead } from "../rules/validate";
import { DEMO_LEADS } from "./demo";

// The store boundary. Until a real backend passes its gate, every write returns not_connected
// and the UI shows that message. Nothing here ever reports a success it did not get.

export type WriteResult =
  | { ok: true }
  | { ok: false; status: "not_connected"; message: string }
  | { ok: false; status: "forbidden"; message: string }
  | { ok: false; status: "invalid"; message: string; errors: Errors };

export interface ReadResult { status: "live" | "demo"; leads: Lead[] }

const notConnected = (k: FeatureKey): WriteResult => ({ ok: false, status: "not_connected", message: `${FEATURES[k].label}: ${FEATURES[k].note}` });
const forbidden = (message = "ไม่มีสิทธิ์"): WriteResult => ({ ok: false, status: "forbidden", message });
const invalid = (errors: Errors): WriteResult => ({ ok: false, status: "invalid", message: "ข้อมูลยังไม่ครบหรือไม่ถูกต้อง", errors });

export async function listLeads(): Promise<ReadResult> {
  // A deep copy, so screens cannot change the demo rows.
  return { status: "demo", leads: DEMO_LEADS.map(l => ({ ...l, fields: { ...l.fields } })) };
}

export async function addLead(role: Role, input: NewLeadInput): Promise<WriteResult> {
  const p = can(role, "addLead");
  if (!p.ok) return forbidden(p.reason);
  const e = validateNewLead(input);
  if (Object.keys(e).length) return invalid(e);
  return notConnected("addLead");
}

export async function moveStage(role: Role, lead: Lead, to: Stage): Promise<WriteResult> {
  const p = canMove(role, lead.stage, to);
  if (!p.ok) return forbidden(p.reason);
  return notConnected("moveStage");
}

export async function closeDeal(role: Role, lead: Lead, input: CloseInput): Promise<WriteResult> {
  const p = canMove(role, lead.stage, "ปิดดีล");
  if (!p.ok) return forbidden(p.reason);
  const e = validateClose(input);
  if (Object.keys(e).length) return invalid(e);
  return notConnected("closeDeal");
}

export async function markLost(role: Role, lead: Lead, reason: string): Promise<WriteResult> {
  const p = canMove(role, lead.stage, "ปิดไม่ได้");
  if (!p.ok) return forbidden(p.reason);
  const e = validateLost(reason);
  if (Object.keys(e).length) return invalid(e);
  return notConnected("closeDeal");
}
