// What the screen does after a write. Success re-reads the sheet; a result that means the
// sheet may differ from what is on screen offers a reload; the rest change nothing on the sheet.

export type Next = "reload" | "offer_reload" | "none";

export function afterWrite(r: { ok: boolean; status?: string }): Next {
  if (r.ok) return "reload";
  return r.status === "conflict" || r.status === "partial" || r.status === "error" ? "offer_reload" : "none";
}

/** After a reload a lead may sit on another row, or be gone; find it by id only. */
export function findLead<T extends { id: string }>(leads: T[], id: string): T | null {
  return leads.find(l => l.id === id) ?? null;
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
