export interface AftertoneHistoryState { aftertone?: boolean; internalBack?: boolean; artistDetailTab?: boolean; albumRevisionOrigin?: number }
export function initialAftertoneState(state: unknown): AftertoneHistoryState { return { ...(state as AftertoneHistoryState | null), aftertone: true, internalBack: (state as AftertoneHistoryState | null)?.internalBack === true }; }
export function nextAftertoneState(_state: unknown): AftertoneHistoryState { return { aftertone: true, internalBack: true }; }
export function hasInternalBack(state: unknown): boolean { return (state as AftertoneHistoryState | null)?.internalBack === true; }
export function hasArtistDetailTabBack(state: unknown): boolean { return (state as AftertoneHistoryState | null)?.artistDetailTab === true; }
export function hasAlbumRevisionBack(state: unknown, albumId: number): boolean { return hasInternalBack(state) && (state as AftertoneHistoryState | null)?.albumRevisionOrigin === albumId; }
export const navigationChangeEvent = "aftertone:navigation";
export function notifyNavigationChange(): void { window.dispatchEvent(new Event(navigationChangeEvent)); }
export const beforeNavigationEvent = "aftertone:before-navigation";
export function allowPageNavigation(): boolean { return window.dispatchEvent(new Event(beforeNavigationEvent, { cancelable: true })); }
