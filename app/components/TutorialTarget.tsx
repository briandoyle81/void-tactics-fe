import type { CSSProperties, ReactNode } from "react";

// Tutorial guidance (styles: .vt-target* in globals.css). Targeting
// brackets close in on the thing to act on, with a soft glow. A "click"
// target adds a tap ripple and a chevron pointing at it; a "highlight" (look
// here, nothing to click) is the brackets and glow alone. Nothing here takes
// pointer events, and the chevron has no box, so there's no second thing
// that looks clickable. Shared by GameDisplay and SimulatedGameDisplay
// through the grid, and by the tutorial's own buttons.

export type TutorialTargetVariant = "click" | "highlight";

/**
 * Brackets, glow and (for "click") ripple over the nearest positioned
 * ancestor. `inside` keeps the brackets within its bounds, for grid cells
 * and controls inside clipped panels.
 */
export function TutorialTargetFrame({
  variant = "click",
  inside = false,
}: {
  variant?: TutorialTargetVariant;
  inside?: boolean;
}) {
  const style = inside
    ? ({ "--vt-target-gap": "-4px", "--vt-target-travel": "2px" } as CSSProperties)
    : undefined;
  return (
    <span className="vt-target z-[30]" style={style} aria-hidden>
      <span className="vt-target-glow" />
      <span className="vt-target-corners">
        <i />
        <i />
        <i />
        <i />
      </span>
      {variant === "click" && <span className="vt-target-ripple" />}
    </span>
  );
}

/**
 * The chevron, with an optional caption (a choice's name, e.g. "Save
 * Ship"). Place it at the target's top-center via `style`; `below` points
 * up from under the target instead.
 */
export function TutorialTargetPointer({
  label,
  below = false,
  className = "",
  style,
}: {
  label?: string;
  below?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`vt-target-pointer${below ? " vt-target-pointer-below" : ""} ${className}`}
      style={style}
      aria-hidden
    >
      {label && <span>{label}</span>}
      <b />
    </span>
  );
}

/**
 * Wraps a control: when `active`, frames it and (for "click") points at it
 * from above or below. In a scrolling list, which would clip anything
 * outside the control, `inside` keeps the brackets within it and
 * `pointer="inline"` puts the chevron in the flow above it; `pointer="none"`
 * leaves it out (a control that's obvious once framed). `className` goes
 * on the wrapper, which takes the control's place in the layout.
 */
export function TutorialTarget({
  active,
  variant = "click",
  pointer = "above",
  inside = false,
  label,
  className = "",
  children,
}: {
  active: boolean;
  variant?: TutorialTargetVariant;
  pointer?: "above" | "below" | "inline" | "none";
  inside?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const showPointer = active && variant === "click" && pointer !== "none";
  if (pointer === "inline") {
    return (
      <div className={`flex flex-col ${className}`}>
        {showPointer && <TutorialTargetPointer label={label} className="vt-target-pointer-inline" />}
        <div className="relative">
          {children}
          {active && <TutorialTargetFrame variant={variant} inside={inside} />}
        </div>
      </div>
    );
  }
  return (
    <div className={`relative ${className}`}>
      {children}
      {active && (
        <>
          <TutorialTargetFrame variant={variant} inside={inside} />
          {showPointer && (
            <TutorialTargetPointer
              label={label}
              below={pointer === "below"}
              className="z-[280]"
              style={
                pointer === "below"
                  ? { left: "50%", top: "calc(100% + 7px)" }
                  : { left: "50%", top: "-7px" }
              }
            />
          )}
        </>
      )}
    </div>
  );
}
