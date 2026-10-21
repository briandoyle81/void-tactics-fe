"use client";

import { useEffect, useState } from "react";

// A thin orange frame around the whole page when it's served from localhost,
// so a local build is never mistaken for the deployed site.

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function LocalhostFrame() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // The hostname is only known in the browser.
    setShow(isLocalHost(window.location.hostname));
  }, []);
  if (!show) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2147483647] border-2 border-orange"
    />
  );
}
