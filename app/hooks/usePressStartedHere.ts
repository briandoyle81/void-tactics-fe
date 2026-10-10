import React from "react";

/**
 * For overlays that open right as something resolves (RoundStartModal,
 * GameResultModal): a button only acts on a press that started on it after
 * the overlay opened. Otherwise a click already in progress underneath (the
 * comms OK, the submit button, a board click) lands on the fresh overlay and
 * dismisses it, or takes its action, unseen.
 *
 * Spread `pressProps(handler)` onto each guarded button. Keyboard
 * activation (Enter/Space, click detail 0) always counts.
 */
export function usePressStartedHere() {
  const startedRef = React.useRef(false);
  return React.useCallback(
    (handler: () => void) => ({
      onPointerDown: () => {
        startedRef.current = true;
      },
      onClick: (e: React.MouseEvent) => {
        if (e.detail !== 0 && !startedRef.current) return;
        startedRef.current = false;
        handler();
      },
    }),
    [],
  );
}
