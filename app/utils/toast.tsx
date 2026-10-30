import hotToast, { type ToastOptions } from "react-hot-toast";

// react-hot-toast plus `toast.info`: a neutral notice (a hint, a pointer at
// the next step), not a success or a failure. Same Toaster and styling as the
// rest (app/layout.tsx), with a cyan "i" and a cyan border.

function InfoIcon() {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold normal-case"
      style={{ backgroundColor: "var(--color-cyan)", color: "var(--color-near-black)" }}
    >
      i
    </span>
  );
}

function info(message: string, options?: ToastOptions) {
  return hotToast(message, {
    icon: <InfoIcon />,
    ...options,
    style: { border: "2px solid var(--color-cyan)", ...options?.style },
  });
}

export const toast = Object.assign(
  (...args: Parameters<typeof hotToast>) => hotToast(...args),
  hotToast,
  { info },
);
