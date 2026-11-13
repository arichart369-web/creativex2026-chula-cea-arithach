import { validateNewLead, validateLost, validateClose } from "../../src/rules/validate";

const base = { channel: "LINE OA", name: "ก", contact: "line-id", budget: "", type: "", loc: "", movein: "" };

describe("validation", () => {
  it("accepts the three required fields alone", () => expect(validateNewLead(base)).toEqual({}));
  it("flags each missing required field", () => {
    expect(Object.keys(validateNewLead({ ...base, channel: "", name: " ", contact: "" })).sort()).toEqual(["channel", "contact", "name"]);
  });
  it("rejects a non-numeric budget and a malformed date", () => {
    const e = validateNewLead({ ...base, budget: "15k", movein: "1/12/2026" });
    expect(e.budget).toBeDefined();
    expect(e.movein).toBeDefined();
  });
  it("T6: lost needs a reason", () => {
    expect(validateLost("  ").reason).toBeDefined();
    expect(validateLost("งบไม่พอ")).toEqual({});
  });
  it("close needs a typed date and rent; nothing is computed", () => {
    expect(Object.keys(validateClose({ sign: "", rent: "" })).sort()).toEqual(["rent", "sign"]);
    expect(validateClose({ sign: "2026-12-01", rent: "18000" })).toEqual({});
  });
});
