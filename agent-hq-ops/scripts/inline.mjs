// Turn dist/ into one self-contained HTML file for publishing as a claude.ai artifact:
// the CSS and JS bundles are inlined, nothing is loaded from elsewhere.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
let html = readFileSync(new URL("index.html", dist), "utf8");

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, f) =>
  `<style>${readFileSync(new URL(f, dist), "utf8")}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(new URL(f, dist), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error("an asset reference was not inlined");
mkdirSync(new URL("../dist-artifact/", import.meta.url), { recursive: true });
const out = new URL("../dist-artifact/agent-hq-ops.html", import.meta.url);
writeFileSync(out, html);
console.log(`wrote ${out.pathname} (${(html.length / 1024).toFixed(1)} KB)`);
