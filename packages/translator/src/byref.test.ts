import { describe, expect, it } from 'vitest';
import {
  translatePseudocodeToPython,
  translatePythonToPseudocode,
} from './index.js';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

describe('BYVAL / BYREF translation', () => {
  it('emits BYREF sticky params and Python cell helpers for SWAP', () => {
    const source = `PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp ← X
    X ← Y
    Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 1
B ← 2
CALL SWAP(A, B)
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('def _pp_cell(value):');
    expect(result.code).toContain('def SWAP(X: int, Y: int):  # BYREF X, Y');
    expect(result.code).toContain('Temp = X[0]');
    expect(result.code).toContain('X[0] = Y[0]');
    expect(result.code).toContain('_pp_ref_0 = _pp_cell(A)');
    expect(result.code).toContain('_pp_ref_1 = _pp_cell(B)');
    expect(result.code).toContain('SWAP(_pp_ref_0, _pp_ref_1)');
    expect(result.code).toContain('A = _pp_ref_0[0]');
    expect(result.code).toContain('B = _pp_ref_1[0]');
  });

  it('round-trips SWAP through Python reverse', () => {
    const source = `PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)
    DECLARE Temp : INTEGER
    Temp ← X
    X ← Y
    Y ← Temp
ENDPROCEDURE
DECLARE A, B : INTEGER
A ← 1
B ← 2
CALL SWAP(A, B)
`;
    const py = translatePseudocodeToPython(source);
    expect(py.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const back = translatePythonToPseudocode(py.code);
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(norm(back.code)).toContain('PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)');
    expect(norm(back.code)).toContain('CALL SWAP(A, B)');
  });

  it('does not deepcopy BYREF record arguments', () => {
    const source = `TYPE Point
    DECLARE X : INTEGER
ENDTYPE
PROCEDURE Move(BYREF P : Point)
    P.X ← P.X + 1
ENDPROCEDURE
DECLARE A : Point
A.X ← 1
CALL Move(A)
`;
    const result = translatePseudocodeToPython(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('Move(A)');
    expect(result.code).not.toContain('Move(copy.deepcopy(A))');
  });

  it('still deepcopies BYVAL record arguments', () => {
    const source = `TYPE Point
    DECLARE X : INTEGER
ENDTYPE
PROCEDURE Show(BYVAL P : Point)
    OUTPUT P.X
ENDPROCEDURE
DECLARE A : Point
CALL Show(A)
`;
    const result = translatePseudocodeToPython(source);
    expect(result.code).toContain('Show(copy.deepcopy(A))');
  });
});
