import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import { onSessionExpired, request, setCsrfToken } from "../../api/client";

type Session = { authenticated: boolean; csrf_token: string | null };
const OwnerContext = createContext(false);
export const useOwner = () => useContext(OwnerContext);
export function OwnerOnly({ children }: { children: ReactNode }) { return useOwner() ? children : null; }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState(false);
  const [ready, setReady] = useState(false);
  const [showLogin, setShowLogin] = useState(window.location.pathname === "/login");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const apply = (session: Session) => { setOwner(session.authenticated); setCsrfToken(session.csrf_token); };
  useEffect(() => {
    let active = true;
    request<Session>("/api/auth/session").then((session) => { if (active) apply(session); }).catch((cause: Error) => { if (active) setError(cause.message); }).finally(() => { if (active) setReady(true); });
    const unsubscribe = onSessionExpired(() => { apply({ authenticated: false, csrf_token: null }); setError("Your session expired. Sign in to continue editing."); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { apply(await request<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) })); setPassword(""); setShowLogin(false); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError(null);
    try { await request("/api/auth/logout", { method: "POST" }); apply({ authenticated: false, csrf_token: null }); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <OwnerContext.Provider value={owner}>
    <div className="owner-access">
      {owner ? <button className="text-button" disabled={busy} onClick={signOut}>Sign out</button> : <button className="text-button" onClick={() => setShowLogin((value) => !value)}>Owner sign in</button>}
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {showLogin && !owner && <form className="page" onSubmit={signIn}><h1>Owner sign in</h1><label>Password<input type="password" autoComplete="current-password" maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy || !ready} type="submit">{busy ? "Signing in…" : "Sign in"}</button></form>}
    {ready ? <div key={owner ? "owner" : "visitor"}>{children}</div> : <main className="page"><p>Loading…</p></main>}
  </OwnerContext.Provider>;
}
