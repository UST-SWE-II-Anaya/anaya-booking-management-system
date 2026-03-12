# gemini.md — General System Rules

> These are the shared rules for all developers working on this project.
> Each developer may have their own view-specific rules in separate files.

---

## 1. Tech Stack

- **Framework:** React (JavaScript)
- **Backend / Auth:** Supabase
- **Styling:** Tailwind CSS
- **API Style:** REST
- **Style Guide:** Standard JS
- **Formatter:** Prettier

---

## 2. Code Style & Formatting

- Follow **Standard JS** rules across all `.js` and `.jsx` files.
- Use **Prettier** for formatting. Never manually reformat code that Prettier handles.
- Use **single quotes** for strings (Standard JS default).
- **No semicolons** (Standard JS default).
- Maximum line length: **80 characters**.
- Use `const` by default; use `let` only when reassignment is necessary. Never use `var`.
- Prefer **arrow functions** for callbacks and functional components.
- Always use **explicit `return`** for multi-line arrow functions.
- Avoid deeply nested code — extract logic into named functions or custom hooks.
- Delete unused variables, imports, and dead code before committing.

---

## 3. Folder & File Structure

The project follows a **layer-based** structure:

```
src/
├── assets/         # Static files (images, fonts, icons)
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── pages/          # Route-level page components
├── services/       # API call functions
├── store/          # Global state management
├── styles/         # Global styles and Tailwind config overrides
└── utils/          # Pure helper/utility functions
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `UserCard.jsx` |
| Hooks | camelCase with `use` prefix | `useAuthUser.js` |
| Pages | PascalCase | `DashboardPage.jsx` |
| Services | camelCase | `userService.js` |
| Utils | camelCase | `formatDate.js` |
| Directories | kebab-case | `user-profile/` |

- Each component should live in its own folder if it has related files (e.g., styles, tests):
  ```
  components/
  └── UserCard/
      ├── index.jsx
      └── UserCard.test.jsx
  ```
- Keep files **single-responsibility** — one component or one logical concern per file.

---

## 4. React Guidelines

- Use **functional components** only. No class components.
- Define **prop types** or use JSDoc comments for all component props.
- Keep components small and focused. Extract subcomponents when a component exceeds ~150 lines.
- Place all reusable logic in `hooks/`. Never duplicate stateful logic across components.
- Avoid inline styles. Use **Tailwind CSS utility classes** instead.
- Use Tailwind's `cn()` or `clsx` for conditional class logic — avoid string concatenation.

---

## 5. API, REST & Supabase Conventions

- All API calls must live in `src/services/`.
- Name service functions clearly by resource and action:
  - `getUsers()`, `getUserById(id)`, `createUser(data)`, `updateUser(id, data)`, `deleteUser(id)`
- Always handle errors explicitly — never silently swallow them.
- Use `async/await` over `.then()` chains.
- Never put raw `fetch` or `axios` calls directly in components or hooks — always go through a service function.
- API base URL must come from environment variables (e.g., `REACT_APP_API_URL`). Never hardcode URLs.

### Supabase

- Initialize the Supabase client **once** in `src/services/supabaseClient.js` and import it wherever needed. Never instantiate it more than once.
- Supabase credentials (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`) must always come from environment variables. Never hardcode them.
- All Supabase queries must live in `src/services/` — not in components or hooks directly.
- Always handle Supabase errors via the returned `{ data, error }` pattern — never assume a successful response.
- Auth state must be managed centrally (e.g., via a context or store). Do not call `supabase.auth.getUser()` ad hoc across components.
- Use **Row Level Security (RLS)** on all Supabase tables. Never rely solely on client-side access control.

---

## 6. Git & Branching Conventions

### Branch Strategy: **Gitflow**

| Branch | Purpose |
|---|---|
| `main` | Production-ready code only |
| `develop` | Integration branch for ongoing work |
| `feature/*` | New features (branch off `develop`) |
| `fix/*` | Bug fixes (branch off `develop`) |
| `hotfix/*` | Urgent production fixes (branch off `main`) |

### Branch Naming

```
feature/short-description
fix/short-description
hotfix/short-description
```

Examples: `feature/user-login`, `fix/navbar-overlap`, `hotfix/payment-crash`

### Commit Messages

Use the **Conventional Commits** format:

```
<type>: <short description>
```

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Maintenance, deps, config |
| `refactor` | Code change with no behavior change |
| `style` | Formatting only |
| `docs` | Documentation updates |
| `test` | Adding or updating tests |

Examples:
```
feat: add user profile page
fix: resolve login redirect loop
chore: update prettier config
```

### Pull Request Rules

- All PRs must target `develop` (except hotfixes which target `main`).
- PR title must follow the same Conventional Commits format.
- At least **1 peer review** required before merging.
- Delete the feature branch after merging.

---

## 7. General Don'ts

- ❌ Do not commit `.env` files or any secrets.
- ❌ Do not push directly to `main` or `develop`.
- ❌ Do not leave `console.log` statements in committed code.
- ❌ Do not mix concerns — keep UI, logic, and API layers separate.
- ❌ Do not override Prettier formatting manually.