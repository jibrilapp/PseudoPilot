import { printPythonIndex } from './array-index.js';
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
  fileHandleName,
  programUsesEof,
  programUsesFiles,
  pythonMode,
} from '../file/mapping.js';

const INDENT = '    ';

type FilePrintCtx = {
  /** literal path → Python handle identifier */
  readonly handles: Map<string, string>;
  needsDict: boolean;
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
  return typeRef.name;
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
  return `${elem.name}()`;
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
    return names.map((name) => `${p}${name}: ${py}${tag}`);
  }
  if (typeRef.kind === 'IrNamedType') {
    if (isKnownClassName(typeRef.name)) {
      return names.map(
        (name) => `${p}${name}: ${typeRef.name} | None = None`,
      );
    }
    return names.map(
      (name) => `${p}${name}: ${typeRef.name} = ${typeRef.name}()`,
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
    (name) => `${p}${name}: list[${elemAnnotated}] = ${init}  # ARRAY[${dims}]`,
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
  if (typeRef.kind === 'IrScalarType') {
    const py = irTypeToPython(typeRef.name);
    const tag =
      typeRef.name === 'CHAR'
        ? '  # CHAR'
        : typeRef.name === 'DATE'
          ? '  # DATE'
          : '';
    return `${name}: ${py} = ${scalarDefaultLiteral(typeRef.name)}${tag}`;
  }
  if (typeRef.kind === 'IrNamedType') {
    return `${name}: ${typeRef.name} = field(default_factory=${typeRef.name})`;
  }
  const elem = irSimpleTypeToPython(typeRef.elementType);
  const dims = typeRef.dimensions
    .map((d) => `${printExpr(d.lower, 0)}:${printExpr(d.upper, 0)}`)
    .join(', ');
  const init = arrayDefaultExpr(typeRef);
  return `${name}: list[${elem}] = field(default_factory=lambda: ${init})  # ARRAY[${dims}]`;
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
  return `${printExpr(expr.object, POSTFIX_PRECEDENCE)}.${expr.property}`;
}

function printTarget(target: IrAssignTarget): string {
  switch (target.kind) {
    case 'IrIdentifier':
      return target.name;
    case 'IrIndexExpression':
      return printIndex(target);
    case 'IrMemberExpression':
      return printMember(target);
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
    case 'IrIdentifier':
      return expr.name;
    case 'IrIndexExpression':
      return printIndex(expr);
    case 'IrMemberExpression':
      return printMember(expr);
    case 'IrDeepCopyExpression':
      return `copy.deepcopy(${printExpr(expr.value, 0)})`;
    case 'IrCallExpression': {
      const builtin = tryPrintBuiltinPython(
        expr.callee,
        expr.args,
        printExpr,
      );
      if (builtin !== null) return builtin;
      return `${expr.callee}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
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
      return `${expr.className}(${expr.args.map((a) => printExpr(a, 0)).join(', ')})`;
    case 'IrMethodCallExpression': {
      const isSuperNew =
        expr.object.kind === 'IrSuperExpression' &&
        expr.method.toUpperCase() === 'NEW';
      const obj =
        expr.object.kind === 'IrSuperExpression'
          ? 'super()'
          : printExpr(expr.object, POSTFIX_PRECEDENCE);
      const method = isSuperNew ? '__init__' : expr.method;
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
  const prec = BINARY_PRECEDENCE[expr.operator];
  const op = irBinaryToPython(expr.operator);
  const left = printExpr(expr.left, prec);
  const right = printExpr(expr.right, prec + 1);
  const core = `${left} ${op} ${right}`;
  return prec < parentPrec ? `(${core})` : core;
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
  const pyName = isCtor ? '__init__' : member.name;
  const params = [
    'self',
    ...member.parameters.map(
      (param) => `${param.name}: ${irSimpleTypeToPython(param.typeName)}`,
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
    case 'IrAssignment':
      lines.push(`${p}${printTarget(stmt.target)} = ${printExpr(stmt.value, 0)}`);
      break;
    case 'IrInput': {
      const target = printTarget(stmt.target);
      // BOOLEAN/CHAR helpers ignore prompts; surface prompt as a print first.
      if (
        stmt.prompt &&
        (stmt.valueType === 'BOOLEAN' || stmt.valueType === 'CHAR')
      ) {
        lines.push(`${p}print(${printExpr(stmt.prompt, 0)})`);
        lines.push(
          `${p}${target} = ${printTypedInputRhs(stmt.valueType, null)}`,
        );
      } else {
        lines.push(
          `${p}${target} = ${printTypedInputRhs(stmt.valueType, stmt.prompt)}`,
        );
      }
      break;
    }
    case 'IrOutput':
      lines.push(
        `${p}print(${stmt.values.map((v) => printExpr(v, 0)).join(', ')})`,
      );
      break;
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
      if (stmt.step) {
        lines.push(`${p}for ${stmt.variable} in range(${startStr}, ${endStr}, ${printExpr(stmt.step, 0)}):`);
      } else {
        lines.push(`${p}for ${stmt.variable} in range(${startStr}, ${endStr}):`);
      }
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrDeclareStatement':
      lines.push(...printDeclarePython(stmt.names, stmt.typeRef, level));
      break;
    case 'IrConstantStatement':
      lines.push(`${p}${stmt.name} = ${printExpr(stmt.value, 0)}  # CONSTANT`);
      break;
    case 'IrProcedureDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name}: ${irSimpleTypeToPython(param.typeName)}`)
        .join(', ');
      lines.push(`${p}def ${stmt.name}(${params}):`);
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrFunctionDeclaration': {
      const params = stmt.parameters
        .map((param) => `${param.name}: ${irSimpleTypeToPython(param.typeName)}`)
        .join(', ');
      lines.push(
        `${p}def ${stmt.name}(${params}) -> ${irSimpleTypeToPython(stmt.returnType)}:`,
      );
      lines.push(...printBlock(stmt.body, level + 1));
      break;
    }
    case 'IrTypeDeclaration': {
      lines.push(`${p}@dataclass`);
      lines.push(`${p}class ${stmt.name}:`);
      const fieldLines = printDataclassFields(stmt.fields, level + 1);
      lines.push(...(fieldLines.length > 0 ? fieldLines : [`${pad(level + 1)}pass`]));
      break;
    }
    case 'IrCallStatement': {
      lines.push(
        `${p}${stmt.callee}(${stmt.args.map((a) => printExpr(a, 0)).join(', ')})`,
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
      const handle = fileRef(stmt.fileName);
      const path = printExpr(stmt.fileName, 0);
      const mode = pythonMode(stmt.mode);
      lines.push(`${p}${handle} = open(${path}, "${mode}")`);
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
      const handle = fileRef(stmt.fileName);
      lines.push(`${p}${handle}.close()`);
      break;
    }
    case 'IrClassDeclaration': {
      const base = stmt.inherits ? `(${stmt.inherits})` : '';
      lines.push(`${p}class ${stmt.name}${base}:`);
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
  const fileCtx: FilePrintCtx = { handles: new Map(), needsDict: false };
  activeFileCtx = fileCtx;
  activeClassNames = collectClassNames(program);
  needsInputBoolHelper = false;
  needsInputCharHelper = false;
  needsInputDateHelper = false;
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
    if (hasTypeDeclarations) {
      const needsField = typeDeclarationsNeedFieldImport(program);
      lines.push(
        needsField
          ? 'from dataclasses import dataclass, field'
          : 'from dataclasses import dataclass',
      );
      lines.push('');
    }
    if (programUsesDeepCopy(program)) {
      lines.push('import copy');
      lines.push('');
    }
    if (irUsesRand(program)) {
      lines.push('import random');
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
      if (programUsesEof(program)) {
        lines.push(PP_EOF_HELPER);
        lines.push('');
      } else if (fileCtx.needsDict) {
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
    needsInputBoolHelper = false;
    needsInputCharHelper = false;
    needsInputDateHelper = false;
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
      stmt.kind === 'IrCloseFileStatement'
    ) {
      activeFileCtx = ctx;
      fileRef(stmt.fileName);
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
  const walkExpr = (e: IrExpression): boolean => {
    switch (e.kind) {
      case 'IrCallExpression':
        if (e.callee.toLowerCase() === 'rand') return true;
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
          s.callee.toLowerCase() === 'rand' || s.args.some(walkExpr)
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
