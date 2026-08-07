TYPE IntPtr = ^INTEGER
DECLARE Value : INTEGER
DECLARE Ptr : IntPtr
Value ← 10
Ptr ← ^Value
Ptr^ ← Ptr^ + 5
OUTPUT Value
