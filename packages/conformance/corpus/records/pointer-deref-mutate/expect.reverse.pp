TYPE IntPtr = ^INTEGER
// TYPE IntPtr = ^INTEGER (pointer to int)
DECLARE Value : INTEGER
DECLARE Ptr : IntPtr
// NIL / IntPtr
Value ← 10
Ptr ← ^Value
Ptr^ ← Ptr^ + 5
OUTPUT Value
