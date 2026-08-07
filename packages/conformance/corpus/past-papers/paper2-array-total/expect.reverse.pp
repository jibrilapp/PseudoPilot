DECLARE Marks : ARRAY[1:4] OF INTEGER
// ARRAY[1:4]
DECLARE I : INTEGER
DECLARE Total : INTEGER
DECLARE Average : REAL
Marks[1] ← 40
Marks[2] ← 50
Marks[3] ← 60
Marks[4] ← 70
Total ← 0
FOR I ← 1 TO 4
    Total ← Total + Marks[I]
NEXT I
Average ← Total / 4
OUTPUT Total
OUTPUT Average
