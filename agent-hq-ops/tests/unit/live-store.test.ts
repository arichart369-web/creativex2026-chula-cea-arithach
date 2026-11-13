import { createStore } from "../../src/data/store";
import { MemorySheetClient, colA1 } from "../../src/data/sheetClient";
import { AUDIT_HEAD, REDACTED } from "../../src/data/audit";
import { FEATURES, type FeatureKey, type FeatureStatus } from "../../src/config/status";
import { COLS } from "../../src/rules/sheet";

const head = Object.values(COLS);
const H = (k: keyof typeof COLS) => head.indexOf(COLS[k]);
const row = (id: string, stage: string) => head.map(h => (h === COLS.id ? id : h === COLS.stage ? stage : ""));
const allLive = Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, { ...v, status: "live" }])) as Record<FeatureKey, FeatureStatus>;
const fixedNow = () => new Date(2026, 10, 14, 9, 5);

function setup(rows = [row("L-0001", "ลีดใหม่"), row("L-0002", "นัดดูจริง"), row("L-0007", "คัดกรอง")]) {
  const client = new MemorySheetClient({ "ลีด": [head, ...rows], "บันทึก": [AUDIT_HEAD] });
  const store = createStore({ statuses: allLive, client, actor: "ทดสอบ", now: fixedNow });
  return { client, store, leads: client.tabs["ลีด"], log: client.tabs["บันทึก"] };
}

describe("colA1", () => {
  it("handles one and two letters", () => {
    expect([colA1(0), colA1(18), colA1(25), colA1(26), colA1(27)]).toEqual(["A", "S", "Z", "AA", "AB"]);
  });
});

describe("gate", () => {
  it("stays not_connected when the feature is live but the audit log is not", async () => {
    const { client } = setup();
    const statuses = { ...allLive, auditLog: { ...allLive.auditLog, status: "not_connected" as const } };
    const s = createStore({ statuses, client });
    const r = await s.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ ok: false, status: "not_connected" });
    expect(client.calls).toEqual([]);
  });
  it("stays not_connected without a client", async () => {
    const s = createStore({ statuses: allLive });
    expect(await s.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง")).toMatchObject({ status: "not_connected" });
  });
});

describe("live reads", () => {
  it("parses the lead tab when leadSheet is live", async () => {
    const { store } = setup();
    const r = await store.listLeads();
    expect(r.status).toBe("live");
    expect(r.leads.map(l => [l.id, l.row])).toEqual([["L-0001", 2], ["L-0002", 3], ["L-0007", 4]]);
  });
});

describe("T3 move one stage", () => {
  it("changes exactly one cell and appends one audit row", async () => {
    const { store, leads, log } = setup();
    const before = JSON.stringify(leads);
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toEqual({ ok: true, leadId: "L-0001" });
    expect(leads[1][H("stage")]).toBe("คัดกรอง");
    const diff = JSON.parse(before).flat().filter((v: string, i: number) => v !== leads.flat()[i]);
    expect(diff).toHaveLength(1);
    expect(log.slice(1)).toEqual([["2026-11-14 09:05", "ทดสอบ", "agent", "moveStage", "L-0001", "ขั้น", "ลีดใหม่", "คัดกรอง"]]);
  });
});

describe("T4 sheet re-sorted before the write", () => {
  it("stops when the row now holds another lead", async () => {
    const { store, client, log } = setup();
    // Someone sorts the sheet: L-0009, also in ลีดใหม่, is now on row 2, so only the id check can catch it.
    client.tabs["ลีด"] = [head, row("L-0009", "ลีดใหม่"), row("L-0001", "ลีดใหม่"), row("L-0002", "นัดดูจริง")];
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ ok: false, status: "conflict" });
    expect(client.tabs["ลีด"][1][H("stage")]).toBe("ลีดใหม่"); // L-0009 untouched
    expect(client.tabs["ลีด"][2][H("stage")]).toBe("ลีดใหม่");
    expect(log).toHaveLength(1);
    expect(client.calls.some(c => c.startsWith("update"))).toBe(false);
  });
  it("stops when someone else already moved the lead", async () => {
    const { store, leads } = setup();
    leads[1][H("stage")] = "เสนอห้อง";
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ status: "conflict" });
    expect(leads[1][H("stage")]).toBe("เสนอห้อง");
  });
});

describe("close and lost", () => {
  it("writes typed sign date and rent, then the stage, with one audit row per cell", async () => {
    const { store, leads, log } = setup();
    const r = await store.closeDeal("lead", { row: 3, id: "L-0002", stage: "นัดดูจริง", fields: {} }, { sign: "2026-12-01", rent: "18000" });
    expect(r.ok).toBe(true);
    expect([leads[2][H("sign")], leads[2][H("rent")], leads[2][H("stage")]]).toEqual(["2026-12-01", "18000", "ปิดดีล"]);
    expect(log.slice(1).map(r => r[5])).toEqual(["วันเซ็นสัญญา", "ค่าเช่าที่ปิดได้ (฿)", "ขั้น"]);
  });
  it("redacts the lost reason in the audit log (it may hold personal data)", async () => {
    const { store, leads, log } = setup();
    await store.markLost("lead", { row: 4, id: "L-0007", stage: "คัดกรอง", fields: {} }, "ลูกค้าย้ายไปต่างจังหวัด");
    expect(leads[3][H("note")]).toBe("ลูกค้าย้ายไปต่างจังหวัด");
    expect(log[1]).toEqual(["2026-11-14 09:05", "ทดสอบ", "lead", "markLost", "L-0007", COLS.note, "", REDACTED]);
    expect(JSON.stringify(log)).not.toContain("ต่างจังหวัด");
  });
});

describe("failures never read as success", () => {
  it("reports partial when a later cell fails, and logs only what was written", async () => {
    const { store, client, leads, log } = setup();
    client.failOn.update = r => r.endsWith(`${colA1(H("rent"))}3`);
    const r = await store.closeDeal("lead", { row: 3, id: "L-0002", stage: "นัดดูจริง", fields: {} }, { sign: "2026-12-01", rent: "18000" });
    expect(r).toMatchObject({ ok: false, status: "partial", written: ["sign"] });
    expect(leads[2][H("stage")]).toBe("นัดดูจริง"); // stage is written last, so it did not move
    expect(log.slice(1).map(r => r[5])).toEqual(["วันเซ็นสัญญา"]);
  });
  it("reports partial when the audit append fails after the write", async () => {
    const { store, client } = setup();
    client.failOn.append = r => r.startsWith("บันทึก");
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ ok: false, status: "partial" });
  });
  it("reports error when the first write fails", async () => {
    const { store, client, log } = setup();
    client.failOn.update = () => true;
    const r = await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง");
    expect(r).toMatchObject({ ok: false, status: "error" });
    expect(log).toHaveLength(1);
  });
  it("reports error when the header is missing", async () => {
    const { store, client } = setup();
    client.tabs["ลีด"][0] = ["อย่างอื่น"];
    expect(await store.moveStage("agent", { row: 2, id: "L-0001", stage: "ลีดใหม่", fields: {} }, "คัดกรอง")).toMatchObject({ status: "error" });
  });
});

describe("add lead", () => {
  const input = { channel: "LINE OA", name: "คุณทดสอบ", contact: "0800000000", budget: "15000", type: "", loc: "", movein: "" };
  it("appends the next L- id with today's date and ลีดใหม่, by header position", async () => {
    const { store, leads, log } = setup();
    const r = await store.addLead("agent", input);
    expect(r).toEqual({ ok: true, leadId: "L-0008" });
    const added = leads.at(-1)!;
    expect([added[H("id")], added[H("date")], added[H("time")], added[H("stage")], added[H("budget")]]).toEqual(["L-0008", "2026-11-14", "09:05", "ลีดใหม่", "15000"]);
    expect(log.slice(1)).toEqual([["2026-11-14 09:05", "ทดสอบ", "agent", "addLead", "L-0008", "รหัสลีด", "", "L-0008"]]);
    expect(JSON.stringify(log)).not.toContain("0800000000");
  });
  it("starts at L-0001 on an empty sheet", async () => {
    const { store } = setup([]);
    expect(await store.addLead("agent", input)).toEqual({ ok: true, leadId: "L-0001" });
  });
});
