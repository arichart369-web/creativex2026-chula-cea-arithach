// The only way the store talks to a spreadsheet. A real client (Google Sheets through the
// artifact connector) and the in-memory one used by tests both implement this.

export interface SheetClient {
  read(range: string): Promise<string[][]>;
  update(range: string, values: string[][]): Promise<void>;
  append(range: string, values: string[][]): Promise<void>;
}

export const LEAD_TAB = "ลีด";
export const AUDIT_TAB = "บันทึก";

/** 0-based column index → A1 letters (0 → A, 25 → Z, 26 → AA). */
export function colA1(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const parseA1 = (ref: string) => {
  const m = /^([A-Z]+)(\d+)?$/.exec(ref);
  if (!m) throw new Error("bad range " + ref);
  const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return { col, row: m[2] ? Number(m[2]) - 1 : null };
};

/** In-memory sheet for tests and local trials. Supports "Tab!A1", "Tab!A1:X10" and "Tab!1:1". */
export class MemorySheetClient implements SheetClient {
  tabs: Record<string, string[][]>;
  calls: string[] = [];
  failOn: Partial<Record<"read" | "update" | "append", (range: string) => boolean>> = {};

  constructor(tabs: Record<string, string[][]>) {
    this.tabs = Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, v.map(r => [...r])]));
  }

  private split(range: string) {
    const [tab, ref = ""] = range.split("!");
    if (!this.tabs[tab]) throw new Error("no tab " + tab);
    return { grid: this.tabs[tab], ref };
  }

  private check(op: "read" | "update" | "append", range: string) {
    this.calls.push(`${op} ${range}`);
    if (this.failOn[op]?.(range)) throw new Error(`${op} failed: ${range}`);
  }

  async read(range: string): Promise<string[][]> {
    this.check("read", range);
    const { grid, ref } = this.split(range);
    const row = /^(\d+):(\d+)$/.exec(ref);
    if (row) return grid.slice(Number(row[1]) - 1, Number(row[2])).map(r => [...r]);
    if (!ref.includes(":")) {
      const a = parseA1(ref);
      const v = grid[a.row ?? 0]?.[a.col];
      return v === undefined || v === "" ? [] : [[v]];
    }
    const [a, b] = ref.split(":").map(parseA1);
    return grid.slice(a.row ?? 0, (b.row ?? grid.length - 1) + 1).map(r => r.slice(a.col, b.col + 1));
  }

  async update(range: string, values: string[][]): Promise<void> {
    this.check("update", range);
    const { grid, ref } = this.split(range);
    const a = parseA1(ref);
    values.forEach((r, i) => r.forEach((v, j) => {
      const row = (a.row ?? 0) + i;
      grid[row] ??= [];
      grid[row][a.col + j] = v;
    }));
  }

  async append(range: string, values: string[][]): Promise<void> {
    this.check("append", range);
    const { grid } = this.split(range);
    grid.push(...values.map(r => [...r]));
  }
}
