DECLARE output : STRING

FUNCTION middle(x : STRING, y : INTEGER, z : INTEGER) RETURNS STRING

DECLARE length : INTEGER

DECLARE right,answer : STRING

length ← LENGTH(x)

right ← RIGHT(x,(length-y) + 1)

answer ← LEFT(right,z)

RETURN answer

ENDFUNCTION

output ← middle("hello",3,3)

OUTPUT output
