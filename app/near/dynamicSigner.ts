/**
 * near-api-js Signer backed by the player's Dynamic Solana embedded wallet.
 *
 * A NEAR signature is Ed25519 over sha256(borsh(transaction)), and
 * near-api-js hands signBytes() exactly that 32-byte hash. Dynamic's docs
 * (javascript/reference/tier-2-chains/near) sign NEAR transactions by
 * passing that hash, hex-encoded, to the Solana wallet's signMessage; on
 * Ed25519 chains Dynamic signs the bytes it's given with no prefix.
 *
 * Wallet SDK versions differ in how they take the message, so every
 * signature is verified against the public key before it's used, trying in
 * turn: the connector's signMessage(hex), the Solana signer's
 * signMessage(bytes) (external wallets), and signRawMessage(hex). A
 * signature that doesn't verify is never broadcast.
 */
import { PublicKey, Signer, KeyType, baseDecode, baseEncode } from "near-api-js";
import { bytesToHex, solanaAddressToPublicKeyBytes } from "./identity";

/** The bits of a Dynamic Solana wallet this signer uses (typed loosely: they differ by connector). */
export interface DynamicSolanaWalletLike {
  address: string;
  connector?: unknown;
  getSigner?: () => Promise<unknown>;
}

type SignedLike = string | Uint8Array | { signature?: Uint8Array | string } | undefined | null;

function decodeSignature(signed: SignedLike): Uint8Array | null {
  if (!signed) return null;
  if (signed instanceof Uint8Array) return signed;
  if (typeof signed === "object" && "signature" in signed) return decodeSignature(signed.signature as SignedLike);
  if (typeof signed !== "string") return null;
  const s = signed.trim();
  // hex
  if (/^(0x)?[0-9a-fA-F]{128}$/.test(s)) {
    const hex = s.startsWith("0x") ? s.slice(2) : s;
    const out = new Uint8Array(64);
    for (let i = 0; i < 64; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  // base58
  try {
    const b = baseDecode(s);
    if (b.length === 64) return b;
  } catch {
    // not base58
  }
  // base64
  try {
    const bin = atob(s);
    if (bin.length === 64) {
      const out = new Uint8Array(64);
      for (let i = 0; i < 64; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {
    // not base64
  }
  return null;
}

export class DynamicNearSigner extends Signer {
  private readonly publicKey: PublicKey;

  constructor(private readonly wallet: DynamicSolanaWalletLike) {
    super();
    this.publicKey = new PublicKey({
      keyType: KeyType.ED25519,
      data: solanaAddressToPublicKeyBytes(wallet.address),
    });
  }

  async getPublicKey(): Promise<PublicKey> {
    return this.publicKey;
  }

  protected async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const hex = bytesToHex(bytes);
    const connector = this.wallet.connector as
      | {
          signMessage?: (m: string) => Promise<SignedLike>;
          signRawMessage?: (a: { accountAddress: string; message: string }) => Promise<SignedLike>;
        }
      | undefined;
    const attempts: Array<() => Promise<SignedLike>> = [];
    if (connector?.signMessage) attempts.push(() => connector.signMessage!(hex));
    if (this.wallet.getSigner) {
      attempts.push(async () => {
        const signer = (await this.wallet.getSigner!()) as { signMessage?: (b: Uint8Array) => Promise<SignedLike> };
        return signer.signMessage ? signer.signMessage(bytes) : null;
      });
    }
    if (connector?.signRawMessage && bytes.length === 32) {
      attempts.push(() => connector.signRawMessage!({ accountAddress: this.wallet.address, message: hex }));
    }

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        const sig = decodeSignature(await attempt());
        if (sig && this.publicKey.verify(bytes, sig)) return sig;
      } catch (e) {
        // A user rejection ends it; anything else tries the next method.
        const text = String((e as Error)?.message ?? e).toLowerCase();
        if (text.includes("reject") || text.includes("denied") || text.includes("cancel")) throw e;
        lastError = e;
      }
    }
    throw new Error(
      `The wallet couldn't sign this NEAR transaction (key ${baseEncode(this.publicKey.data).slice(0, 8)}…).` +
        (lastError ? ` ${String((lastError as Error)?.message ?? lastError)}` : ""),
    );
  }
}
