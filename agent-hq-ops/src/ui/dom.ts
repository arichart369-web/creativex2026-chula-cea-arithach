import { esc } from "../rules/escape";
import type { Errors } from "../rules/validate";

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/** A labelled field whose error, when present, is tied with aria-describedby and announced with role=alert. */
export function field(id: string, label: string, control: string, hint = ""): string {
  const hintId = hint ? `${id}-hint` : "";
  return `<div class="field" data-field="${id}">
    <label for="${id}">${esc(label)}</label>
    ${control.replace("%A%", `id="${id}" name="${id}"${hintId ? ` aria-describedby="${hintId}"` : ""}`)}
    ${hint ? `<p class="hint" id="${hintId}">${esc(hint)}</p>` : ""}
  </div>`;
}

export function showErrors(form: HTMLElement, errors: Errors): void {
  form.querySelectorAll(".err").forEach(n => n.remove());
  form.querySelectorAll("[aria-invalid]").forEach(n => {
    n.removeAttribute("aria-invalid");
    const d = (n.getAttribute("aria-describedby") ?? "").split(" ").filter(x => !x.endsWith("-err")).join(" ");
    d ? n.setAttribute("aria-describedby", d) : n.removeAttribute("aria-describedby");
  });
  let first: HTMLElement | null = null;
  for (const [k, msg] of Object.entries(errors)) {
    const input = form.querySelector<HTMLElement>(`#${CSS.escape(k)}`);
    if (!input) continue;
    const p = document.createElement("p");
    p.className = "err";
    p.id = `${k}-err`;
    p.setAttribute("role", "alert");
    p.textContent = msg;
    input.closest(".field")!.append(p);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), p.id].filter(Boolean).join(" "));
    first ??= input;
  }
  first?.focus();
}

/** Show a store result. Only an ok:true result may read as success. */
export function showResult(box: HTMLElement, r: { ok: boolean; message?: string }): void {
  box.className = "msg notice" + (r.ok ? "" : " bad");
  box.setAttribute("role", r.ok ? "status" : "alert");
  box.textContent = r.ok ? "บันทึกแล้ว" : r.message ?? "ไม่สำเร็จ";
}
