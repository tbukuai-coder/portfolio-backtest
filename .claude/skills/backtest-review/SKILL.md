---
name: backtest-review
description: Review a shared portfolio-backtest URL (…/portfolio-backtest/#p=...) or compare candidate portfolios. Decodes the hash, reproduces the run headlessly with the app's own engine in Node, adds control portfolios, runs robustness checks, and writes an investment-commentary verdict. Use when the user pastes a portfolio-backtest link or asks to "review", "compare", or "pick" between allocations.
---

# Backtest review

Reproduce a shared portfolio-backtest run outside the browser, pressure-test
it, and deliver a verdict. This is read-only analysis — never edit the app
while reviewing. Requires only Node (any modern version, no packages) and
this repo checked out; run everything from the repo root.

## 1. Decode the hash

Grammar (from `encodeState()` in index.html; full spec in CLAUDE.md):

- `p=TICKER:w1:w2:w3,…` — one row per asset; the three weight slots are
  Portfolio 1/2/3 columns. Empty slots are empty strings (`VTI:75::` = P1 only).
- `s=YYYY-M` / `e=YYYY-M` — **M is the 0-indexed month** (`2020-0` = Jan 2020,
  `2026-5` = Jun 2026). Do not misread it as a calendar month number.
- `i=` initial $; `cf=mode:amt:step` (add | wd | wdpct); `fee=` %/yr;
  `rb=N|band:X` (12 annual, 3 quarterly, 1 monthly, 0 never);
  `b=` benchmark ticker — **absent means SPY**, `b=` empty means none;
  `mc=` MC horizon years; `g=GOAL$:YR` MC goal; `td=` custom Twelve Data
  symbols (those need a user API key and cannot be reproduced headlessly —
  say so if present).

## 2. Reproduce with the app's engine in Node

Eval the real engine — never re-implement the math:

```js
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const grab = (a, b) => html.split(a)[1].split(b)[0];
eval(fs.readFileSync('data.js', 'utf8').replace('const PV_DATA', 'var PV_DATA'));
eval(grab('/*==ENGINE-START==*/', '/*==ENGINE-END==*/'));
// now: mIdx, ret, simulate, computeStats, computeBenchStats, rollingCAGR,
// rollingSharpe, moneyWeightedReturn, returnHistogram, corrMatrix, monteCarlo
const s = mIdx('2020-01'), e = mIdx('2026-06');
const rf = [], mkt = [];
for (let m = s; m <= e; m++) { rf.push(ret('CASHX', m)); mkt.push(ret('SPY', m)); }
const sim = simulate([{t:'VTI',w:75},{t:'AVUV',w:25}], s, e, 10000, cashflow, 12, fee);
const st  = computeStats(sim, rf, mkt);
const vs  = computeBenchStats(sim.twr, benchSim.twr, rf);
```

Match the app's clamping: start = max of every constituent's (and CASHX/SPY's)
`mIdx(series.start)`, end = min of any custom-series `end` and `PV_DATA.end`;
note in the review when a young fund clamps the window.

## 3. Always add controls

The linked portfolios alone can't answer "was it worth it". Add:

- **SPY 100%** (or the chosen benchmark) — the do-nothing alternative.
- **Each sleeve at 100%** — shows what each ingredient contributed.
- **The untilted base** when a portfolio is "core + tilt" (e.g. VTI-only
  next to VTI+AVUV) — isolates the tilt decision from the core decision.

## 4. Stats to report

Per portfolio: final balance, CAGR, vol, max drawdown (+ episode dates and
recovery), longest underwater, Sharpe/Sortino, Ulcer, beta/alpha/TE/IR,
up/down capture, monthly skew, year-by-year table vs benchmark. When the
user asks to **pick** between candidates, also compute the correlation of
their **active-return streams** (each minus benchmark, then correlate) — a
low/negative value is the case for blending instead of choosing, and if so
simulate the 50/50 blend and report its stats too.

## 5. Robustness checks (these have flipped verdicts before)

- **Trim the endpoint**: re-run ending the previous Dec 31. If the ranking
  inverts, the "winner" is a recent-months artifact — say so prominently.
- **Window vs inception**: if a fund's data starts near the window start,
  the backtest is the fund's whole life — flag it.
- **Partial years**: the final calendar year runs only to `PV_DATA.end`.
- **Month-end granularity**: intramonth drawdowns (COVID) are understated.
- **Factor-premium horizon**: 5–10y windows can't validate or refute a
  factor tilt; frame conclusions as "on this window" only.

## 6. Deliver the verdict

Lead with the pick/assessment in one or two sentences, then: compact stats
table → year-by-year with the story (when each candidate won and why) →
caveats from step 5 → recommendation. If recommending an alternative
allocation, hand back a loadable link by composing the hash in the same
grammar (weights into a free portfolio column of the user's own link when
comparing). Keep the app's own framing: educational, not investment advice.
