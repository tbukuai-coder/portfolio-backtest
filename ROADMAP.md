# Roadmap

Where this homage could go next. Items are roughly ordered by value within
each section; nothing here is committed work. Keep the invariants from
`CLAUDE.md`: static files with zero runtime dependencies (index.html +
data.js, still serverless from `file://`), `data.js` only ever regenerated
by `refresh_data.py`, every stat fed the time-weighted series, engine
changes proven in Node before shipping.

## Near-term polish

- [ ] **Shareable URLs** — serialize the whole form (allocations, dates,
      contributions, rebalancing, benchmark) into the location hash and
      auto-run on load. Portfolio Visualizer's most-used feature after the
      backtest itself; costs nothing at runtime and makes results linkable
      from the Pages URL.
- [ ] **Preset portfolios dropdown** — 60/40, Three-Fund, All Weather,
      Permanent Portfolio, Golden Butterfly next to `#exampleBtn`. All
      constituents are already in the universe; it's just named weight sets.
- [ ] **CSV export** — client-side Blob download of the annual returns table
      and the monthly TWR/balance series per portfolio. No server needed.
- [ ] **OG/social meta + favicon** so the GitHub Pages link unfurls nicely.
- [ ] **Print stylesheet** — summary + charts on one printable page; the SVG
      charts already scale, mostly needs hiding the form and forcing light
      theme.

## Metrics & analytics (all feed on `sim.twr`; ordered by value per effort)

- [x] **Benchmark-relative stats** — built 2026-07-19: beta, annualized CAPM
      alpha, R², tracking error, information ratio, and correlation vs the
      chosen `#bench` (`computeBenchStats()` in the engine block), appended
      to the summary when a benchmark is selected; the correlation-to-SPY
      row remains for benchmark "None". Degenerate benchmarks (cash) render
      "—" via a variance-epsilon guard rather than dividing by float noise.
- [ ] **Risk-stat batch: Ulcer index, Martin ratio, Calmar ratio, underwater
      duration** — all derivable from existing `computeStats()` internals
      (`ddSeries`, `episodes`, the excess-return mean); Calmar is one
      division on numbers already in the stats object. Care points: report
      an unrecovered episode (`recovered: null`) as "N months and counting"
      instead of skipping it, and exclude the seeded zero point at
      `startM − 1` from the Ulcer mean.
- [ ] **Rolling returns chart** — 1/3/5/10-year rolling CAGR with a window
      toggle (all four windows × 4 series at once is unreadable) plus a
      best/worst/average table covering every window. Hide windows longer
      than the sample — crypto-clamped runs have well under 10 years. The
      biggest analytical gap vs Portfolio Visualizer, and the most chart
      work in this section.
- [ ] **Monthly returns heatmap** — year × month table, one portfolio at a
      time behind a selector (stacking four heatmaps is too tall). Monthly
      returns are signed data: use a diverging ramp centered at zero (not
      sequential — that would shade −8% and +8% equally), and keep numbers
      in the cells — color alone is sub-contrast.

## Simulation features

- [ ] **Withdrawal mode** — negative contributions: fixed monthly/annual
      withdrawal, or fixed percentage. Enables SWR-style experiments and is
      the mirror image of the existing contribution code path. Withdrawals
      must not touch the TWR series, same as contributions.
- [ ] **Contribution step-up** — grow the monthly contribution by N%/year
      (or by embedded CPI once that lands).
- [ ] **Tolerance-band rebalancing** — rebalance only when a weight drifts
      more than X% absolute from target, as an alternative to the calendar
      schedule. Needs care in the engine block: bands read current weights,
      which the calendar path never has to expose.
- [ ] **Asset correlation matrix page** — full pairwise correlations over
      the chosen window; all the data is already client-side. Could live
      behind a tab rather than a second file.
- [ ] **Monte Carlo projection** — bootstrap resampling of the portfolio's
      own monthly TWR to fan out forward wealth percentiles. Deterministic
      seed so re-runs are reproducible and the Node sanity check stays
      assertable.

## Data & universe (all via `refresh_data.py`)

- [x] **Custom tickers via runtime API (opt-in)** — built 2026-07-18: arbitrary
      tickers fetched at runtime with the user's own free Twelve Data key
      (Tiingo failed the CORS gate, Alpha Vantage the free-tier gate), merged
      into the in-memory dataset + localStorage cache; embedded universe stays
      the offline core. Design + gate results: `DATA-API-PLAN.md`.

- [ ] **Embed a CPI series** — fetch CPI at refresh time alongside prices,
      add an "inflation-adjusted" toggle that deflates the growth chart and
      final balance, and report real CAGR. Runtime stays offline.
- [ ] **Extend history with mutual-fund proxies** — splice older proxy
      returns before each ETF's inception (VFINX before SPY, VUSTX before
      TLT, VGSIX before VNQ, …), the way Portfolio Visualizer does. Big win:
      backtests could start in the 1980s instead of clamping to the youngest
      ETF. Needs a per-asset `proxy` field in `UNIVERSE` and a splice-date
      note in the UI.
- [ ] **Universe expansion** — factor ETFs (VTV/VUG/MTUM/QUAL), TIPS (TIP),
      EM bonds, a few more mega-caps. Cheap to add, but each new asset grows
      `data.js`; keep the curated feel rather than becoming a ticker
      search box (which would break the no-server-calls rule anyway).
- [ ] **Automated monthly refresh** — a scheduled GitHub Action that runs
      `refresh_data.py`, re-runs the Node engine sanity check, and commits
      the regenerated `data.js`. Removes the manual refresh chore; the
      sanity check is the gate that makes auto-commit safe.

## Distribution

- [ ] **PWA manifest + service worker** for offline install — the page
      already works from `file://`, so this is a manifest and a tiny
      cache-first SW, still no build step.
- [ ] **Link exchange** — cross-link from the other GitHub Pages apps'
      footers once a few share an audience.
