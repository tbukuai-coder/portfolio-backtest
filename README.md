# Backtest Portfolio

A single-file HTML homage to [Portfolio Visualizer's Backtest Portfolio](https://www.portfoliovisualizer.com/backtest-portfolio).
Zero dependencies, no build step, no server calls — monthly total-return data for a
31-asset universe is embedded directly in `index.html`, so the page works offline,
from `file://`, or on GitHub Pages.

## Features

- Up to **3 portfolios** side by side, plus a benchmark series
- Curated universe: US equity ETFs, international, bonds, gold/commodities/REITs/crypto,
  8 mega-cap stocks, and cash (3-month T-bill)
- Start/end month, initial amount, **monthly contributions**, rebalancing
  (monthly / quarterly / semi-annual / annual / none)
- Performance summary: final balance, CAGR, annualized volatility, best/worst year,
  max drawdown, Sharpe, Sortino, correlation to SPY
- Portfolio growth chart (linear/log), annual returns bars, drawdown chart with
  worst-drawdown episode tables, annual returns table — all with hover tooltips,
  light/dark theme aware

## Refreshing the data

Prices come from yfinance (monthly, auto-adjusted = dividends reinvested), spliced
into `index.html` between the `/*==DATA-START==*/` … `/*==DATA-END==*/` markers:

```bash
python3 refresh_data.py
```

To change the universe, edit the `UNIVERSE` dict at the top of `refresh_data.py`
and re-run. The in-progress current month is always dropped.

## Methodology notes

- Stats (CAGR, volatility, Sharpe, Sortino, drawdowns) are computed on
  **time-weighted** monthly returns, so contributions don't distort them;
  the final balance does include contributions.
- Contributions are added at month-end at target weights; rebalancing happens on
  calendar boundaries (December for annual, quarter-ends for quarterly).
- Sharpe = mean monthly excess return over the 3-month T-bill ÷ its standard
  deviation, × √12. Sortino replaces the denominator with the downside deviation
  of the same excess returns.
- Max drawdown is month-end based — intra-month dips are invisible.
- If a requested start predates any selected asset's history, the period is
  clamped to the earliest common month (noted above the summary).

Educational tool — not investment advice.
