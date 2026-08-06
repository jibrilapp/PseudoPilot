import { printPythonIndex } from './array-index.js';
import { sanitizePythonIdentifier as pyId } from './identifier-sanitizer.js';
import type {
  IrArrayDimension,
  IrArrayType,
  IrAssignTarget,
  IrBinaryExpression,
  IrClassMember,
  IrExpression,
  IrIndexExpression,
  IrMemberExpression,
  IrProgram,
  IrSimpleType,
  IrStatement,
  IrTypeField,
  IrTypeName,
  IrTypeReference,
  IrUnaryExpression,
} from '../ir/nodes.js';
import {
  escapePythonString,
  escapePythonChar,
  formatBooleanPython,
  formatRealLiteral,
} from '../rules/literals.js';
import {
  BINARY_PRECEDENCE,
  UNARY_PRECEDENCE,
  irBinaryToPython,
  irUnaryToPython,
  isWordOperator,
} from '../rules/operators.js';
import { tryPrintBuiltinPython } from '../builtins/emit.js';
import { printTrivia } from '../trivia/attach.js';
import {
  PP_EOF_HELPER,
  PP_FILES_INIT,
  PP_RANDOM_FILES_INIT,
  PP_RANDOM_HELPERS,
  fileHandleName,
  programUsesEof,
  programUsesFiles,
  programUsesRandomFiles,
  pythonMode,
} from '../file/mapping.js';

const INDENT = '    ';

type FilePrintCtx = {
  /** literal path → Python handle identifier */
  readonly handles: Map<string, string>;
  /** literal paths opened FOR RANDOM (CLOSEFILE is a no-op pass) */
  readonly randomPaths: Set<string>;
  needsDict: boolean;
  needsRandomDict: boolean;
};

/** Active while printing — emit _pp_input_bool / _pp_input_char helpers once. */
let needsInputBoolHelper = false;
let needsInputCharHelper = false;
let needsInputDateHelper = false;

const PP_INPUT_BOOL_HELPER = `def _pp_input_bool() -> bool:
    s = input().strip().upper()
    if s == "TRUE":
        return True
    if s == "FALSE":
        return False
    raise ValueError(f"Invalid BOOLEAN INPUT '{s}' (expected TRUE or FALSE)")`;

const PP_INPUT_CHAR_HELPER = `def _pp_input_char() -> str:
    s = input()
    if len(s) < 1:
        raise ValueError("CHAR INPUT requires one character.")
    return s[0]`;

const PP_INPUT_DATE_HELPER = `def _pp_input_date():
    raw = input().strip()
    parts = raw.split("/")
    if len(parts) != 3:
        raise ValueError("DATE INPUT requires dd/mm/yyyy.")
    d, m, y = (int(parts[0]), int(parts[1]), int(parts[2]))
    return date(y, m, d)
`;

/** Match interpreter IS_NUM: optional sign + digits, at most one decimal point. */
const PP_IS_NUM_HELPER = `def _pp_is_num(value) -> bool:
    import re
    t = str(value).strip()
    if t == "":
        return False
    return re.fullmatch(r"[+-]?(\\d+(\\.\\d*)?|\\.\\d+)", t) is not None
`;

/** Mutable cell for Cambridge BYREF scalar parameters (one-line for reverse skip). */
const PP_CELL_HELPER = `def _pp_cell(value): return [value]`;

/**
 * Truncating DIV/MOD (Cambridge / interpreter): toward zero, not floor.
 * Python `//` and `%` floor toward -∞ on negatives.
 * One-line defs so reverse skip stays reliable.
 */
const PP_DIV_MOD_HELPERS = `def _pp_div(a, b): return int(a / b)
def _pp_mod(a, b): return a - _pp_div(a, b) * b`;

/** RIGHT(s, 0) → "" — Python s[-0:] is the full string. */
const PP_RIGHT_HELPER = `def _pp_right(s, n): return s[-n:] if n else ""`;

/** Pointer cells reuse list cells (same shape as BYREF `_pp_cell`). */
const PP_POINTER_HELPERS = `def _pp_addr(cell): return cell
def _pp_load(cell): return cell[0]
def _pp_store(cell, value): cell[0] = value
def _pp_pload(ptr): return ptr[0]
def _pp_pstore(ptr, value): ptr[0] = value`;

/**
 * Enum ordinal +/− (IntEnum `e + 1` yields int).
 * One-line bodies so reverse `def _pp_*` skip cannot swallow following stmts.
 */
const PP_ENUM_ADD_HELPER = `def _pp_enum_add(a, b): return type(a)(int(a) + b) if hasattr(a, "value") and type(a).__name__ != "int" else a + b
def _pp_enum_sub(a, b): return type(a)(int(a) - b) if hasattr(a, "value") and type(a).__name__ != "int" else a - b`;

/** Format OUTPUT for enum / NIL pointer (sets print via Python set/str). */
const PP_SHOW_HELPER = `def _pp_show(v): return v.name if hasattr(v, "name") and type(v).__module__ == "enum" else ("NIL" if v is None else v)`;

const PP_DEFINE_HELPER = `def _pp_define(_type, *values): return set(values)`;

/** Active while {@link printPython} runs — user TYPE registries for emit. */
type UserTypePrintCtx = {
  readonly enumTypes: Map<string, { readonly name: string; readonly members: readonly string[] }>;
  readonly enumMembers: Map<string, string>; // memberKey → enum display name
  readonly pointerTypes: Set<string>;
  readonly setTypes: Set<string>;
  readonly addressTaken: Set<string>; // bindingKey of address-taken scalars
  readonly cellVars: Set<string>; // bindingKey — DECLARE'd as _PpCell
  /** Variables DECLARE'd with an enum TYPE (bindingKey). */
  readonly enumVars: Set<string>;
  /** Variables DECLARE'd with a pointer TYPE whose target is an enum. */
  readonly enumPointerVars: Set<string>;
};

let activeUserTypes: UserTypePrintCtx | null = null;
let needsDivModHelpers = false;
let needsRightHelper = false;
let needsPointerHelpers = false;
let needsEnumArithHelpers = false;
let needsShowHelper = false;
let needsDefineHelper = false;

/**
 * Cambridge INPUT has no prompt; Python `input(prompt)` reverse may set prompt.
 * Typed conversions match the interpreter's parseInput rules.
 */
function printTypedInputRhs(
  valueType: IrTypeName | null,
  prompt: IrExpression | null,
): string {
  const raw =
    prompt !== null ? `input(${printExpr(prompt, 0)})` : 'input()';
  switch (valueType) {
    case 'INTEGER':
      return `int(${raw}.strip())`;
    case 'REAL':
      return `float(${raw}.strip())`;
    case 'BOOLEAN':
      needsInputBoolHelper = true;
      return '_pp_input_bool()';
    case 'CHAR':
      needsInputCharHelper = true;
      return '_pp_input_char()';
    case 'DATE':
      needsInputDateHelper = true;
      return '_pp_input_date()';
    case 'STRING':
    case null:
      return raw;
    default: {
      const _exhaustive: never = valueType;
      return _exhaustive;
    }
  }
}

/** Active while {@link printPython} runs — avoids threading ctx through every expr. */
let activeFileCtx: FilePrintCtx | null = null;

/**
 * Lower-cased CLASS names in the program — active while {@link printPython}
 * runs. Distinguishes a `DECLARE X : Foo` where `Foo` is a CLASS (reference
 * type; default `None`, never eagerly constructed) from a TYPE record
 * (value type; default `Foo()`).
 */
let activeClassNames: ReadonlySet<string> = new Set();

function isKnownClassName(name: string): boolean {
  return activeClassNames.has(name.toLowerCase());
}

function collectClassNames(program: IrProgram): Set<string> {
  const names = new Set<string>();
  for (const stmt of program.body) {
    if (stmt.kind === 'IrClassDeclaration') names.add(stmt.name.toLowerCase());
  }
  return names;
}

function collectUserTypeCtx(program: IrProgram): UserTypePrintCtx {
  const enumTypes = new Map<
    string,
    { readonly name: string; readonly members: readonly string[] }
  >();
  const enumMembers = new Map<string, string>();
  const pointerTypes = new Set<string>();
  const setTypes = new Set<string>();
  const addressTaken = new Set<string>();
  const enumVars = new Set<string>();
  const enumPointerVars = new Set<string>();
  /** pointer type key → true when target is an enum TYPE */
  const pointerToEnum = new Map<string, boolean>();

  for (const stmt of program.body) {
    if (stmt.kind === 'IrEnumTypeDeclaration') {
      const key = stmt.name.toLowerCase();
      enumTypes.set(key, { name: stmt.name, members: stmt.members });
      for (const m of stmt.members) {
        enumMembers.set(m.toLowerCase(), stmt.name);
      }
    } else if (stmt.kind === 'IrPointerTypeDeclaration') {
      pointerTypes.add(stmt.name.toLowerCase());
      const targetIsEnum =
        stmt.targetType.kind === 'IrNamedType' &&
        // enum may appear later in body — resolve in second pass
        true;
      void targetIsEnum;
      pointerToEnum.set(
        stmt.name.toLowerCase(),
        stmt.targetType.kind === 'IrNamedType' &&
          enumTypes.has(stmt.targetType.name.toLowerCase()),
      );
    } else if (stmt.kind === 'IrSetTypeDeclaration') {
      setTypes.add(stmt.name.toLowerCase());
    }
  }

  // Second pass: pointer targets may reference enums declared later.
  for (const stmt of program.body) {
    if (stmt.kind === 'IrPointerTypeDeclaration') {
      pointerToEnum.set(
        stmt.name.toLowerCase(),
        stmt.targetType.kind === 'IrNamedType' &&
          enumTypes.has(stmt.targetType.name.toLowerCase()),
      );
    }
  }

  for (const stmt of program.body) {
    if (stmt.kind === 'IrDeclareStatement' && stmt.typeRef.kind === 'IrNamedType') {
      const tk = stmt.typeRef.name.toLowerCase();
      if (enumTypes.has(tk)) {
        for (const n of stmt.names) enumVars.add(n.toLowerCase());
      }
      if (pointerToEnum.get(tk)) {
        for (const n of stmt.names) enumPointerVars.add(n.toLowerCase());
      }
    }
  }

  const walkExpr = (e: IrExpression): void => {
    switch (e.kind) {
      case 'IrAddressOfExpression':
        if (e.target.kind === 'IrIdentifier') {
          addressTaken.add(e.target.name.toLowerCase());
        }
        walkExprTarget(e.target);
        return;
      case 'IrDerefExpression':
        walkExpr(e.pointer);
        return;
      case 'IrCallExpression':
        e.args.forEach(walkExpr);
        return;
      case 'IrUnaryExpression':
        walkExpr(e.argument);
        return;
      case 'IrBinaryExpression':
        walkExpr(e.left);
        walkExpr(e.right);
        return;
      case 'IrGroupingExpression':
        walkExpr(e.expression);
        return;
      case 'IrIndexExpression':
        walkExpr(e.array);
        e.indices.forEach(walkExpr);
        return;
      case 'IrMemberExpression':
        walkExpr(e.object);
        return;
      case 'IrDeepCopyExpression':
        walkExpr(e.value);
        return;
      case 'IrNewExpression':
        e.args.forEach(walkExpr);
        return;
      case 'IrMethodCallExpression':
        walkExpr(e.object);
        e.args.forEach(walkExpr);
        return;
      case 'IrEofExpression':
        walkExpr(e.fileName);
        return;
      default:
        return;
    }
  };

  const walkExprTarget = (t: IrAssignTarget): void => {
    if (t.kind === 'IrDerefExpression') walkExpr(t.pointer);
    else if (t.kind === 'IrIndexExpression') {
      walkExpr(t.array);
      t.indices.forEach(walkExpr);
    } else if (t.kind === 'IrMemberExpression') walkExpr(t.object);
  };

  const walkStmt = (s: IrStatement): void => {
    switch (s.kind) {
      case 'IrAssignment':
        walkExprTarget(s.target);
        walkExpr(s.value);
        return;
      case 'IrOutput':
        s.values.forEach(walkExpr);
        return;
      case 'IrInput':
        walkExprTarget(s.target);
        if (s.prompt) walkExpr(s.prompt);
        return;
      case 'IrDefineStatement':
        s.values.forEach(walkExpr);
        return;
      case 'IrExpressionStatement':
        walkExpr(s.expression);
        return;
      case 'IrIfStatement':
        walkExpr(s.condition);
        s.consequent.forEach(walkStmt);
        s.elseIfClauses.forEach((c) => {
          walkExpr(c.condition);
          c.consequent.forEach(walkStmt);
        });
        s.alternate?.forEach(walkStmt);
        return;
      case 'IrWhileStatement':
      case 'IrRepeatStatement':
        walkExpr(s.condition);
        s.body.forEach(walkStmt);
        return;
      case 'IrForStatement':
        walkExpr(s.start);
        walkExpr(s.end);
        if (s.step) walkExpr(s.step);
        s.body.forEach(walkStmt);
        return;
      case 'IrCaseStatement':
        walkExpr(s.discriminant);
        s.arms.forEach((a) => a.body.forEach(walkStmt));
        s.otherwise?.forEach(walkStmt);
        return;
      case 'IrProcedureDeclaration':
      case 'IrFunctionDeclaration':
        s.body.forEach(walkStmt);
        return;
      case 'IrClassDeclaration':
        s.members.forEach((m) => {
          if (m.kind !== 'IrClassProperty') m.body.forEach(walkStmt);
        });
        return;
      case 'IrCallStatement':
        s.args.forEach(walkExpr);
        return;
      case 'IrReturnStatement':
      case 'IrConstantStatement':
        walkExpr(s.value);
        return;
      default:
        return;
    }
  };

  for (const stmt of program.body) walkStmt(stmt);

  // Scalars that are address-taken become _PpCell wrappers.
  const cellVars = new Set(addressTaken);

  return {
    enumTypes,
    enumMembers,
    pointerTypes,
    setTypes,
    addressTaken,
    cellVars,
    enumVars,
    enumPointerVars,
  };
}

function isEnumNamedType(name: string): boolean {
  return activeUserTypes?.enumTypes.has(name.toLowerCase()) ?? false;
}

function isPointerNamedType(name: string): boolean {
  return activeUserTypes?.pointerTypes.has(name.toLowerCase()) ?? false;
}

function isSetNamedType(name: string): boolean {
  return activeUserTypes?.setTypes.has(name.toLowerCase()) ?? false;
}

function isCellVar(name: string): boolean {
  return activeUserTypes?.cellVars.has(name.toLowerCase()) ?? false;
}

function programUsesUserTypes(ctx: UserTypePrintCtx): boolean {
  return (
    ctx.enumTypes.size > 0 ||
    ctx.pointerTypes.size > 0 ||
    ctx.setTypes.size > 0
  );
}

function fileRef(pathExpr: IrExpression): string {
  const ctx = activeFileCtx;
  if (!ctx) {
    return `_pp_files[${printExpr(pathExpr, 0)}]`;
  }
  if (pathExpr.kind === 'IrStringLiteral') {
    let h = ctx.handles.get(pathExpr.value);
    if (!h) {
      h = fileHandleName(pathExpr.value);
      ctx.handles.set(pathExpr.value, h);
    }
    return h;
  }
  ctx.needsDict = true;
  return `_pp_files[${printExpr(pathExpr, 0)}]`;
}

/** Handle expression for RANDOM file ops (never the text `_pp_files` dict). */
function randomFileRef(pathExpr: IrExpression): string {
  const ctx = activeFileCtx;
  if (pathExpr.kind === 'IrStringLiteral') {
    return fileRef(pathExpr);
  }
  if (ctx) ctx.needsRandomDict = true;
  return `_pp_random_files[${printExpr(pathExpr, 0)}]`;
}

function isRandomPathExpr(pathExpr: IrExpression): boolean {
  const ctx = activeFileCtx;
  if (!ctx) return false;
  if (pathExpr.kind === 'IrStringLiteral') {
    return ctx.randomPaths.has(pathExpr.value);
  }
  return ctx.needsRandomDict || ctx.randomPaths.size > 0;
}

function isNegativeLiteral(expr: IrExpression | null): boolean {
  if (!expr) return false;
  if (expr.kind === 'IrIntegerLiteral' || expr.kind === 'IrRealLiteral') {
    return expr.value < 0;
  }
  if (
    expr.kind === 'IrUnaryExpression' &&
    expr.operator === '-' &&
    (expr.argument.kind === 'IrIntegerLiteral' || expr.argument.kind === 'IrRealLiteral')
  ) {
    return true;
  }
  return false;
}

function irTypeToPython(typeName: string): string {
  switch (typeName) {
    case 'INTEGER':
      return 'int';
    case 'REAL':
      return 'float';
    case 'STRING':
      return 'str';
    case 'BOOLEAN':
      return 'bool';
    case 'CHAR':
      return 'str';
    case 'DATE':
      return 'date';
    default:
      return 'int';
  }
}

/** Scalar builtin → Python annotation; user TYPE name → the dataclass name. */
function irSimpleTypeToPython(typeRef: IrSimpleType): string {
  if (typeRef.kind === 'IrScalarType') return irTypeToPython(typeRef.name);
  return pyId(typeRef.name);
}

/** Cambridge default value for a scalar type, matching TYPE dataclass field defaults. */
function scalarDefaultLiteral(typeName: string): string {
  switch (typeName) {
    case 'INTEGER':
      return '0';
    case 'REAL':
      return '0.0';
    case 'STRING':
      return '""';
    case 'BOOLEAN':
      return 'False';
    case 'CHAR':
      return "' '";
    case 'DATE':
      return 'date(1900, 1, 1)';
    default:
      return '0';
  }
}

/**
 * Zero-arg constructor call / literal default for a single array element.
 * CLASS elements default to `None` — constructors may require arguments and
 * CLASS instances are reference types, never eagerly allocated.
 */
function elementDefaultExpr(elem: IrSimpleType): string {
  if (elem.kind === 'IrScalarType') return scalarDefaultLiteral(elem.name);
  if (isKnownClassName(elem.name)) return 'None';
  return `${pyId(elem.name)}()`;
}

/** Build a (possibly nested, for multi-dim ARRAY) list-comprehension default.
 * Length is always `(upper - lower + 1)` — storage is dense and 0-based.
 */
function arrayDefaultExpr(typeRef: IrArrayType): string {
  const build = (dims: readonly IrArrayDimension[]): string => {
    if (dims.length === 0) return elementDefaultExpr(typeRef.elementType);
    const [dim, ...rest] = dims;
    const inner = build(rest);
    const lo = printExpr(dim!.lower, 0);
    const hi = printExpr(dim!.upper, 0);
    return `[${inner} for _ in range((${hi}) - (${lo}) + 1)]`;
  };
  return build(typeRef.dimensions);
}

/**
 * Python emission strategy (DECLARE / CONSTANT):
 * - Scalar DECLARE → `Name: pytype` (annotation only; CHAR adds `# CHAR`)
 * - Named-type (record) DECLARE → `Name: Record = Record()` (usable instance)
 * - Named-type (CLASS) DECLARE → `Name: Cls | None = None` (reference type;
 *   constructors may require arguments, so never eagerly allocated — assign
 *   via `NEW Cls(...)` instead)
 * - Array of scalar DECLARE → `Name: list[elem] = [… for _ in range((u)-(l)+1)]  # ARRAY[l:u, …]`
 * - Array of record DECLARE → `Name: list[Record] = [Record() for _ in range((u)-(l)+1)]  # ARRAY[l:u, …]`
 * - Array of CLASS DECLARE → `Name: list[Cls | None] = [None for _ in range((u)-(l)+1)]  # ARRAY[l:u, …]`
 *   Indices are emitted as `arr[i - l]` (see {@link printPythonIndex}).
 */
function printDeclarePython(
  names: readonly string[],
  typeRef: IrTypeReference,
  level: number,
): string[] {
  const p = pad(level);
  if (typeRef.kind === 'IrScalarType') {
    const py = irTypeToPython(typeRef.name);
    const tag =
      typeRef.name === 'CHAR'
        ? '  # CHAR'
        : typeRef.name === 'DATE'
          ? '  # DATE'
          : '';
    return names.map((name) => {
      if (isCellVar(name)) {
        needsPointerHelpers = true;
        const init = scalarDefaultLiteral(typeRef.name);
        return `${p}${pyId(name)} = _pp_cell(${init})${tag}`;
      }
      return `${p}${pyId(name)}: ${py}${tag}`;
    });
  }
  if (typeRef.kind === 'IrNamedType') {
    const typeName = pyId(typeRef.name);
    if (isKnownClassName(typeRef.name)) {
      return names.map(
        (name) => `${p}${pyId(name)}: ${typeName} | None = None`,
      );
    }
    if (isEnumNamedType(typeRef.name)) {
      const enumInfo = activeUserTypes!.enumTypes.get(
        typeRef.name.toLowerCase(),
      )!;
      const first = enumInfo.members[0] ?? 'None';
      const defaultVal =
        first === 'None'
          ? 'None'
          : `${typeName}.${pyId(first)}`;
      return names.map(
        (name) => `${p}${pyId(name)}: ${typeName} = ${defaultVal}`,
      );
    }
    if (isPointerNamedType(typeRef.name)) {
      return names.map(
        (name) => `${p}${pyId(name)} = None  # NIL / ${typeName}`,
      );
    }
    if (isSetNamedType(typeRef.name)) {
      return names.map(
        (name) => `${p}${pyId(name)} = set()  # ${typeName}`,
      );
    }
    return names.map(
      (name) => `${p}${pyId(name)}: ${typeName} = ${typeName}()`,
    );
  }
  const elemIsClass =
    typeRef.elementType.kind === 'IrNamedType' &&
    isKnownClassName(typeRef.elementType.name);
  const elem = irSimpleTypeToPython(typeRef.elementType);
  const elemAnnotated = elemIsClass ? `${elem} | None` : elem;
  const dims = typeRef.dimensions
    .map((d) => `${printExpr(d.lower, 0)}:${printExpr(d.upper, 0)}`)
    .join(', ');
  const init = arrayDefaultExpr(typeRef);
  return names.map(
    (name) =>
      `${p}${pyId(name)}: list[${elemAnnotated}] = ${init}  # ARRAY[${dims}]`,
  );
}

function pad(level: number): string {
  return INDENT.repeat(level);
}

/**
 * Emit one `@dataclass` field line per DECLARE'd name, with a default matching
 * Cambridge's implicit type default (INTEGER 0, REAL 0.0, STRING "", BOOLEAN
 * False, CHAR " "). Nested records / arrays need `field(default_factory=…)`
 * since a plain mutable/unhashable default is rejected by `dataclasses`.
 */
function printDataclassFields(
  fields: readonly IrTypeField[],
  level: number,
): string[] {
  const p = pad(level);
  const lines: string[] = [];
  for (const field of fields) {
    for (const name of field.names) {
      lines.push(`${p}${printDataclassFieldLine(name, field.typeRef)}`);
    }
  }
  return lines;
}

function printDataclassFieldLine(name: string, typeRef: IrTypeReference): string {
  const fieldName = pyId(name);
  if (typeRef.kind === 'IrScalarType') {
    const py = irTypeToPython(typeRef.name);
    const tag =
      typeRef.name === 'CHAR'
        ? '  # CHAR'
        : typeRef.name === 'DATE'
          ? '  # DATE'
          : '';
    return `${fieldName}: ${py} = ${scalarDefaultLiteral(typeRef.name)}${tag}`;
  }
  if (typeRef.kind === 'IrNamedType') {
    const typeName = pyId(typeRef.name);
    return `${fieldName}: ${typeName} = field(default_factory=${typeName})`;
  }
  const elem = irSimpleTypeToPython(typeRef.elementType);
  const dims = typeRef.dimensions
    .map((d) => `${printExpr(d.lower, 0)}:${printExpr(d.upper, 0)}`)
    .join(', ');
  const init = arrayDefaultExpr(typeRef);
  return `${fieldName}: list[${elem}] = field(default_factory=lambda: ${init})  # ARRAY[${dims}]`;
}

/** Whether any TYPE field needs `field(default_factory=…)` (records / arrays). */
function typeDeclarationsNeedFieldImport(program: IrProgram): boolean {
  return program.body.some(
    (stmt) =>
      stmt.kind === 'IrTypeDeclaration' &&
      stmt.fields.some((f) => f.typeRef.kind !== 'IrScalarType'),
  );
}

/** Higher than any binary/unary operator — forces parens around compound bases. */
const POSTFIX_PRECEDENCE = 100;

function printIndex(expr: IrIndexExpression): string {
  return printPythonIndex(expr, printExpr, POSTFIX_PRECEDENCE);
}

function printMember(expr: IrMemberExpression): string {
  return `${printExpr(expr.object, POSTFIX_PRECEDENCE)}.${pyId(expr.property)}`;
}

function printTarget(target: IrAssignTarget): string {
  switch (target.kind) {
    case 'IrIdentifier':
      return pyId(target.name);
    case 'IrIndexExpression':
      return printIndex(target);
    case 'IrMemberExpression':
      return printMember(target);
    case 'IrDerefExpression':
      needsPointerHelpers = true;
      // Assignment targets are rewritten to _pp_pstore in printStatement.
      return `_pp_pload(${printExpr(target.pointer, 0)})`;
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

function printExpr(expr: IrExpression, parentPrec: number): string {
  switch (expr.kind) {
    case 'IrIntegerLiteral':
      return String(expr.value);
    case 'IrRealLiteral':
      return formatRealLiteral(expr.value);
    case 'IrStringLiteral':
      return `"${escapePythonString(expr.value)}"`;
    case 'IrCharLiteral':
      return `'${escapePythonChar(expr.value)}'`;
    case 'IrBooleanLiteral':
      return formatBooleanPython(expr.value);
    case 'IrDateLiteral':
      // Python date(year, month, day) — note argument order vs Cambridge dd/mm/yyyy.
      return `date(${expr.year}, ${expr.month}, ${expr.day})`;
    case 'IrIdentifier': {
      if (isCellVar(expr.name)) {
        needsPointerHelpers = true;
        return `_pp_load(${pyId(expr.name)})`;
      }
      return pyId(expr.name);
    }
    case 'IrIndexExpression':
      return printIndex(expr);
    case 'IrMemberExpression':
      return printMember(expr);
    case 'IrDeepCopyExpression':
      return `copy.deepcopy(${printExpr(expr.value, 0)})`;
    case 'IrAddressOfExpression': {
      needsPointerHelpers = true;
      // Address-of a cell var returns the cell itself (not .value).
      if (expr.target.kind === 'IrIdentifier' && isCellVar(expr.target.name)) {
        return `_pp_addr(${pyId(expr.target.name)})`;
      }
      // Non-cell place: wrap with _pp_cell at address time (rare / reverse edge).
      return `_pp_addr(_pp_cell(${printTarget(expr.target)}))`;
    }
    case 'IrDerefExpression':
      needsPointerHelpers = true;
      return `_pp_pload(${printExpr(expr.pointer, 0)})`;
    case 'IrCallExpression': {
      if (expr.callee.toLowerCase() === 'right') {
        needsRightHelper = true;
      }
      const builtin = tryPrintBuiltinPython(
        expr.callee,
        expr.args,
        printExpr,
      );
      if (builtin !== null) return builtin;
      return `${pyId(expr.callee)}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
    }
    case 'IrEofExpression':
      return `_pp_eof(${fileRef(expr.fileName)})`;
    case 'IrGroupingExpression':
      return `(${printExpr(expr.expression, 0)})`;
    case 'IrUnaryExpression':
      return printUnary(expr, parentPrec);
    case 'IrBinaryExpression':
      return printBinary(expr, parentPrec);
    case 'IrNewExpression':
      return `${pyId(expr.className)}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
    case 'IrMethodCallExpression': {
      const isSuperNew =
        expr.object.kind === 'IrSuperExpression' &&
        expr.method.toUpperCase() === 'NEW';
      const obj =
        expr.object.kind === 'IrSuperExpression'
          ? 'super()'
          : printExpr(expr.object, POSTFIX_PRECEDENCE);
      const method = isSuperNew ? '__init__' : pyId(expr.method);
      return `${obj}.${method}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
    }
    case 'IrSuperExpression':
      // Only ever appears as the `object` of IrMethodCallExpression, handled
      // above; kept for exhaustiveness / defensive printing.
      return 'super()';
    default: {
      const _exhaustive: never = expr;
      return _exhaustive;
    }
  }
}

function printUnary(expr: IrUnaryExpression, parentPrec: number): string {
  const prec = UNARY_PRECEDENCE;
  const op = irUnaryToPython(expr.operator);
  const arg = printExpr(expr.argument, prec);
  const gap = isWordOperator(op) ? ' ' : '';
  const core = `${op}${gap}${arg}`;
  return prec < parentPrec ? `(${core})` : core;
}

function printBinary(expr: IrBinaryExpression, parentPrec: number): string {
  // Cambridge DIV/MOD truncates toward zero; Python // / % floor.
  if (expr.operator === '//') {
    needsDivModHelpers = true;
    return `_pp_div(${printExpr(expr.left, 0)}, ${printExpr(expr.right, 0)})`;
  }
  if (expr.operator === '%') {
    needsDivModHelpers = true;
    return `_pp_mod(${printExpr(expr.left, 0)}, ${printExpr(expr.right, 0)})`;
  }
  // Enum ordinal arithmetic only when the left operand is enum-typed.
  if (
    (expr.operator === '+' || expr.operator === '-') &&
    exprLooksEnumTyped(expr.left)
  ) {
    needsEnumArithHelpers = true;
    const fn = expr.operator === '+' ? '_pp_enum_add' : '_pp_enum_sub';
    return `${fn}(${printExpr(expr.left, 0)}, ${printExpr(expr.right, 0)})`;
  }
  const prec = BINARY_PRECEDENCE[expr.operator];
  const op = irBinaryToPython(expr.operator);
  const left = printExpr(expr.left, prec);
  const right = printExpr(expr.right, prec + 1);
  const core = `${left} ${op} ${right}`;
  return prec < parentPrec ? `(${core})` : core;
}

function exprLooksEnumTyped(expr: IrExpression): boolean {
  if (!activeUserTypes) return false;
  if (expr.kind === 'IrGroupingExpression') {
    return exprLooksEnumTyped(expr.expression);
  }
  if (expr.kind === 'IrIdentifier') {
    const k = expr.name.toLowerCase();
    return (
      activeUserTypes.enumMembers.has(k) || activeUserTypes.enumVars.has(k)
    );
  }
  if (expr.kind === 'IrDerefExpression') {
    if (expr.pointer.kind === 'IrIdentifier') {
      return activeUserTypes.enumPointerVars.has(
        expr.pointer.name.toLowerCase(),
      );
    }
  }
  if (
    expr.kind === 'IrMemberExpression' &&
    expr.object.kind === 'IrIdentifier'
  ) {
    // Season.Spring already printed as member access from enum class
    return activeUserTypes.enumTypes.has(expr.object.name.toLowerCase());
  }
  return false;
}

function printBlock(
  statements: readonly IrStatement[],
  level: number,
): string[] {
  if (statements.length === 0) {
    return [`${pad(level)}pass`];
  }
  const lines: string[] = [];
  for (const stmt of statements) {
    lines.push(...printStatement(stmt, level));
  }
  return lines;
}

/**
 * Print one CLASS member. Properties emit nothing — Python has no separate
 * field-declaration syntax; instance attributes materialize via `self.X = …`
 * assignments inside `__init__` / other methods (see `IrClassProperty` doc).
 */
function printClassMember(member: IrClassMember, level: number): string[] {
  const p = pad(level);
  if (member.kind === 'IrClassProperty') return [];

  const isCtor = member.name.toUpperCase() === 'NEW';
  const pyName = isCtor ? '__init__' : pyId(member.name);
  const params = [
    'self',
    ...member.parameters.map(
      (param) => `${pyId(param.name)}: ${irSimpleTypeToPython(param.typeName)}`,
    ),
  ].join(', ');

  if (member.kind === 'IrClassProcedure') {
    const returnAnno = isCtor ? ' -> None' : '';
    const lines = [`${p}def ${pyName}(${params})${returnAnno}:`];
    lines.push(...printBlock(member.body, level + 1));
    return lines;
  }

  const lines = [
    `${p}def ${pyName}(${params}) -> ${irSimpleTypeToPython(member.returnType)}:`,
  ];
  lines.push(...printBlock(member.body, level + 1));
  return lines;
}

function printStatement(stmt: IrStatement, level: number): string[] {
  const p = pad(level);
  const lines: string[] = [
    ...printTrivia(stmt.leadingTrivia, 'hash').map((l) =>
      l.length === 0 ? l : `${p}${l}`,
    ),
  ];

  switch (stmt.kind) {
    case 'IrAssignment': {
      // Address-taken scalar cells / pointer deref: use _pp_store(cell, v)
      if (
        stmt.target.kind === 'IrIdentifier' &&
        isCellVar(stmt.target.name)
      ) {
        needsPointerHelpers = true;
        lines.push(
          `${p}_pp_store(${pyId(stmt.target.name)}, ${printExpr(stmt.value, 0)})`,
        );
      } else if (stmt.target.kind === 'IrDerefExpression') {
        needsPointerHelpers = true;
        lines.push(
          `${p}_pp_pstore(${printExpr(stmt.target.pointer, 0)}, ${printExpr(stmt.value, 0)})`,
        );
      } else {
        lines.push(
          `${p}${printTarget(stmt.target)} = ${printExpr(stmt.value, 0)}`,
        );
      }
      break;
    }
    case 'IrInput': {
      const isCell =
        stmt.target.kind === 'IrIdentifier' && isCellVar(stmt.target.name);
      const target = isCell
        ? pyId(stmt.target.name)
        : printTarget(stmt.target);
      // BOOLEAN/CHAR helpers ignore prompts; surface prompt as a print first.
      if (
        stmt.prompt &&
        (stmt.valueType === 'BOOLEAN' || stmt.valueType === 'CHAR')
      ) {
        lines.push(`${p}print(${printExpr(stmt.prompt, 0)})`);
        const rhs = printTypedInputRhs(stmt.valueType, null);
        if (isCell) {
          needsPointerHelpers = true;
          lines.push(`${p}_pp_store(${target}, ${rhs})`);
        } else {
          lines.push(`${p}${target} = ${rhs}`);
        }
      } else {
        const rhs = printTypedInputRhs(stmt.valueType, stmt.prompt);
        if (isCell) {
          needsPointerHelpers = true;
          lines.push(`${p}_pp_store(${target}, ${rhs})`);
        } else {
          lines.push(`${p}${target} = ${rhs}`);
        }
      }
      break;
    }
    case 'IrOutput': {
      if (activeUserTypes && programUsesUserTypes(activeUserTypes)) {
        needsShowHelper = true;
        lines.push(
          `${p}print(${stmt.values.map((v) => `_pp_show(${printExpr(v, 0)})`).join(', ')})`,
        );
      } else {
        lines.push(
          `${p}print(${stmt.values.map((v) => printExpr(v, 0)).join(', ')})`,
        );
      }
      break;
    }
    case 'IrIfStatement': {
      lines.push(`${p}if ${printExpr(stmt.condition, 0)}:`);
      lines.push(...printBlock(stmt.consequent, level + 1));
      for (const clause of stmt.elseIfClauses) {
        lines.push(`${p}elif ${printExpr(clause.condition, 0)}:`);
        lines.push(...printBlock(clause.consequent, level + 1));
      }
      if (stmt.alternate !== null) {
        lines.push(`${p}else:`);
        lines.push(...printBlock(stmt.alternate, level + 1));
      }
      break;
    }
    case 'IrCaseStatement': {
      lines.push(`${p}match ${printExpr(stmt.discriminant, 0)}:`);
      if (stmt.arms.length === 0 && stmt.otherwise === null) {
        lines.push(`${pad(level + 1)}case _:`);
        lines.push(`${pad(level + 2)}pass`);
      } else {
        for (const arm of stmt.arms) {
          if (arm.label.kind === 'IrCaseValue') {
            lines.push(`${pad(level + 1)}case ${printExpr(arm.label.value, 0)}:`);
          } else {
            // Guarded capture preserves inclusive Cambridge TO ranges.
            lines.push(
              `${pad(level + 1)}case _v if ${printExpr(arm.label.low, 0)} <= _v and _v <= ${printExpr(arm.label.high, 0)}:`,
            );
          }
          lines.push(...printBlock(arm.body, level + 2));
        }
        if (stmt.otherwise !== null) {
          lines.push(`${pad(level + 1)}case _:`);
          lines.push(...printBlock(stmt.otherwise, level + 2));
        }
      }
      break;
    }
    case 'IrWhileStatement': {
      lines.push(`${p}while ${printExpr(stmt.condition, 0)}:`);
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrRepeatStatement': {
      lines.push(`${p}while True:`);
      if (stmt.body.length === 0) {
        lines.push(`${pad(level + 1)}pass`);
      } else {
        lines.push(...printBlock(stmt.body, level + 1));
      }
      lines.push(`${pad(level + 1)}if ${printExpr(stmt.condition, 0)}:`);
      lines.push(`${pad(level + 2)}break`);
      break;
    }
    case 'IrForStatement': {
      const startStr = printExpr(stmt.start, 0);
      const isDescending = isNegativeLiteral(stmt.step);
      const adjust = isDescending ? ' - 1' : ' + 1';
      const endStr = `${printExpr(stmt.end, 0)}${adjust}`;
      const loopVar = pyId(stmt.variable);
      if (stmt.step) {
        lines.push(`${p}for ${loopVar} in range(${startStr}, ${endStr}, ${printExpr(stmt.step, 0)}):`);
      } else {
        lines.push(`${p}for ${loopVar} in range(${startStr}, ${endStr}):`);
      }
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrDeclareStatement':
      lines.push(...printDeclarePython(stmt.names, stmt.typeRef, level));
      break;
    case 'IrConstantStatement':
      lines.push(`${p}${pyId(stmt.name)} = ${printExpr(stmt.value, 0)}  # CONSTANT`);
      break;
    case 'IrProcedureDeclaration': {
      const params = stmt.parameters
        .map((param) => `${pyId(param.name)}: ${irSimpleTypeToPython(param.typeName)}`)
        .join(', ');
      const byRefNames = stmt.parameters
        .filter((p) => p.mode === 'BYREF')
        .map((p) => pyId(p.name));
      const byRefTag =
        byRefNames.length > 0 ? `  # BYREF ${byRefNames.join(', ')}` : '';
      lines.push(`${p}def ${pyId(stmt.name)}(${params}):${byRefTag}`);
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrFunctionDeclaration': {
      const params = stmt.parameters
        .map((param) => `${pyId(param.name)}: ${irSimpleTypeToPython(param.typeName)}`)
        .join(', ');
      lines.push(
        `${p}def ${pyId(stmt.name)}(${params}) -> ${irSimpleTypeToPython(stmt.returnType)}:`,
      );
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrTypeDeclaration': {
      lines.push(`${p}@dataclass`);
      lines.push(`${p}class ${pyId(stmt.name)}:`);
      const fieldLines = printDataclassFields(stmt.fields, level + 1);
      lines.push(...(fieldLines.length > 0 ? fieldLines : [`${pad(level + 1)}pass`]));
      break;
    }
    case 'IrEnumTypeDeclaration': {
      lines.push(`${p}class ${pyId(stmt.name)}(IntEnum):`);
      if (stmt.members.length === 0) {
        lines.push(`${pad(level + 1)}pass`);
      } else {
        stmt.members.forEach((m, i) => {
          lines.push(`${pad(level + 1)}${pyId(m)} = ${i}`);
        });
      }
      // Aliases so bare Cambridge member names remain valid Python identifiers.
      for (const m of stmt.members) {
        lines.push(
          `${p}${pyId(m)} = ${pyId(stmt.name)}.${pyId(m)}`,
        );
      }
      break;
    }
    case 'IrPointerTypeDeclaration': {
      const target = irSimpleTypeToPython(stmt.targetType);
      lines.push(
        `${p}${pyId(stmt.name)} = object  # TYPE ${stmt.name} = ^${stmt.targetType.name} (pointer to ${target})`,
      );
      break;
    }
    case 'IrSetTypeDeclaration': {
      const elem = irSimpleTypeToPython(stmt.elementType);
      lines.push(
        `${p}${pyId(stmt.name)} = set  # TYPE ${stmt.name} = SET OF ${stmt.elementType.name} (${elem})`,
      );
      break;
    }
    case 'IrDefineStatement': {
      needsDefineHelper = true;
      const vals = stmt.values.map((v) => printExpr(v, 0)).join(', ');
      lines.push(
        `${p}${pyId(stmt.name)} = _pp_define(${JSON.stringify(stmt.typeName)}${vals ? `, ${vals}` : ''})`,
      );
      break;
    }
    case 'IrCallStatement': {
      lines.push(
        `${p}${pyId(stmt.callee)}(${stmt.args.map((a) => printExpr(a, 0)).join(', ')})`,
      );
      break;
    }
    case 'IrReturnStatement':
      lines.push(`${p}return ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrBreakStatement':
      lines.push(`${p}break`);
      break;
    case 'IrOpenFileStatement': {
      const path = printExpr(stmt.fileName, 0);
      if (stmt.mode === 'RANDOM') {
        if (stmt.fileName.kind === 'IrStringLiteral') {
          const handle = fileRef(stmt.fileName);
          lines.push(`${p}${handle} = _pp_random_open(${path})`);
        } else {
          lines.push(`${p}_pp_random_open(${path})`);
        }
      } else {
        const handle = fileRef(stmt.fileName);
        const mode = pythonMode(stmt.mode);
        lines.push(`${p}${handle} = open(${path}, "${mode}")`);
      }
      break;
    }
    case 'IrReadFileStatement': {
      const handle = fileRef(stmt.fileName);
      lines.push(
        `${p}${printTarget(stmt.target)} = ${handle}.readline().rstrip("\\n")`,
      );
      break;
    }
    case 'IrWriteFileStatement': {
      const handle = fileRef(stmt.fileName);
      lines.push(
        `${p}${handle}.write(str(${printExpr(stmt.value, 0)}) + "\\n")`,
      );
      break;
    }
    case 'IrCloseFileStatement': {
      if (isRandomPathExpr(stmt.fileName)) {
        const handle = randomFileRef(stmt.fileName);
        lines.push(`${p}_pp_random_close(${handle})`);
      } else {
        const handle = fileRef(stmt.fileName);
        lines.push(`${p}${handle}.close()`);
      }
      break;
    }
    case 'IrSeekStatement': {
      const handle = randomFileRef(stmt.fileName);
      lines.push(
        `${p}_pp_random_seek(${handle}, ${printExpr(stmt.address, 0)})`,
      );
      break;
    }
    case 'IrGetRecordStatement': {
      const handle = randomFileRef(stmt.fileName);
      lines.push(
        `${p}${printTarget(stmt.target)} = _pp_random_get(${handle})`,
      );
      break;
    }
    case 'IrPutRecordStatement': {
      const handle = randomFileRef(stmt.fileName);
      lines.push(
        `${p}_pp_random_put(${handle}, ${printExpr(stmt.value, 0)})`,
      );
      break;
    }
    case 'IrClassDeclaration': {
      const base = stmt.inherits ? `(${pyId(stmt.inherits)})` : '';
      lines.push(`${p}class ${pyId(stmt.name)}${base}:`);
      const memberLines: string[] = [];
      for (const member of stmt.members) {
        memberLines.push(...printClassMember(member, level + 1));
      }
      lines.push(
        ...(memberLines.length > 0 ? memberLines : [`${pad(level + 1)}pass`]),
      );
      break;
    }
    case 'IrExpressionStatement':
      lines.push(`${p}${printExpr(stmt.expression, 0)}`);
      break;
    default: {
      const _exhaustive: never = stmt;
      return _exhaustive;
    }
  }

  const trailing = printTrivia(stmt.trailingTrivia, 'hash');
  if (
    stmt.kind !== 'IrIfStatement' &&
    stmt.kind !== 'IrCaseStatement' &&
    stmt.kind !== 'IrWhileStatement' &&
    stmt.kind !== 'IrRepeatStatement' &&
    stmt.kind !== 'IrForStatement' &&
    stmt.kind !== 'IrDeclareStatement' &&
    stmt.kind !== 'IrConstantStatement' &&
    stmt.kind !== 'IrProcedureDeclaration' &&
    stmt.kind !== 'IrFunctionDeclaration' &&
    stmt.kind !== 'IrTypeDeclaration' &&
    stmt.kind !== 'IrEnumTypeDeclaration' &&
    stmt.kind !== 'IrPointerTypeDeclaration' &&
    stmt.kind !== 'IrSetTypeDeclaration' &&
    stmt.kind !== 'IrDefineStatement' &&
    stmt.kind !== 'IrClassDeclaration' &&
    trailing.length > 0 &&
    trailing[0]?.startsWith('#')
  ) {
    const last = lines.pop()!;
    lines.push(`${last} ${trailing[0]}`);
    lines.push(...trailing.slice(1).map((l) => (l.length === 0 ? l : `${p}${l}`)));
  } else {
    lines.push(...trailing.map((l) => (l.length === 0 ? l : `${p}${l}`)));
  }
  return lines;
}

function finalizeOutput(lines: string[]): string {
  while (lines.length > 0 && lines[0] === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

export function printPython(program: IrProgram): string {
  const fileCtx: FilePrintCtx = {
    handles: new Map(),
    randomPaths: new Set(),
    needsDict: false,
    needsRandomDict: false,
  };
  activeFileCtx = fileCtx;
  activeClassNames = collectClassNames(program);
  activeUserTypes = collectUserTypeCtx(program);
  needsInputBoolHelper = false;
  needsInputCharHelper = false;
  needsInputDateHelper = false;
  needsDivModHelpers = false;
  needsRightHelper = false;
  needsPointerHelpers = false;
  needsEnumArithHelpers = false;
  needsShowHelper = false;
  needsDefineHelper = false;
  try {
    // Pre-walk file ops so handle names are stable before EOF exprs print.
    if (programUsesFiles(program)) {
      seedFileHandles(program.body, fileCtx);
    }
    const bodyLines: string[] = [];
    for (const stmt of program.body) {
      bodyLines.push(...printStatement(stmt, 0));
    }
    const lines: string[] = [...printTrivia(program.leadingTrivia, 'hash')];
    const hasTypeDeclarations = program.body.some(
      (stmt) => stmt.kind === 'IrTypeDeclaration',
    );
    const hasEnum = activeUserTypes.enumTypes.size > 0;
    if (hasEnum) {
      lines.push('from enum import IntEnum');
      lines.push('');
    }
    if (hasTypeDeclarations) {
      const needsField = typeDeclarationsNeedFieldImport(program);
      lines.push(
        needsField
          ? 'from dataclasses import dataclass, field'
          : 'from dataclasses import dataclass',
      );
      lines.push('');
    }
    const usesRandom = programUsesRandomFiles(program);
    if (programUsesDeepCopy(program) || usesRandom) {
      lines.push('import copy');
      lines.push('');
    }
    if (irUsesRand(program)) {
      lines.push('import random');
      lines.push('');
    }
    if (irUsesIsNum(program)) {
      lines.push(PP_IS_NUM_HELPER);
      lines.push('');
    }
    if (programUsesByRefCell(program)) {
      lines.push(PP_CELL_HELPER);
      lines.push('');
    }
    if (needsDivModHelpers) {
      lines.push(PP_DIV_MOD_HELPERS);
      lines.push('');
    }
    if (needsRightHelper) {
      lines.push(PP_RIGHT_HELPER);
      lines.push('');
    }
    if (needsPointerHelpers || activeUserTypes.cellVars.size > 0) {
      // Address-taken scalars also need _pp_cell for DECLARE init.
      if (!programUsesByRefCell(program)) {
        lines.push(PP_CELL_HELPER);
        lines.push('');
      }
      lines.push(PP_POINTER_HELPERS);
      lines.push('');
    }
    if (needsEnumArithHelpers) {
      lines.push(PP_ENUM_ADD_HELPER);
      lines.push('');
    }
    if (needsShowHelper) {
      lines.push(PP_SHOW_HELPER);
      lines.push('');
    }
    if (needsDefineHelper) {
      lines.push(PP_DEFINE_HELPER);
      lines.push('');
    }
    const dt = datetimeImportNeeds(program);
    if (dt.date) {
      lines.push('from datetime import date');
      lines.push('');
    }
    if (programUsesFiles(program)) {
      if (fileCtx.needsDict) {
        lines.push(PP_FILES_INIT);
      }
      if (usesRandom || fileCtx.needsRandomDict) {
        lines.push(PP_RANDOM_FILES_INIT);
        lines.push(PP_RANDOM_HELPERS);
        lines.push('');
      }
      if (programUsesEof(program)) {
        lines.push(PP_EOF_HELPER);
        lines.push('');
      } else if (fileCtx.needsDict && !usesRandom && !fileCtx.needsRandomDict) {
        lines.push('');
      }
    }
    if (needsInputBoolHelper) {
      lines.push(PP_INPUT_BOOL_HELPER);
      lines.push('');
    }
    if (needsInputCharHelper) {
      lines.push(PP_INPUT_CHAR_HELPER);
      lines.push('');
    }
    if (needsInputDateHelper) {
      lines.push(PP_INPUT_DATE_HELPER);
      lines.push('');
    }
    lines.push(...bodyLines);
    lines.push(...printTrivia(program.trailingTrivia, 'hash'));
    return finalizeOutput(lines);
  } finally {
    activeFileCtx = null;
    activeClassNames = new Set();
    activeUserTypes = null;
    needsInputBoolHelper = false;
    needsInputCharHelper = false;
    needsInputDateHelper = false;
    needsDivModHelpers = false;
    needsRightHelper = false;
    needsPointerHelpers = false;
    needsEnumArithHelpers = false;
    needsShowHelper = false;
    needsDefineHelper = false;
  }
}

function seedFileHandles(
  stmts: readonly IrStatement[],
  ctx: FilePrintCtx,
): void {
  for (const stmt of stmts) {
    if (
      stmt.kind === 'IrOpenFileStatement' ||
      stmt.kind === 'IrReadFileStatement' ||
      stmt.kind === 'IrWriteFileStatement' ||
      stmt.kind === 'IrCloseFileStatement' ||
      stmt.kind === 'IrSeekStatement' ||
      stmt.kind === 'IrGetRecordStatement' ||
      stmt.kind === 'IrPutRecordStatement'
    ) {
      activeFileCtx = ctx;
      fileRef(stmt.fileName);
      if (stmt.kind === 'IrOpenFileStatement' && stmt.mode === 'RANDOM') {
        if (stmt.fileName.kind === 'IrStringLiteral') {
          ctx.randomPaths.add(stmt.fileName.value);
        } else {
          ctx.needsRandomDict = true;
        }
      }
      if (
        stmt.kind === 'IrSeekStatement' ||
        stmt.kind === 'IrGetRecordStatement' ||
        stmt.kind === 'IrPutRecordStatement'
      ) {
        if (stmt.fileName.kind !== 'IrStringLiteral') {
          ctx.needsRandomDict = true;
        }
      }
    }
    if (stmt.kind === 'IrIfStatement') {
      seedFileHandles(stmt.consequent, ctx);
      for (const c of stmt.elseIfClauses) seedFileHandles(c.consequent, ctx);
      if (stmt.alternate) seedFileHandles(stmt.alternate, ctx);
    } else if (
      stmt.kind === 'IrWhileStatement' ||
      stmt.kind === 'IrRepeatStatement' ||
      stmt.kind === 'IrForStatement'
    ) {
      seedFileHandles(stmt.body, ctx);
    } else if (stmt.kind === 'IrCaseStatement') {
      for (const arm of stmt.arms) seedFileHandles(arm.body, ctx);
      if (stmt.otherwise) seedFileHandles(stmt.otherwise, ctx);
    } else if (
      stmt.kind === 'IrProcedureDeclaration' ||
      stmt.kind === 'IrFunctionDeclaration'
    ) {
      seedFileHandles(stmt.body, ctx);
    } else if (stmt.kind === 'IrClassDeclaration') {
      for (const member of stmt.members) {
        if (member.kind !== 'IrClassProperty') {
          seedFileHandles(member.body, ctx);
        }
      }
    }
  }
}

function programUsesDeepCopy(program: IrProgram): boolean {
  const walkExpr = (e: IrExpression): boolean => {
    switch (e.kind) {
      case 'IrDeepCopyExpression':
        return true;
      case 'IrCallExpression':
        return e.args.some(walkExpr);
      case 'IrUnaryExpression':
        return walkExpr(e.argument);
      case 'IrBinaryExpression':
        return walkExpr(e.left) || walkExpr(e.right);
      case 'IrGroupingExpression':
        return walkExpr(e.expression);
      case 'IrIndexExpression':
        return walkExpr(e.array) || e.indices.some(walkExpr);
      case 'IrMemberExpression':
        return walkExpr(e.object);
      case 'IrEofExpression':
        return walkExpr(e.fileName);
      case 'IrNewExpression':
        return e.args.some(walkExpr);
      case 'IrMethodCallExpression':
        return walkExpr(e.object) || e.args.some(walkExpr);
      default:
        return false;
    }
  };
  const walkStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case 'IrAssignment':
      case 'IrReturnStatement':
        return walkExpr(s.value);
      case 'IrCallStatement':
        return s.args.some(walkExpr);
      case 'IrExpressionStatement':
        return walkExpr(s.expression);
      case 'IrOutput':
        return s.values.some(walkExpr);
      case 'IrIfStatement':
        return (
          walkExpr(s.condition) ||
          s.consequent.some(walkStmt) ||
          s.elseIfClauses.some(
            (c) => walkExpr(c.condition) || c.consequent.some(walkStmt),
          ) ||
          (s.alternate?.some(walkStmt) ?? false)
        );
      case 'IrWhileStatement':
      case 'IrRepeatStatement':
        return walkExpr(s.condition) || s.body.some(walkStmt);
      case 'IrForStatement':
        return (
          walkExpr(s.start) ||
          walkExpr(s.end) ||
          (s.step ? walkExpr(s.step) : false) ||
          s.body.some(walkStmt)
        );
      case 'IrCaseStatement':
        return (
          walkExpr(s.discriminant) ||
          s.arms.some((a) => a.body.some(walkStmt)) ||
          (s.otherwise?.some(walkStmt) ?? false)
        );
      case 'IrProcedureDeclaration':
      case 'IrFunctionDeclaration':
        return s.body.some(walkStmt);
      case 'IrClassDeclaration':
        return s.members.some(
          (m) => m.kind !== 'IrClassProperty' && m.body.some(walkStmt),
        );
      default:
        return false;
    }
  };
  return program.body.some(walkStmt);
}

function irUsesRand(program: IrProgram): boolean {
  return irUsesNamedCall(program, 'rand');
}

function irUsesIsNum(program: IrProgram): boolean {
  return irUsesNamedCall(program, 'is_num');
}

function programUsesByRefCell(program: IrProgram): boolean {
  if (irUsesNamedCall(program, '_pp_cell')) return true;
  const hasByRef = (params: readonly { readonly mode?: 'BYVAL' | 'BYREF' }[]) =>
    params.some((p) => p.mode === 'BYREF');
  for (const stmt of program.body) {
    if (stmt.kind === 'IrProcedureDeclaration' && hasByRef(stmt.parameters)) {
      return true;
    }
    if (stmt.kind === 'IrClassDeclaration') {
      for (const m of stmt.members) {
        if (
          (m.kind === 'IrClassProcedure' || m.kind === 'IrClassFunction') &&
          hasByRef(m.parameters)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function irUsesNamedCall(program: IrProgram, calleeKey: string): boolean {
  const walkExpr = (e: IrExpression): boolean => {
    switch (e.kind) {
      case 'IrCallExpression':
        if (e.callee.toLowerCase() === calleeKey) return true;
        return e.args.some(walkExpr);
      case 'IrDeepCopyExpression':
        return walkExpr(e.value);
      case 'IrUnaryExpression':
        return walkExpr(e.argument);
      case 'IrBinaryExpression':
        return walkExpr(e.left) || walkExpr(e.right);
      case 'IrGroupingExpression':
        return walkExpr(e.expression);
      case 'IrIndexExpression':
        return walkExpr(e.array) || e.indices.some(walkExpr);
      case 'IrMemberExpression':
        return walkExpr(e.object);
      case 'IrNewExpression':
        return e.args.some(walkExpr);
      case 'IrMethodCallExpression':
        return walkExpr(e.object) || e.args.some(walkExpr);
      default:
        return false;
    }
  };
  const walkStmt = (s: IrStatement): boolean => {
    switch (s.kind) {
      case 'IrAssignment':
        return walkExpr(s.value);
      case 'IrOutput':
        return s.values.some(walkExpr);
      case 'IrInput':
        return s.prompt ? walkExpr(s.prompt) : false;
      case 'IrExpressionStatement':
        return walkExpr(s.expression);
      case 'IrIfStatement':
        return (
          walkExpr(s.condition) ||
          s.consequent.some(walkStmt) ||
          s.elseIfClauses.some(
            (c) => walkExpr(c.condition) || c.consequent.some(walkStmt),
          ) ||
          (s.alternate?.some(walkStmt) ?? false)
        );
      case 'IrWhileStatement':
      case 'IrRepeatStatement':
        return walkExpr(s.condition) || s.body.some(walkStmt);
      case 'IrForStatement':
        return (
          walkExpr(s.start) ||
          walkExpr(s.end) ||
          (s.step ? walkExpr(s.step) : false) ||
          s.body.some(walkStmt)
        );
      case 'IrCaseStatement':
        return (
          walkExpr(s.discriminant) ||
          s.arms.some((a) => a.body.some(walkStmt)) ||
          (s.otherwise?.some(walkStmt) ?? false)
        );
      case 'IrProcedureDeclaration':
      case 'IrFunctionDeclaration':
        return s.body.some(walkStmt);
      case 'IrClassDeclaration':
        return s.members.some(
          (m) => m.kind !== 'IrClassProperty' && m.body.some(walkStmt),
        );
      case 'IrCallStatement':
        return (
          s.callee.toLowerCase() === calleeKey || s.args.some(walkExpr)
        );
      case 'IrReturnStatement':
        return walkExpr(s.value);
      case 'IrConstantStatement':
        return walkExpr(s.value);
      default:
        return false;
    }
  };
  return program.body.some(walkStmt);
}

function datetimeImportNeeds(program: IrProgram): {
  date: boolean;
} {
  let needDate = false;

  const noteType = (name: string): void => {
    if (name === 'DATE') needDate = true;
  };

  const walkExpr = (e: IrExpression): void => {
    switch (e.kind) {
      case 'IrDateLiteral':
        needDate = true;
        return;
      case 'IrCallExpression': {
        const c = e.callee.toUpperCase();
        if (['DAY', 'MONTH', 'YEAR', 'DAYINDEX', 'SETDATE', 'TODAY'].includes(c)) {
          needDate = true;
        }
        e.args.forEach(walkExpr);
        return;
      }
      case 'IrDeepCopyExpression':
        walkExpr(e.value);
        return;
      case 'IrUnaryExpression':
        walkExpr(e.argument);
        return;
      case 'IrBinaryExpression':
        walkExpr(e.left);
        walkExpr(e.right);
        return;
      case 'IrGroupingExpression':
        walkExpr(e.expression);
        return;
      case 'IrIndexExpression':
        walkExpr(e.array);
        e.indices.forEach(walkExpr);
        return;
      case 'IrMemberExpression':
        walkExpr(e.object);
        return;
      case 'IrNewExpression':
        e.args.forEach(walkExpr);
        return;
      case 'IrMethodCallExpression':
        walkExpr(e.object);
        e.args.forEach(walkExpr);
        return;
      case 'IrEofExpression':
        walkExpr(e.fileName);
        return;
      default:
        return;
    }
  };

  const walkStmt = (s: IrStatement): void => {
    switch (s.kind) {
      case 'IrDeclareStatement':
        if (s.typeRef.kind === 'IrScalarType') noteType(s.typeRef.name);
        if (
          s.typeRef.kind === 'IrArrayType' &&
          s.typeRef.elementType.kind === 'IrScalarType'
        ) {
          noteType(s.typeRef.elementType.name);
        }
        return;
      case 'IrConstantStatement':
        walkExpr(s.value);
        return;
      case 'IrAssignment':
        walkExpr(s.value);
        return;
      case 'IrOutput':
        s.values.forEach(walkExpr);
        return;
      case 'IrInput':
        if (s.valueType === 'DATE') needDate = true;
        if (s.prompt) walkExpr(s.prompt);
        return;
      case 'IrExpressionStatement':
        walkExpr(s.expression);
        return;
      case 'IrIfStatement':
        walkExpr(s.condition);
        s.consequent.forEach(walkStmt);
        s.elseIfClauses.forEach((c) => {
          walkExpr(c.condition);
          c.consequent.forEach(walkStmt);
        });
        s.alternate?.forEach(walkStmt);
        return;
      case 'IrWhileStatement':
      case 'IrRepeatStatement':
        walkExpr(s.condition);
        s.body.forEach(walkStmt);
        return;
      case 'IrForStatement':
        walkExpr(s.start);
        walkExpr(s.end);
        if (s.step) walkExpr(s.step);
        s.body.forEach(walkStmt);
        return;
      case 'IrCaseStatement':
        walkExpr(s.discriminant);
        s.arms.forEach((a) => a.body.forEach(walkStmt));
        s.otherwise?.forEach(walkStmt);
        return;
      case 'IrProcedureDeclaration':
        s.parameters.forEach((p) => {
          if (p.typeName.kind === 'IrScalarType') noteType(p.typeName.name);
        });
        s.body.forEach(walkStmt);
        return;
      case 'IrFunctionDeclaration':
        s.parameters.forEach((p) => {
          if (p.typeName.kind === 'IrScalarType') noteType(p.typeName.name);
        });
        if (s.returnType.kind === 'IrScalarType') noteType(s.returnType.name);
        s.body.forEach(walkStmt);
        return;
      case 'IrTypeDeclaration':
        s.fields.forEach((f) => {
          if (f.typeRef.kind === 'IrScalarType') noteType(f.typeRef.name);
        });
        return;
      case 'IrClassDeclaration':
        s.members.forEach((m) => {
          if (m.kind === 'IrClassProperty') {
            if (m.typeRef.kind === 'IrScalarType') noteType(m.typeRef.name);
          } else {
            m.parameters.forEach((p) => {
              if (p.typeName.kind === 'IrScalarType') noteType(p.typeName.name);
            });
            if (
              m.kind === 'IrClassFunction' &&
              m.returnType.kind === 'IrScalarType'
            ) {
              noteType(m.returnType.name);
            }
            m.body.forEach(walkStmt);
          }
        });
        return;
      case 'IrCallStatement':
        s.args.forEach(walkExpr);
        return;
      case 'IrReturnStatement':
        walkExpr(s.value);
        return;
      default:
        return;
    }
  };

  program.body.forEach(walkStmt);
  if (needsInputDateHelper) needDate = true;
  return { date: needDate };
}
