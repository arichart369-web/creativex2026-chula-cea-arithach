import * as store from "../../src/data/store";
import { FEATURES, systemStatus } from "../../src/config/status";

const lead = { row: 3, id: "L1", stage: "นัดดูจริง" as const, fields: {} };
const okLead = { channel: "LINE OA", name: "ก", contact: "x", budget: "", type: "", loc: "", movein: "" };

describe("store boundary (FR-02)", () => {
  it("never reports success while not connected", async () => {
    const results = [
      await store.addLead("agent", okLead),
      await store.moveStage("agent", { ...lead, stage: "ลีดใหม่" }, "คัดกรอง"),
      await store.closeDeal("lead", lead, { sign: "2026-12-01", rent: "18000" }),
      await store.markLost("lead", lead, "งบไม่พอ"),
    ];
    for (const r of results) expect(r).toMatchObject({ ok: false, status: "not_connected" });
  });
  it("carries the status note from config into the message", async () => {
    const r = await store.addLead("agent", okLead);
    expect(!r.ok && r.message).toContain(FEATURES.addLead.note);
  });
  it("checks permission before anything else (T2, T5)", async () => {
    expect(await store.addLead("viewer", okLead)).toMatchObject({ status: "forbidden" });
    expect(await store.closeDeal("agent", lead, { sign: "2026-12-01", rent: "1" })).toMatchObject({ status: "forbidden" });
  });
  it("returns field errors for invalid input (T6)", async () => {
    const r = await store.markLost("lead", lead, "");
    expect(r).toMatchObject({ status: "invalid", errors: { reason: expect.any(String) } });
  });
  it("labels the read as demo", async () => {
    expect((await store.listLeads()).status).toBe("demo");
  });
});

describe("systemStatus", () => {
  it("is demo while any feature is demo", () => expect(systemStatus()).toBe("demo"));
  it("is live only when all are live", () => {
    expect(systemStatus({ a: { status: "live", label: "", note: "" } })).toBe("live");
    expect(systemStatus({ a: { status: "not_connected", label: "", note: "" } })).toBe("not_connected");
  });
});
