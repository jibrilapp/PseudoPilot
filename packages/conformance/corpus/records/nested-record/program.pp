TYPE Address
  DECLARE City : STRING
ENDTYPE
TYPE Person
  DECLARE Name : STRING
  DECLARE Home : Address
ENDTYPE
DECLARE P : Person
P.Name ← "Sam"
P.Home.City ← "Cambridge"
OUTPUT P.Name
OUTPUT P.Home.City
