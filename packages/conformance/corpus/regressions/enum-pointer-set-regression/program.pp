TYPE Colour = (Red, Green, Blue)
TYPE ColourPtr = ^Colour
TYPE Flags = SET OF INTEGER
DEFINE Bits(1, 2) : Flags
DECLARE C : Colour
DECLARE P : ColourPtr
C ← Green
P ← ^C
OUTPUT P^
OUTPUT Bits
