import { FEATURES, type FeatureKey, type FeatureStatus } from "../config/status";
import { type Role, can, canMove } from "../rules/roles";
import type { Stage } from "../rules/stages";
import { COLS, type Field, type Lead, parseSheet, rowStillMatches } from "../rules/sheet";
import { type CloseInput, type Errors, type NewLeadInput, validateClose, validateLost, validateNewLead } from "../rules/validate";
import { type AuditEntry, auditRow } from "./audit";
import { DEMO_LEADS } from "./demo";
import { AUDIT_TAB, LEAD_TAB, type SheetClient, colA1 } from "./sheetClient";

// The store boundary. A write reaches the sheet only when its feature AND the audit log are
// marked live in config and a client is present; otherwise it returns not_connected.
// Nothing here reports a success the sheet did not give.

export type WriteResult =
  | { ok: true; leadId: string }
  | { ok: false; status: "not_connected" | "forbidden" | "conflict" | "error"; message: string }
  | { ok: false; status: "invalid"; message: string; errors: Errors }
  | { ok: false; status: "partial"; message: string; written: Field[] };

export interface ReadResult { status: "live" | "demo"; leads: Lead[]; full: boolean; skipped: number }

export const LEAD_RANGE = `${LEAD_TAB}!A1:X1000`;
const MAX_ROWS = 1000;

export interface StoreDeps {
  statuses?: Record<FeatureKey, FeatureStatus>;
  client?: SheetClient;
  actor?: string;
  now?: () => Date;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createStore(deps: StoreDeps = {}) {
  const statuses = deps.statuses ?? FEATURES;
  const client = deps.client;
  const actor = deps.actor ?? "ไม่ระบุตัวตน (ทดลอง)";
  const now = deps.now ?? (() => new Date());

  const forbidden = (message = "ไม่มีสิทธิ์"): WriteResult => ({ ok: false, status: "forbidden", message });
  const invalid = (errors: Errors): WriteResult => ({ ok: false, status: "invalid", message: "ข้อมูลยังไม่ครบหรือไม่ถูกต้อง", errors });

  /** The not_connected result for `k`, or null when the write may go to the sheet. */
  function gate(k: FeatureKey): WriteResult | null {
    for (const f of [k, "auditLog"] as const) {
      if (statuses[f].status !== "live") return { ok: false, status: "not_connected", message: `${statuses[f].label}: ${statuses[f].note}` };
    }
    if (!client) return { ok: false, status: "not_connected", message: "ยังไม่ได้ตั้งค่าตัวเชื่อมชีต" };
    return null;
  }

  async function headerIndex(c: SheetClient): Promise<Record<Field, number>> {
    const [head = []] = await c.read(`${LEAD_TAB}!1:1`);
    const ix = {} as Record<Field, number>;
    for (const k of Object.keys(COLS) as Field[]) ix[k] = head.indexOf(COLS[k]);
    if (ix.id < 0 || ix.stage < 0) throw new Error(`ไม่พบหัวคอลัมน์ "${COLS.id}" หรือ "${COLS.stage}" ในแท็บ ${LEAD_TAB}`);
    return ix;
  }

  async function audit(c: SheetClient, entries: AuditEntry[]): Promise<void> {
    if (entries.length) await c.append(`${AUDIT_TAB}!A1`, entries.map(auditRow));
  }

  /** FR-05 + FR-04: re-read the row, check id and stage, write each cell, then log every written cell. */
  async function writeCells(role: Role, action: AuditEntry["action"], lead: Lead, changes: Partial<Record<Field, string>>): Promise<WriteResult> {
    const c = client!;
    let ix: Record<Field, number>, row: string[];
    try {
      ix = await headerIndex(c);
      [row = []] = await c.read(`${LEAD_TAB}!${lead.row}:${lead.row}`);
    } catch (e) {
      return { ok: false, status: "error", message: "อ่านชีตไม่สำเร็จ: " + msg(e) };
    }
    if (!rowStillMatches(row[ix.id], lead.id))
      return { ok: false, status: "conflict", message: `แถว ${lead.row} ไม่ใช่ลีด ${lead.id} แล้ว (ชีตอาจถูกเรียงใหม่) โหลดข้อมูลใหม่แล้วลองอีกครั้ง` };
    if ((row[ix.stage] ?? "").trim() !== lead.stage)
      return { ok: false, status: "conflict", message: `ลีด ${lead.id} ถูกเปลี่ยนขั้นเป็น "${row[ix.stage] ?? ""}" แล้ว โหลดข้อมูลใหม่แล้วลองอีกครั้ง` };

    const written: Field[] = [];
    const entries: AuditEntry[] = [];
    const at = `${ymd(now())} ${hm(now())}`;
    for (const [k, v] of Object.entries(changes) as [Field, string][]) {
      if (ix[k] < 0) return { ok: false, status: written.length ? "partial" : "error", message: `ไม่พบคอลัมน์ "${COLS[k]}"`, written } as WriteResult;
      try {
        await c.update(`${LEAD_TAB}!${colA1(ix[k])}${lead.row}`, [[v]]);
      } catch (e) {
        if (!written.length) return { ok: false, status: "error", message: "เขียนชีตไม่สำเร็จ: " + msg(e) };
        await audit(c, entries).catch(() => {});
        return { ok: false, status: "partial", message: `เขียนได้บางช่อง (${written.map(f => COLS[f]).join(", ")}) แล้วล้มที่ "${COLS[k]}": ${msg(e)}`, written };
      }
      written.push(k);
      entries.push({ at, actor, role, action, leadId: lead.id, field: k, before: row[ix[k]] ?? "", after: v });
    }
    try {
      await audit(c, entries);
    } catch (e) {
      return { ok: false, status: "partial", message: "เขียนชีตแล้ว แต่บันทึกการเปลี่ยนแปลงไม่สำเร็จ: " + msg(e), written };
    }
    return { ok: true, leadId: lead.id };
  }

  return {
    async listLeads(): Promise<ReadResult> {
      if (statuses.leadSheet.status === "live" && client) {
        const r = parseSheet(await client.read(LEAD_RANGE));
        if (r.missing.length) throw new Error(`ไม่พบหัวคอลัมน์: ${r.missing.join(", ")}`);
        return { status: "live", leads: r.leads, full: r.leads.length + r.skipped >= MAX_ROWS - 1, skipped: r.skipped };
      }
      return { status: "demo", leads: DEMO_LEADS.map(l => ({ ...l, fields: { ...l.fields } })), full: false, skipped: 0 };
    },

    async addLead(role: Role, input: NewLeadInput): Promise<WriteResult> {
      const p = can(role, "addLead");
      if (!p.ok) return forbidden(p.reason);
      const e = validateNewLead(input);
      if (Object.keys(e).length) return invalid(e);
      const g = gate("addLead");
      if (g) return g;
      const c = client!;
      let grid: string[][];
      try { grid = await c.read(LEAD_RANGE); } catch (err) { return { ok: false, status: "error", message: "อ่านชีตไม่สำเร็จ: " + msg(err) }; }
      const head = grid[0] ?? [];
      const ix = (k: Field) => head.indexOf(COLS[k]);
      if (ix("id") < 0 || ix("stage") < 0) return { ok: false, status: "error", message: `ไม่พบหัวคอลัมน์ "${COLS.id}" หรือ "${COLS.stage}"` };
      // Same id format the current page uses: L-0001, L-0002, …
      const max = grid.slice(1).reduce((m, r) => { const x = /^L-(\d+)$/i.exec((r[ix("id")] ?? "").trim()); return x ? Math.max(m, Number(x[1])) : m; }, 0);
      const id = "L-" + String(max + 1).padStart(4, "0");
      const t = now();
      const values: Partial<Record<Field, string>> = { id, date: ymd(t), time: hm(t), channel: input.channel, name: input.name, contact: input.contact, budget: input.budget, type: input.type, loc: input.loc, movein: input.movein, stage: "ลีดใหม่" };
      const row = head.map(h => { const k = (Object.keys(COLS) as Field[]).find(f => COLS[f] === h); return k ? (values[k] ?? "").trim() : ""; });
      try { await c.append(`${LEAD_TAB}!A1`, [row]); } catch (err) { return { ok: false, status: "error", message: "เพิ่มแถวไม่สำเร็จ: " + msg(err) }; }
      try {
        await audit(c, [{ at: `${ymd(t)} ${hm(t)}`, actor, role, action: "addLead", leadId: id, field: "id", before: "", after: id }]);
      } catch (err) {
        return { ok: false, status: "partial", message: `เพิ่มลีด ${id} แล้ว แต่บันทึกการเปลี่ยนแปลงไม่สำเร็จ: ${msg(err)}`, written: ["id"] };
      }
      return { ok: true, leadId: id };
    },

    async moveStage(role: Role, lead: Lead, to: Stage): Promise<WriteResult> {
      const p = canMove(role, lead.stage, to);
      if (!p.ok) return forbidden(p.reason);
      return gate("moveStage") ?? writeCells(role, "moveStage", lead, { stage: to });
    },

    async closeDeal(role: Role, lead: Lead, input: CloseInput): Promise<WriteResult> {
      const p = canMove(role, lead.stage, "ปิดดีล");
      if (!p.ok) return forbidden(p.reason);
      const e = validateClose(input);
      if (Object.keys(e).length) return invalid(e);
      return gate("closeDeal") ?? writeCells(role, "closeDeal", lead, { sign: input.sign.trim(), rent: input.rent.trim(), stage: "ปิดดีล" });
    },

    async markLost(role: Role, lead: Lead, reason: string): Promise<WriteResult> {
      const p = canMove(role, lead.stage, "ปิดไม่ได้");
      if (!p.ok) return forbidden(p.reason);
      const e = validateLost(reason);
      if (Object.keys(e).length) return invalid(e);
      return gate("closeDeal") ?? writeCells(role, "markLost", lead, { note: reason.trim(), stage: "ปิดไม่ได้" });
    },
  };
}

export type Store = ReturnType<typeof createStore>;

// The app's store: built from config, no client yet, so every write is not_connected.
const app = createStore();
export const { listLeads, addLead, moveStage, closeDeal, markLost } = app;
