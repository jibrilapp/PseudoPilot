/**
 * Python identifier safety — re-exports from {@link ./identifier-sanitizer.js}.
 * Prefer importing sanitize/unsanitize from the sanitizer module directly.
 */

export {
  isPythonReservedIdentifier,
  isPythonSyntaxKeyword,
  isPythonTranslatorBuiltin,
  sanitizePythonIdentifier,
  unsanitizePythonIdentifier,
} from '../python/identifier-sanitizer.js';
