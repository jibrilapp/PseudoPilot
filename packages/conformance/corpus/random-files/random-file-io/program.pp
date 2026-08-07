TYPE Student
  DECLARE LastName : STRING
  DECLARE YearGroup : INTEGER
ENDTYPE
DECLARE Pupil : Student
DECLARE Loaded : Student
Pupil.LastName ← "Johnson"
Pupil.YearGroup ← 6
OPENFILE "StudentFile.Dat" FOR RANDOM
SEEK "StudentFile.Dat", 0
PUTRECORD "StudentFile.Dat", Pupil
SEEK "StudentFile.Dat", 0
GETRECORD "StudentFile.Dat", Loaded
CLOSEFILE "StudentFile.Dat"
OUTPUT Loaded.LastName
OUTPUT Loaded.YearGroup
