# Agent HQ · Live Ops

Next phase of `middle-agent-hq.html`: a lead-operations app for the Middle Property team.
PRD: https://claude.ai/artifact/EkmLhveQj2Ve63QpePY7uH

Stages: PRD → **Skeleton (M0)** → Vertical slice (M1) → MVP (M2) → QA + UAT → Release (M3).

## Run

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # type-check + production build
npm run e2e        # e2e + axe + screenshots (needs the build; uses the pre-installed Playwright)
npm run build:artifact   # one self-contained file: dist-artifact/agent-hq-ops.html
npm run e2e:artifact     # checks that file: no network, runtime path, dark mode + axe
```

Evidence lands in `test-results/` (`e2e.json`, `axe.json`, `screens/*.png`).

## How it is built

- `src/config/status.ts` — the only place that says live / demo / not_connected. The utility-bar badge and the "สถานะระบบ" page read it.
- `src/data/store.ts` — the store boundary. Every write checks permission, then validation, then returns `{ ok: false, status: 'not_connected', message }` until the sheet writer passes its gate. The UI shows that message and never shows a success it did not get.
- `src/data/sheetClient.ts` — the `SheetClient` interface (read / update / append) the store uses to reach a sheet, plus `MemorySheetClient` for tests. No real Google Sheets client is wired in yet.
- `src/data/connectorSheetClient.ts` — the real `SheetClient`: calls the viewer's claude.ai **Google Sheets** connector (`get_values`, `update_values`, `append_values` with `spreadsheetId`, `range`, `values`) through the artifact `mcp` capability. Each connector error code keeps its own Thai fix message; a write that times out says it may or may not have landed; an unreadable payload is an error, never an empty sheet.
- `src/config/sheet.ts` — the sheet id. Empty in the repo.
- On load the app paints the demo rows at once, then runs the connection check; only when the check reaches the sheet does it swap in the connector client (writes stay gated by config). A failed live read falls back to demo rows with the reason shown.
- `src/data/runtime.ts` — a read-only connection check (header row only) shown on the "สถานะระบบ" page. It never turns writes on: that is still config.
- `src/data/audit.ts` — one audit row per written cell (time, actor, role, action, lead id, column, before, after). Name, contact and note values are replaced with "(ข้อมูลส่วนตัว)".
- A write reaches the sheet only when its feature **and** the audit log are `live` in config **and** a client is set. Before writing it re-reads the row and stops if the lead id or stage changed (FR-05). Stage is written last, so a half-failed close leaves the stage as it was. A failed write returns `error`; a write that landed but could not be fully logged or finished returns `partial` with the cells written — never `ok`.
- `src/rules/` — stages, roles (FR-03), validation, sheet parsing, the row re-check (FR-05), the follow-up queue (FR-08) and HTML escaping. All pure functions with unit tests.
- No personal data in the URL, `localStorage`, `sessionStorage`, analytics or logs: state lives in memory only.
- Demo rows (`src/data/demo.ts`) hold no prices, budgets or real people, and every screen that shows them says "ข้อมูลสาธิต".

## Increments

| # | What | Unit | E2E |
| --- | --- | --- | --- |
| M1c-prep | Publish-ready single-file build (`build:artifact`), app swaps in the connector client when the read-only check passes, dark-mode tokens for the artifact page contract | 59/59 | 14/14 + artifact 5/5 (no network, runtime path without id, dark-mode axe at 360/1280) |
| M1b | Google Sheets client over the claude.ai connector, error-code messages, ambiguous-write message, read-only connection check on the status page | 59/59 (+14) | 14/14 (+1) |
| M1a | Sheet write path behind the gate: `SheetClient` + in-memory client, live read, add lead (next `L-0001` id, same format as the current page), move, close, lost, FR-05 row and stage re-check, audit rows without personal data, partial/error results | 45/45 (+15) | 13/13 (UI unchanged; still not_connected) |
| M0 | Skeleton: status config, store boundary, rules, 5 pages (board, new lead, due follow-ups, audit log, system status), lead drawer with move / close / lost, demo role switcher, a11y basics | 30/30 | 13/13 (axe: 0 violations on 12 page/size checks) |

## Not yet tested

- Real Google Sheets reads and writes: the connector client is tested against a fake runtime backed by `MemorySheetClient`. The `get_values` result shape is taken from the parser in `middle-agent-hq.html`, not from a real call made here. Config still says not_connected, so the app never takes the write path.
- Running inside claude.ai as an artifact (the app is not published; publishing needs your approval).
- Two people writing the same row at the same moment: the re-check narrows the window but the sheet API has no compare-and-set.
- Screen readers (NVDA / VoiceOver) — only axe and keyboard checks so far.
- Core Web Vitals on a deployed build.
- Real Thai web fonts: the container blocks Google Fonts, so screenshots use fallback fonts.

## Still missing (owner decisions or later increments)

- Who has which role, and how a viewer proves who they are.
- Audit log tab ("บันทึก") in the sheet, with the header row `เวลา, ผู้ทำ, บทบาท, การกระทำ, รหัสลีด, คอลัมน์, ค่าเดิม, ค่าใหม่`.
- The id of a TEST sheet (not the live lead sheet) for `src/config/sheet.ts`, and approval to publish the app as a private artifact that declares `mcp: {servers: [{server: "Google Sheets", tools: ["get_values", "update_values", "append_values"]}]}`.
- Whether "ปิดไม่ได้" reasons come from a fixed list.
- Whether a stage can be moved back, and by whom.
- Retention period for lost leads (PDPA).
