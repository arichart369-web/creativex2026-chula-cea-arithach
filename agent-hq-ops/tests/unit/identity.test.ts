import { ANONYMOUS, actorFrom, resolveIdentity } from "../../src/data/identity";

describe("actorFrom", () => {
  it("writes the email when the viewer shares it, and shows the name", () => {
    expect(actorFrom({ id: "u_1", email: "a@example.com", name: "เอ" })).toEqual({ actor: "a@example.com", kind: "email", display: "เอ" });
  });
  it("falls back to the opaque id without an email", () => {
    expect(actorFrom({ id: "u_1", email: null, name: "" })).toEqual({ actor: "u_1", kind: "id", display: "ผู้ใช้ claude.ai" });
  });
  it("is anonymous with no identity", () => {
    expect(actorFrom({ id: null, email: null, name: "" }).actor).toBe(ANONYMOUS);
    expect(actorFrom(null).kind).toBe("anonymous");
  });
  it("never writes the display name", () => {
    expect(actorFrom({ id: "u_1", email: null, name: "ชื่อจริง" }).actor).toBe("u_1");
  });
});

describe("resolveIdentity", () => {
  it("is anonymous outside claude.ai", async () => expect((await resolveIdentity({})).kind).toBe("anonymous"));
  it("is anonymous when the capability is unavailable", async () => {
    expect((await resolveIdentity({ claude: { use: async () => null } })).kind).toBe("anonymous");
  });
  it("never rejects", async () => {
    expect((await resolveIdentity({ claude: { use: async () => { throw new Error("x"); } } })).kind).toBe("anonymous");
  });
  it("reads me() from the capability", async () => {
    const user = { me: async () => ({ id: "u_9", email: "b@example.com", name: "บี" }) };
    expect(await resolveIdentity({ claude: { use: async () => user } })).toMatchObject({ actor: "b@example.com" });
  });
});
