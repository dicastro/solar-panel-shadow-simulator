const FNV_PRIME = 0x01000193;
const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * FNV-1a (Fowler–Noll–Vo) 32-bit hash.
 *
 * Chosen over alternatives (djb2, MurmurHash) because:
 *  - The algorithm is public domain with no licence concerns.
 *  - The implementation fits in ~10 lines with no dependencies.
 *  - 32-bit output produces an 8-character hex string, compact enough for
 *    IndexedDB keys and URL parameters.
 *  - Collision risk is negligible for the input sizes used here (config
 *    objects serialised to JSON, typically < 10 KB).
 *
 * This is not a cryptographic hash and must not be used for security purposes.
 */
export const HashUtils = {
  /**
   * Returns the FNV-1a 32-bit hash of `input` as a lowercase hex string.
   * The result is always exactly 8 characters.
   */
  fnv1a: (input: string): string => {
    let hash = FNV_OFFSET_BASIS;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      // Multiply by FNV prime, keeping only the lower 32 bits.
      hash = Math.imul(hash, FNV_PRIME);
    }
    // >>> 0 converts to an unsigned 32-bit integer before the hex conversion.
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
};