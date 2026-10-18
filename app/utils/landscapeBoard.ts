import { GRID_DIMENSIONS } from "../types/types";

/**
 * The board's height in the phone landscape battle layout (GameDisplay,
 * GameDisplayWeb2 and SimulatedGameDisplay): the full row height, or less
 * when the width left beside the 12rem left column can't fit the grid's
 * aspect at that height. body carries the notch insets as padding (see
 * globals.css), and 100vw includes them, so they're subtracted too.
 */
export const LANDSCAPE_BOARD_HEIGHT = `min(100%, calc((100vw - 12.5rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) * ${GRID_DIMENSIONS.HEIGHT} / ${GRID_DIMENSIONS.WIDTH}))`;
