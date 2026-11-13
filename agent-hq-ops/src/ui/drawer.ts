// Modal drawer with a focus trap; Esc and the close button return focus to the opener.

let opener: HTMLElement | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openDrawer(title: string, body: string, from: HTMLElement): HTMLElement {
  closeDrawer(false);
  opener = from;
  const root = document.getElementById("drawerRoot")!;
  root.innerHTML = `<div class="scrim" data-close></div>
    <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
      <div class="drawer-head"><h2 id="drawerTitle">${title}</h2>
        <button type="button" class="btn secondary" data-close aria-label="ปิดหน้าต่าง">ปิด</button></div>
      ${body}
    </div>`;
  const dlg = root.querySelector<HTMLElement>(".drawer")!;
  root.querySelectorAll("[data-close]").forEach(n => n.addEventListener("click", () => closeDrawer()));
  onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    const f = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", onKey);
  document.getElementById("main")!.setAttribute("inert", "");
  document.querySelector(".bar")?.setAttribute("inert", "");
  dlg.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  return dlg;
}

export function closeDrawer(restore = true): void {
  const root = document.getElementById("drawerRoot");
  if (!root || !root.innerHTML) return;
  root.innerHTML = "";
  if (onKey) document.removeEventListener("keydown", onKey);
  onKey = null;
  document.getElementById("main")!.removeAttribute("inert");
  document.querySelector(".bar")?.removeAttribute("inert");
  if (restore) opener?.focus();
  opener = null;
}
