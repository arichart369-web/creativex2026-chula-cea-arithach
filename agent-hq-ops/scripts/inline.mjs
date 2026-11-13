// Turn dist/ into one self-contained HTML file for publishing as a claude.ai artifact:
// the CSS and JS bundles are inlined, nothing is loaded from elsewhere.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [distDir = "dist", outName = "dist-artifact/agent-hq-ops.html"] = process.argv.slice(2);
const dist = new URL(`../${distDir}/`, import.meta.url);
let html = readFileSync(new URL("index.html", dist), "utf8");

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) =>
  `<style>${readFileSync(new URL(f, dist), "utf8")}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(new URL(f, dist), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error("an asset reference was not inlined");
const out = new URL(`../${outName}`, import.meta.url);
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out.pathname} (${(html.length / 1024).toFixed(1)} KB)`);
