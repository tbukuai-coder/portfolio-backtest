# Backtest Portfolio

A static HTML homage to [Portfolio Visualizer's Backtest Portfolio](https://www.portfoliovisualizer.com/backtest-portfolio).
Zero dependencies, no build step, no server calls — monthly total-return data for a
40-asset universe ships alongside the page in `data.js` (loaded via a plain
`<script src>`, not `fetch`), so the page still works offline, from `file://`,
or on GitHub Pages.

## Features

- Up to **3 portfolios** side by side, plus a benchmark series
- Curated universe: US equity ETFs (incl. small-cap value AVUV), global/international
  (VT, EFA, EEM, AVDV), bonds, gold/commodities/REITs/crypto,
  8 mega-cap stocks, a Malaysia group (iShares MSCI Malaysia plus five Bursa
  blue chips — Maybank, Public Bank, CIMB, Tenaga, Genting — converted to USD),
  and cash (3-month T-bill)
- Start/end month, initial amount, **monthly contributions**, rebalancing
  (monthly / quarterly / semi-annual / annual / none)
- Performance summary: final balance, CAGR, annualized volatility, best/worst year,
  max drawdown, longest underwater stretch, Sharpe, Sortino, Calmar, Ulcer index,
  Martin ratio — plus benchmark-relative stats when a benchmark is selected:
  correlation, beta, annualized alpha, R², tracking error, information ratio
- Portfolio growth chart (linear/log), annual returns bars, drawdown chart with
  worst-drawdown episode tables, rolling returns (1/3/5/10-year window toggle
  plus a best/worst/average table across all windows), monthly returns heatmap
  (year × month, diverging blue↔red fill with a portfolio selector), annual
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
  the final balance does include contributions.
- Contributions are added at month-end at target weights; rebalancing happens on
  calendar boundaries (December for annual, quarter-ends for quarterly).
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
