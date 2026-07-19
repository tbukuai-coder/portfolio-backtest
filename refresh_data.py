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

# key -> (display name, group) for assets whose key IS the Yahoo ticker, or
# key -> (display name, group, yahoo ticker, fx pair) for listings quoted in a
# foreign currency: closes are multiplied by the FX rate month by month, so the
# embedded returns are USD total returns (local return x currency return).
UNIVERSE = {
    "SPY":     ("SPDR S&P 500",              "US Equity"),
    "QQQ":     ("Invesco Nasdaq 100",         "US Equity"),
    "DIA":     ("SPDR Dow Jones",             "US Equity"),
    "VTI":     ("Vanguard Total US Market",   "US Equity"),
    "IWM":     ("iShares Russell 2000",       "US Equity"),
    "VTV":     ("Vanguard Value",             "US Equity"),
    "VUG":     ("Vanguard Growth",            "US Equity"),
    "AVUV":    ("Avantis US Small Cap Value", "US Equity"),
    "SCHD":    ("Schwab US Dividend Equity",  "US Equity"),
    "MTUM":    ("iShares MSCI USA Momentum",  "US Equity"),
    "QUAL":    ("iShares MSCI USA Quality",   "US Equity"),
    "VT":      ("Vanguard Total World Stock", "International"),
    "VXUS":    ("Vanguard Total Intl Stock",  "International"),
    "EFA":     ("iShares MSCI EAFE (Dev Intl)", "International"),
    "EEM":     ("iShares MSCI Emerging Mkts", "International"),
    "AVDV":    ("Avantis Intl Small Cap Value", "International"),
    "EWS":     ("iShares MSCI Singapore",     "International"),
    "AGG":     ("iShares Core US Total Bond", "Bonds"),
    "TLT":     ("iShares 20+ Yr Treasury",    "Bonds"),
    "IEF":     ("iShares 7-10 Yr Treasury",   "Bonds"),
    "SHY":     ("iShares 1-3 Yr Treasury",    "Bonds"),
    "LQD":     ("iShares IG Corporate",       "Bonds"),
    "HYG":     ("iShares High Yield",         "Bonds"),
    "TIP":     ("iShares TIPS",               "Bonds"),
    "EMB":     ("iShares EM USD Bonds",       "Bonds"),
    "BNDX":    ("Vanguard Total Intl Bond (hedged)", "Bonds"),
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
    "AVGO":    ("Broadcom",                   "Stocks"),
    "JPM":     ("JPMorgan Chase",             "Stocks"),
    "LLY":     ("Eli Lilly",                  "Stocks"),
    "COST":    ("Costco",                     "Stocks"),
    "EWM":     ("iShares MSCI Malaysia",      "Malaysia"),
    "MAYBANK": ("Maybank (USD)",              "Malaysia", "1155.KL", "MYRUSD=X"),
    "PBBANK":  ("Public Bank (USD)",          "Malaysia", "1295.KL", "MYRUSD=X"),
    "CIMB":    ("CIMB Group (USD)",           "Malaysia", "1023.KL", "MYRUSD=X"),
    "TENAGA":  ("Tenaga Nasional (USD)",      "Malaysia", "5347.KL", "MYRUSD=X"),
    "RHBBANK": ("RHB Bank (USD)",             "Malaysia", "1066.KL", "MYRUSD=X"),
    "IHH":     ("IHH Healthcare (USD)",       "Malaysia", "5225.KL", "MYRUSD=X"),
    "SUNWAY":  ("Sunway (USD)",               "Malaysia", "5211.KL", "MYRUSD=X"),
}


def month_key(ts):
    return f"{ts.year:04d}-{ts.month:02d}"


def fetch_returns():
    yahoo = set()
    for key, spec in UNIVERSE.items():
        yahoo.add(spec[2] if len(spec) > 2 else key)
        if len(spec) > 3:
            yahoo.add(spec[3])
    px = yf.download(sorted(yahoo), interval="1mo", period="max",
                     auto_adjust=True, progress=False)["Close"]
    # drop the in-progress current month
    today = dt.date.today()
    px = px[px.index < dt.datetime(today.year, today.month, 1)]
    end_m = px.index[-1].year * 12 + px.index[-1].month

    series = {}
    for key, spec in UNIVERSE.items():
        name, group = spec[0], spec[1]
        p = px[spec[2] if len(spec) > 2 else key]
        if len(spec) > 3:
            p = p * px[spec[3]]
        s = p.pct_change().dropna()
        if s.empty:
            print(f"WARN: no data for {key}", file=sys.stderr)
            continue
        # an interior gap would shift every later month one slot after dropna
        span = end_m - (s.index[0].year * 12 + s.index[0].month) + 1
        if len(s) != span:
            sys.exit(f"ERROR: {key} has interior gaps ({len(s)} rows over {span} months)")
        series[key] = {
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
