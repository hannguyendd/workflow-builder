# Commit convention

Follow [Conventional Commits (qoomon)](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13).

Format:

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

Types:

- **feat** — add, adjust, or remove a feature (API or UI)
- **fix** — fix a bug in a preceding `feat`
- **refactor** — restructure code without changing API/UI behavior
- **perf** — a `refactor` that specifically improves performance
- **style** — code style only (whitespace, formatting, semicolons); no behavior change
- **test** — add or correct tests
- **docs** — documentation only
- **build** — build tooling, dependencies, project version
- **ops** — infrastructure, deployment, CI/CD, monitoring
- **chore** — misc tasks (initial commit, `.gitignore`, etc.)

Rules:

- **Scope** (optional): contextual area (e.g. `workflow`, `store`). Don't use issue IDs as scope.
- **Description** (required): imperative present tense ("add" not "added"), lowercase first letter, no trailing period.
- **Breaking changes**: add `!` before the colon (`feat(store)!: ...`) and describe in a footer line starting with `BREAKING CHANGE:`.
- **Body** (optional): explain motivation, imperative present tense.
- **Footer** (optional): reference issues (`Closes #123`); required for breaking changes.

Examples: `feat(workflow): add drag-to-connect for nodes` · `fix(store): prevent edge duplication on reconnect` · `docs: add folder-structure constitution`
