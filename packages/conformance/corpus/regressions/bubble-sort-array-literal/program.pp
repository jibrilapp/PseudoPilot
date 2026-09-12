DECLARE list : ARRAY[1:10] OF INTEGER
DECLARE i, j, temp : INTEGER
list ← [5,4,3,1,2,6,7,8,9,0]
FOR i ← 1 TO 9
  FOR j ← 1 TO 10 - i
    IF list[j] > list[j + 1] THEN
      temp ← list[j]
      list[j] ← list[j + 1]
      list[j + 1] ← temp
    ENDIF
  NEXT j
NEXT i
FOR i ← 1 TO 10
  OUTPUT list[i]
NEXT i
