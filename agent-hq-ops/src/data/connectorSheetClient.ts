import type { SheetClient } from "./sheetClient";

// SheetClient over the claude.ai `mcp` capability (the viewer's Google Sheets connector).
// Tool and argument names come from the connector's schemas: get_values / update_values /
// append_values with { spreadsheetId, range, values }.

export interface McpLike {
  callTool(server: string, tool: string, input?: unknown, options?: { cache?: false | { refresh?: boolean } }): Promise<{ payload?: unknown }>;
}

/** Thai text per connector error code; codes with their own fix keep their own message. */
export const MCP_MSG: Record<string, string> = {
  needs_reauth: "ต้องเชื่อม Google Sheets ใหม่ที่ claude.ai › Settings › Connectors",
  server_not_connected: "ยังไม่ได้เพิ่ม Google Sheets ที่ claude.ai › Settings › Connectors",
  selection_required: "มีบัญชี Google Sheets มากกว่าหนึ่งบัญชี เลือกบัญชีที่จะใช้ในหน้าต่างที่ claude.ai แสดง",
  server_not_found: "ไม่พบตัวเชื่อม Google Sheets แล้ว เพิ่มใหม่ที่ claude.ai › Settings › Connectors",
  not_in_manifest: "หน้านี้ยังไม่ได้รับอนุญาตให้ใช้ Google Sheets",
  consent_required: "หน้านี้ยังไม่ได้รับอนุญาตให้ใช้ Google Sheets",
  approval_required: "ต้องกดอนุญาตก่อน หน้านี้จึงจะใช้ชีตได้",
  blocked_by_policy: "องค์กรของคุณปิดการใช้ Google Sheets ในหน้านี้",
  not_granted: "หน้านี้ไม่ได้รับสิทธิ์ใช้ตัวเชื่อม",
  capability_disabled: "ตัวเชื่อมใช้ไม่ได้ในมุมมองนี้",
  capability_removed: "ตัวเชื่อมใช้ไม่ได้ในมุมมองนี้",
};

// For a write, these codes do not prove the tool did not run.
const AMBIGUOUS = ["server_unavailable", "upstream_error", "cancelled", "rate_limited"];

export class SheetError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Accepts the payload shapes the current middle-agent-hq.html handles; anything else is an error, never an empty sheet. */
export function valuesOf(p: unknown): string[][] | null {
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { return null; } }
  if (!p || typeof p !== "object") return null;
  const o = p as { values?: unknown; range?: unknown; content?: { values?: unknown; range?: unknown } };
  const v = Array.isArray(o.values) ? o.values : o.content && Array.isArray(o.content.values) ? o.content.values : null;
  if (v) return (v as unknown[][]).map(r => (Array.isArray(r) ? r.map(c => (c == null ? "" : String(c))) : []));
  if ("range" in o || (o.content && "range" in o.content)) return []; // a range with no values = empty
  return null;
}

function fail(e: unknown, write: boolean): never {
  const code = (e as { code?: string })?.code ?? "upstream_error";
  if (code === "tool_error") throw new SheetError(code, "ชีตตอบว่าทำไม่สำเร็จ: " + ((e as { message?: string }).message ?? ""));
  if (write && AMBIGUOUS.includes(code)) throw new SheetError(code, "ไม่แน่ใจว่าเขียนลงชีตแล้วหรือยัง (การเชื่อมต่อขาดระหว่างทาง) โหลดข้อมูลใหม่ก่อนลองอีกครั้ง");
  throw new SheetError(code, MCP_MSG[code] ?? (AMBIGUOUS.includes(code) ? "เชื่อมต่อชีตไม่ได้ชั่วคราว ลองใหม่อีกครั้ง" : "ใช้ชีตไม่สำเร็จ (" + code + ")"));
}

export class ConnectorSheetClient implements SheetClient {
  constructor(private mcp: McpLike, private spreadsheetId: string, private server = "Google Sheets") {
    if (!spreadsheetId) throw new Error("ยังไม่ได้ใส่ id ชีต");
  }

  async read(range: string): Promise<string[][]> {
    let r: { payload?: unknown };
    try { r = await this.mcp.callTool(this.server, "get_values", { spreadsheetId: this.spreadsheetId, range }, { cache: false }); }
    catch (e) { fail(e, false); }
    const v = valuesOf(r.payload);
    if (!v) throw new SheetError("bad_payload", "ชีตตอบกลับในรูปแบบที่หน้านี้อ่านไม่ได้");
    return v;
  }

  async update(range: string, values: string[][]): Promise<void> {
    try { await this.mcp.callTool(this.server, "update_values", { spreadsheetId: this.spreadsheetId, range, values }); }
    catch (e) { fail(e, true); }
  }

  async append(range: string, values: string[][]): Promise<void> {
    try { await this.mcp.callTool(this.server, "append_values", { spreadsheetId: this.spreadsheetId, range, values }); }
    catch (e) { fail(e, true); }
  }
}
