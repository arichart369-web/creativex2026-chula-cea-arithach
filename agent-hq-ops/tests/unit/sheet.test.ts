import { COLS, parseSheet, rowStillMatches, dueFollowUps } from "../../src/rules/sheet";
import { esc } from "../../src/rules/escape";

const head = Object.values(COLS);
const row = (id: string, stage: string, follow = "") => head.map(h => (h === COLS.id ? id : h === COLS.stage ? stage : h === COLS.follow ? follow : ""));

describe("parseSheet", () => {
  it("reads id, stage and the 1-based sheet row", () => {
    const r = parseSheet([head, row("L1", "คัดกรอง")]);
    expect(r.leads).toEqual([{ row: 2, id: "L1", stage: "คัดกรอง", fields: { id: "L1", stage: "คัดกรอง" } }]);
  });
  it("skips rows with no id or an unknown stage instead of guessing", () => {
    const r = parseSheet([head, row("", "คัดกรอง"), row("L2", "ปิดแล้ว"), row("L3", "ลีดใหม่")]);
    expect(r.leads.map(l => l.id)).toEqual(["L3"]);
    expect(r.skipped).toBe(2);
  });
  it("reports missing required headers", () => {
    expect(parseSheet([["ชื่อลูกค้า"], ["x"]]).missing).toEqual([COLS.id, COLS.stage]);
  });
  it("finds columns by header, not position", () => {
    const shuffled = [...head].reverse();
    const r = parseSheet([shuffled, [...row("L9", "เสนอห้อง")].reverse()]);
    expect(r.leads[0]).toMatchObject({ id: "L9", stage: "เสนอห้อง" });
  });
});

describe("FR-05 row check (T4)", () => {
  it("writes only when the row still holds the same id", () => {
    expect(rowStillMatches("L1", "L1")).toBe(true);
    expect(rowStillMatches("L7", "L1")).toBe(false);
    expect(rowStillMatches(undefined, "L1")).toBe(false);
  });
});

describe("dueFollowUps (FR-08)", () => {
  it("lists open leads due today or earlier, oldest first", () => {
    const { leads } = parseSheet([head, row("A", "คัดกรอง", "2026-11-12"), row("B", "ลีดใหม่", "2026-11-10"), row("C", "ปิดไม่ได้", "2026-11-01"), row("D", "เสนอห้อง", "2026-12-01"), row("E", "เสนอห้อง")]);
    expect(dueFollowUps(leads, "2026-11-13").map(l => l.id)).toEqual(["B", "A"]);
  });
});

describe("esc (T10)", () => {
  it("renders a script tag as text", () => {
    expect(esc("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(esc(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});
