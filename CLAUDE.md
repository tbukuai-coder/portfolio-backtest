# CLAUDE.md

Guidance for Claude Code when working in this repo. Read `README.md` first for
what the app is; this file covers the things you can't tell from skimming the code.
See `ROADMAP.md` for planned work.

## Architecture in one paragraph

The app is two files. `data.js` is the **data block**: a single
`const PV_DATA = {...}` assignment between `/*==DATA-START==*/` and
`/*==DATA-END==*/` markers, generated wholesale by `refresh_data.py` and loaded
by `index.html` via a plain `<script src="data.js">` (NOT `fetch` — a classic
script tag works from `file://`, `fetch` does not; that's what keeps the page
serverless). `index.html` holds everything else in two `<script>` blocks: the
**engine block** (pure functions between `/*==ENGINE-START==*/` and
`/*==ENGINE-END==*/` — month arithmetic, `simulate()`, `computeStats()` incl.
Ulcer/Martin/Calmar/underwater, `rollingCAGR()`, `computeBenchStats()`) and the
**app block** (DOM, form handling, SVG chart rendering). The marker comments are
load-bearing: `tests/sanity.js` evals both blocks in Node. Don't rename or
remove them, and keep the engine block free of DOM references so it stays
Node-evaluable.

## Hard rules

- **Never edit `data.js` by hand.** Regenerate it with
  `python3 refresh_data.py` (edit the `UNIVERSE` dict there to change assets).
  The script drops the in-progress current month — keep that; a partial month
  poisons every stat downstream.
- **Engine or data changes must pass `node tests/sanity.js` before shipping**
  (78 assertions; it evals `data.js` + the engine block, replacing
  `const PV_DATA` with `var` first — `const` inside `eval` doesn't escape to
  the caller's scope). Extend it when you add a metric or an asset. Known-good
  anchors it pins: SPY 100% from 1994-01 → CAGR ≈ 10.9%, max drawdown ≈ −50.8%
  (trough Feb 2009), longest underwater 75 mo from Aug 2000 (dot-com beat the
  GFC), worst rolling 10y ≈ −3.5%/yr, Ulcer ≈ 14%; All Weather's worst year is
  2022; SPY-vs-SPY benchmark stats are exact identities (beta 1, alpha 0,
  R² 1, TE 0, IR NaN); MAYBANK (USD) from 2004 → CAGR ≈ 7.9%. Contributions
  must leave the TWR series unchanged for a single-asset portfolio (up to ~1e-15
  float noise — compare with a tolerance, not stringify).
- **Render-check both themes.** No build/lint exists; verification is headless
  Chromium via Python playwright (installed in this studio): load the page over
  `file://`, click `#exampleBtn` then `#runBtn`, screenshot with
  `color_scheme="light"` and `"dark"`, and assert zero console/page errors.
- **Keep stats time-weighted.** `computeStats()` runs on the TWR series, never
  on the cashflow-inflated balance series; only the final balance and the growth
  chart reflect contributions. If you add a metric, feed it `sim.twr`.

## Conventions & quirks

- Months are integers: `m = year*12 + (month-1)`; `PV_DATA.series[t].r[i]` is
  the return for month `mIdx(start) + i`. All clamping (earliest common start
  across chosen tickers + CASHX + SPY) happens in `run()`, not in the engine.
- Rebalancing is calendar-aligned (`(m % 12 + 1) % rebalEvery === 0` → Dec for
  annual, quarter-ends for quarterly), not anniversary-of-start. Contributions
  are added at month-end at target weights.
- CASHX is derived from ^IRX (13-week T-bill): monthly rf =
  `(1 + yield/100)^(1/12) − 1`. It doubles as the Sharpe/Sortino risk-free leg.
- Foreign listings (Malaysia group) use 4-tuple `UNIVERSE` entries
  `(name, group, yahoo ticker, fx pair)`: closes × FX rate month by month, so
  embedded returns are USD total returns. Prefer liquid home-exchange listings
  over US OTC ADRs — the ADR tapes are full of stale-quote garbage prints.
  `refresh_data.py` hard-fails if any series has an interior month gap
  (a gap would shift every later return one slot after `dropna`).
- Chart colors are the dataviz-skill validated palette: `--s1..--s4` =
  Portfolio 1/2/3 + benchmark, defined once in `:root` with dark-mode overrides
  under both `prefers-color-scheme` and `[data-theme]` scopes. The light-mode
  magenta/yellow slots are sub-3:1 contrast by design — the summary and annual
  tables are the required relief; don't remove them.
- Bars: 4px rounded corners at the **data end only**, square at the baseline
  (flips for negative bars); 2px gaps between grouped bars. Lines 2px. The
  annual chart renders at natural pixel width inside `.scrollx` — don't let it
  shrink-to-fit or the tick text becomes unreadable.
- Benchmark dedup: if a portfolio is already 100% of the benchmark ticker, no
  separate benchmark series is added — `run()` then uses that portfolio's own
  sim as the benchmark leg for `computeBenchStats()`.
- Benchmark-relative summary rows (correlation/beta/alpha/R²/TE/IR) render only
  when `#bench` is set; with benchmark "None" a plain correlation-to-SPY row
  shows instead. `computeBenchStats()` guards degenerate variance with
  `EPS = 1e-18` — a cash benchmark leaves ~1e-32 float noise, not exact zero,
  and would otherwise produce a garbage beta instead of "—". `fmtPct`/`fmtNum`
  and the pos/neg wrapper are NaN-safe (render "—"); keep new formatters that
  way.
- Rolling returns: `rollWin` (12/36/60/120 months, default 36) persists across
  runs; windows longer than the sample are hidden and the active window falls
  back to the largest available. The best/worst/average table always covers
  every available window regardless of the chart's active one.
- Monthly heatmap: diverging blue↔red fill via
  `color-mix(in oklab, var(--hm-pos|--hm-neg) t%, var(--hm-mid))`, saturating
  at ±8%/mo. The `--hm-*` poles are per-theme (darker in dark mode so white
  cell text keeps ≥4.5:1) and were validated with the dataviz palette script —
  re-validate if you change them. Exact numbers stay in every cell in ink
  tokens; color is never the only encoding.
- Custom tickers (opt-in Twelve Data fetch — see `DATA-API-PLAN.md` for why
  that provider): fetched series are merged into the **in-memory**
  `PV_DATA.series` only — `data.js` stays untouched — under group
  "Custom (Twelve Data)", with an extra `end` field ("YYYY-MM") that `run()`
  clamps to (embedded series have no `end`; they all run to `PV_DATA.end`).
  localStorage: `pv_td_key` (API key — never put it in URLs) and `pv_td_cache`
  (series cache, auto-invalidated when `PV_DATA.end` advances). Parsing keeps
  the longest trailing contiguous month run ≤ `PV_DATA.end`, which also drops
  the in-progress month. Chip/status DOM is built with `textContent`, not
  innerHTML — ticker strings are user input. Playwright tests stub
  `api.twelvedata.com` via `page.route()`; no key needed to verify.

## Deploy

Own git repo → github.com/tbukuai-coder/portfolio-backtest, served by GitHub
Pages from main branch root (legacy build — a push to main is the deploy).
Data refresh cycle: `python3 refresh_data.py`, `node tests/sanity.js`,
commit the regenerated `data.js`, push.
