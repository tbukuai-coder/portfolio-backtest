# Backtest Portfolio

A static HTML homage to [Portfolio Visualizer's Backtest Portfolio](https://www.portfoliovisualizer.com/backtest-portfolio).
Zero dependencies, no build step, no server calls — monthly total-return data for a
58-asset universe ships alongside the page in `data.js` (loaded via a plain
`<script src>`, not `fetch`), so the page still works offline, from `file://`,
or on GitHub Pages.

## Features

- Up to **3 portfolios** side by side, plus a benchmark series
- **Shareable URLs** — every run serializes the whole setup into the location
  hash, so copying the address bar shares the exact backtest (custom tickers
  by symbol only; your API key never appears in a URL)
- Curated universe: US equity ETFs (incl. factor styles — small-cap value AVUV,
  dividend SCHD, momentum MTUM, quality QUAL), global/international (VT, VXUS,
  EFA, EEM, AVDV), bonds (US treasuries/credit plus EM bonds EMB
  and hedged international BNDX), gold/commodities/REITs/crypto,
  12 mega-cap stocks, a Malaysia group (iShares MSCI Malaysia plus seven Bursa
  blue chips — Maybank, Public Bank, CIMB, RHB Bank, Tenaga, IHH Healthcare,
  Sunway — converted to USD), a Singapore group (iShares MSCI Singapore plus
  DBS, OCBC, UOB, SingTel, Singapore Airlines, likewise USD-converted), and
  cash (3-month T-bill)
- Start/end month, initial amount, **cashflows** — contribute or withdraw
  $/month with an optional annual step-up (inflation-adjusted 4%-rule style),
  or withdraw a fixed % of balance per year; unsustainable withdrawals show
  the **depletion month** — an **annual fee** input (ER/advisor drag, benchmark
  stays gross), and rebalancing (monthly / quarterly / semi-annual / annual /
  **tolerance band** with a rebalance count / none)
- Performance summary: final balance, CAGR, annualized volatility, best/worst year,
  max drawdown, longest underwater stretch, Sharpe, Sortino, Calmar, Ulcer index,
  Martin ratio — with a cashflow mode active, also the **money-weighted return
  (IRR)**: what the investor's actual dollars earned, vs. the time-weighted CAGR —
  plus benchmark-relative stats when a benchmark is selected:
  correlation, beta, **up/down capture ratios**, annualized alpha, R², tracking
  error, information ratio
- Portfolio growth chart (linear/log), annual returns bars, drawdown chart with
  worst-drawdown episode tables, rolling returns (1/3/5/10-year window toggle,
  a **return ↔ Sharpe metric toggle**,
  plus a best/worst/average table across all windows), monthly returns heatmap
  (year × month, diverging blue↔red fill with a portfolio selector), asset
  correlation matrix (the backtest's assets over its window), **Monte Carlo
  projection** (1,000 block-bootstrap paths from the backtest's final balance
  over a 1–60y horizon, percentile fan + survival rate under withdrawals),
  annual returns table — all with hover tooltips, light/dark theme aware
- **Custom tickers (opt-in)**: fetch any symbol's dividend-adjusted monthly
  history with your own free [Twelve Data](https://twelvedata.com/pricing) API
  key — see below

## Data

Prices come from yfinance (monthly, auto-adjusted = dividends reinvested), written
to `data.js` as a `const PV_DATA = …` assignment between `/*==DATA-START==*/` …
`/*==DATA-END==*/` markers. **Refreshes are automated**: a GitHub Action runs
weekly after the US Friday close, re-fetches everything, gates the result on the
`tests/sanity.js` assertion suite, and commits `data.js` only when a new complete
month has landed (or the universe changed) — so the live page updates itself a
day or two after each month-end, and a failed refresh opens an issue instead of
publishing bad data. The same cycle works manually:

```bash
python3 refresh_data.py && node tests/sanity.js
```

To change the universe, edit the `UNIVERSE` dict at the top of `refresh_data.py` —
adding a US-listed ticker is one line (the next weekly Action run publishes it).
The in-progress current month is always dropped. Foreign listings (the Malaysia
and Singapore groups) carry a Yahoo ticker and an FX pair in their entry: closes
are multiplied by the FX rate month by month, so the embedded returns are USD
total returns — local return × currency return. (The home-exchange listings are
used instead of US OTC ADRs because the ADR price history is full of
stale-quote artifacts.)

## Custom tickers (optional)

The embedded universe needs no network at all. To backtest symbols outside it,
open **Custom tickers** in the form, paste a free
[Twelve Data API key](https://twelvedata.com/pricing) (no card required), and
add tickers by symbol. Fetched series use `adjust=all` (splits + dividends —
the same total-return basis as the embedded data, verified against yfinance to
within ~2 bp/month), are trimmed to complete months, and are cached in your
browser so repeat visits cost zero API calls. The key lives only in your
browser's localStorage and is sent only to api.twelvedata.com. Free-plan
limits (8 calls/min, 800/day) are ample: one call per ticker. Shared URLs
carry custom tickers by symbol: anyone opening your link is prompted for
their own key (or their stored key fetches automatically) — your key is
never part of the link. If a custom symbol later joins the embedded
universe, the embedded data takes precedence.

## Methodology notes

- Stats (CAGR, volatility, Sharpe, Sortino, drawdowns) are computed on
  **time-weighted** monthly returns, so contributions don't distort them;
  the final balance does include contributions. The annual fee is the one
  input that does change the return series — it's deducted as (1 − fee/12)
  from each monthly return, portfolios only; the benchmark stays gross.
- Cashflows happen at month-end: contributions buy in at target weights;
  withdrawals sell pro-rata from current holdings. Step-ups apply each January.
  Percent-of-balance withdrawals take (rate ÷ 12) of the current balance
  monthly and can never fully deplete. If a fixed withdrawal exhausts the
  balance, the portfolio is **depleted**: the balance stays at $0, the summary
  flags the depletion month, and stats past that date aren't meaningful.
  Rebalancing happens on calendar boundaries (December for annual,
  quarter-ends for quarterly), or — in tolerance-band mode — whenever any
  weight drifts more than X percentage points from target, checked monthly
  after cashflows; the summary reports how often the band triggered.
- With a cashflow mode active the summary adds the **money-weighted return
  (IRR)**: the discount rate that prices the initial amount, every monthly
  cashflow, and the final balance to zero (solved by bisection). TWR answers
  "how did the strategy do?"; MWR answers "how did *my dollars* do?" — with no
  cashflows the two are identical.
- Sharpe = mean monthly excess return over the 3-month T-bill ÷ its standard
  deviation, × √12. Sortino replaces the denominator with the downside deviation
  of the same excess returns. The rolling chart's Sharpe view applies the same
  formula per trailing window.
- Beta, alpha and R² come from a CAPM regression of the portfolio's monthly
  excess returns (over the 3-month T-bill) on the benchmark's; alpha is
  annualized geometrically. Tracking error is the annualized standard deviation
  of monthly active returns (portfolio − benchmark); information ratio is the
  annualized mean active return ÷ tracking error. Up (down) capture is the
  portfolio's average return across the benchmark's up (down) months as a
  percentage of the benchmark's own average in those months.
- Monte Carlo resamples the backtest's own monthly returns in 12-month blocks
  (preserving volatility clustering), with a fixed seed so results are
  reproducible; it is only as representative as the backtest window it
  resamples — short windows inherit their regime, and the page warns when
  history is under 10 years.
- Max drawdown is month-end based — intra-month dips are invisible. Longest
  underwater is the peak-to-recovery span of the longest drawdown episode
  (marked "ongoing" if unrecovered). Calmar = CAGR ÷ |max drawdown|; Ulcer
  index = root-mean-square of the monthly drawdown series; Martin ratio =
  annualized mean excess return ÷ Ulcer index.
- If a requested start predates any selected asset's history, the period is
  clamped to the earliest common month (noted above the summary).

## Development

Two files: `index.html` (engine + app) and `data.js` (generated data — never
edit by hand). The simulation/stats engine is a block of pure functions that
`tests/sanity.js` evals in Node and pins with 150+ assertions against
known-good history (run `node tests/sanity.js` before shipping any change).
`CLAUDE.md` documents the architecture, hard rules, and conventions;
`ROADMAP.md` tracks planned and shipped work.

Educational tool — not investment advice.
