# Paper 2 insert — DATE

Source: [June 2024 Paper 2 Insert](https://www.cambridgeinternational.org/Images/673618-june-2024-insert-paper-21.pdf). Date format assumed **DD/MM/YYYY** unless a paper states otherwise. Shipped in PseudoPilot Core.

---

## DAY

**Status:** SUPPORTED

### Syntax

```text
DAY(ThisDate : DATE) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisDate` | `DATE` | Source date |

### Return

Day number of the month.

### What it does

Extracts the day component.

### Example

```text
OUTPUT DAY(04/10/2003)
// 4
```

### Restrictions

Argument must be `DATE`.

### Common mistake

Swapping day and month when reading `04/10/2003`.

### Support notes

Core DATE insert pack.

---

## MONTH

**Status:** SUPPORTED

### Syntax

```text
MONTH(ThisDate : DATE) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisDate` | `DATE` | Source date |

### Return

Month number `1`–`12`.

### Example

```text
OUTPUT MONTH(04/10/2003)
// 10
```

### Restrictions

`DATE` argument required.

### Common mistake

Assuming US month-first formatting.

### Support notes

Core.

---

## YEAR

**Status:** SUPPORTED

### Syntax

```text
YEAR(ThisDate : DATE) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisDate` | `DATE` | Source date |

### Return

Year number.

### Example

```text
OUTPUT YEAR(04/10/2003)
// 2003
```

### Restrictions

`DATE` only.

### Common mistake

Using string slicing on `"04/10/2003"` instead of `YEAR`.

### Support notes

Core.

---

## DAYINDEX

**Status:** SUPPORTED

### Syntax

```text
DAYINDEX(ThisDate : DATE) RETURNS INTEGER
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `ThisDate` | `DATE` | Source date |

### Return

Weekday index: **Sunday = 1** … **Saturday = 7**.

### What it does

Maps a date to a weekday number for timetables and scheduling logic.

### Example

```text
OUTPUT DAYINDEX(09/05/2023)
// 3
```

### Restrictions

Must follow Sunday=1 convention from the insert.

### Common mistake

Using Monday=1 (ISO) instead of Sunday=1.

### Support notes

Core.

---

## SETDATE

**Status:** SUPPORTED

### Syntax

```text
SETDATE(Day, Month, Year : INTEGER) RETURNS DATE
```

### Parameters

| Name | Type | Role |
| --- | --- | --- |
| `Day` | `INTEGER` | Day |
| `Month` | `INTEGER` | Month |
| `Year` | `INTEGER` | Year |

### Return

`DATE` for that calendar day.

### What it does

Builds a date from numeric parts.

### Example

```text
OUTPUT SETDATE(26, 10, 2003)
// date corresponding to 26/10/2003
```

### Restrictions

Invalid calendar combinations → runtime error behaviour as implemented.

### Common mistake

Passing arguments in `Y, M, D` order.

### Support notes

Core.

---

## TODAY

**Status:** SUPPORTED

### Syntax

```text
TODAY() RETURNS DATE
```

### Parameters

None.

### Return

Current calendar `DATE`.

### What it does

Supplies “today” for age calculations and timestamps in algorithms.

### Example

```text
DECLARE D : DATE
D ← TODAY()
OUTPUT YEAR(D)
```

### Restrictions

Host clock dependent in the runtime.

### Common mistake

Writing `TODAY` without `()`.

### Support notes

Core DATE insert pack.
