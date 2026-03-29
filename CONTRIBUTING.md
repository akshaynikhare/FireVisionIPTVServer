# Contributing to FireVisionIPTVServer

Thank you for contributing to FireVisionIPTVServer!

## Commit and PR Policy

**Do not reference AI tooling** in any commit message, PR title, PR body, or code comment. The following are explicitly forbidden:

- `paperclip` or `Paperclip`
- `claude` or `Claude` (including `claude.ai` URLs)
- `codex` or `Codex`
- `Co-Authored-By: Paperclip` or `Co-Authored-By: Claude`
- `Generated with [Claude Code](...)`
- `ai agent`

This policy maintains the open-source credibility of the project. Contributors and users expect a clean, human-owned commit history.

Violations are caught automatically by:

- **`check-ai-references` GitHub Actions workflow** — blocks PRs with forbidden content in the title, body, or commit messages.
- **`commit-msg` Husky hook** — rejects commits locally before they are pushed.

## Installing git hooks

Hooks are managed by [Husky](https://typicode.github.io/husky/). After cloning, run:

```sh
npm install
```

This runs the `prepare` script which installs Husky hooks (including `commit-msg`).

## Submitting a pull request

1. Fork the repository and create a feature or fix branch with a descriptive name.
2. Keep commits focused. One logical change per commit.
3. Ensure `npm run build` and lint checks pass before opening a PR.
4. Write a clear PR description covering what changed and why.
5. Do not include AI tool references anywhere in the PR (see policy above).
