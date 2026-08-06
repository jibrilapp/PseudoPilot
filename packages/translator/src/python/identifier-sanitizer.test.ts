import { describe, expect, it } from 'vitest';
import {
  isPythonReservedIdentifier,
  sanitizePythonIdentifier,
  unsanitizePythonIdentifier,
} from './identifier-sanitizer.js';

describe('IdentifierSanitizer', () => {
  it('leaves non-colliding names unchanged', () => {
    for (const name of ['Count', 'Total', 'Scores', 'x', 'my_list', 'List', 'Class']) {
      expect(sanitizePythonIdentifier(name)).toBe(name);
      expect(unsanitizePythonIdentifier(name)).toBe(name);
    }
  });

  it('appends _ to keywords', () => {
    expect(sanitizePythonIdentifier('class')).toBe('class_');
    expect(sanitizePythonIdentifier('def')).toBe('def_');
    expect(sanitizePythonIdentifier('for')).toBe('for_');
    expect(sanitizePythonIdentifier('while')).toBe('while_');
    expect(sanitizePythonIdentifier('if')).toBe('if_');
    expect(sanitizePythonIdentifier('else')).toBe('else_');
    expect(sanitizePythonIdentifier('from')).toBe('from_');
    expect(sanitizePythonIdentifier('import')).toBe('import_');
    expect(sanitizePythonIdentifier('lambda')).toBe('lambda_');
    expect(sanitizePythonIdentifier('global')).toBe('global_');
    expect(sanitizePythonIdentifier('nonlocal')).toBe('nonlocal_');
    expect(sanitizePythonIdentifier('pass')).toBe('pass_');
    expect(sanitizePythonIdentifier('match')).toBe('match_');
    expect(sanitizePythonIdentifier('case')).toBe('case_');
  });

  it('appends _ to builtins', () => {
    expect(sanitizePythonIdentifier('list')).toBe('list_');
    expect(sanitizePythonIdentifier('dict')).toBe('dict_');
    expect(sanitizePythonIdentifier('set')).toBe('set_');
    expect(sanitizePythonIdentifier('tuple')).toBe('tuple_');
    expect(sanitizePythonIdentifier('str')).toBe('str_');
    expect(sanitizePythonIdentifier('int')).toBe('int_');
    expect(sanitizePythonIdentifier('float')).toBe('float_');
    expect(sanitizePythonIdentifier('bool')).toBe('bool_');
    expect(sanitizePythonIdentifier('input')).toBe('input_');
    expect(sanitizePythonIdentifier('print')).toBe('print_');
    expect(sanitizePythonIdentifier('len')).toBe('len_');
    expect(sanitizePythonIdentifier('range')).toBe('range_');
    expect(sanitizePythonIdentifier('type')).toBe('type_');
    expect(sanitizePythonIdentifier('object')).toBe('object_');
    expect(sanitizePythonIdentifier('open')).toBe('open_');
    expect(sanitizePythonIdentifier('file')).toBe('file_');
    expect(sanitizePythonIdentifier('sum')).toBe('sum_');
    expect(sanitizePythonIdentifier('min')).toBe('min_');
    expect(sanitizePythonIdentifier('max')).toBe('max_');
    expect(sanitizePythonIdentifier('chr')).toBe('chr_');
    expect(sanitizePythonIdentifier('ord')).toBe('ord_');
    expect(sanitizePythonIdentifier('bytes')).toBe('bytes_');
    expect(sanitizePythonIdentifier('Exception')).toBe('Exception_');
    expect(sanitizePythonIdentifier('date')).toBe('date_');
    expect(sanitizePythonIdentifier('copy')).toBe('copy_');
    expect(sanitizePythonIdentifier('random')).toBe('random_');
  });

  it('is deterministic and idempotent on sanitized form', () => {
    const a = sanitizePythonIdentifier('list');
    const b = sanitizePythonIdentifier('list');
    expect(a).toBe('list_');
    expect(b).toBe(a);
    // Already-sanitized form is not reserved, so second sanitize is a no-op.
    expect(sanitizePythonIdentifier(a)).toBe('list_');
  });

  it('round-trips reserved names via unsanitize', () => {
    for (const name of [
      'list',
      'class',
      'print',
      'input',
      'str',
      'int',
      'def',
      'Exception',
    ]) {
      expect(unsanitizePythonIdentifier(sanitizePythonIdentifier(name))).toBe(
        name,
      );
    }
  });

  it('unsanitize only strips when stem is reserved', () => {
    expect(unsanitizePythonIdentifier('list_')).toBe('list');
    expect(unsanitizePythonIdentifier('class_')).toBe('class');
    expect(unsanitizePythonIdentifier('Count_')).toBe('Count_');
    expect(unsanitizePythonIdentifier('my_list_')).toBe('my_list_');
    expect(unsanitizePythonIdentifier('_')).toBe('_');
  });

  it('documents imperfect reverse for Cambridge names already ending in _', () => {
    // Cambridge `list_` is not reserved → emit `list_` → reverse strips to `list`.
    expect(sanitizePythonIdentifier('list_')).toBe('list_');
    expect(unsanitizePythonIdentifier('list_')).toBe('list');
  });

  it('leaves translator _pp_* helpers unchanged', () => {
    for (const name of [
      '_pp_cell',
      '_pp_eof',
      '_pp_files',
      '_pp_is_num',
      '_pp_input_bool',
      '_pp_ref_0',
    ]) {
      expect(isPythonReservedIdentifier(name)).toBe(false);
      expect(sanitizePythonIdentifier(name)).toBe(name);
      expect(unsanitizePythonIdentifier(name)).toBe(name);
    }
  });
});
