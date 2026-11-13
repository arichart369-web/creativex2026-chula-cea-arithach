import { validateFollowUp } from "../../src/rules/validate";
import { canFollowUp } from "../../src/rules/roles";
import { createStore } from "../../src/data/store";
import { MemorySheetClient } from "../../src/data/sheetClient";
import { AUDIT_HEAD } from "../../src/data/audit";
import { FEATURES, type FeatureKey, type FeatureStatus } from "../../src/config/status";
import { COLS } from "../../src/rules/sheet";

const head = Object.values(COLS);
const row = (id: string, stage: string, follow = "") => head.map(h => (h === COLS.id ? id : h === COLS.stage ? stage : h === COLS.follow ? follow : ""));
const allLive = Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, { ...v, status: "live" }])) as Record<FeatureKey, FeatureStatus>;
const now = () => new Date(2026, 10, 14, 10, 0);
const lead = { row: 2, id: "L-0001", stage: "เสนอห้อง" as const, fields: {} };

describe("validateFollowUp", () => {
  it("accepts today and later", () => {
    expect(validateFollowUp("2026-11-14", "2026-11-14")).toEqual({});
    expect(validateFollowUp("2027-01-02", "2026-11-14")).toEqual({});
  });
  it("rejects a past date", () => expect(validateFollowUp("2026-11-13", "2026-11-14").follow).toBeDefined());
  it("rejects empty, malformed and impossible dates", () => {
    for (const d of ["", "14/11/2026", "2026-13-01", "2026-02-30"]) expect(validateFollowUp(d, "2026-01-01").follow).toBeDefined();
  });
});

describe("canFollowUp", () => {
  it("agent and lead on an open lead", () => {
    expect(canFollowUp("agent", "คัดกรอง").ok).toBe(true);
    expect(canFollowUp("lead", "นัดดูจริง").ok).toBe(true);
  });
  it("not the viewer, not on a closed lead", () => {
    expect(canFollowUp("viewer", "คัดกรอง").ok).toBe(false);
    expect(canFollowUp("lead", "ปิดดีล").ok).toBe(false);
    expect(canFollowUp("agent", "ปิดไม่ได้").ok).toBe(false);
  });
});

describe("store.setFollowUp", () => {
  it("is not_connected in the release config", async () => {
    expect(await createStore().setFollowUp("agent", lead, "2099-01-01")).toMatchObject({ status: "not_connected" });
  });
  it("checks permission and the date before the gate", async () => {
    const s = createStore({ now });
    expect(await s.setFollowUp("viewer", lead, "2026-11-20")).toMatchObject({ status: "forbidden" });
    expect(await s.setFollowUp("agent", lead, "2026-11-01")).toMatchObject({ status: "invalid", errors: { follow: expect.any(String) } });
  });
  it("writes one cell and one audit row when live", async () => {
    const client = new MemorySheetClient({ "ลีด": [head, row("L-0001", "เสนอห้อง", "2026-11-10")], "บันทึก": [AUDIT_HEAD] });
    const s = createStore({ statuses: allLive, client, actor: "t", now });
    expect(await s.setFollowUp("agent", lead, "2026-11-20")).toEqual({ ok: true, leadId: "L-0001" });
    expect(client.tabs["ลีด"][1][head.indexOf(COLS.follow)]).toBe("2026-11-20");
    expect(client.tabs["บันทึก"].slice(1)).toEqual([["2026-11-14 10:00", "t", "agent", "setFollowUp", "L-0001", COLS.follow, "2026-11-10", "2026-11-20"]]);
  });
  it("stops on a re-sorted sheet like every other write", async () => {
    const client = new MemorySheetClient({ "ลีด": [head, row("L-0009", "เสนอห้อง")], "บันทึก": [AUDIT_HEAD] });
    const s = createStore({ statuses: allLive, client, now });
    expect(await s.setFollowUp("agent", lead, "2026-11-20")).toMatchObject({ status: "conflict" });
    expect(client.tabs["บันทึก"]).toHaveLength(1);
  });
});
