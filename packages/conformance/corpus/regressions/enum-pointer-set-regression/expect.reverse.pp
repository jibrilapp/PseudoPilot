TYPE Colour = (Red, Green, Blue)
TYPE ColourPtr = ^Colour
// TYPE ColourPtr = ^Colour (pointer to Colour)
TYPE Flags = SET OF INTEGER
// TYPE Flags = SET OF INTEGER (int)
DEFINE Bits (1, 2): Flags
DECLARE C : Colour
DECLARE P : ColourPtr
// NIL / ColourPtr
C ← Green
P ← ^C
OUTPUT P^
OUTPUT Bits
