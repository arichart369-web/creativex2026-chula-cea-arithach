import { STAGES, isStage, nextStage, isOpen } from "../../src/rules/stages";

describe("stages", () => {
  it("names match the sheet's ขั้น column", () => {
    expect([...STAGES]).toEqual(["ลีดใหม่", "คัดกรอง", "เสนอห้อง", "วิดีโอคอล", "นัดดูจริง", "ปิดดีล", "ปิดไม่ได้"]);
  });
  it("moves one step forward and ends at ปิดดีล", () => {
    expect(nextStage("ลีดใหม่")).toBe("คัดกรอง");
    expect(nextStage("วิดีโอคอล")).toBe("นัดดูจริง");
    expect(nextStage("นัดดูจริง")).toBe("ปิดดีล");
  });
  it("has no next stage once closed", () => {
    expect(nextStage("ปิดดีล")).toBeNull();
    expect(nextStage("ปิดไม่ได้")).toBeNull();
  });
  it("rejects unknown stage names", () => {
    expect(isStage("ปิดแล้ว")).toBe(false);
    expect(isStage("ลีดใหม่")).toBe(true);
  });
  it("treats both closed stages as not open", () => {
    expect(isOpen("ปิดดีล")).toBe(false);
    expect(isOpen("ปิดไม่ได้")).toBe(false);
    expect(isOpen("เสนอห้อง")).toBe(true);
  });
});
