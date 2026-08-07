TYPE Cell
    DECLARE V : INTEGER
ENDTYPE
DECLARE First : Cell
DECLARE Second : Cell
DECLARE Loaded : Cell
First.V ← 1
Second.V ← 99
OPENFILE "Cell.Dat" FOR RANDOM
SEEK "Cell.Dat", 0
PUTRECORD "Cell.Dat", First
SEEK "Cell.Dat", 0
PUTRECORD "Cell.Dat", Second
SEEK "Cell.Dat", 0
GETRECORD "Cell.Dat", Loaded
CLOSEFILE "Cell.Dat"
OUTPUT Loaded.V
