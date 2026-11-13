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
```

Evidence lands in `test-results/` (`e2e.json`, `axe.json`, `screens/*.png`).

## How it is built

- `src/config/status.ts` — the only place that says live / demo / not_connected. The utility-bar badge and the "สถานะระบบ" page read it.
- `src/data/store.ts` — the store boundary. Every write checks permission, then validation, then returns `{ ok: false, status: 'not_connected', message }` until the sheet writer passes its gate. The UI shows that message and never shows a success it did not get.
- `src/rules/` — stages, roles (FR-03), validation, sheet parsing, the row re-check (FR-05), the follow-up queue (FR-08) and HTML escaping. All pure functions with unit tests.
- No personal data in the URL, `localStorage`, `sessionStorage`, analytics or logs: state lives in memory only.
- Demo rows (`src/data/demo.ts`) hold no prices, budgets or real people, and every screen that shows them says "ข้อมูลสาธิต".

## Increments

| # | What | Unit | E2E |
| --- | --- | --- | --- |
| M0 | Skeleton: status config, store boundary, rules, 5 pages (board, new lead, due follow-ups, audit log, system status), lead drawer with move / close / lost, demo role switcher, a11y basics | 30/30 | 13/13 (axe: 0 violations on 12 page/size checks) |

## Not yet tested

- Real Google Sheets reads and writes (not connected in M0).
- Screen readers (NVDA / VoiceOver) — only axe and keyboard checks so far.
- Core Web Vitals on a deployed build.
- Real Thai web fonts: the container blocks Google Fonts, so screenshots use fallback fonts.

## Still missing (owner decisions or later increments)

- Who has which role, and how a viewer proves who they are.
- Audit log tab ("บันทึก") in the sheet.
- Whether "ปิดไม่ได้" reasons come from a fixed list.
- Whether a stage can be moved back, and by whom.
- Retention period for lost leads (PDPA).
