import { can, canMove } from "../../src/rules/roles";

describe("roles (FR-03)", () => {
  it("viewer cannot write anything", () => {
    for (const a of ["addLead", "moveStage", "closeDeal", "markLost"] as const) expect(can("viewer", a).ok).toBe(false);
  });
  it("agent adds and moves one step", () => {
    expect(can("agent", "addLead").ok).toBe(true);
    expect(canMove("agent", "ลีดใหม่", "คัดกรอง").ok).toBe(true);
  });
  it("agent cannot skip a stage or move backwards", () => {
    expect(canMove("agent", "ลีดใหม่", "เสนอห้อง").ok).toBe(false);
    expect(canMove("agent", "เสนอห้อง", "คัดกรอง").ok).toBe(false);
  });
  it("T5: agent cannot close a deal or mark it lost", () => {
    expect(canMove("agent", "นัดดูจริง", "ปิดดีล").ok).toBe(false);
    expect(canMove("agent", "คัดกรอง", "ปิดไม่ได้").ok).toBe(false);
  });
  it("lead closes from นัดดูจริง and marks lost from any open stage", () => {
    expect(canMove("lead", "นัดดูจริง", "ปิดดีล").ok).toBe(true);
    expect(canMove("lead", "ลีดใหม่", "ปิดไม่ได้").ok).toBe(true);
  });
  it("nobody moves a closed lead", () => {
    expect(canMove("lead", "ปิดดีล", "ปิดไม่ได้").ok).toBe(false);
    expect(canMove("lead", "ปิดไม่ได้", "ลีดใหม่").ok).toBe(false);
  });
});
