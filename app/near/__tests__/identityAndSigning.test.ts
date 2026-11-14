import { describe, expect, it } from "vitest";
import { KeyPair, baseEncode, baseDecode } from "near-api-js";
import { createHash } from "node:crypto";
import {
  bytesToHex,
  implicitAccountFromSolanaAddress,
  isImplicitAccount,
  nearPublicKeyFromSolanaAddress,
  shortAccount,
} from "../identity";
import { DynamicNearSigner } from "../dynamicSigner";

// A Solana address is the base58 Ed25519 public key; a NEAR key pair stands in for the wallet.
function fakeSolanaWallet() {
  const kp = KeyPair.fromRandom("ed25519");
  const pubBytes = kp.getPublicKey().data;
  return { kp, address: baseEncode(pubBytes), pubBytes };
}

describe("identity", () => {
  it("maps a Solana address to its NEAR implicit account (hex of the public key)", () => {
    const { address, pubBytes } = fakeSolanaWallet();
    const account = implicitAccountFromSolanaAddress(address);
    expect(account).toBe(bytesToHex(pubBytes));
    expect(isImplicitAccount(account)).toBe(true);
    expect(nearPublicKeyFromSolanaAddress(address)).toBe(`ed25519:${address}`);
  });

  it("rejects something that isn't a 32-byte key", () => {
    expect(() => implicitAccountFromSolanaAddress("abc")).toThrow();
  });

  it("shortens implicit accounts, not named ones", () => {
    expect(shortAccount("a".repeat(64))).toBe("aaaaaa…aaaa");
    expect(shortAccount("game.void-tactics.testnet")).toBe("game.void-tactics.testnet");
  });
});

/** Signs the bytes Dynamic would be handed: the sha256 transaction hash, hex-encoded. */
function signHex(kp: KeyPair, hex: string) {
  const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
  return baseEncode(kp.sign(bytes).signature);
}

async function signWith(wallet: ConstructorParameters<typeof DynamicNearSigner>[0], digest: Uint8Array) {
  const signer = new DynamicNearSigner(wallet) as unknown as { signBytes(b: Uint8Array): Promise<Uint8Array> };
  return signer.signBytes(digest);
}

describe("DynamicNearSigner", () => {
  const digest = new Uint8Array(createHash("sha256").update("a borsh transaction").digest());

  it("uses a signature from the connector's signMessage(hex) when it verifies", async () => {
    const { kp, address } = fakeSolanaWallet();
    const sig = await signWith(
      { address, connector: { signMessage: async (hex: string) => signHex(kp, hex) } },
      digest,
    );
    expect(kp.getPublicKey().verify(digest, sig)).toBe(true);
  });

  it("falls back when signMessage signs the hex text instead of the bytes", async () => {
    const { kp, address } = fakeSolanaWallet();
    const wrong = async (hex: string) => baseEncode(kp.sign(new TextEncoder().encode(hex)).signature);
    const sig = await signWith(
      {
        address,
        connector: { signMessage: wrong },
        getSigner: async () => ({
          signMessage: async (b: Uint8Array) => ({ signature: kp.sign(b).signature }),
        }),
      },
      digest,
    );
    expect(kp.getPublicKey().verify(digest, sig)).toBe(true);
  });

  it("never returns a signature that doesn't verify", async () => {
    const { address } = fakeSolanaWallet();
    const other = KeyPair.fromRandom("ed25519");
    await expect(
      signWith({ address, connector: { signMessage: async (hex: string) => signHex(other, hex) } }, digest),
    ).rejects.toThrow(/couldn't sign/);
  });

  it("stops at a user rejection", async () => {
    const { address } = fakeSolanaWallet();
    await expect(
      signWith(
        {
          address,
          connector: {
            signMessage: async () => {
              throw new Error("User rejected the request");
            },
          },
        },
        digest,
      ),
    ).rejects.toThrow(/User rejected/);
  });

  it("accepts hex and base64 encoded signatures too", async () => {
    const { kp, address } = fakeSolanaWallet();
    const asHex = async (hex: string) => Buffer.from(baseDecode(signHex(kp, hex))).toString("hex");
    const sig = await signWith({ address, connector: { signMessage: asHex } }, digest);
    expect(kp.getPublicKey().verify(digest, sig)).toBe(true);
  });
});
