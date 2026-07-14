# @pseudopilot/web

Student IDE UI shell for PseudoPilot (**Milestone 2 — UI only**).

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @pseudopilot/web dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s here

Visual IDE chrome inspired by VS Code / modern developer tools:

- Toolbar + brand
- Activity bar + file explorer
- Split pseudocode / Python editors (dummy highlighted code)
- Console, AI coach panel, variable inspector
- Status bar
- Responsive mobile dock

No interpreter, parser, auth, or AI backend is wired yet.
