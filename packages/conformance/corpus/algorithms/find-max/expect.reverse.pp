DECLARE Scores : ARRAY[1:5] OF INTEGER
// ARRAY[1:5]
DECLARE I : INTEGER
DECLARE Max : INTEGER
Scores[1] ← 12
Scores[2] ← 27
Scores[3] ← 9
Scores[4] ← 31
Scores[5] ← 18
Max ← Scores[1]
FOR I ← 2 TO 5
    IF Scores[I] > Max THEN
        Max ← Scores[I]
    ENDIF
NEXT I
OUTPUT Max
