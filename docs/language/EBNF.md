# PseudoPilot EBNF Grammar

**Canonical grammar** for the PseudoPilot dialect of Cambridge 9618 pseudocode.  
Status marks on productions use the same legend as the checklists.

Notation:

- `"…"` — terminal literal (case-insensitive for keyword letters)
- `'…'` — character / symbol terminal
- `{ X }` — zero or more
- `[ X ]` — optional
- `( X | Y )` — choice
- `(X)` — grouping
- `(* … *)` — comment

Newline (`NL`) is significant for statement boundaries and for `ELSE IF` disambiguation.

---

## 1. Lexical grammar

```ebnf
letter       = "A" | … | "Z" | "a" | … | "z" ;
digit        = "0" | … | "9" ;
identifier   = letter { letter | digit | "_" } ;

integer_lit  = digit { digit } ;
real_lit     = digit { digit } "." digit { digit } ;   (* strict Cambridge *)

string_lit   = '"' { string_char } '"' ;
char_lit     = "'" char_char "'" ;                    (* ❌ not lexer-complete *)

comment      = "//" { any_char_except_NL } NL ;

(* Whitespace: spaces, tabs ignored; NL tokenised for line orientation *)
```

**Operator terminals:**

```ebnf
assign_op    = "←" | "<-" ;
rel_op       = "=" | "<>" | "<" | "<=" | ">" | ">=" ;
add_op       = "+" | "-" | "&" ;                       (* "&" ❌ *)
mul_op       = "*" | "/" | "DIV" | "MOD" ;
```

---

## 2. Program and blocks

```ebnf
program         = { NL } { ( top_form | NL ) } ;

top_form        = routine_decl
                | statement
                ;

block           = { NL } { ( statement | NL ) } ;

(* ✅ program / block as used by current parser *)
```

---

## 3. Declarations and routines

```ebnf
routine_decl    = procedure_decl                          (* ✅ *)
                | function_decl                           (* ✅ *)
                | type_decl                               (* ❌ Extended *)
                | class_decl                              (* ❌ Extended *)
                ;

procedure_decl  = "PROCEDURE" identifier [ param_list ] NL
                  block
                  "ENDPROCEDURE"                          (* ✅ *)
                ;

function_decl   = "FUNCTION" identifier [ param_list ]
                  "RETURNS" type_name NL
                  block
                  "ENDFUNCTION"                           (* ✅ *)
                ;

param_list      = "(" [ param { "," param } ] ")" ;       (* ✅ *)

param           = [ "BYVAL" | "BYREF" ] identifier ":" type_name ;
                  (* BYVAL/BYREF ❌; Ident:Type ✅ *)

declare_stmt    = "DECLARE" identifier { "," identifier }
                  ":" type_ref ;                          (* ✅ *)

constant_stmt   = "CONSTANT" identifier "=" literal ;     (* ❌ *)

type_ref        = type_name                               (* ✅ *)
                | array_type                              (* ✅ *)
                ;

type_name       = "INTEGER" | "REAL" | "CHAR" | "STRING"
                | "BOOLEAN" | "DATE"                      (* DATE ❌ *)
                | identifier                              (* user type ❌ *)
                ;

array_type      = "ARRAY" "[" dimension { "," dimension } "]"
                  "OF" type_name ;                        (* ✅ *)

dimension       = expression ":" expression ;             (* ✅ *)
```

---

## 4. Statements

```ebnf
statement       = declare_stmt                            (* ✅ *)
                | constant_stmt                           (* ❌ *)
                | assign_stmt                             (* ✅ *)
                | input_stmt                              (* ✅ *)
                | output_stmt                             (* ✅ *)
                | if_stmt                                 (* ✅ *)
                | case_stmt                               (* ❌ *)
                | for_stmt                                (* ✅ *)
                | while_stmt                              (* ✅ *)
                | repeat_stmt                             (* ✅ *)
                | call_stmt                               (* ✅ *)
                | return_stmt                             (* ✅ *)
                | openfile_stmt                           (* ✅ *)
                | readfile_stmt                           (* ✅ *)
                | writefile_stmt                          (* ✅ *)
                | closefile_stmt                          (* ✅ *)
                | seek_stmt                               (* ❌ *)
                | getrecord_stmt                          (* ❌ *)
                | putrecord_stmt                          (* ❌ *)
                ;
```

### 4.1 Assignment, I/O

```ebnf
assign_stmt     = assign_target assign_op expression ;    (* ✅ *)

assign_target   = identifier                              (* ✅ *)
                | index_expr                              (* ✅ *)
                | member_expr                             (* ❌ *)
                ;

input_stmt      = "INPUT" assign_target ;                 (* ✅ *)

output_stmt     = "OUTPUT" expression { "," expression } ;(* ✅ *)
```

### 4.2 Selection

```ebnf
if_stmt         = "IF" expression "THEN" NL
                  block
                  { else_if_clause }
                  [ "ELSE" NL block ]
                  "ENDIF" ;                               (* ✅ *)

else_if_clause  = "ELSE" "IF" expression "THEN" NL
                  block ;
                  (* "IF" must be same line as "ELSE" — ✅ *)

case_stmt       = "CASE" "OF" expression NL
                  { case_arm }
                  [ otherwise_arm ]
                  "ENDCASE" ;                             (* ❌ *)

case_arm        = case_label ":" statement NL ;

case_label      = expression
                | expression "TO" expression ;

otherwise_arm   = "OTHERWISE" ":" statement NL ;
```

### 4.3 Iteration

```ebnf
for_stmt        = "FOR" identifier assign_op expression
                  "TO" expression
                  [ "STEP" expression ] NL
                  block
                  "NEXT" identifier ;                     (* ✅ *)

while_stmt      = "WHILE" expression ["DO"] NL
                  block
                  "ENDWHILE" ;                            (* ✅ — DO optional *)

repeat_stmt     = "REPEAT" NL
                  block
                  "UNTIL" expression ;                    (* ✅ *)
```

### 4.4 Calls and return

```ebnf
call_stmt       = "CALL" identifier [ "(" [ arg_list ] ")" ] ; (* ✅ *)

return_stmt     = "RETURN" expression ;                   (* ✅ functions only *)

arg_list        = expression { "," expression } ;
```

### 4.5 Files

```ebnf
openfile_stmt   = "OPENFILE" expression "FOR" file_mode ; (* ✅ text modes *)

file_mode       = "READ" | "WRITE" | "APPEND"             (* ✅ *)
                | "RANDOM" ;                              (* ❌ *)

readfile_stmt   = "READFILE" expression "," assign_target ; (* ✅ *)

writefile_stmt  = "WRITEFILE" expression "," expression ; (* ✅ *)

closefile_stmt  = "CLOSEFILE" expression ;                (* ✅ *)

seek_stmt       = "SEEK" expression "," expression ;      (* ❌ *)

getrecord_stmt  = "GETRECORD" expression "," assign_target ; (* ❌ *)

putrecord_stmt  = "PUTRECORD" expression "," expression ; (* ❌ *)
```

---

## 5. Expressions (Pratt / precedence)

```ebnf
expression      = or_expr ;                               (* ✅ core ops *)

or_expr         = and_expr { "OR" and_expr } ;

and_expr        = rel_expr { "AND" rel_expr } ;

rel_expr        = add_expr [ rel_op add_expr ] ;
                  (* no chaining x < y < z as range — resolved in SPEC §13 *)

add_expr        = mul_expr { ( "+" | "-" | "&" ) mul_expr } ;
                  (* "&" ❌ *)

mul_expr        = unary_expr { ( "*" | "/" | "DIV" | "MOD" ) unary_expr } ;

unary_expr      = ( "+" | "-" | "NOT" ) unary_expr
                | postfix_expr ;

postfix_expr    = primary
                  { "(" [ arg_list ] ")"                  (* call ✅ *)
                  | "[" expression { "," expression } "]" (* index ✅ *)
                  | "." identifier                        (* member ❌ *)
                  | "^"                                   (* deref ❌ *)
                  } ;

primary         = literal
                | identifier
                | "EOF" "(" expression ")"                (* ✅ *)
                | "(" expression ")"
                ;

literal         = integer_lit                             (* ✅ *)
                | real_lit                                (* ✅ / 🟡 strict form *)
                | string_lit                              (* ✅ *)
                | char_lit                                (* ❌ *)
                | "TRUE" | "FALSE"                        (* ✅ *)
                | date_lit                                (* ❌ *)
                ;

index_expr      = identifier "[" expression { "," expression } "]" ;

member_expr     = postfix_expr "." identifier ;           (* ❌ *)
```

**Call note:** `EOF(…)` is a dedicated primary, not a general identifier call, so it is not shadowed by user functions.

User function calls share the `identifier "(" … ")"` postfix form with builtins (`LENGTH`, …) once registered.

---

## 6. Extended: TYPE and CLASS (❌)

```ebnf
type_decl       = enum_type
                | pointer_type
                | record_type
                | set_type ;

enum_type       = "TYPE" identifier "="
                  "(" identifier { "," identifier } ")" ;

pointer_type    = "TYPE" identifier "=" "^" type_name ;

record_type     = "TYPE" identifier NL
                  { declare_stmt NL }
                  "ENDTYPE" ;

set_type        = "TYPE" identifier "=" "SET" "OF" type_name NL
                  "DEFINE" identifier
                  "(" literal { "," literal } ")" ":" identifier ;

class_decl      = "CLASS" identifier [ "INHERITS" identifier ] NL
                  { class_member }
                  "ENDCLASS" ;

class_member    = [ "PUBLIC" | "PRIVATE" ]
                  ( declare_stmt
                  | procedure_decl
                  | function_decl
                  ) ;

(* Instantiation: target ← NEW ClassName ( args )  — ❌ *)
```

---

## 7. Coverage summary (grammar-level)

| Production family | Status |
| --- | --- |
| Program / block / comments | ✅ |
| DECLARE + ARRAY types | ✅ |
| CONSTANT | ❌ |
| Assignment / INPUT / OUTPUT | ✅ |
| IF / ELSE / ELSE IF / ENDIF | ✅ |
| CASE / ENDCASE | ❌ |
| WHILE / ENDWHILE | ✅ |
| REPEAT / UNTIL | ✅ |
| FOR | ✅ |
| PROCEDURE / FUNCTION / CALL / RETURN | ✅ |
| BYVAL / BYREF | ❌ |
| Text files + EOF | ✅ |
| Random files | ❌ |
| Core expression operators | ✅ |
| `&` concat | ❌ |
| Builtins LENGTH/RIGHT/… | ❌ |
| CHAR / DATE literals | ❌ / ❌ |
| TYPE / CLASS | ❌ |

Exact itemised checklists: [PARSER_COVERAGE.md](./PARSER_COVERAGE.md).
