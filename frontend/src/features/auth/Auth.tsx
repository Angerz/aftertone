import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { onSessionExpired, request, setCsrfToken } from "../../api/client";
import { initialAftertoneState, nextAftertoneState } from "../../navigation";
import { EntryScreen } from "./EntryScreen";

type Session = { authenticated: boolean; csrf_token: string | null };
const OwnerContext = createContext(false);
const SignInContext = createContext<() => void>(() => undefined);
export const useOwner = () => useContext(OwnerContext);
export const useOwnerSignIn = () => useContext(SignInContext);
export function OwnerOnly({ children }: { children: ReactNode }) { return useOwner() ? children : null; }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState(false);
  const [ready, setReady] = useState(false);
  const [showLogin, setShowLogin] = useState(window.location.pathname === "/login");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const signInTriggerRef = useRef<HTMLButtonElement>(null);
  const openSignIn = useCallback(() => setShowLogin(true), []);
  const apply = (session: Session) => { setOwner(session.authenticated); setCsrfToken(session.csrf_token); };
  const goTo = (path: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"](replace ? initialAftertoneState(null) : nextAftertoneState(window.history.state), "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  useEffect(() => {
    let active = true;
    const checkSession = () => request<Session>("/api/auth/session").then((session) => { if (active) apply(session); }).catch((cause: Error) => { if (active) { apply({ authenticated: false, csrf_token: null }); setError(cause.message); } }).finally(() => { if (active) setReady(true); });
    checkSession();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { apply({ authenticated: false, csrf_token: null }); setReady(false); checkSession(); } };
    window.addEventListener("pageshow", onPageShow);
    const unsubscribe = onSessionExpired(() => { apply({ authenticated: false, csrf_token: null }); setError("Your session expired. Sign in to continue editing."); });
    return () => { active = false; unsubscribe(); window.removeEventListener("pageshow", onPageShow); };
  }, []);
  useEffect(() => {
    if (showLogin) passwordRef.current?.focus();
    const restore = () => setShowLogin(window.location.pathname === "/login");
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [showLogin]);
  function closeSignIn() { setShowLogin(false); setPassword(""); if (window.location.pathname === "/login") goTo("/", true); signInTriggerRef.current?.focus(); }
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { apply(await request<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) })); setPassword(""); setShowLogin(false); if (["/", "/login"].includes(window.location.pathname)) goTo("/library", true); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError(null);
    try { await request("/api/auth/logout", { method: "POST" }); apply({ authenticated: false, csrf_token: null }); setPassword(""); setShowLogin(false); goTo("/", true); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <OwnerContext.Provider value={owner}><SignInContext.Provider value={openSignIn}>
    <header className="owner-access">
      <a className="owner-access-brand" href="/" onClick={(event) => { event.preventDefault(); goTo("/"); }}>Aftertone</a>
      {owner ? <button type="button" className="text-button" disabled={busy} onClick={signOut}>Sign out</button> : <button ref={signInTriggerRef} type="button" className="text-button" aria-expanded={showLogin} aria-controls="owner-sign-in" onClick={() => showLogin ? closeSignIn() : openSignIn()}>Owner sign in</button>}
    </header>
    {error && <div className="owner-access-feedback"><p className="notice error" role="alert">{error}</p></div>}
    {showLogin && !owner ? <main className="page owner-sign-in"><form id="owner-sign-in" onSubmit={signIn}><p className="eyebrow">Aftertone · Owner access</p><h1>Owner sign in</h1><label>Password<input ref={passwordRef} type="password" autoComplete="current-password" maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="owner-sign-in-actions"><button disabled={busy || !ready} type="submit">{busy ? "Signing in…" : "Sign in"}</button><button type="button" className="text-button" disabled={busy} onClick={closeSignIn}>Cancel</button></div></form></main>
      : ready ? <div key={owner ? "owner" : "visitor"}>{children}</div> : <EntryScreen preparing onExplore={() => goTo("/library")} onSignIn={openSignIn} />}
  </SignInContext.Provider></OwnerContext.Provider>;
}
