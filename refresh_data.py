#!/usr/bin/env python3
"""Regenerate the price dataset in data.js.

Downloads max-history monthly auto-adjusted closes (dividends reinvested) for a
curated universe via yfinance, converts to monthly returns, and writes data.js
(a `const PV_DATA = {...}` assignment wrapped in /*==DATA-START==*/ and
/*==DATA-END==*/ markers), which index.html loads via <script src="data.js">.

Usage:  python3 refresh_data.py
"""

import datetime as dt
import json
import sys
from pathlib import Path

import yfinance as yf

HERE = Path(__file__).resolve().parent
DATA = HERE / "data.js"

# ticker -> (display name, group)
UNIVERSE = {
    "SPY":     ("SPDR S&P 500",              "US Equity"),
    "QQQ":     ("Invesco Nasdaq 100",         "US Equity"),
    "DIA":     ("SPDR Dow Jones",             "US Equity"),
    "VTI":     ("Vanguard Total US Market",   "US Equity"),
    "IWM":     ("iShares Russell 2000",       "US Equity"),
    "VTV":     ("Vanguard Value",             "US Equity"),
    "VUG":     ("Vanguard Growth",            "US Equity"),
    "EFA":     ("iShares MSCI EAFE (Dev Intl)", "International"),
    "EEM":     ("iShares MSCI Emerging Mkts", "International"),
    "AGG":     ("iShares Core US Total Bond", "Bonds"),
    "TLT":     ("iShares 20+ Yr Treasury",    "Bonds"),
    "IEF":     ("iShares 7-10 Yr Treasury",   "Bonds"),
    "SHY":     ("iShares 1-3 Yr Treasury",    "Bonds"),
    "LQD":     ("iShares IG Corporate",       "Bonds"),
    "HYG":     ("iShares High Yield",         "Bonds"),
    "TIP":     ("iShares TIPS",               "Bonds"),
    "GLD":     ("SPDR Gold Shares",           "Alternatives"),
    "SLV":     ("iShares Silver",             "Alternatives"),
    "DBC":     ("Invesco DB Commodity",       "Alternatives"),
    "VNQ":     ("Vanguard Real Estate",       "Alternatives"),
    "BTC-USD": ("Bitcoin",                    "Alternatives"),
    "ETH-USD": ("Ethereum",                   "Alternatives"),
    "AAPL":    ("Apple",                      "Stocks"),
    "MSFT":    ("Microsoft",                  "Stocks"),
    "NVDA":    ("NVIDIA",                     "Stocks"),
    "GOOGL":   ("Alphabet",                   "Stocks"),
    "AMZN":    ("Amazon",                     "Stocks"),
    "META":    ("Meta Platforms",             "Stocks"),
    "TSLA":    ("Tesla",                      "Stocks"),
    "BRK-B":   ("Berkshire Hathaway B",       "Stocks"),
}


def month_key(ts):
    return f"{ts.year:04d}-{ts.month:02d}"


def fetch_returns():
    tickers = list(UNIVERSE)
    px = yf.download(tickers, interval="1mo", period="max",
                     auto_adjust=True, progress=False)["Close"]
    # drop the in-progress current month
    today = dt.date.today()
    px = px[px.index < dt.datetime(today.year, today.month, 1)]
    rets = px.pct_change()

    series = {}
    for t in tickers:
        s = rets[t].dropna()
        if s.empty:
            print(f"WARN: no data for {t}", file=sys.stderr)
            continue
        name, group = UNIVERSE[t]
        series[t] = {
            "name": name,
            "group": group,
            "start": month_key(s.index[0]),
            "r": [round(float(v), 5) for v in s.values],
        }
    return series, month_key(px.index[-1])


def fetch_cash(end_month):
    """CASHX: monthly return from the 13-week T-bill yield (^IRX)."""
    irx = yf.download("^IRX", interval="1mo", period="max",
                      auto_adjust=False, progress=False)["Close"]["^IRX"].dropna()
    today = dt.date.today()
    irx = irx[irx.index < dt.datetime(today.year, today.month, 1)]
    r = [round((1 + float(y) / 100) ** (1 / 12) - 1, 5) for y in irx.values]
    return {
        "name": "Cash (3-mo T-bill)",
        "group": "Cash",
        "start": month_key(irx.index[0]),
        "r": r,
    }


def main():
    series, last_month = fetch_returns()
    series["CASHX"] = fetch_cash(last_month)
    payload = {
        "updated": dt.date.today().isoformat(),
        "end": last_month,
        "series": series,
    }
    blob = json.dumps(payload, separators=(",", ":"))

    DATA.write_text("/*==DATA-START==*/\nconst PV_DATA = " + blob
                    + ";\n/*==DATA-END==*/\n")
    n = len(series)
    print(f"Wrote {n} series through {last_month} "
          f"({len(blob) // 1024} KB) to {DATA.name}")


if __name__ == "__main__":
    main()
