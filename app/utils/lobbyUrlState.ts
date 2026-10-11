import { setUrlParams, type SetUrlParamsOptions } from "./urlState";

// Skirmish screen state in the URL (see urlState.ts), shared by Lobbies.tsx
// and LobbiesWeb2.tsx: the lobby being set up (`lobby`), the create form
// (`create=1`) and the fleet viewer (`fleet` + `fleetOwner`, web2 `fleet` +
// `fleetLobby`). Plain
// functions, not hooks, so callbacks that use them need no extra deps.
// Opening pushes a history entry (Back closes it). Closing defaults to
// `{ back: true }` (history.back() when the previous entry is the screen it
// returns to); pass `{ replace: true }` for automatic closes.

type Opts = SetUrlParamsOptions;
const CLOSE: Opts = { back: true };

export function setSelectedLobbyParam(id: bigint | number | null, options?: Opts): void {
  setUrlParams({ lobby: id == null ? null : id.toString() }, options ?? (id == null ? CLOSE : undefined));
}

export function setCreateFormParam(open: boolean, options?: Opts): void {
  setUrlParams({ create: open ? "1" : null }, options ?? (open ? undefined : CLOSE));
}

export function openFleetViewParam(fleetId: bigint | number, owner: string): void {
  setUrlParams({ fleet: fleetId.toString(), fleetOwner: owner });
}

/** Web2 names a fleet by its lobby and fleet id (`fleet` + `fleetLobby`). */
export function openLobbyFleetViewParam(lobbyId: number, fleetId: number): void {
  setUrlParams({ fleet: fleetId.toString(), fleetLobby: lobbyId.toString() });
}

export function closeFleetViewParam(options?: Opts): void {
  setUrlParams({ fleet: null, fleetOwner: null, fleetLobby: null }, options ?? CLOSE);
}
