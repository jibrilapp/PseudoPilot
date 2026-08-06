/**
 * @pseudopilot/interpreter
 *
 * Cambridge 9618 AST interpreter (not Python).
 * Pipeline: Lexer → Parser → Checker → Interpreter
 * Translator remains an independent backend.
 */

export const PACKAGE_NAME = '@pseudopilot/interpreter' as const;
export const PACKAGE_VERSION = '0.4.0' as const;

export { runPseudocode, type RunOptions, type RunResult } from './run.js';
export {
  Interpreter,
  type InterpretOptions,
  type InterpretResult,
  type FrameSnapshot,
  type VariableSnapshot,
} from './interpreter.js';
export {
  MemoryHost,
  SeededRandom,
  defaultRandom,
  type RuntimeHost,
  type RandomSource,
} from './host.js';
export {
  VirtualFileSystem,
  FileSystemError,
  type FileOpenMode,
  type FileSystemHost,
  type VirtualFile,
  type VirtualFileHandle,
  type OpenFileSnapshot,
} from './files/index.js';
export {
  Environment,
} from './environment.js';
export {
  CallStack,
  type StackFrame,
  type FrameKind,
  type DebuggerHooks,
  type StatementHookInfo,
  type StatementHookResult,
} from './frame.js';
export {
  executeBuiltin,
  builtinImplNames,
} from './builtins.js';
export {
  type RuntimeValue,
  type ScalarValue,
  type ArrayValue,
  type RecordValue,
  type ObjectValue,
  type EnumValue,
  type PointerValue,
  type SetValue,
  type PointerCell,
  type ValuePlace,
  type Binding,
  type RuntimeDiagnostic,
  formatValue,
  integerValue,
  realValue,
  booleanValue,
  stringValue,
  charValue,
  enumValue,
  pointerValue,
  setValue,
  nilPointer,
  emptySet,
  RuntimeError,
  ReturnSignal,
} from './value.js';
