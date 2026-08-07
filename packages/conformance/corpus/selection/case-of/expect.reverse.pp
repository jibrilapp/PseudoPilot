DECLARE Grade : CHAR
// CHAR
Grade ← 'B'
CASE OF Grade
    'A' :
        OUTPUT "Excellent"
    'B' :
        OUTPUT "Good"
    OTHERWISE
        OUTPUT "Other"
ENDCASE
