// Turn a Vite dist folder into one self-contained HTML file: the CSS and JS bundles are
// inlined, nothing is loaded from elsewhere.
//
//   node scripts/inline.mjs [distDir] [outFile] [--fragment]
//
// --fragment writes the page content only (title, meta, style, body, script), because the
// claude.ai artifact publisher wraps the file in its own <!doctype html><head><body> skeleton.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const fragment = args.includes("--fragment");
const [distDir = "dist", outName = "dist-artifact/agent-hq-ops.html"] = args.filter(a => a !== "--fragment");
const dist = new URL(`../${distDir}/`, import.meta.url);
let html = readFileSync(new URL("index.html", dist), "utf8");

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) =>
  `<style>${readFileSync(new URL(f, dist), "utf8")}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(new URL(f, dist), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error("an asset reference was not inlined");

if (fragment) {
  const pick = re => [...html.matchAll(re)].map(m => m[0]).join("\n");
  const title = pick(/<title>[\s\S]*?<\/title>/g);
  const styles = pick(/<style>[\s\S]*?<\/style>/g);
  const scripts = pick(/<script type="module">[\s\S]*?<\/script>/g);
  const body = (/<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "").replace(/<script type="module">[\s\S]*?<\/script>/g, "");
  if (!title || !styles || !scripts || !body.trim()) throw new Error("fragment is missing a part");
  html = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${styles}\n${body.trim()}\n${scripts}\n`;
}

const out = new URL(`../${outName}`, import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out.pathname} (${(html.length / 1024).toFixed(1)} KB)${fragment ? " [fragment]" : ""}`);
