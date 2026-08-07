DECLARE A : ARRAY[1:6] OF INTEGER
// ARRAY[1:6]
DECLARE I : INTEGER
DECLARE Target : INTEGER
DECLARE Count : INTEGER
A[1] ← 2
A[2] ← 5
A[3] ← 2
A[4] ← 7
A[5] ← 2
A[6] ← 9
Target ← 2
Count ← 0
FOR I ← 1 TO 6
    IF A[I] = Target THEN
        Count ← Count + 1
    ENDIF
NEXT I
OUTPUT Count
