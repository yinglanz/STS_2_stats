---
description: "Use when modifying the dashboard, adding charts, updating filter logic, or changing how run data is visualized. Covers chart conventions, filter architecture, and data loading."
applyTo: "src/analyze/generateDashboard_v2.ts"
---

# STS2 Dashboard Patterns

## Data Loading

`loadDashboardData()` reads `extracted_runs.json` and `elo_ratings.json` from `output/`. Both files must exist (run `npm run analyze` first). Missing files throw a clear error rather than crashing silently.

## Filter Architecture

Filters applied in selectivity order — most selective first reduces dataset early:

```
character → ascension (min) → outcome → mode
```

Each filter is a separate `.filter()` call on `filteredRuns`. Never nest multiple conditions in one `.filter()`.

## Chart Conventions

- **Always use `safePlot(id, traces, layout, config)`** — never `Plotly.newPlot` directly. It checks element existence and catches errors.
- **Always use `darkLayout(extra)`** — merges `extra` onto the shared `DARK` constant.
- Plotly version: **v2.27.0** (hardcoded CDN)
- Chart height: `400px` standard via `.small-chart` class, taller for heatmaps

## DARK Constant

`DARK` and `darkLayout()` are defined before `updateDashboard()` is first called (temporal dead zone — `const` does not hoist). Do not move them below the initialization block.

## Always Use `filteredRuns`

All draw functions must read from `filteredRuns`, never `DATA.runs`.

## No TypeScript in Template Literals

Code inside template literal strings becomes plain JavaScript in the HTML output. Do not use:
- `as any`, `as T[]`, `as SomeType`
- `const x: T[]`
- `: any[]` in function signatures

Use plain JS alternatives: `[].concat(...Object.values(obj))` instead of `(Object.values(obj) as T[][]).flat()`.

## Adding a New Tab

1. Add button in `.tabs` div inside the correct group, with `onclick="switchTab('myTab')"`
2. Add `<div id="myTab" class="tab-content">` with chart + table containers
3. Add case in `updateDashboard()`: `else if (currentTab === 'myTab') { drawMyChart(); }`
4. Implement `drawMyChart()` using `safePlot()` and `darkLayout()`, reading `filteredRuns`
5. Run `npm run dashboard` to regenerate

## Tab Groups (13 Tabs)

```
Run:      overview, ascension, runs
Deck:     cards, relics, potions, synergies
Combat:   encounters, heatmap, builds
Map:      floors, ancients
Analysis: elo
Utility:  export, help
```

## Dark Theme Palette

- Body bg: `#0d1117`, content: `#161b22`, plot bg: `#1a1a2e`, paper bg: `#16213e`
- Gold accent: `#c9a84c`, Win green: `#4db87a`, Loss red: `#e05252`
- Characters: Ironclad `#e05252`, Silent `#4db87a`, Regent `#c9a84c`, Necrobinder `#9b59b6`, Defect `#3498db`

## Window Resize

A debounced `window.resize` handler calls `Plotly.Plots.resize` on all `.js-plotly-plot` elements. Do not add per-chart resize logic.

## Data Loading

`loadDashboardData()` reads from `extracted_runs.json`, `elo_ratings.json`, `floor_analytics.json`, and `ancient_analytics.json`.
Missing analytics files warn and return `[]` — they do not fail the build.

## Global Filters (Mode values)

The Mode filter uses exact player-count strings: `"1"`, `"2"`, `"3"`, `"4"`, or `"multi"` (any multiplayer).
Compare against `run.m` (integer). Empty string = All.

## switchTab

`switchTab(name)` finds the active button by scanning `onclick` attributes — do not pass `event.target`.
Safe to call programmatically (e.g. from tests or deep-link logic).
- No external CSS frameworks
- Color scheme: `#667eea` (primary), `#764ba2` (secondary), `#28a745` (win/good), `#dc3545` (loss/bad)
