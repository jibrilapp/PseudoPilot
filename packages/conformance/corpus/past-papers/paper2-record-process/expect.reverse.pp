TYPE Result
    DECLARE Candidate : STRING
    DECLARE Score : INTEGER
ENDTYPE
DECLARE R : Result
R.Candidate ← "Alex"
R.Score ← 88
IF R.Score >= 80 THEN
    OUTPUT R.Candidate & " distinction"
ELSE
    OUTPUT R.Candidate & " pass"
ENDIF
