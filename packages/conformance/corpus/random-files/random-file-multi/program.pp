TYPE Item
  DECLARE Code : INTEGER
ENDTYPE
DECLARE A, B, Loaded : Item
A.Code ← 10
B.Code ← 20
OPENFILE "Items.Dat" FOR RANDOM
SEEK "Items.Dat", 0
PUTRECORD "Items.Dat", A
SEEK "Items.Dat", 1
PUTRECORD "Items.Dat", B
SEEK "Items.Dat", 1
GETRECORD "Items.Dat", Loaded
CLOSEFILE "Items.Dat"
OUTPUT Loaded.Code
