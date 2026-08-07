DECLARE Data : ARRAY[1:5] OF INTEGER
DECLARE I, Target, Found : INTEGER
Data[1] ← 4
Data[2] ← 8
Data[3] ← 15
Data[4] ← 16
Data[5] ← 23
Target ← 16
Found ← 0
FOR I ← 1 TO 5
  IF Data[I] = Target THEN
    Found ← I
  ENDIF
NEXT I
OUTPUT Found
