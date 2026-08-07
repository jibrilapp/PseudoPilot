DECLARE Line : STRING
OPENFILE "note.txt" FOR WRITE
WRITEFILE "note.txt", "line1"
CLOSEFILE "note.txt"
OPENFILE "note.txt" FOR READ
READFILE "note.txt", Line
CLOSEFILE "note.txt"
OUTPUT Line
