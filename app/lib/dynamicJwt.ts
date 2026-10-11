import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Verifies a Dynamic-issued JWT sent by the client (Authorization: Bearer,
// from getAuthToken()). Per Dynamic's docs (auth/tokens#verifying-the-jwt):
// RS256 signature against the environment's JWKS, issuer
// app.dynamicauth.com/<environmentId>, not expired, and a `scope` list that
// includes `user:basic` (anything else means sign-in or MFA isn't finished).

const ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";

const jwks = ENV_ID
  ? createRemoteJWKSet(new URL(`https://app.dynamicauth.com/api/v0/sdk/${ENV_ID}/.well-known/jwks`))
  : null;

export interface DynamicVerifiedCredential {
  address?: string;
  format?: string;
  wallet_provider?: string;
  chain?: string;
}

export interface DynamicJwtClaims extends JWTPayload {
  sub: string;
  scope?: string;
  verified_credentials?: DynamicVerifiedCredential[];
}

export class DynamicAuthError extends Error {}

/** The verified claims, or throws DynamicAuthError. */
export async function verifyDynamicJwt(authorization: string | null): Promise<DynamicJwtClaims> {
  if (!jwks) throw new DynamicAuthError("Dynamic environment not configured");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new DynamicAuthError("Missing token");
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: `app.dynamicauth.com/${ENV_ID}`,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new DynamicAuthError("Invalid token");
  }
  const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
  if (!scopes.includes("user:basic")) throw new DynamicAuthError("Sign-in not complete");
  if (typeof payload.sub !== "string" || !payload.sub) throw new DynamicAuthError("Invalid token");
  return payload as DynamicJwtClaims;
}
