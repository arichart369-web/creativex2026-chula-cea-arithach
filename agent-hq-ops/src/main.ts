import { FEATURES, STATUS_TEXT, TEST_SHEET_LIVE, systemStatus } from "./config/status";
import { type Store, createStore } from "./data/store";
import { type Identity, actorFrom, resolveIdentity } from "./data/identity";
import { type ConnectionCheck, checkConnection } from "./data/runtime";
import { afterWrite, findLead, hhmm } from "./rules/afterWrite";
import { badgeFor } from "./rules/badge";
import { esc } from "./rules/escape";
import { type Role, ROLE_TEXT, can, canFollowUp, canMove } from "./rules/roles";
import { type Lead, COLS, dueFollowUps } from "./rules/sheet";
import { STAGES, STAGE_TEAM, isOpen, nextStage } from "./rules/stages";
import { $, field, showErrors, showResult } from "./ui/dom";
import { closeDrawer, openDrawer } from "./ui/drawer";

// In-memory state only: nothing personal goes to the URL, storage, analytics or logs.
const state: { role: Role; leads: Lead[]; source: "live" | "demo"; full: boolean; conn: ConnectionCheck | null; loadError: string; loadedAt: Date | null } =
  { role: "agent", leads: [], source: "demo", full: false, conn: null, loadError: "", loadedAt: null };

// Starts without a client; swapped for one only when the read-only check reaches the sheet.
// Writes stay gated by src/config/status.ts either way.
let store: Store = createStore();
let identity: Identity = actorFrom(null);

const CHANNELS = ["LINE OA", "Facebook", "Instagram", "TikTok", "เว็บไซต์", "โทรศัพท์"];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function renderBadge(source: "live" | "demo" | "pending" = "pending"): void {
  const badge = badgeFor({ config: systemStatus(), source, testSheet: TEST_SHEET_LIVE });
  const b = $("#sysBadge");
  b.className = "badge" + (badge.tone === "live" ? " live" : "");
  b.textContent = badge.text;
}

const demoNotice = () =>
  (state.source === "demo" ? `<p class="notice">${esc(STATUS_TEXT.demo)} · ${esc(FEATURES.leadSheet.note)}</p>` : "") +
  (state.loadError ? `<p class="notice bad" role="alert">อ่านชีตไม่สำเร็จ: ${esc(state.loadError)} (แสดงข้อมูลสาธิตแทน)</p>` : "") +
  (state.full ? `<p class="notice bad">แท็บ "ลีด" เต็มช่วงที่อ่าน (1,000 แถว) ลีดหลังจากนั้นจะไม่แสดง</p>` : "");

function cardHtml(l: Lead): string {
  return `<li><button type="button" class="card" data-lead="${esc(l.id)}">
    <b>${esc(l.id)}</b><span>${esc([l.fields.channel, l.fields.level].filter(Boolean).join(" · ") || "ยังไม่มีรายละเอียด")}</span></button></li>`;
}

function pageBoard(): string {
  const cols = STAGES.map(s => {
    const ls = state.leads.filter(l => l.stage === s);
    return `<section class="col" aria-labelledby="col-${s}">
      <h2 id="col-${s}"><span>${esc(s)}</span><span aria-label="${ls.length} ลีด">${ls.length}</span></h2>
      <p class="team">ทีม${esc(STAGE_TEAM[s])}</p>
      ${ls.length ? `<ul class="cards">${ls.map(cardHtml).join("")}</ul>` : `<p class="empty">ไม่มีลีดในขั้นนี้</p>`}
    </section>`;
  }).join("");
  return `<h1>บอร์ดลีด</h1><p class="lead-in">ลีดทุกขั้นจากแท็บ "ลีด" กดการ์ดเพื่อดูรายละเอียดและเลื่อนขั้น</p>
    <div class="toolbar"><span id="loadedAt">${state.loadedAt ? `ข้อมูลเมื่อ ${hhmm(state.loadedAt)}` : ""}</span>
      <button type="button" class="btn secondary" data-refresh>โหลดข้อมูลใหม่</button><span id="refreshMsg" role="status"></span></div>
    ${demoNotice()}<div class="board">${cols}</div>`;
}

function pageNew(): string {
  const allowed = can(state.role, "addLead");
  if (!allowed.ok) return `<h1>เพิ่มลีด</h1><p class="notice">${esc(allowed.reason!)}</p>`;
  const opts = `<option value="">— เลือก —</option>` + CHANNELS.map(c => `<option>${esc(c)}</option>`).join("");
  return `<h1>เพิ่มลีด</h1><p class="lead-in">ช่องที่มี * ต้องกรอก ข้อมูลจะเขียนลงแท็บ "ลีด" เมื่อเชื่อมต่อแล้ว</p>
    <form class="form" id="newForm" novalidate>
      ${field("channel", "ช่องทาง *", `<select %A% required>${opts}</select>`)}
      ${field("name", "ชื่อลูกค้า *", `<input %A% autocomplete="off" required>`)}
      ${field("contact", "LINE หรือเบอร์โทร *", `<input %A% autocomplete="off" required>`)}
      ${field("budget", "งบต่อเดือน (บาท)", `<input %A% inputmode="numeric">`, "ตัวเลขเท่านั้น เว้นว่างได้")}
      ${field("type", "ประเภทห้อง", `<input %A%>`)}
      ${field("loc", "ทำเล / สถานี", `<input %A%>`)}
      ${field("movein", "วันย้ายเข้า", `<input %A% type="date">`)}
      <div><button class="btn" type="submit">บันทึกลีด</button></div>
      <div id="newMsg" aria-live="polite"></div>
    </form>`;
}

function pageDue(): string {
  const due = dueFollowUps(state.leads, today());
  const rows = due.map(l => `<tr><td><button type="button" class="card" data-lead="${esc(l.id)}"><b>${esc(l.id)}</b></button></td><td>${esc(l.stage)}</td><td>${esc(l.fields.follow)}</td></tr>`).join("");
  return `<h1>ติดตามถึงกำหนด</h1><p class="lead-in">ลีดที่ยังเปิดอยู่และวันติดตามถึงแล้ว เรียงจากเก่าสุด</p>${demoNotice()}
    ${due.length ? `<div class="table-wrap"><table><caption class="lead-in">${due.length} ลีด</caption><thead><tr><th scope="col">รหัสลีด</th><th scope="col">ขั้น</th><th scope="col">ติดตามครั้งถัดไป</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">ไม่มีลีดที่ถึงกำหนดติดตาม</p>`}`;
}

function pageLog(): string {
  const f = FEATURES.auditLog;
  return `<h1>บันทึกการเปลี่ยนแปลง</h1><p class="lead-in">ทุกการเขียนที่สำเร็จจะเพิ่ม 1 แถว: เวลา · ผู้ทำ · บทบาท · การกระทำ · รหัสลีด · คอลัมน์ · ค่าเดิม · ค่าใหม่</p>
    <p class="notice">${esc(STATUS_TEXT[f.status])} · ${esc(f.note)}</p><p class="empty">ยังไม่มีรายการ</p>`;
}

function pageStatus(): string {
  const rows = Object.values(FEATURES).map(f => `<tr><td>${esc(f.label)}</td><td><span class="st ${f.status}">${esc(STATUS_TEXT[f.status])}</span></td><td>${esc(f.note)}</td></tr>`).join("");
  return `<h1>สถานะระบบ</h1><p class="lead-in">ค่าทั้งหมดมาจากไฟล์ <code>src/config/status.ts</code> ที่เดียว</p>
    <div class="table-wrap"><table><thead><tr><th scope="col">ส่วน</th><th scope="col">สถานะ</th><th scope="col">หมายเหตุ</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h2 class="sub">การเชื่อมต่อชีต (อ่านอย่างเดียว)</h2><p id="connCheck" class="notice" role="status">กำลังตรวจ…</p>`;
}

function fillConnection(): void {
  const r = state.conn;
  const box = document.getElementById("connCheck");
  if (!box || !r) return;
  box.className = "notice" + (r.ok ? " good" : "");
  box.textContent = r.ok ? `อ่านหัวตารางแท็บ "ลีด" ได้ (${r.headers} คอลัมน์) · การเขียนยังปิดอยู่จนกว่าจะผ่าน gate` : r.message;
}

const ROUTES: Record<string, () => string> = { "#board": pageBoard, "#new": pageNew, "#due": pageDue, "#log": pageLog, "#status": pageStatus };

function render(focus = false): void {
  const route = ROUTES[location.hash] ? location.hash : "#board";
  const main = $("#main");
  main.innerHTML = ROUTES[route]();
  document.querySelectorAll<HTMLAnchorElement>(".nav a").forEach(a => (a.getAttribute("href") === route ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.title = `${$("h1", main).textContent} · Agent HQ`;
  if (focus) main.focus();
  bind(main);
  if (route === "#status") fillConnection();
}

async function refresh(): Promise<void> {
  closeDrawer(false);
  await load();
  render();
}

/** Re-open a lead after a reload; it is found by id, so a re-sorted sheet is fine. */
function reopen(id: string, note: string): void {
  const l = findLead(state.leads, id);
  const card = document.querySelector<HTMLElement>(`[data-lead="${CSS.escape(id)}"]`);
  if (l) { openLead(id, card ?? $("#main"), note); return; }
  const box = document.getElementById("refreshMsg");
  if (box) box.textContent = `ไม่พบลีด ${id} ในชีตแล้ว`;
}

/** Show a store result, then reload or offer a reload as afterWrite says. */
async function handleWrite(box: HTMLElement, r: Awaited<ReturnType<Store["moveStage"]>>, leadId?: string): Promise<void> {
  const next = afterWrite(r);
  if (next === "reload") {
    await refresh();
    if (leadId) reopen(leadId, "บันทึกแล้ว · โหลดข้อมูลจากชีตใหม่แล้ว");
    else { const m = document.getElementById("newMsg"); if (m) showResult(m, r); }
    return;
  }
  showResult(box, r);
  if (next === "offer_reload") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn secondary";
    b.textContent = "โหลดข้อมูลใหม่";
    b.addEventListener("click", async () => { await refresh(); if (leadId) reopen(leadId, "โหลดข้อมูลจากชีตใหม่แล้ว"); });
    box.append(" ", b);
  }
}

function bind(main: HTMLElement): void {
  main.querySelectorAll<HTMLButtonElement>("[data-lead]").forEach(b => b.addEventListener("click", () => openLead(b.dataset.lead!, b)));
  main.querySelector<HTMLButtonElement>("[data-refresh]")?.addEventListener("click", async () => {
    await refresh();
    const b = document.querySelector<HTMLElement>("[data-refresh]");
    b?.focus();
    const m = document.getElementById("refreshMsg");
    if (m) m.textContent = "โหลดข้อมูลใหม่แล้ว";
  });
  const form = main.querySelector<HTMLFormElement>("#newForm");
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    const v = (k: string) => (form.elements.namedItem(k) as HTMLInputElement).value;
    const r = await store.addLead(state.role, { channel: v("channel"), name: v("name"), contact: v("contact"), budget: v("budget"), type: v("type"), loc: v("loc"), movein: v("movein") });
    showErrors(form, !r.ok && r.status === "invalid" ? r.errors : {});
    if (r.ok || r.status !== "invalid") await handleWrite($("#newMsg", form), r);
  });
}

function openLead(id: string, from: HTMLElement, note = ""): void {
  const l = state.leads.find(x => x.id === id);
  if (!l) return;
  const role = state.role;
  const facts = (Object.keys(COLS) as (keyof typeof COLS)[]).filter(k => k !== "id" && l.fields[k]).map(k => `<dt>${esc(COLS[k])}</dt><dd>${esc(l.fields[k])}</dd>`).join("");
  const nx = nextStage(l.stage);
  const parts: string[] = [];
  if (nx && nx !== "ปิดดีล" && canMove(role, l.stage, nx).ok)
    parts.push(`<section><h3>เลื่อนขั้น</h3><button type="button" class="btn" id="moveBtn">เลื่อนไป "${esc(nx)}"</button><div id="moveMsg" aria-live="polite"></div></section>`);
  if (nx === "ปิดดีล" && canMove(role, l.stage, "ปิดดีล").ok)
    parts.push(`<section><h3>ปิดดีล</h3><form class="form" id="closeForm" novalidate>
      ${field("sign", "วันเซ็นสัญญา *", `<input %A% type="date">`)}
      ${field("rent", "ค่าเช่าที่ปิดได้ (บาท) *", `<input %A% inputmode="numeric">`, "กรอกตามสัญญา ระบบไม่คำนวณให้")}
      <div><button class="btn" type="submit">บันทึกปิดดีล</button></div><div id="closeMsg" aria-live="polite"></div></form></section>`);
  if (canFollowUp(role, l.stage).ok)
    parts.push(`<section><h3>นัดติดตามครั้งถัดไป</h3><form class="form" id="followForm" novalidate>
      ${field("follow", "วันติดตาม *", `<input %A% type="date" min="${today()}" value="${esc(l.fields.follow ?? "")}">`, "วันนี้หรือหลังจากนี้")}
      <div><button class="btn secondary" type="submit">บันทึกวันติดตาม</button></div><div id="followMsg" aria-live="polite"></div></form></section>`);
  if (isOpen(l.stage) && canMove(role, l.stage, "ปิดไม่ได้").ok)
    parts.push(`<section><h3>ปิดไม่ได้</h3><form class="form" id="lostForm" novalidate>
      ${field("reason", "เหตุผลที่ปิดไม่ได้ *", `<textarea %A% rows="3"></textarea>`)}
      <div><button class="btn secondary" type="submit">บันทึกปิดไม่ได้</button></div><div id="lostMsg" aria-live="polite"></div></form></section>`);
  const none = !parts.length ? `<p class="notice">${esc(isOpen(l.stage) ? `บทบาท${ROLE_TEXT[role]}ทำอะไรกับลีดนี้ไม่ได้` : "ลีดนี้ปิดแล้ว")}</p>` : "";
  const dlg = openDrawer(esc(l.id), `${note ? `<p class="notice good" role="status">${esc(note)}</p>` : ""}${demoNotice()}<p><span class="st ${state.source}">${esc(l.stage)}</span> · ทีม${esc(STAGE_TEAM[l.stage])}</p><dl>${facts}</dl>${none}<div class="actions">${parts.join("")}</div>`, from);

  dlg.querySelector("#moveBtn")?.addEventListener("click", async () => handleWrite($("#moveMsg", dlg), await store.moveStage(role, l, nx!), l.id));
  const cf = dlg.querySelector<HTMLFormElement>("#closeForm");
  cf?.addEventListener("submit", async e => {
    e.preventDefault();
    const r = await store.closeDeal(role, l, { sign: ($("#sign", cf) as HTMLInputElement).value, rent: ($("#rent", cf) as HTMLInputElement).value });
    showErrors(cf, !r.ok && r.status === "invalid" ? r.errors : {});
    if (r.ok || r.status !== "invalid") await handleWrite($("#closeMsg", cf), r, l.id);
  });
  const ff = dlg.querySelector<HTMLFormElement>("#followForm");
  ff?.addEventListener("submit", async e => {
    e.preventDefault();
    const r = await store.setFollowUp(role, l, ($("#follow", ff) as HTMLInputElement).value);
    showErrors(ff, !r.ok && r.status === "invalid" ? r.errors : {});
    if (r.ok || r.status !== "invalid") await handleWrite($("#followMsg", ff), r, l.id);
  });
  const lf = dlg.querySelector<HTMLFormElement>("#lostForm");
  lf?.addEventListener("submit", async e => {
    e.preventDefault();
    const r = await store.markLost(role, l, ($("#reason", lf) as HTMLTextAreaElement).value);
    showErrors(lf, !r.ok && r.status === "invalid" ? r.errors : {});
    if (r.ok || r.status !== "invalid") await handleWrite($("#lostMsg", lf), r, l.id);
  });
}

async function start(): Promise<void> {
  renderBadge();
  // First paint uses the demo rows straight away; the connector check can take up to 10 s.
  const d = await createStore().listLeads();
  Object.assign(state, { leads: d.leads, source: d.status, loadedAt: new Date() });
  const sel = $("#roleSel") as HTMLSelectElement;
  sel.value = state.role;
  sel.addEventListener("change", () => { state.role = sel.value as Role; closeDrawer(false); render(); });
  // The skip link moves focus without touching the route hash.
  $(".skip").addEventListener("click", e => { e.preventDefault(); $("#main").focus(); });
  window.addEventListener("hashchange", () => { closeDrawer(false); render(true); });
  render();
  await load();
  // Re-render only when the data changed, so a form being filled in is not wiped.
  if (state.source === "live" || state.loadError) render(); else fillConnection();
}

async function load(): Promise<void> {
  state.conn = await checkConnection();
  identity = await resolveIdentity();
  const who = document.getElementById("whoAmI");
  if (who) who.textContent = `ผู้ใช้: ${identity.display}`;
  if (state.conn.ok) store = createStore({ client: state.conn.client, actor: identity.actor });
  try {
    const r = await store.listLeads();
    Object.assign(state, { leads: r.leads, source: r.status, full: r.full, loadError: "", loadedAt: new Date() });
  } catch (e) {
    const r = await createStore().listLeads();
    Object.assign(state, { leads: r.leads, source: r.status, full: false, loadError: e instanceof Error ? e.message : String(e), loadedAt: new Date() });
  }
  // The badge follows what was actually read, not only what config says.
  renderBadge(state.source);
}

start();
