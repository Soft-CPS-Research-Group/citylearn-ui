// Tuple encoding is injective: separators and punctuation in source names do
// not collide. Series IDs stay reproducible across workers and reimports.
export const sourceIdentity = (kind, parts) => `${kind}:${JSON.stringify(parts)}`;

export async function simulationIdentity(path, files) {
  const identity = JSON.stringify([path, files]);
  // Keep folder IDs compact even with thousands of files. Plain HTTP browsers
  // without Web Crypto retain the full unambiguous identity instead of a weak hash.
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(identity),
      );
      return (
        "simulation:" +
        Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
      );
    }
  } catch {
    // A blocked optional crypto provider must not prevent reading valid exports.
  }
  return sourceIdentity("simulation", [path, files]);
}
