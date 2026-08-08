# Object-oriented programming (§10)

Extended A Level surface. Detail: [`OBJECT_ORIENTED_PROGRAMMING.md`](../language/OBJECT_ORIENTED_PROGRAMMING.md).

---

## CLASS … ENDCLASS

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CLASS <identifier>
  <properties and methods>
ENDCLASS
```

### Explanation

Defines a class with properties (fields) and methods (procedures/functions).

### Example

```text
CLASS Pet
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING)
    Name ← GivenName
  ENDPROCEDURE
ENDCLASS
```

### Important Cambridge rules

- Single class body closed by `ENDCLASS`.
- Nested `CLASS` declarations are rejected.

### Common exam mistake

Using `TYPE`…`ENDTYPE` when the question requires `CLASS`.

### Related

- [PUBLIC / PRIVATE](#public--private)
- [NEW instantiation](#new-instantiation)

---

## PUBLIC / PRIVATE

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
PUBLIC <member>
PRIVATE <member>
```

### Explanation

Access level for properties and methods. Guide: methods and properties can be assumed public unless otherwise stated; when access matters, papers use `PUBLIC` / `PRIVATE` explicitly.

### Example

```text
PRIVATE Attempts : INTEGER
PUBLIC PROCEDURE SetAttempts(Number : INTEGER)
  Attempts ← Number
ENDPROCEDURE
PRIVATE FUNCTION GetAttempts() RETURNS INTEGER
  RETURN Attempts
ENDFUNCTION
```

### Important Cambridge rules

- PseudoPilot defaults omitted visibility to **PUBLIC** (documented extension / convenience; Cambridge examples usually write the keyword).

### Common exam mistake

Accessing a `PRIVATE` member from outside the class in a design answer.

### Related

- [CLASS](#class--endclass)
- [CONFORMANCE §4.10](../CONFORMANCE.md)

---

## PROCEDURE NEW (constructor)

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
PUBLIC PROCEDURE NEW(<parameters>)
  <statement(s)>
ENDPROCEDURE
```

### Explanation

Constructors are procedures named `NEW`. They initialise a new object.

### Example

```text
PUBLIC PROCEDURE NEW(GivenName : STRING)
  Name ← GivenName
ENDPROCEDURE
```

### Important Cambridge rules

- Constructor name is `NEW`.
- Called indirectly via `← NEW ClassName(…)`.

### Common exam mistake

Writing a function named `NEW` that `RETURNS` the object instead of using the Guide’s procedure form.

### Related

- [NEW instantiation](#new-instantiation)
- [INHERITS / SUPER](#inherits)

---

## INHERITS

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
CLASS <Child> INHERITS <Parent>
  ...
ENDCLASS
```

### Explanation

Single inheritance from one parent class.

### Example

```text
CLASS Cat INHERITS Pet
  PRIVATE Breed : STRING
  PUBLIC PROCEDURE NEW(GivenName : STRING, GivenBreed : STRING)
    SUPER.NEW(GivenName)
    Breed ← GivenBreed
  ENDPROCEDURE
ENDCLASS
```

### Important Cambridge rules

- One parent only — no multiple inheritance in Cambridge 9618 / PseudoPilot.
- Parent must be a `CLASS`.

### Common exam mistake

Listing two parents after `INHERITS`.

### Related

- [SUPER](#super)
- [OOP.md](../language/OBJECT_ORIENTED_PROGRAMMING.md)

---

## SUPER

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
SUPER.NEW(<arguments>)
SUPER.<Method>(<arguments>)
```

### Explanation

Calls a superclass constructor or method from a subclass.

### Example

```text
SUPER.NEW(GivenName)
```

### Important Cambridge rules

- Used with inheritance to initialise or reuse parent behaviour.

### Common exam mistake

Calling `Pet.NEW(…)` instead of `SUPER.NEW(…)` in subclass constructors.

### Related

- [INHERITS](#inherits)

---

## NEW instantiation

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<objectVariable> ← NEW <ClassName>(<arguments>, ...)
```

### Explanation

Creates an object by running the class’s `NEW` procedure and stores a reference in the variable.

### Example

```text
MyCat ← NEW Cat("Kitty", "Shorthaired")
```

### Important Cambridge rules

- Object variables use reference semantics (distinct from record value copy).
- Arguments match the `NEW` procedure parameters.

### Common exam mistake

Forgetting `NEW` and assigning a class name as if it were a value type.

### Related

- [PROCEDURE NEW](#procedure-new-constructor)
- [Method call](#method-call)

---

## Method call

**Status:** SUPPORTED

### Exact Cambridge syntax

```text
<object>.<Method>(<arguments>)
OUTPUT <object>.<Function>(<arguments>)
```

### Explanation

Invoke a method on an object with dot notation.

### Example

```text
Player.SetAttempts(5)
OUTPUT Player.GetAttempts()
```

### Important Cambridge rules

- Procedure methods are statements; function methods appear in expressions.

### Common exam mistake

Using `CALL Player.SetAttempts(5)` when the Guide shows `Player.SetAttempts(5)`.

### Related

- [PUBLIC / PRIVATE](#public--private)
- [CLASS](#class--endclass)
