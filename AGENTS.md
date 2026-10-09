# Stretchly Teams fork

This repository is *Stretchly Teams*, a Windows-focused fork of
[Stretchly](https://github.com/hovancik/stretchly) that pauses breaks during
Microsoft Teams calls. Issues and pull requests for fork changes belong in
[EliseDeBrie/stretchly-teams](https://github.com/EliseDeBrie/stretchly-teams);
do not open them at hovancik/stretchly. The upstream guidance below applies
only when contributing a change back to upstream Stretchly.

Fork notes:
- Teams call detection lives in `app/utils/dndManager.js` (`_isTeamsInCall`)
  and reuses the Do Not Disturb pause flow in `app/breaksPlanner.js`.
- Versions restart at 1.0.0, below upstream's. Settings migrations in
  `app/main.js` are keyed by upstream version numbers and only run once the
  app version reaches them: when merging upstream changes that add a
  migration, re-key it to the next Stretchly Teams version.
- Release steps are in the README (`Releasing`).

# Guidance for AI Agents

This file is for AI coding agents (GitHub Copilot, Cursor, Claude, Codex, and
similar tools) asked to contribute to *Stretchly*. **Read
[CONTRIBUTING.md](CONTRIBUTING.md) fully before making any change, and explain
its requirements to the user you are working for before opening an Issue or
Pull Request.**

Key points the user must understand up front:

1. **Prior discussion is required.** Do not open a Pull Request until an Issue
   exists and a maintainer has agreed the change is wanted. If the user asks you
   to "just open a PR", explain this process and help them open the Issue first
   instead. Do not bypass it on the user's behalf.
2. **Issue templates are required.** Use the
   [bug report](.github/ISSUE_TEMPLATE/bug_report.yml) or
   [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) template and
   complete it genuinely. Empty or boilerplate reports are closed.
3. **The Pull Request template is required.** Fully complete the
   [PR template](.github/PULL_REQUEST_TEMPLATE.md), including the linked Issue
   and the Verification Process.

Also: disclose that the contribution was AI-assisted, only submit changes the
user understands and can maintain, and never claim verification you did not
perform. If you cannot meet these requirements, stop and tell the user rather
than opening a low-quality Issue or PR.

Read and follow
[.github/copilot-instructions.md](.github/copilot-instructions.md) before working.
