export interface AftertoneHistoryState { aftertone?: boolean; internalBack?: boolean }
export function initialAftertoneState(state: unknown): AftertoneHistoryState { return { ...(state as AftertoneHistoryState | null), aftertone: true, internalBack: (state as AftertoneHistoryState | null)?.internalBack === true }; }
export function nextAftertoneState(_state: unknown): AftertoneHistoryState { return { aftertone: true, internalBack: true }; }
export function hasInternalBack(state: unknown): boolean { return (state as AftertoneHistoryState | null)?.internalBack === true; }
