# Data source plan: custom tickers via runtime API

**Status: BUILT 2026-07-18** — with one major change from the original plan:
the provider is **Twelve Data, not Tiingo**. The verification gates below were
run before building and eliminated both original candidates:

- **Tiingo — FAILED gate 1 (CORS)**: `api.tiingo.com` only sends
  `Access-Control-Allow-Origin` for its own `www.tiingo.com` origin; requests
  from a GitHub Pages origin get no CORS header → blocked by browsers.
- **Alpha Vantage — FAILED gate 3 (free tier)**: `TIME_SERIES_MONTHLY_ADJUSTED`
  passed CORS (`*`) and gate 2 (IBM: 60 months vs yfinance, max 2.2 bp diff
  incl. 20 dividend months), but the endpoint is now **premium** — the `demo`
  key masks this by working on documented examples.
- **Twelve Data — PASSED all gates**: CORS `Access-Control-Allow-Origin: *`;
  `time_series` with `adjust=all` is dividend-adjusted (AAPL: 68 months vs
  yfinance, max 1.6 bp, mean 0.04 bp); docs list `adjust` with no plan
  restriction (unlike AV, which labels premium endpoints explicitly). Residual
  risk: free-plan gating not 100% provable without a real free key — the 401/
  error handling surfaces it plainly if it ever appears.

Implementation lives in the app block of `index.html` ("custom tickers"
section): endpoint `time_series?symbol=&interval=1month&outputsize=5000&
adjust=all`, longest-trailing-contiguous-run parsing trimmed to complete
months ≤ `PV_DATA.end`, in-memory merge into `PV_DATA.series` (file's data
block untouched), localStorage key `pv_td_key` + cache `pv_td_cache`
(invalidated when `PV_DATA.end` advances), per-series `end` field with an
end-clamp in `run()`. Verified: Node engine anchors + headless Chromium in
both themes with stubbed fetch (add/backtest/cache-restore/404/remove paths).

The original plan follows for reference. Provider-specific details below
(Tiingo endpoint, key names) are superseded by the above.

---

Design note for the "more stock data" feature. Written 2026-07-18.
Companion to the "Data & universe" section of `ROADMAP.md`.

## Goal

Let users backtest tickers outside the curated 31-asset embedded universe,
without breaking the app's core contract: the embedded dataset stays the
offline core (page still works from `file://` with no network and no key),
and all stats stay on dividend-adjusted **total-return** monthly series.

## Options considered

| Option | Verdict |
| --- | --- |
| Expand embedded universe only (`refresh_data.py`) | Keep doing this for broadly useful assets, but it can never cover arbitrary tickers and each asset grows `index.html`. |
| **Opt-in runtime fetch, user's own free API key** | **Chosen.** Zero cost, zero infrastructure, degrades gracefully to the embedded universe. |
| Serverless proxy (Cloudflare Worker + shared key) | Rejected for now: infrastructure to maintain outside the repo, shared quota exhaustible by strangers, page no longer self-contained. |

## Chosen provider: Tiingo

Verified 2026-07-18 from [tiingo.com/about/pricing](https://www.tiingo.com/about/pricing):

- Free tier: **1,000 requests/day, 500 unique symbols/month**, no credit card.
- 30+ years of end-of-day history with **`adjClose`** (splits + dividends) —
  satisfies the total-return methodology rule in `CLAUDE.md`.
- One custom ticker = one API call (full monthly history in a single
  request), so free limits are a non-issue for this app's usage pattern.

Endpoint sketch:

```
GET https://api.tiingo.com/tiingo/daily/{ticker}/prices
    ?startDate=1980-01-01&resampleFreq=monthly&columns=adjClose&token={KEY}
```

Monthly return for month t = `adjClose[t] / adjClose[t-1] − 1`, same as
`refresh_data.py` derives from yfinance. Drop the in-progress current month,
same as the refresh script (a partial month poisons every stat downstream).

Runner-up: Twelve Data (free 800 calls/day, 8/min) — kept as fallback, but
whether its free endpoints serve properly dividend-adjusted closes was
unclear from the docs; would need the same validation gate below.

## Must-verify before building (gates, in order)

1. **CORS**: confirm `api.tiingo.com` sends `Access-Control-Allow-Origin`
   usable from a GitHub Pages origin (and ideally `file://`/null origin).
   If it doesn't, this plan falls back to the proxy option — test this
   FIRST, it invalidates everything else.
2. **Adjusted-close correctness**: for 2–3 tickers already in the embedded
   universe (e.g. SPY, TLT, a dividend-heavy one like VNQ), compare
   Tiingo-derived monthly returns against the embedded yfinance data.
   Tolerance: small basis-point noise ok; systematic drift on dividend
   payers = wrong column/endpoint, stop.
3. **Free-tier terms unchanged** (pricing page above).

## Implementation sketch

- UI: "Custom ticker" input + "API key" field (password-type) in the asset
  picker area; key persisted in `localStorage` (`pv_tiingo_key`), never in
  the URL. Small help link → Tiingo signup page. Everything hidden behind a
  disclosure so keyless users see no clutter.
- Fetched series are merged into a **runtime copy** of `PV_DATA` (the
  embedded data block is never touched — hand-edit rule stays absolute).
  Give fetched assets a distinct group label ("Custom (Tiingo)") and mark
  them in the allocation table so users know which rows need the network.
- Existing clamping logic in `run()` (earliest common month across chosen
  tickers + CASHX + SPY) already handles short-history custom tickers —
  no engine-block change expected. If the engine block does need touching,
  the Node sanity check in `CLAUDE.md` applies as usual.
- Cache fetched series in `localStorage` keyed by ticker + month, so
  repeated runs cost zero API calls and work offline after first fetch.
  Invalidate when the embedded `PV_DATA.end` month advances past the cache.
- Error states: bad key (401), unknown ticker (404), rate-limited (429),
  offline — each gets a plain-language message in `#formWarn`; a failed
  custom ticker must never block backtesting the embedded universe.
- Shareable-URL interaction (roadmap item): serialize custom *tickers* in
  the hash, never the key; on load, prompt for a key if custom tickers are
  present and no key is stored.

## Out of scope (for now)

- Daily-resolution data (whole engine is monthly; a resolution change is a
  different project).
- Fundamental data / non-US listings (Tiingo free tier is US-centric;
  revisit only if requested).
- Auto-refreshing the *embedded* universe stays a `refresh_data.py` +
  yfinance concern — see `ROADMAP.md` "Automated monthly refresh".
