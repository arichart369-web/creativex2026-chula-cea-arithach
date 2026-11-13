import { afterWrite, findLead, hhmm } from "../../src/rules/afterWrite";

describe("afterWrite", () => {
  it("re-reads the sheet after a success", () => expect(afterWrite({ ok: true })).toBe("reload"));
  it("offers a reload when the sheet may differ from the screen", () => {
    for (const status of ["conflict", "partial", "error"]) expect(afterWrite({ ok: false, status })).toBe("offer_reload");
  });
  it("changes nothing when the sheet was not touched", () => {
    for (const status of ["not_connected", "forbidden", "invalid"]) expect(afterWrite({ ok: false, status })).toBe("none");
  });
});

describe("findLead", () => {
  const leads = [{ id: "L-0001", row: 2 }, { id: "L-0007", row: 3 }];
  it("finds by id whatever the row", () => expect(findLead(leads, "L-0007")).toEqual({ id: "L-0007", row: 3 }));
  it("returns null when the lead is gone", () => expect(findLead(leads, "L-0009")).toBeNull());
});

describe("hhmm", () => {
  it("pads hours and minutes", () => expect(hhmm(new Date(2026, 0, 1, 9, 5))).toBe("09:05"));
});
