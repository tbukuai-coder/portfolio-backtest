# Backtest Portfolio

A static HTML homage to [Portfolio Visualizer's Backtest Portfolio](https://www.portfoliovisualizer.com/backtest-portfolio).
Zero dependencies, no build step, no server calls — monthly total-return data for a
58-asset universe ships alongside the page in `data.js` (loaded via a plain
`<script src>`, not `fetch`), so the page still works offline, from `file://`,
or on GitHub Pages.

## Features

- Up to **3 portfolios** side by side, plus a benchmark series
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
  Martin ratio — plus benchmark-relative stats when a benchmark is selected:
  correlation, beta, annualized alpha, R², tracking error, information ratio
- Portfolio growth chart (linear/log), annual returns bars, drawdown chart with
  worst-drawdown episode tables, rolling returns (1/3/5/10-year window toggle
  plus a best/worst/average table across all windows), monthly returns heatmap
  (year × month, diverging blue↔red fill with a portfolio selector), asset
  correlation matrix (the backtest's assets over its window), annual
  returns table — all with hover tooltips, light/dark theme aware
- **Custom tickers (opt-in)**: fetch any symbol's dividend-adjusted monthly
  history with your own free [Twelve Data](https://twelvedata.com/pricing) API
  key — see below

## Refreshing the data

Prices come from yfinance (monthly, auto-adjusted = dividends reinvested), written
to `data.js` as a `const PV_DATA = …` assignment between `/*==DATA-START==*/` …
`/*==DATA-END==*/` markers:

```bash
python3 refresh_data.py
```

To change the universe, edit the `UNIVERSE` dict at the top of `refresh_data.py`
and re-run. The in-progress current month is always dropped. Foreign listings
(the Malaysia group) carry a Yahoo ticker and an FX pair in their entry: closes
are multiplied by the FX rate month by month, so the embedded returns are USD
total returns — local return × currency return. (The Bursa listings are used
instead of the US OTC ADRs because the ADR price history is full of
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
limits (8 calls/min, 800/day) are ample: one call per ticker.

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
- Sharpe = mean monthly excess return over the 3-month T-bill ÷ its standard
  deviation, × √12. Sortino replaces the denominator with the downside deviation
  of the same excess returns.
- Beta, alpha and R² come from a CAPM regression of the portfolio's monthly
  excess returns (over the 3-month T-bill) on the benchmark's; alpha is
  annualized geometrically. Tracking error is the annualized standard deviation
  of monthly active returns (portfolio − benchmark); information ratio is the
  annualized mean active return ÷ tracking error.
- Max drawdown is month-end based — intra-month dips are invisible. Longest
  underwater is the peak-to-recovery span of the longest drawdown episode
  (marked "ongoing" if unrecovered). Calmar = CAGR ÷ |max drawdown|; Ulcer
  index = root-mean-square of the monthly drawdown series; Martin ratio =
  annualized mean excess return ÷ Ulcer index.
- If a requested start predates any selected asset's history, the period is
  clamped to the earliest common month (noted above the summary).

Educational tool — not investment advice.
