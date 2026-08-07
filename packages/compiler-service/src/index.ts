/**
 * @pseudopilot/compiler-service
 *
 * Incremental compilation + document caching for Cambridge 9618.
 * Does not execute or translate. Does not duplicate parser/checker logic.
 */

export const PACKAGE_NAME = '@pseudopilot/compiler-service' as const;
export const PACKAGE_VERSION = '1.0.0-beta.0' as const;

export { hashSource } from './hash.js';
export {
  STAGE_ORDER,
  stagesFrom,
  freshStageFlags,
  invalidateFlags,
  type CompileStage,
  type StageFlags,
} from './stages.js';
export { DependencyGraph, type DocumentUri } from './dependencies.js';
export {
  type CompiledDocument,
  type CompileStats,
} from './document.js';
export {
  IncrementalCompiler,
  type CompileOptions,
  type CompileResult,
} from './compiler.js';
export {
  CompilerService,
  type CompilerServiceOptions,
  type CompilerPosition,
  type LanguageFeatureProvider,
} from './service.js';
