DECLARE Mark : INTEGER
DECLARE Grade : CHAR
// CHAR
Mark ← 67
IF Mark >= 80 THEN
    Grade ← 'A'
ELSE
    IF Mark >= 70 THEN
        Grade ← 'B'
    ELSE
        IF Mark >= 60 THEN
            Grade ← 'C'
        ELSE
            Grade ← 'U'
        ENDIF
    ENDIF
ENDIF
OUTPUT Grade
