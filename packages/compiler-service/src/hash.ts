/**
 * Fast non-cryptographic content fingerprint.
 *
 * Format: `<decimalLength>:<fnv1a32-hex>` — length prefix makes accidental
 * collisions far less likely, but **must not** be the sole invalidation key.
 * {@link IncrementalCompiler} always compares full source text before reuse.
 */

export function hashSource(source: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const fnv = (h >>> 0).toString(16).padStart(8, '0');
  return `${source.length}:${fnv}`;
}
