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
Ulcer/Martin/Calmar/underwater, `rollingCAGR()`, `rollingSharpe()`,
`moneyWeightedReturn()`, `computeBenchStats()` incl. up/down capture,
`corrMatrix()`, `monteCarlo()` + `mulberry32()` seeded PRNG) and the
**app block** (DOM, form handling, SVG chart rendering). The marker comments are
load-bearing: `tests/sanity.js` evals both blocks in Node. Don't rename or
remove them, and keep the engine block free of DOM references so it stays
Node-evaluable.

## Hard rules

- **Never edit `data.js` by hand.** Regenerate it with
  `python3 refresh_data.py` (edit the `UNIVERSE` dict there to change assets).
  The script drops the in-progress current month — keep that; a partial month
  poisons every stat downstream. Adding a US-listed ticker is ONE line in
  `UNIVERSE` — `tests/sanity.js` parses the dict so the series count
  self-syncs, and the Action commits on universe changes as well as new
  months (so pushing just the `UNIVERSE` edit is enough; the next weekly run
  publishes the data). Foreign listings additionally need the 4-tuple + the
  identity/gap/garbage-print probes (see Conventions).
- **Engine or data changes must pass `node tests/sanity.js` before shipping**
  (167 assertions at last count; it evals `data.js` + the engine block,
  replacing `const PV_DATA` with `var` first — `const` inside `eval` doesn't
  escape to the caller's scope). Extend it when you add a metric or an asset.
  Known-good anchors it pins: SPY 100% from 1994-01 → CAGR ≈ 10.9%, max
  drawdown ≈ −50.8% (trough Feb 2009), longest underwater 75 mo from Aug 2000
  (dot-com beat the GFC), worst rolling 10y ≈ −3.5%/yr, Ulcer ≈ 14%; All
  Weather's worst year is 2022; SPY-vs-SPY benchmark stats are exact identities
  (beta 1, alpha 0, R² 1, TE 0, IR NaN, up/down capture 100/100); MAYBANK (USD)
  from 2004 → CAGR ≈ 7.9%. Invariance identities are asserted exactly: contributions leave single-asset
  TWR unchanged, pro-rata withdrawals leave even multi-asset TWR unchanged,
  band ~0 ≡ monthly and band ∞ ≡ never, fee 0 is a no-op and net twr =
  (1+gross)(1−fee/12)−1 per month, no cashflows → MWR = CAGR and a constant
  1%/mo return → IRR exactly 1%/mo whatever the flows, a full-sample rolling
  Sharpe window = the summary Sharpe, Monte Carlo reproduces byte-identical
  bands from the same seed (compare with tolerances, not stringify, wherever
  float noise ~1e-15 applies).
- **Render-check both themes.** No build/lint exists; verification is headless
  Chromium via Python playwright (installed in this studio): load the page over
  `file://`, click `#exampleBtn` then `#runBtn`, screenshot with
  `color_scheme="light"` and `"dark"`, and assert zero console/page errors.
- **Keep stats time-weighted.** `computeStats()` runs on the TWR series, never
  on the cashflow-inflated balance series; only the final balance and the growth
  chart reflect contributions. If you add a metric, feed it `sim.twr`. The one
  deliberate exception: the annual fee (simulate's 7th arg) IS inside twr —
  fees are a real return reduction, not a cashflow. The benchmark run is
  always simulated gross-of-fee.

## Conventions & quirks

- Months are integers: `m = year*12 + (month-1)`; `PV_DATA.series[t].r[i]` is
  the return for month `mIdx(start) + i`. All clamping (earliest common start
  across chosen tickers + CASHX + SPY) happens in `run()`, not in the engine.
- Rebalancing is calendar-aligned (`(m % 12 + 1) % every === 0` → Dec for
  annual, quarter-ends for quarterly), not anniversary-of-start. The rebal arg
  also accepts `{band: X}` (tolerance band, checked monthly after cashflows);
  `sim.rebals` counts events in every mode, surfaced as a summary row only in
  band mode.
- Cashflows: `simulate()`'s 5th arg is a number ($/mo, back-compat) or
  `{amount, stepUp, rate}` — see the comment above it. The asymmetry is
  deliberate: contributions buy at target weights (mildly rebalancing),
  withdrawals sell pro-rata (weight-preserving, so withdrawal TWR invariance
  is exact even multi-asset; contribution invariance is single-asset only).
  Depletion pins the balance to 0 and pushes twr = 0 afterward — series stay
  aligned, stats past depletion are knowingly meaningless, and the summary's
  "(depleted Mon YYYY)" is the headline. The log-scale growth chart clamps
  zero balances to the smallest positive value.
- CASHX is derived from ^IRX (13-week T-bill): monthly rf =
  `(1 + yield/100)^(1/12) − 1`. It doubles as the Sharpe/Sortino risk-free leg.
- Foreign listings (Malaysia and Singapore groups) use 4-tuple `UNIVERSE`
  entries `(name, group, yahoo ticker, fx pair)`: closes × FX rate month by
  month, so embedded returns are USD total returns. Prefer liquid
  home-exchange listings over US OTC ADRs — the ADR tapes are full of
  stale-quote garbage prints — and verify ticker identity empirically
  (yfinance metadata can be empty; a price-level fingerprint works, and
  "TLKMF" turned out to be Telkom Indonesia, not Telekom Malaysia).
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
- Rolling returns: `rollWin` (12/36/60/120 months, default 36) and `rollMetric`
  ("ret" | "sharpe") persist across runs; windows longer than the sample are
  hidden and the active window falls back to the largest available. The
  best/worst/average table always covers every available window regardless of
  the chart's active one, in the active metric. `rollingSharpe()` returns NaN
  for zero-variance windows (pure-cash legs) — the chart path lifts the pen
  across NaN gaps and table cells render "—"; keep both guards if you add a
  third metric. The Sharpe view needs `LAST.rf` (stashed by `run()`).
- Money-weighted return: `moneyWeightedReturn(sim)` recovers actual monthly
  flows from the sim (`flow = bal − prevBal·(1+twr)`) and bisects the
  future-value (Horner) form of NPV — do NOT rewrite it as discounted NPV,
  which underflows to 0/0 = NaN near rate −1 and silently converges to −100%.
  Post-depletion months (zero flow, zero balance) are trimmed first for the
  same reason. The summary row renders only when a cashflow mode is active
  (without cashflows MWR ≡ CAGR, so the row would be noise).
- Monthly heatmap: diverging blue↔red fill via
  `color-mix(in oklab, var(--hm-pos|--hm-neg) t%, var(--hm-mid))`, saturating
  at ±8%/mo. The `--hm-*` poles are per-theme (darker in dark mode so white
  cell text keeps ≥4.5:1) and were validated with the dataviz palette script —
  re-validate if you change them. Exact numbers stay in every cell in ink
  tokens; color is never the only encoding.
- Shareable URLs: `encodeState()` writes the whole form to the location hash
  via `history.replaceState` after every successful `run()` (and on MC-horizon
  change); `applyHash()` at boot repopulates and auto-runs. Hash grammar:
  `p=TICKER:w1:w2:w3,…&s=YYYY-M&e=YYYY-M&i=…&cf=mode:amt:step&fee=…&
  rb=N|band:X&b=BENCH&mc=YRS&td=SYM,…` — tickers URI-encoded (custom tickers
  are user input), `b` omitted means the SPY default, `td` carries custom
  tickers by symbol ONLY. The API key must never enter a URL. Custom tickers
  in a hash auto-fetch when `pv_td_key` is stored; otherwise `#customStatus`
  prompts and the run proceeds without them (weight totals then fail with a
  plain message rather than silently reassigning weights). Playwright gotcha:
  navigating an open page to the same URL + hash does NOT reload (no
  `applyHash`) — test hash restores by opening the hash URL in a fresh page.
- Correlation matrix: `corrMatrix()` scopes to the distinct tickers in the
  current runs (constituents + benchmark) — never the whole 58-asset universe.
  The card hides for single-asset runs; ticker labels are HTML-escaped
  (custom tickers are user input); zero-variance legs render "—".
- Monte Carlo: `monteCarlo(hist, startBal, months, cashflow, paths, seed)` —
  1,000 paths, seed 42, 12-month block bootstrap of the selected run's
  net-of-fee `sim.twr`, starting from the backtest's FINAL balance with the
  current cashflow settings (step-up restarts at projection year 1). Keep it
  deterministic — the seed is what keeps `tests/sanity.js` assertable. The
  survival note renders only for fixed withdrawals ($ mode); the card warns
  when history < 120 months (a short bull sample projects fantasy fans —
  a 2022-start window projected $33M medians during testing).
- Custom tickers (opt-in Twelve Data fetch — see `DATA-API-PLAN.md` for why
  that provider): fetched series are merged into the **in-memory**
  `PV_DATA.series` only — `data.js` stays untouched — under group
  "Custom (Twelve Data)", with an extra `end` field ("YYYY-MM") that `run()`
  clamps to (embedded series have no `end`; they all run to `PV_DATA.end`).
  localStorage: `pv_td_key` (API key — never put it in URLs) and `pv_td_cache`
  (series cache, auto-invalidated when `PV_DATA.end` advances). Parsing keeps
  the longest trailing contiguous month run ≤ `PV_DATA.end`, which also drops
  the in-progress month. Chip/status DOM is built with `textContent`, not
  innerHTML — ticker strings are user input. Embedded data always wins over
  custom: the add path rejects a ticker that exists in `PV_DATA.series`, and
  cache restore skips one that has since been embedded (the stale cache entry
  lingers harmlessly). Playwright tests stub `api.twelvedata.com` via
  `page.route()`; no key needed to verify (compatibility re-verified
  end-to-end 2026-07-19 after the data.js split and all new analytics).

## Deploy

Own git repo → github.com/tbukuai-coder/portfolio-backtest, served by GitHub
Pages from main branch root (legacy build — a push to main is the deploy).
Data refresh is automated: `.github/workflows/refresh-data.yml` runs weekly
after the US Friday close (01:17 UTC Saturday; also manual dispatch), gates on
`tests/sanity.js`, and commits `data.js` only when a new complete month landed
or the universe composition changed (weekly runs are retry resilience, not
commit churn); it opens an issue on failure. The same cycle works manually:
`python3 refresh_data.py`, `node tests/sanity.js`, commit `data.js`, push.
Pull before local work — the Action pushes to main.
