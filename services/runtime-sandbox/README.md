# @pseudopilot/runtime-sandbox

Isolated execution microservice boundary.

**Why it exists as its own service folder in Milestone 1:** server-side runs (teacher batch grading, untrusted paste, file I/O) must scale horizontally *without* scaling the whole API. At 100k users, peak execute load must not starve auth/projects.

No containers or seccomp yet — foundation only.
