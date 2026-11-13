import { ConnectorSheetClient, MCP_MSG, SheetError, valuesOf, type McpLike } from "../../src/data/connectorSheetClient";
import { MemorySheetClient } from "../../src/data/sheetClient";
import { checkConnection } from "../../src/data/runtime";
import { createStore } from "../../src/data/store";
import { AUDIT_HEAD } from "../../src/data/audit";
import { FEATURES, type FeatureKey, type FeatureStatus } from "../../src/config/status";
import { COLS } from "../../src/rules/sheet";

type Call = { server: string; tool: string; input: any; options: any };

/** A fake viewer runtime whose Google Sheets tools are backed by a MemorySheetClient. */
function fakeMcp(sheet: MemorySheetClient, failWith?: (tool: string) => string | null) {
  const calls: Call[] = [];
  const mcp: McpLike = {
    async callTool(server, tool, input: any, options) {
      calls.push({ server, tool, input, options });
      const code = failWith?.(tool);
      if (code) throw { code, message: "x" };
      if (tool === "get_values") return { payload: { range: input.range, values: await sheet.read(input.range) } };
      if (tool === "update_values") { await sheet.update(input.range, input.values); return { payload: {} }; }
      if (tool === "append_values") { await sheet.append(input.range, input.values); return { payload: {} }; }
      throw { code: "not_in_manifest", message: "?" };
    },
  };
  return { mcp, calls };
}

const head = Object.values(COLS);
const row = (id: string, stage: string) => head.map(h => (h === COLS.id ? id : h === COLS.stage ? stage : ""));
const allLive = Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, { ...v, status: "live" }])) as Record<FeatureKey, FeatureStatus>;

describe("valuesOf", () => {
  it("reads values from the payload shapes the current page handles", () => {
    expect(valuesOf({ values: [["a", 1, null]] })).toEqual([["a", "1", ""]]);
    expect(valuesOf({ content: { values: [["x"]] } })).toEqual([["x"]]);
    expect(valuesOf(JSON.stringify({ values: [["y"]] }))).toEqual([["y"]]);
  });
  it("treats a range with no values as empty", () => expect(valuesOf({ range: "ลีด!A1:B2" })).toEqual([]));
  it("refuses anything else instead of guessing", () => {
    expect(valuesOf("oops")).toBeNull();
    expect(valuesOf({ rows: [] })).toBeNull();
    expect(valuesOf(null)).toBeNull();
  });
});

describe("ConnectorSheetClient", () => {
  it("calls the connector's tool names with spreadsheetId, range and values", async () => {
    const sheet = new MemorySheetClient({ "ลีด": [["h"]] });
    const { mcp, calls } = fakeMcp(sheet);
    const c = new ConnectorSheetClient(mcp, "SHEET1");
    await c.read("ลีด!1:1");
    await c.update("ลีด!A2", [["v"]]);
    await c.append("ลีด!A1", [["w"]]);
    expect(calls.map(x => [x.server, x.tool, x.input])).toEqual([
      ["Google Sheets", "get_values", { spreadsheetId: "SHEET1", range: "ลีด!1:1" }],
      ["Google Sheets", "update_values", { spreadsheetId: "SHEET1", range: "ลีด!A2", values: [["v"]] }],
      ["Google Sheets", "append_values", { spreadsheetId: "SHEET1", range: "ลีด!A1", values: [["w"]] }],
    ]);
    expect(calls[0].options).toEqual({ cache: false }); // reads before a write must be fresh
  });
  it("refuses to start without a sheet id", () => {
    expect(() => new ConnectorSheetClient(fakeMcp(new MemorySheetClient({})).mcp, "")).toThrow();
  });
  it("keeps each connector error's own fix message", async () => {
    for (const code of ["needs_reauth", "server_not_connected", "approval_required", "blocked_by_policy"]) {
      const c = new ConnectorSheetClient(fakeMcp(new MemorySheetClient({ "ลีด": [] }), () => code).mcp, "S");
      const e = await c.read("ลีด!1:1").catch(x => x);
      expect(e).toBeInstanceOf(SheetError);
      expect(e.code).toBe(code);
      expect(e.message).toBe(MCP_MSG[code]);
    }
  });
  it("says a timed-out write may or may not have landed", async () => {
    const c = new ConnectorSheetClient(fakeMcp(new MemorySheetClient({ "ลีด": [] }), t => (t === "update_values" ? "server_unavailable" : null)).mcp, "S");
    const e = await c.update("ลีด!A2", [["v"]]).catch(x => x);
    expect(e.message).toContain("ไม่แน่ใจว่าเขียนลงชีตแล้วหรือยัง");
  });
  it("calls an unreadable payload an error, not an empty sheet", async () => {
    const mcp: McpLike = { callTool: async () => ({ payload: "<html>" }) };
    await expect(new ConnectorSheetClient(mcp, "S").read("ลีด!1:1")).rejects.toMatchObject({ code: "bad_payload" });
  });
});

describe("store over the connector (T3 end to end with a fake runtime)", () => {
  it("moves one stage and logs it through the connector tools", async () => {
    const sheet = new MemorySheetClient({ "ลีด": [head, row("L-0001", "ลีดใหม่")], "บันทึก": [AUDIT_HEAD] });
    const { mcp, calls } = fakeMcp(sheet);
    const store = createStore({ statuses: allLive, client: new ConnectorSheetClient(mcp, "S"), actor: "t", now: () => new Date(2026, 0, 1) });
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toEqual({ ok: true, leadId: "L-0001" });
    expect(calls.map(c => c.tool)).toEqual(["get_values", "get_values", "update_values", "append_values"]);
    expect(sheet.tabs["ลีด"][1][head.indexOf(COLS.stage)]).toBe("คัดกรอง");
  });
  it("turns an ambiguous write into an error the UI shows, never ok", async () => {
    const sheet = new MemorySheetClient({ "ลีด": [head, row("L-0001", "ลีดใหม่")], "บันทึก": [AUDIT_HEAD] });
    const { mcp } = fakeMcp(sheet, t => (t === "update_values" ? "upstream_error" : null));
    const store = createStore({ statuses: allLive, client: new ConnectorSheetClient(mcp, "S") });
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ ok: false, status: "error" });
    expect(!r.ok && r.message).toContain("ไม่แน่ใจ");
  });
});

describe("checkConnection (read-only)", () => {
  const win = (mcp: McpLike | null) => ({ claude: { use: async () => mcp } });
  it("reports no runtime outside claude.ai", async () => expect(await checkConnection({}, "S")).toMatchObject({ ok: false, code: "no_runtime" }));
  it("reports a missing sheet id", async () => {
    expect(await checkConnection(win(fakeMcp(new MemorySheetClient({})).mcp), "")).toMatchObject({ ok: false, code: "no_sheet_id" });
  });
  it("reads only the header row and counts columns", async () => {
    const { mcp, calls } = fakeMcp(new MemorySheetClient({ "ลีด": [head] }));
    const r = await checkConnection(win(mcp), "S");
    expect(r).toMatchObject({ ok: true, headers: head.length });
    expect(calls.map(c => c.tool)).toEqual(["get_values"]);
  });
  it("passes the connector's own message through", async () => {
    const { mcp } = fakeMcp(new MemorySheetClient({}), () => "needs_reauth");
    expect(await checkConnection(win(mcp), "S")).toMatchObject({ ok: false, code: "needs_reauth" });
  });
});
