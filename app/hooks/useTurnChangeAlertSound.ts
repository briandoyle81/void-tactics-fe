import { useEffect, useRef, type MutableRefObject } from "react";
import { playSoundEffect } from "./useSoundEffects";

/** The "it's your turn" sound, as the transition-based hook below plays it.
 * GameDisplay.tsx and GameDisplayWeb2.tsx feed that hook the server/chain
 * turn once nothing is playing back and no move is pending, so a same-turn
 * multi-move sequence dips false while its move is pending and plays back,
 * and the hook's own false->true detection covers it. */
export function playTurnAlertSound() {
  playSoundEffect("/sound/alert.mp3");
}

/**
 * Shared between GameDisplay.tsx (web3) and GameDisplayWeb2.tsx (web2) —
 * plays an alert sound only when the turn changes from opponent to player,
 * not on initial mount (guarded by the previous-turn ref starting at null).
 *
 * `externalTurnRef` is optional: GameDisplay.tsx has a second effect (clearing
 * pending transaction state) that also needs to observe "was it not my turn
 * last render", and must read the exact same ref this hook mutates to
 * preserve their original execution-order coupling (this hook's effect runs
 * first and updates the ref before that second effect reads it). Pass a ref
 * in from the caller when another effect needs to share this state;
 * otherwise the hook manages its own internal ref.
 */
export function useTurnChangeAlertSound(
  isMyTurn: boolean,
  identity: string | null | undefined,
  readOnly: boolean,
  externalTurnRef?: MutableRefObject<boolean | null>,
) {
  const internalTurnRef = useRef<boolean | null>(null);
  const prevTurnRef = externalTurnRef ?? internalTurnRef;

  useEffect(() => {
    if (!readOnly && isMyTurn && identity && prevTurnRef.current === false) {
      playTurnAlertSound();
    }
    prevTurnRef.current = isMyTurn;
    // prevTurnRef is a stable ref (either internal or caller-provided); it
    // intentionally isn't a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, identity, readOnly]);
}

const TURN_TITLE_PREFIX = "● Your turn · ";

/**
 * Tab-title cue for a player who isn't looking: when it becomes their turn
 * while the tab is hidden or the window unfocused, prefix the title until
 * they come back (or the turn passes). Shared by GameDisplay and
 * GameDisplayWeb2.
 */
export function useTurnTitleCue(isMyTurn: boolean, enabled: boolean) {
  const prevTurnRef = useRef<boolean | null>(null);

  useEffect(() => {
    const wasMyTurn = prevTurnRef.current;
    prevTurnRef.current = isMyTurn;
    if (!enabled || !isMyTurn || wasMyTurn !== false) return;
    if (document.visibilityState !== "hidden" && document.hasFocus()) return;

    const clear = () => {
      if (document.title.startsWith(TURN_TITLE_PREFIX)) {
        document.title = document.title.slice(TURN_TITLE_PREFIX.length);
      }
    };
    const onReturn = () => {
      if (document.visibilityState !== "hidden" && document.hasFocus()) clear();
    };
    if (!document.title.startsWith(TURN_TITLE_PREFIX)) {
      document.title = TURN_TITLE_PREFIX + document.title;
    }
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      clear();
    };
  }, [isMyTurn, enabled]);
}
