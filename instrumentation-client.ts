import posthog from "posthog-js";
import { NEAR_NETWORK } from "./app/near/config";

const posthogProjectToken =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ??
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN;
const isDev = process.env.NODE_ENV === "development";
const isPosthogEnabled = Boolean(posthogProjectToken) && !isDev;
const isIgnorableDevNetworkError = (value: unknown): boolean => {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "";
  return (
    message === "NetworkError when attempting to fetch resource." ||
    message === "Failed to fetch" ||
    message === "Load failed"
  );
};

if (posthogProjectToken) {
  if (isPosthogEnabled) {
    posthog.init(posthogProjectToken, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-01-30",
      capture_exceptions: true,
      debug: false,
    });
  }
} else {
  console.error(
    "PostHog disabled: set NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN or NEXT_PUBLIC_POSTHOG_TOKEN."
  );
}

// Super properties on every capture: in-app network (picker) before React mounts.
if (typeof window !== "undefined") {
  // Dev-only: avoid noisy browser/runtime fetch failures (often blocked scripts
  // or transient RPC/network issues) from surfacing as full-screen overlays.
  if (isDev) {
    window.addEventListener("error", (event) => {
      if (isIgnorableDevNetworkError(event.error ?? event.message)) {
        event.preventDefault();
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      if (isIgnorableDevNetworkError(event.reason)) {
        event.preventDefault();
      }
    });
  }

  if (isPosthogEnabled) {
    const normalizeError = (value: unknown): { message: string; stack?: string } => {
      if (value instanceof Error) {
        return {
          message: value.message || "Unknown error",
          stack: value.stack,
        };
      }
      if (typeof value === "string") {
        return { message: value };
      }
      try {
        return { message: JSON.stringify(value) };
      } catch {
        return { message: String(value) };
      }
    };

    // Belt-and-suspenders capture for browsers/runtimes where automatic exception
    // capture may miss some global errors.
    window.addEventListener("error", (event) => {
      const normalized = normalizeError(event.error ?? event.message);
      posthog.captureException(new Error(normalized.message), {
        $exception_message: normalized.message,
        $exception_stack_trace: normalized.stack,
        error_filename: event.filename,
        error_lineno: event.lineno,
        error_colno: event.colno,
        error_type: "window.error",
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const normalized = normalizeError(event.reason);
      posthog.captureException(new Error(normalized.message), {
        $exception_message: normalized.message,
        $exception_stack_trace: normalized.stack,
        error_type: "unhandledrejection",
      });
    });

    try {
      posthog.register({
        app_chain_id: `near-${NEAR_NETWORK}`,
        app_chain_name: `NEAR ${NEAR_NETWORK}`,
      });
    } catch {
      /* ignore storage / edge cases */
    }
  }
}
