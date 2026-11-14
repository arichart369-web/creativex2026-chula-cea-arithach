// Who is using the page, from claude.ai's `user` capability (scopes "profile" and "email").
// The audit log is a Google Sheet people read, so the actor written there is the viewer's email
// when they share it, else the platform's opaque id (stable, but only meaningful to claude.ai),
// else "ไม่ระบุตัวตน". Names are shown on screen only, never written: they go stale.

export interface ViewerLike { id: string | null; email: string | null; name: string }
export interface UserLike { me(): Promise<ViewerLike> }

export interface Identity {
  /** Written to the audit log's "ผู้ทำ" column. */
  actor: string;
  kind: "email" | "id" | "anonymous";
  /** Shown in the header; never stored. */
  display: string;
}

export const ANONYMOUS = "ไม่ระบุตัวตน";

export function actorFrom(v: ViewerLike | null): Identity {
  if (v?.email) return { actor: v.email, kind: "email", display: v.name || v.email };
  if (v?.id) return { actor: v.id, kind: "id", display: v.name || "ผู้ใช้ claude.ai" };
  return { actor: ANONYMOUS, kind: "anonymous", display: ANONYMOUS };
}

type ClaudeWindow = { claude?: { use(name: "user"): Promise<UserLike | null> } };

/** Never rejects: outside claude.ai, or without the capability, the viewer is anonymous. */
export async function resolveIdentity(win: ClaudeWindow = window as unknown as ClaudeWindow): Promise<Identity> {
  try {
    const user = win.claude?.use ? await win.claude.use("user") : null;
    return actorFrom(user ? await user.me() : null);
  } catch {
    return actorFrom(null);
  }
}
