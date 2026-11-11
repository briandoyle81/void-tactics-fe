// Positions as players see them: (X, Y), X across (the column) and Y down
// (the row). The contracts, the board data and all game logic keep row and
// col; only text shown to people goes through this.

/** "(x, y)" for a board tile. */
export function formatGridPosition(position: { row: number; col: number }): string {
  return `(${position.col}, ${position.row})`;
}
