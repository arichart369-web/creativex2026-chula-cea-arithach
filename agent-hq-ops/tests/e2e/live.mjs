// Runs the LIVE path in a browser: the e2e-live build (all features live, fake sheet id) with a
// fake claude.ai runtime whose "Google Sheets" connector is an in-page grid. Nothing leaves the page.
// This build is never published.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const AXE = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const FILE = new URL("../../dist-e2e-live/single.html", import.meta.url).href;
const OUT = new URL("../../test-results/", import.meta.url).pathname;
mkdirSync(OUT + "screens", { recursive: true });

const COLS = ["รหัสลีด", "วันที่เข้า", "เวลาเข้า", "ช่องทาง", "ชื่อลูกค้า", "ติดต่อ (LINE/เบอร์)", "งบต่อเดือน (฿)", "ประเภทห้อง", "ทำเล / สถานี", "วันย้ายเข้า", "ระดับ", "ขั้น", "ตอบแรก (นาที)", "วันวิดีโอคอล", "วันดูจริง", "วันเซ็นสัญญา", "ค่าเช่าที่ปิดได้ (฿)", "ติดตามครั้งถัดไป", "หมายเหตุ / เหตุผลปิดไม่ได้"];
const AUDIT = ["เวลา", "ผู้ทำ", "บทบาท", "การกระทำ", "รหัสลีด", "คอลัมน์", "ค่าเดิม", "ค่าใหม่"];
const row = (id, stage, channel) => COLS.map(h => (h === "รหัสลีด" ? id : h === "ขั้น" ? stage : h === "ช่องทาง" ? channel : ""));
const SEED = { "ลีด": [COLS, row("L-0001", "ลีดใหม่", "LINE OA"), row("L-0002", "นัดดูจริง", "Facebook"), row("L-0003", "คัดกรอง", "TikTok")], "บันทึก": [AUDIT] };
const C = name => COLS.indexOf(name);

// The fake runtime, installed before the page's own script runs.
function installFake(seed) {
  const tabs = JSON.parse(JSON.stringify(seed));
  const fails = []; // [{tool, match}] consumed once
  const calls = [];
  const col = s => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const cell = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return m && { c: col(m[1]), r: Number(m[2]) - 1 }; };
  const split = range => { const [tab, ref] = range.split("!"); if (!tabs[tab]) throw { code: "tool_error", message: "no tab" }; return [tabs[tab], ref]; };
  const read = range => {
    const [g, ref] = split(range);
    let m = /^(\d+):(\d+)$/.exec(ref);
    if (m) return g.slice(Number(m[1]) - 1, Number(m[2]));
    m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref);
    if (m) return g.slice(Number(m[2]) - 1, Number(m[4])).map(r => r.slice(col(m[1]), col(m[3]) + 1));
    const a = cell(ref); const v = g[a.r]?.[a.c];
    return v ? [[v]] : [];
  };
  window.__sheet = { tabs, fails, calls };
  window.claude = {
    use: async name => name !== "mcp" ? null : {
      callTool: async (server, tool, input) => {
        calls.push([tool, input.range]);
        const f = fails.findIndex(x => x.tool === tool && input.range.includes(x.match));
        if (f >= 0) { const { code } = fails.splice(f, 1)[0]; throw { code, message: "injected" }; }
        if (server !== "Google Sheets" || input.spreadsheetId !== "E2E-FAKE-SHEET") throw { code: "not_in_manifest", message: "?" };
        if (tool === "get_values") return { payload: { range: input.range, values: read(input.range) } };
        if (tool === "update_values") { const [g, ref] = split(input.range); const a = cell(ref); g[a.r][a.c] = String(input.values[0][0]); return { payload: {} }; }
        if (tool === "append_values") { const [g] = split(input.range); g.push(...input.values.map(r => r.map(String))); return { payload: {} }; }
        throw { code: "not_in_manifest", message: "?" };
      },
    },
  };
}

const results = [], axeOut = {};
const test = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log("ok  ", name); }
  catch (e) { results.push({ name, ok: false, error: String(e.message || e) }); console.log("FAIL", name, "-", e.message); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(installFake, SEED);
const page = await ctx.newPage();
const errors = [], requests = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("request", r => requests.push(r.url()));

const sheet = () => page.evaluate(() => window.__sheet.tabs);
const role = async r => { await page.selectOption("#roleSel", r); await page.waitForTimeout(50); };
const openBoard = async () => { await page.goto(FILE + "#/board"); await page.waitForSelector('[data-lead="L-0001"]'); };
const cardIn = (id, stage) => page.$(`section:has(h2 span:text-is("${stage}")) [data-lead="${id}"]`);
const axe = async key => {
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations);
  axeOut[key] = v.map(x => ({ id: x.id, impact: x.impact, nodes: x.nodes.length }));
  const bad = v.filter(x => x.impact === "serious" || x.impact === "critical");
  assert(!bad.length, `axe ${key}: ` + bad.map(x => `${x.id}(${x.nodes.length})`).join(", "));
};

await test("T1 live: reads the sheet through the connector and labels it live", async () => {
  await openBoard();
  assert((await page.textContent("#sysBadge")).includes("ทำงานจริง"), "badge");
  assert(!(await page.$("main .notice")), "a demo or error notice is shown");
  assert(await cardIn("L-0002", "นัดดูจริง"), "L-0002 not in นัดดูจริง");
  await page.goto(FILE + "#/status");
  await page.waitForFunction(() => document.querySelector("#connCheck")?.textContent.includes("คอลัมน์"));
  assert((await page.textContent("#connCheck")).includes("19 คอลัมน์"), await page.textContent("#connCheck"));
});

await test("T3 agent moves a lead one stage: one cell, one audit row, drawer re-opens", async () => {
  await openBoard();
  await role("agent");
  await page.click('[data-lead="L-0001"]');
  await page.click("#moveBtn");
  await page.waitForSelector('.drawer .notice.good');
  assert((await page.textContent(".drawer .notice.good")).includes("บันทึกแล้ว"), "no success note");
  const t = await sheet();
  assert(t["ลีด"][1][C("ขั้น")] === "คัดกรอง", "stage not written");
  assert(t["บันทึก"].length === 2 && t["บันทึก"][1][3] === "moveStage" && t["บันทึก"][1][6] === "ลีดใหม่", "audit: " + JSON.stringify(t["บันทึก"]));
  await axe("drawer-after-success");
  await page.keyboard.press("Escape");
  assert(await cardIn("L-0001", "คัดกรอง"), "board not reloaded");
});

await test("T4 sheet re-sorted: conflict, nothing written, reload re-opens the right lead", async () => {
  await openBoard();
  await role("agent");
  // Someone sorts the sheet after the page loaded: L-0003 moves to row 2, L-0001 (now คัดกรอง) to row 4.
  await page.evaluate(() => { const g = window.__sheet.tabs["ลีด"]; [g[1], g[3]] = [g[3], g[1]]; });
  const auditBefore = (await sheet())["บันทึก"].length;
  await page.click('[data-lead="L-0001"]');
  await page.click("#moveBtn");
  await page.waitForSelector("#moveMsg button");
  assert((await page.textContent("#moveMsg")).includes("ไม่ใช่ลีด L-0001"), await page.textContent("#moveMsg"));
  const t = await sheet();
  assert(t["ลีด"][1][C("ขั้น")] === "คัดกรอง" && t["ลีด"][1][0] === "L-0003", "L-0003 was changed");
  assert(t["บันทึก"].length === auditBefore, "audit grew on conflict");
  await page.click("#moveMsg button");
  await page.waitForSelector('.drawer .notice.good');
  assert((await page.textContent("#drawerTitle")) === "L-0001", "wrong lead re-opened");
  await page.click("#moveBtn");
  await page.waitForFunction(() => window.__sheet.tabs["ลีด"][3][11] === "เสนอห้อง");
  await page.keyboard.press("Escape");
});

await test("T5 agent cannot close; lead closes with typed date and rent", async () => {
  await openBoard();
  await role("agent");
  await page.click('[data-lead="L-0002"]');
  assert(!(await page.$("#closeForm")), "agent sees close form");
  await page.keyboard.press("Escape");
  await role("lead");
  await page.click('[data-lead="L-0002"]');
  await page.fill("#sign", "2026-12-01");
  await page.fill("#rent", "18000");
  await page.click("#closeForm button[type=submit]");
  await page.waitForSelector('.drawer .notice.good');
  const g = (await sheet())["ลีด"].find(r => r[0] === "L-0002");
  assert(g[C("ขั้น")] === "ปิดดีล" && g[C("วันเซ็นสัญญา")] === "2026-12-01" && g[C("ค่าเช่าที่ปิดได้ (฿)")] === "18000", "close not written: " + JSON.stringify(g));
  assert(!(await page.$("#closeForm, #lostForm, #moveBtn")), "closed lead still offers actions");
  await page.keyboard.press("Escape");
});

await test("partial close: a failed cell is reported, stage stays, reload offered", async () => {
  // The fake sheet is re-seeded on a full page load, so add the row and use the app's own reload.
  await page.evaluate(() => { location.hash = "#/board"; window.__sheet.tabs["ลีด"].push(["L-0004", ...Array(10).fill(""), "นัดดูจริง", ...Array(7).fill("")]); });
  await page.click("[data-refresh]");
  await page.waitForSelector('[data-lead="L-0004"]');
  await role("lead");
  await page.evaluate(() => window.__sheet.fails.push({ tool: "update_values", match: "!Q" })); // ค่าเช่า column
  await page.click('[data-lead="L-0004"]');
  await page.fill("#sign", "2026-12-02");
  await page.fill("#rent", "9000");
  await page.click("#closeForm button[type=submit]");
  await page.waitForSelector("#closeMsg button");
  const m = await page.textContent("#closeMsg");
  assert(m.includes("เขียนได้บางช่อง") && !m.includes("บันทึกแล้ว"), m);
  const g = (await sheet())["ลีด"].find(r => r[0] === "L-0004");
  assert(g[C("ขั้น")] === "นัดดูจริง", "stage moved on a partial write");
  await page.keyboard.press("Escape");
});

await test("T6 lost needs a reason; the reason is redacted in the audit log", async () => {
  await openBoard();
  await role("lead");
  await page.click('[data-lead="L-0003"]');
  await page.click("#lostForm button[type=submit]");
  await page.waitForSelector("#reason-err[role=alert]");
  await page.fill("#reason", "ลูกค้าย้ายไปเชียงใหม่");
  await page.click("#lostForm button[type=submit]");
  await page.waitForSelector('.drawer .notice.good');
  const t = await sheet();
  assert(t["ลีด"].find(r => r[0] === "L-0003")[C("ขั้น")] === "ปิดไม่ได้", "not marked lost");
  assert(!JSON.stringify(t["บันทึก"]).includes("เชียงใหม่"), "reason leaked into audit log");
  await page.keyboard.press("Escape");
});

await test("add lead appends the next id; contact stays out of the audit log", async () => {
  await page.goto(FILE + "#/new");
  await page.waitForSelector("#newForm");
  await role("agent");
  await page.selectOption("#channel", "LINE OA");
  await page.fill("#name", "คุณทดสอบสด");
  await page.fill("#contact", "0899999999");
  await page.click("#newForm button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#newMsg")?.textContent.includes("บันทึกแล้ว"));
  const t = await sheet();
  const added = t["ลีด"].at(-1);
  assert(added[0] === "L-0005" && added[C("ขั้น")] === "ลีดใหม่", "added: " + JSON.stringify(added));
  assert(!JSON.stringify(t["บันทึก"]).includes("0899999999"), "contact leaked into audit log");
  assert((await page.inputValue("#name")) === "", "form not cleared after success");
});

await test("follow-up set to today: one cell, one audit row, lead shows on the due page", async () => {
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  await page.evaluate(() => { location.hash = "#/board"; });
  await page.click("[data-refresh]");
  await page.waitForSelector('[data-lead="L-0005"]');
  await role("agent");
  const auditBefore = (await sheet())["บันทึก"].length;
  await page.click('[data-lead="L-0005"]');
  await page.fill("#follow", today);
  await page.click("#followForm button[type=submit]");
  await page.waitForSelector('.drawer .notice.good');
  const t = await sheet();
  assert(t["ลีด"].find(r => r[0] === "L-0005")[C("ติดตามครั้งถัดไป")] === today, "follow not written");
  assert(t["บันทึก"].length === auditBefore + 1 && t["บันทึก"].at(-1)[3] === "setFollowUp", "audit: " + JSON.stringify(t["บันทึก"].at(-1)));
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#/due"; });
  await page.waitForSelector('table [data-lead="L-0005"]');
});

await test("T8 no personal data in URL or storage; no request leaves the page", async () => {
  const s = await page.evaluate(() => location.href + JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie);
  for (const pii of ["คุณทดสอบสด", "0899999999", "เชียงใหม่"]) assert(!decodeURIComponent(s).includes(pii), "found " + pii);
  assert(requests.every(u => u.startsWith("file:")), "network: " + requests.filter(u => !u.startsWith("file:")).join(", "));
});

await test("no page errors", async () => assert(!errors.length, errors.join("\n")));

await page.screenshot({ path: OUT + "screens/live-new-1280.png", fullPage: true });
await openBoard();
await page.screenshot({ path: OUT + "screens/live-board-1280.png", fullPage: true });
await browser.close();
writeFileSync(OUT + "e2e-live.json", JSON.stringify(results, null, 2));
writeFileSync(OUT + "axe-live.json", JSON.stringify(axeOut, null, 2));
const pass = results.filter(r => r.ok).length;
console.log(`\ne2e-live ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
