import { useEffect } from "react";
import { beforeNavigationEvent } from "../navigation";

/** Let global links reuse an editor's existing dirty state and discard prompt. */
export function useUnsavedNavigation(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = (event: Event) => { if (!window.confirm(message)) event.preventDefault(); };
    window.addEventListener(beforeNavigationEvent, confirm);
    return () => window.removeEventListener(beforeNavigationEvent, confirm);
  }, [dirty, message]);
}
