DECLARE A : ARRAY[1:7] OF INTEGER
// ARRAY[1:7]
DECLARE Low : INTEGER
DECLARE High : INTEGER
DECLARE Mid : INTEGER
DECLARE Target : INTEGER
DECLARE Found : INTEGER
A[1] ← 1
A[2] ← 3
A[3] ← 5
A[4] ← 7
A[5] ← 9
A[6] ← 11
A[7] ← 13
Target ← 9
Low ← 1
High ← 7
Found ← 0
WHILE Low <= High AND Found = 0 DO
    Mid ← (Low + High) DIV 2
    IF A[Mid] = Target THEN
        Found ← Mid
    ELSE
        IF A[Mid] < Target THEN
            Low ← Mid + 1
        ELSE
            High ← Mid - 1
        ENDIF
    ENDIF
ENDWHILE
OUTPUT Found
