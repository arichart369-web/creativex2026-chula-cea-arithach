// Checks the single-file build (dist-artifact/agent-hq-ops.html) the way a claude.ai artifact
// would load it: from one file, no network, optionally with a window.claude runtime.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const AXE = readFileSync(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const FILE = new URL("../../dist-artifact/agent-hq-ops.html", import.meta.url).href;
const OUT = new URL("../../test-results/", import.meta.url).pathname;
mkdirSync(OUT + "screens", { recursive: true });

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log("ok  ", name); }
  catch (e) { results.push({ name, ok: false, error: String(e.message || e) }); console.log("FAIL", name, "-", e.message); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch();

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1280, height: 900 }, colorScheme: opts.dark ? "dark" : "light" });
  const page = await ctx.newPage();
  const requests = [], errors = [];
  page.on("request", r => requests.push(r.url()));
  page.on("pageerror", e => errors.push(String(e)));
  if (opts.runtime) await page.addInitScript(() => {
    window.__mcpCalls = [];
    window.claude = { use: async name => (name === "mcp" ? { callTool: async (...a) => { window.__mcpCalls.push(a); return { payload: { values: [] } }; } } : null) };
  });
  return { ctx, page, requests, errors };
}

await test("single file loads with no other requests and no errors", async () => {
  const { ctx, page, requests, errors } = await open();
  await page.goto(FILE + "#/board");
  await page.waitForSelector(".card");
  assert(requests.every(u => u.startsWith("file:")), "network requests: " + requests.filter(u => !u.startsWith("file:")).join(", "));
  assert((await page.textContent("#sysBadge")).includes("ข้อมูลสาธิต"), "badge");
  assert(!errors.length, errors.join("\n"));
  await ctx.close();
});

await test("outside claude.ai the status page says so", async () => {
  const { ctx, page } = await open();
  await page.goto(FILE + "#/status");
  await page.waitForFunction(() => !document.querySelector("#connCheck").textContent.includes("กำลังตรวจ"));
  assert((await page.textContent("#connCheck")).includes("ไม่ได้เปิดใน claude.ai"), await page.textContent("#connCheck"));
  await ctx.close();
});

await test("with a runtime but no sheet id it asks for the id and makes no connector call", async () => {
  const { ctx, page } = await open({ runtime: true });
  await page.goto(FILE + "#/status");
  await page.waitForFunction(() => !document.querySelector("#connCheck").textContent.includes("กำลังตรวจ"));
  const t = await page.textContent("#connCheck");
  assert(t.includes("ยังไม่ได้ใส่ id ชีต"), t);
  assert((await page.evaluate(() => window.__mcpCalls.length)) === 0, "connector was called");
  assert((await page.textContent("#sysBadge")).includes("ข้อมูลสาธิต"), "badge changed");
  await ctx.close();
});

for (const width of [360, 1280]) {
  await test(`dark mode passes axe and does not overflow at ${width}px`, async () => {
    const { ctx, page } = await open({ dark: true, width });
    for (const r of ["#/board", "#/new", "#/status"]) {
      await page.goto(FILE + r);
      await page.waitForSelector("main h1");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(over <= 0, `${r} overflows by ${over}`);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations);
      const bad = v.filter(x => x.impact === "serious" || x.impact === "critical");
      assert(!bad.length, `${r}: ` + bad.map(x => `${x.id}(${x.nodes.length})`).join(", "));
      await page.screenshot({ path: `${OUT}screens/dark-${r.slice(2)}-${width}.png`, fullPage: true });
    }
    await ctx.close();
  });
}

await browser.close();
writeFileSync(OUT + "e2e-artifact.json", JSON.stringify(results, null, 2));
const pass = results.filter(r => r.ok).length;
console.log(`\ne2e-artifact ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
