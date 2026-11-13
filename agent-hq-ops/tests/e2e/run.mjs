// Plain Node e2e: starts `vite preview`, drives Chromium with the pre-installed Playwright,
// runs axe-core on every page, checks overflow at 360/1280 and writes evidence to test-results/.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const AXE = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const BASE = "http://localhost:4173/";
const OUT = new URL("../../test-results/", import.meta.url).pathname;
mkdirSync(OUT + "screens", { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { detached: true, stdio: "ignore" });
const stop = () => { try { process.kill(-server.pid); } catch {} };
for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 200)); } }

const results = [];
const axeOut = {};
const test = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log("ok  ", name); }
  catch (e) { results.push({ name, ok: false, error: String(e.message || e) }); console.log("FAIL", name, "-", e.message); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
const go = async h => { await page.goto(BASE + h); await page.waitForSelector("main h1"); };
const role = async r => { await page.selectOption("#roleSel", r); await page.waitForTimeout(50); };
const axe = async key => {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  const bad = r.violations.filter(v => v.impact === "serious" || v.impact === "critical");
  axeOut[key] = r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  assert(!bad.length, `axe ${key}: ` + bad.map(v => `${v.id}(${v.nodes.length})`).join(", "));
};

const PAGES = ["#/board", "#/new", "#/due", "#/log", "#/status"];

await test("T1 every page loads in demo mode with the badge", async () => {
  for (const h of PAGES) {
    await go(h);
    const badge = await page.textContent("#sysBadge");
    assert(badge.includes("ข้อมูลสาธิต"), `${h} badge: ${badge}`);
  }
});

await test("skip link is the first focusable element and moves focus to main", async () => {
  await page.goto("about:blank");
  await go("#/due");
  await page.keyboard.press("Tab");
  assert((await page.evaluate(() => document.activeElement.className)) === "skip", "first tab is not the skip link");
  await page.keyboard.press("Enter");
  assert((await page.evaluate(() => document.activeElement.id)) === "main", "focus did not move to main");
  assert((await page.evaluate(() => location.hash)) === "#/due", "skip link changed the route");
});

await test("T1 writes return not_connected and never show success", async () => {
  await role("agent");
  await go("#/board");
  await page.click('[data-lead="ตัวอย่าง-01"]');
  await page.click("#moveBtn");
  const m = await page.textContent("#moveMsg");
  assert(m.includes("ยังไม่ได้เชื่อม"), "move message: " + m);
  assert(!m.includes("บันทึกแล้ว"), "shows success");
  await page.keyboard.press("Escape");
});

await test("status page reports the sheet connection without writing", async () => {
  await go("#/status");
  await page.waitForFunction(() => !document.querySelector("#connCheck").textContent.includes("กำลังตรวจ"));
  const t = await page.textContent("#connCheck");
  assert(t.includes("ไม่ได้เปิดใน claude.ai"), "connection line: " + t);
});

await test("board reload button re-reads, keeps focus and announces it", async () => {
  await go("#/board");
  assert(/ข้อมูลเมื่อ \d\d:\d\d/.test(await page.textContent("#loadedAt")), "no last-loaded time");
  await page.focus("[data-refresh]");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#refreshMsg")?.textContent.includes("โหลดข้อมูลใหม่แล้ว"));
  assert(await page.evaluate(() => document.activeElement.matches("[data-refresh]")), "focus lost after reload");
  assert((await page.$$(".card")).length === 6, "cards changed after reload");
});

await test("not_connected offers no reload button", async () => {
  await go("#/board");
  await role("agent");
  await page.click('[data-lead="ตัวอย่าง-01"]');
  await page.click("#moveBtn");
  assert(!(await page.$("#moveMsg button")), "reload offered for a write that never reached the sheet");
  await page.keyboard.press("Escape");
});

await test("T2 viewer sees no write controls", async () => {
  await go("#/board");
  await role("viewer");
  await page.click('[data-lead="ตัวอย่าง-05"]');
  assert(!(await page.$("#moveBtn, #closeForm, #lostForm")), "write control visible to viewer");
  await page.keyboard.press("Escape");
  await go("#/new");
  assert(!(await page.$("#newForm")), "new-lead form visible to viewer");
  await role("agent");
});

await test("T5 agent cannot see close or lost on นัดดูจริง", async () => {
  await go("#/board");
  await role("agent");
  await page.click('[data-lead="ตัวอย่าง-05"]');
  assert(!(await page.$("#closeForm, #lostForm")), "close/lost visible to agent");
  await page.keyboard.press("Escape");
});

await test("T6 lost without a reason shows a tied alert", async () => {
  await go("#/board");
  await role("lead");
  await page.click('[data-lead="ตัวอย่าง-02"]');
  await page.click("#lostForm button[type=submit]");
  const err = await page.$("#reason-err[role=alert]");
  assert(err, "no alert");
  const desc = await page.getAttribute("#reason", "aria-describedby");
  assert(desc && desc.includes("reason-err"), "error not tied: " + desc);
  assert((await page.getAttribute("#reason", "aria-invalid")) === "true", "aria-invalid missing");
  await page.fill("#reason", "เหตุผลทดสอบ");
  await page.click("#lostForm button[type=submit]");
  const m = await page.textContent("#lostMsg");
  assert(m.includes("ยังไม่ได้เชื่อม"), "lost message: " + m);
  await axe("drawer-lost");
  await page.keyboard.press("Escape");
  await role("agent");
});

await test("drawer traps focus, closes on Esc and returns focus", async () => {
  await go("#/board");
  await page.focus('[data-lead="ตัวอย่าง-03"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector(".drawer");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".drawer")), "focus left the drawer");
  }
  await page.keyboard.press("Escape");
  assert(!(await page.$(".drawer")), "drawer still open");
  assert((await page.evaluate(() => document.activeElement.dataset.lead)) === "ตัวอย่าง-03", "focus not returned");
});

await test("T9 keyboard-only new lead: errors, then not_connected", async () => {
  await go("#/new");
  await page.focus("#channel");
  await page.keyboard.press("Tab"); // to the name field
  await page.keyboard.press("Enter"); // implicit submit from a text field
  await page.waitForSelector("#channel-err");
  assert((await page.evaluate(() => document.activeElement.id)) === "channel", "focus not on first error");
  await page.keyboard.press("ArrowDown"); // pick the first channel with the keyboard
  assert((await page.inputValue("#channel")) !== "", "channel not chosen by keyboard");
  await page.focus("#name"); await page.keyboard.type("ลูกค้าทดสอบ");
  await page.focus("#contact"); await page.keyboard.type("0800000000");
  await page.focus("#budget"); await page.keyboard.type("abc");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#budget-err");
  await page.fill("#budget", "");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#newMsg").textContent.length > 0);
  const m = await page.textContent("#newMsg");
  assert(m.includes("ยังไม่ได้เชื่อม"), "new lead message: " + m);
  await axe("new-after-submit");
});

await test("T8 no personal data in URL or storage after the full flow", async () => {
  const s = await page.evaluate(() => ({ url: location.href, ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), ck: document.cookie }));
  const blob = decodeURIComponent(JSON.stringify(s));
  for (const pii of ["ลูกค้าทดสอบ", "0800000000", "เหตุผลทดสอบ"]) assert(!blob.includes(pii), "found " + pii + " in " + blob);
  assert(s.ls === "{}" && s.ss === "{}", "storage not empty");
});

await test("rendered pages hold no script elements (T10 escaping is unit-tested)", async () => {
  await go("#/board");
  assert(!(await page.$("main script, #drawerRoot script")), "script element rendered");
});

for (const [w, h] of [[360, 780], [1280, 900]]) {
  await test(`no horizontal overflow + axe at ${w}px`, async () => {
    await page.setViewportSize({ width: w, height: h });
    for (const r of PAGES) {
      await go(r);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(over <= 0, `${r} overflows by ${over}px at ${w}`);
      await axe(`${r.slice(2)}-${w}`);
      await page.screenshot({ path: `${OUT}screens/${r.slice(2)}-${w}.png`, fullPage: true });
    }
    await go("#/board");
    await role("lead");
    await page.click('[data-lead="ตัวอย่าง-05"]');
    await page.screenshot({ path: `${OUT}screens/drawer-lead-${w}.png` });
    await page.keyboard.press("Escape");
    await role("agent");
  });
}

await test("no page errors", async () => assert(!errors.length, errors.join("\n")));

await browser.close();
stop();
writeFileSync(OUT + "e2e.json", JSON.stringify(results, null, 2));
writeFileSync(OUT + "axe.json", JSON.stringify(axeOut, null, 2));
const pass = results.filter(r => r.ok).length;
console.log(`\ne2e ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
