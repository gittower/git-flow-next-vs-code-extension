# Git Flow Next for VS Code

A VS Code extension that brings the Git Flow Next CLI workflow into the editor with commands, prompts, and a sidebar view for your feature/release/hotfix/support/bugfix branches.

This project is in its v0.1 ‘early access’ phase. Contributions and feedback are especially welcome as the extension and the git-flow-next project evolves.

## What this extension does

- Command Palette actions for every Git Flow Next operation (start/finish/list/checkout/delete/rename/update for all branch types, plus shorthand finish/update/rebase/delete/rename/publish).
- Sidebar view that lists Git Flow branches by type and lets you check them out with a click.
- Guided initialization: prompts to set up Git Flow in the current repo and configure branch/tag prefixes.
- Installation helpers: detects when `git-flow-next` is missing and offers Homebrew install or docs.
- Settings-driven behavior: finish/update strategies, fast-forward, tagging, branch retention, remote selection, GPG signing, and more.
- Recovery commands to continue or abort a finish after conflicts.

## Requirements

- [Git Flow Next CLI](https://github.com/gittower/git-flow-next) available on your PATH.  
  macOS/Homebrew: `brew install gittower/tap/git-flow-next`
- A Git repository opened as your workspace folder in VS Code.

## Install the extension

1. Install the Git Flow Next CLI (see above).
2. Install the extension (from VSIX or VS Marketplace, if published).
3. Reload VS Code.

## Quick start (in VS Code)

1. Open a Git repo.
2. Run `Git Flow Next: Initialize Git Flow` (from the welcome view or Command Palette).
3. Start work, e.g. `Git Flow Next: Feature: Start`, then finish with `Git Flow Next: Feature: Finish`.
4. Use the **Git Flow Next** activity bar icon to browse branches and check them out.

## Command highlights

- **Initialize & config**: `Initialize Git Flow`, `Show Installation Instructions`, `Configure Git Flow`, `Show Overview`.
- **Branch lifecycle**: start/finish/list/checkout/delete/rename/update for feature, release, hotfix, support, bugfix.
- **Shorthands** (auto-detect current branch type): `Finish Current Branch`, `Update Current Branch`, `Rebase Current Branch`, `Delete Current Branch`, `Rename Current Branch`, `Publish Current Branch`.
- **Finish recovery**: `Finish: Continue (after resolving conflicts)`, `Finish: Abort Operation`.


## Sidebar view

- Activity bar container: **Git Flow Next** → **Overview**.
- Shows branch types; expanding a type lists branches and lets you checkout.
- Shows welcome/installation/init guidance when the CLI is missing or Git Flow isn’t initialized.

## Settings (selected)

- Finish strategy per type: `merge`, `rebase`, `squash`, or `use-git-config`.
- Update strategy per type: `merge`, `rebase`, or `use-git-config`.
- Fast-forward preference per type: `no-ff`, `ff`, or `use-git-config`.
- Tagging: enable/disable per type, tag prefix, GPG signing, prompt for tag message.
- Branch retention: delete/keep/keep-local/keep-remote/`use-git-config`, plus `forceDelete`.
- Start points and remote selection, optional fetch-before-start.

All settings live under `gitFlowNext.*` in VS Code settings.

## Troubleshooting

- **“git-flow-next is not installed”**: Install via Homebrew or open the instructions link shown in the prompt.
- **“Not in a git repository”**: Open a folder that contains a `.git` directory.
- **Commands hidden**: The extension hides actions when Git Flow isn’t initialized or when no branches of that type exist; initialize or create a branch first.

## Development

Prereqs: Node 16+, npm.

```
npm install
npm run esbuild
```

## License

MIT (see `LICENSE`).

For any problems you can contact us at support@git-tower.com
