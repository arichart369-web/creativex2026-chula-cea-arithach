import { badgeFor } from "../../src/rules/badge";

describe("badgeFor", () => {
  it("follows config when nothing is meant to be live", () => {
    expect(badgeFor({ config: "demo", source: "demo", testSheet: false })).toEqual({ text: "ระบบ: ข้อมูลสาธิต", tone: "warn" });
    expect(badgeFor({ config: "not_connected", source: "demo", testSheet: false }).tone).toBe("warn");
  });
  it("does not claim live before the sheet answers", () => {
    expect(badgeFor({ config: "live", source: "pending", testSheet: true })).toEqual({ text: "ระบบ: กำลังเชื่อมชีต…", tone: "warn" });
  });
  it("says it could not reach the sheet when a live build fell back to demo rows", () => {
    const b = badgeFor({ config: "live", source: "demo", testSheet: true });
    expect(b.tone).toBe("warn");
    expect(b.text).not.toContain("ทำงานจริง");
  });
  it("says live only when the sheet was read", () => {
    expect(badgeFor({ config: "live", source: "live", testSheet: true })).toEqual({ text: "ระบบ: ทำงานจริง (ชีตทดสอบ)", tone: "live" });
    expect(badgeFor({ config: "live", source: "live", testSheet: false }).text).toBe("ระบบ: ทำงานจริง");
  });
});
