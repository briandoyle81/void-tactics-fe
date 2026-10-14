"use client";

import { useEffect } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { getUrlParam, setUrlParams } from "../utils/urlState";

// After a social sign-in, Dynamic sends the player back with its OAuth
// params in the query (dynamicOauthCode, dynamicOauthState) and leaves them
// there. It reads them once, when its provider mounts, so they can go once
// the SDK has loaded. A fallback timer covers an SDK that never reports
// loaded. The code is single-use, but it shouldn't sit in links people copy.

const OAUTH_PARAMS = ["dynamicOauthCode", "dynamicOauthState", "dynamicOauthSsoProviderId"] as const;
const FALLBACK_MS = 10_000;

function clearOAuthParams(): void {
  if (!OAUTH_PARAMS.some((key) => getUrlParam(key) !== null)) return;
  setUrlParams(Object.fromEntries(OAUTH_PARAMS.map((key) => [key, null])), { replace: true });
}

export function ClearOAuthRedirectParams() {
  const { sdkHasLoaded } = useDynamicContext();
  useEffect(() => {
    // A timer, not now: this effect can run before Dynamic's own mount
    // effect (a parent's) has read the params.
    const timer = setTimeout(clearOAuthParams, sdkHasLoaded ? 0 : FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [sdkHasLoaded]);
  return null;
}
