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

**Last Updated**: April 2026

## Recent Changes

### Repo-Wide Markdown Lint Fix (April 30, 2026)

- **Full audit completed**: Zero lint errors across all `.md` files
  - Files fixed: CHANGELOG.md, README_AI.md, SETUP.md, .ai/architecture.md, .ai/rules.md, .ai/prompts.md
  - Rules resolved: MD022, MD024, MD031, MD032, MD036, MD040, MD060
  - .ai/prompts.md fully rewritten with language specifiers on all code blocks

### STS2 History Folder Path Update (April 29, 2026)

- **Updated History Source Path**: Changed from local `history/` folder to actual STS2 save location
  - New path: `C:\Users\you\AppData\Roaming\SlayTheSpire2\steam\0000000000000000\profile1\saves\history`
  - Files: Updated in `extractRunData.ts`, `src/server/index.ts`, and `src/server/watcher.ts`
  - This allows direct ingestion from the actual STS2 game save folder without manual copying

### Multiplayer Mode Reporting Fix (April 29, 2026)

- **Fixed Export Table Mode Display**: Mode badges now correctly show 1P/2P/3P/4P
  - Root cause: Export table was accessing `r.m` (number) instead of `r.mode` (string)
  - Fix: Updated `drawExportTable()` to use the mapped `r.mode` property
  - Verification: Database contains 155 single-player runs + 33 multiplayer runs

### Dashboard Filtering (April 28, 2026)

- **Starter Relic Filtering**: Added automatic filtering of starting relics by character
  - Ironclad: Burning Blood
  - Silent: Ring of the Snake
  - Defect: Cracked Core
  - Necrobinder: Bound Phylactery
  - Regent: Divine Right
  - Implementation: `src/analyze/extractRunData.ts` (STARTER_RELICS constant)

- **Optimized Filter Logic**: Refactored dashboard filter performance
  - Changed from single `.filter()` with nested conditions to sequential filtering
  - Filters applied in selectivity order (character → ascension → outcome → mode)
  - Reduces dataset early for faster filtering on large run counts
  - Implementation: `src/analyze/generateDashboard_v2.ts` (applyFilters function)
