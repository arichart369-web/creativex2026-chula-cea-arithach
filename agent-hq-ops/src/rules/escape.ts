const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape any value from the sheet before it goes into HTML (T10). */
export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, c => MAP[c]);
