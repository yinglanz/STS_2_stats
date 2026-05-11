# AI Usage Guide

This project uses structured AI assistance.

## How to use with Copilot Chat

1. Always reference:
   - `/ai/rules.md`
   - `/ai/workflow.md`

2. Start prompts with:
   "Follow workflow.md"

3. For complex tasks:
   - Ask for a plan first
   - Then ask to implement step-by-step

## Goal

Maintain consistent, high-quality AI-generated code.

---

## 📁 Documentation Structure

### `.ai/` Directory

- **rules.md** - Development principles and standards
- **architecture.md** - Project structure and constraints
- **workflow.md** - AI process (Understand → Plan → Implement → Validate)
- **prompts.md** - Prompt templates for common tasks

### `.github/` Directory

- **copilot-instructions.md** - GitHub Copilot code generation guidelines

---

## Quick Reference

**Need to...**

- **Get started?** → Read [README.md](README.md) for overview, [SETUP.md](SETUP.md) for configuration
- **Add a feature?** → Start with "Follow workflow.md"
- **Fix a bug?** → Use prompts.md Debugging template
- **Improve code?** → Reference rules.md
- **Understand codebase?** → Read architecture.md
- **Generate code?** → Check copilot-instructions.md
- **Configure data source?** → Update paths in [SETUP.md](SETUP.md)

---

**Last Updated**: May 10, 2026

## Recent Changes

### Damage and Act Fixes (May 10, 2026)

- **Total Damage Taken**: Now correctly summed across all combat encounters in the run (was reading a single cumulative field from the last floor point)
- **Player Index Fix**: In multiplayer runs, damage and encounter stats now use your player's index rather than always using `player_stats[0]`
- **Act Reached**: Now derived from `run.encs` (max act across all encounters) instead of parsing the unreliable `acts` string

### Help Tab Rewrite (May 10, 2026)

- All 15 tabs documented with accurate column/metric definitions
- Filters, multiplayer behaviour, and tips sections updated
- Export tab documented (was missing)

### Repo-Wide Markdown Lint Fix (April 30, 2026)

- **Full audit completed**: Zero lint errors across all `.md` files
  - Files fixed: CHANGELOG.md, README_AI.md, SETUP.md, .ai/architecture.md, .ai/rules.md, .ai/prompts.md
  - Rules resolved: MD022, MD024, MD031, MD032, MD036, MD040, MD060

### Config Centralisation (April 2026)

- `YOUR_STEAM_ID` and `HISTORY_PATH` moved to `src/config.ts` — single file to edit for a new user
- All modules (`extractRunData.ts`, `server/index.ts`, `server/watcher.ts`) import from `src/config.ts`
