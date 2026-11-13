import { SHEET } from "../config/sheet";
import { ConnectorSheetClient, type McpLike, SheetError } from "./connectorSheetClient";
import { LEAD_TAB, type SheetClient } from "./sheetClient";

export type ConnectionCheck =
  | { ok: true; client: SheetClient; headers: number }
  | { ok: false; code: "no_runtime" | "no_sheet_id" | string; message: string };

type ClaudeWindow = { claude?: { use(name: "mcp"): Promise<McpLike | null> } };

/**
 * Read-only check: is there a claude.ai runtime, a sheet id and a reachable header row?
 * It never writes. The store still gates writes on config, whatever this returns.
 */
export async function checkConnection(win: ClaudeWindow = window as unknown as ClaudeWindow, sheetId: string = SHEET.id): Promise<ConnectionCheck> {
  if (!win.claude?.use) return { ok: false, code: "no_runtime", message: "หน้านี้ไม่ได้เปิดใน claude.ai จึงใช้ตัวเชื่อมชีตไม่ได้" };
  const mcp = await win.claude.use("mcp").catch(() => null);
  if (!mcp) return { ok: false, code: "no_runtime", message: "มุมมองนี้ใช้ตัวเชื่อมของ claude.ai ไม่ได้" };
  if (!sheetId) return { ok: false, code: "no_sheet_id", message: "ยังไม่ได้ใส่ id ชีต (src/config/sheet.ts)" };
  const client = new ConnectorSheetClient(mcp, sheetId, SHEET.server);
  try {
    const [head = []] = await client.read(`${LEAD_TAB}!1:1`);
    return { ok: true, client, headers: head.filter(Boolean).length };
  } catch (e) {
    return { ok: false, code: e instanceof SheetError ? e.code : "error", message: e instanceof Error ? e.message : String(e) };
  }
}
