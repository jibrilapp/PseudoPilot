DECLARE A : ARRAY[1:5] OF INTEGER
// ARRAY[1:5]
DECLARE I : INTEGER
DECLARE J : INTEGER
DECLARE Temp : INTEGER
A[1] ← 5
A[2] ← 1
A[3] ← 4
A[4] ← 2
A[5] ← 3
FOR I ← 1 TO 4
    FOR J ← 1 TO 5 - I
        IF A[J] > A[J + 1] THEN
            Temp ← A[J]
            A[J] ← A[J + 1]
            A[J + 1] ← Temp
        ENDIF
    NEXT J
NEXT I
FOR I ← 1 TO 5
    OUTPUT A[I]
NEXT I
