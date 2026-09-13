import { describe, expect, it } from 'vitest';
import { runPseudocode, MemoryHost } from '@pseudopilot/interpreter';
import { runPythonToPseudocode } from './runTranslate';

const LINEAR_SEARCH = `
def LinearSearch(NumberList, TargetValue):
    for index in range(len(NumberList)):
        if NumberList[index] == TargetValue:
            return index
        elif index == len(NumberList) - 1:
            return -1

NumberList = [12, 7, 25, 4, 19]

search_item = 25

result = LinearSearch(NumberList, search_item)

if result != -1:
    print(f"Item {search_item} found at position {result}.")
else:
    print(f"Item {search_item} not found in the list.")
`;

const LINEAR_SEARCH_PARTIAL_ANNOTATIONS = `
def LinearSearch(NumberList, TargetValue: int) -> int:
    for index in range(0, len(NumberList) + 1):
        if NumberList[index] == TargetValue:
            return index
        elif index == len(NumberList) - 1:
            return -1
    return -1

NumberList = [12, 7, 25, 4, 19]
search_item = 25
result = LinearSearch(NumberList, search_item)

if result != -1:
    print("Item", search_item, "found at position", result, ".")
else:
    print("Item", search_item, "not found in the list.")
`;

const BINARY_SEARCH = `
def binary_search(data_list, target):
    low = 0
    high = len(data_list) - 1

    while low <= high:
        mid = (low + high) // 2

        if data_list[mid] == target:
            return mid
        elif data_list[mid] < target:
            low = mid + 1
        else:
            high = mid - 1

    return -1

mylist = [3,7,11,15,19,23,27,31,35]
ans = binary_search(mylist, 23)
print(ans)
`;

describe('runPythonToPseudocode (web adapter)', () => {
  it('translates binary_search through the same path as the IDE', async () => {
    const translated = runPythonToPseudocode(BINARY_SEARCH);
    expect(translated.ok, translated.diagnostics.map((d) => d.message).join('; ')).toBe(
      true,
    );
    expect(translated.diagnostics).toEqual([]);
    expect(translated.code).toContain('FUNCTION binary_search');
    expect(translated.code).toContain('data_list : ARRAY[1:9] OF INTEGER');
    expect(translated.code).toContain('RETURNS INTEGER');

    const host = new MemoryHost();
    const run = await runPseudocode(translated.code, { host });
    expect(run.ok, JSON.stringify(run.diagnostics)).toBe(true);
    expect(host.outputs.join('')).toBe('5');
  });

  it('translates partially annotated LinearSearch with zero diagnostics', async () => {
    const translated = runPythonToPseudocode(LINEAR_SEARCH_PARTIAL_ANNOTATIONS);
    expect(translated.ok, translated.diagnostics.map((d) => d.message).join('; ')).toBe(
      true,
    );
    expect(translated.diagnostics).toEqual([]);
    expect(translated.code).toContain('NumberList : ARRAY[1:5] OF INTEGER');

    const host = new MemoryHost();
    const run = await runPseudocode(translated.code, { host });
    expect(run.ok, JSON.stringify(run.diagnostics)).toBe(true);
    expect(host.outputs.join('')).toContain('found at position 2');
  });

  it('translates LinearSearch through the same path as the IDE', async () => {
    const translated = runPythonToPseudocode(LINEAR_SEARCH);
    expect(translated.ok, translated.diagnostics.map((d) => d.message).join('; ')).toBe(
      true,
    );
    expect(translated.diagnostics).toEqual([]);
    expect(translated.code).toContain('FUNCTION LinearSearch');
    expect(translated.code).toContain('DECLARE NumberList : ARRAY[1:5] OF INTEGER');
    expect(translated.code).not.toContain('LENGTH(NumberList)');

    const host = new MemoryHost();
    const run = await runPseudocode(translated.code, { host });
    expect(run.ok, JSON.stringify(run.diagnostics)).toBe(true);
    expect(host.outputs.join('')).toBe('Item 25 found at position 2.');
    expect(translated.code).toMatch(/FOR index ← 0 TO 4/);
    expect(translated.code).not.toMatch(/- 1 \+ 1 - 1/);
  });

  it('reports clear Python 3 diagnostic for bare print', () => {
    const translated = runPythonToPseudocode('print hello\n');
    expect(translated.ok).toBe(false);
    expect(translated.diagnostics).toHaveLength(1);
    expect(translated.diagnostics[0]?.message).toContain('requires parentheses in Python 3');
  });

  it('translates myfunc concat + print(x) through web adapter', async () => {
    const source = `
def myfunc(hello):
    hello = hello + " hi"
    return hello
x = myfunc("yo")
print(x)
`;
    const translated = runPythonToPseudocode(source);
    expect(translated.ok, translated.diagnostics.map((d) => d.message).join('; ')).toBe(
      true,
    );
    expect(translated.diagnostics).toEqual([]);
    const host = new MemoryHost();
    const run = await runPseudocode(translated.code, { host });
    expect(run.ok, JSON.stringify(run.diagnostics)).toBe(true);
    expect(host.outputs.join('')).toBe('yo hi');
  });

  it('infers STRING parameter from body assignment (myfunc/hello)', () => {
    const source = `
def myfunc(hello):
    hello = "hi"
    return hello
`;
    const translated = runPythonToPseudocode(source);
    expect(translated.ok, translated.diagnostics.map((d) => d.message).join('; ')).toBe(
      true,
    );
    expect(translated.diagnostics).toEqual([]);
    expect(translated.code).toContain('myfunc(hello : STRING)');
    expect(translated.code).toContain('RETURNS STRING');
    expect(translated.code).not.toContain('hello : INTEGER');
  });
});
