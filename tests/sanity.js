const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const grab = (a, b) => html.split(a)[1].split(b)[0];
eval(fs.readFileSync("data.js", "utf8").replace("const PV_DATA", "var PV_DATA"));
eval(grab("/*==ENGINE-START==*/", "/*==ENGINE-END==*/"));

const assert = (cond, msg) => { if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; } else console.log("ok: " + msg); };

const endM = mIdx(PV_DATA.end);
const rfFrom = (startM) => {
  const out = [];
  for (let m = startM; m <= endM; m++) out.push(ret("CASHX", m));
  return out;
};

// Anchor 1: SPY 100% from 1994-01
const s0 = mIdx("1994-01");
const spy = simulate([{ t: "SPY", w: 100 }], s0, endM, 10000, 0, 0);
const st = computeStats(spy, rfFrom(s0), null);
console.log("SPY CAGR", (st.cagr * 100).toFixed(2), "maxDD", (st.maxDD * 100).toFixed(2), "trough", mKey(st.episodes[0].trough));
assert(Math.abs(st.cagr - 0.109) < 0.006, "SPY CAGR ~10.9%");
assert(Math.abs(st.maxDD - -0.508) < 0.005, "SPY maxDD ~ -50.8%");
assert(mKey(st.episodes[0].trough) === "2009-02", "trough Feb 2009");

// Risk-stat batch: Calmar / Ulcer / Martin / longest underwater
console.log("SPY calmar", st.calmar.toFixed(3), "ulcer", (st.ulcer * 100).toFixed(2) + "%",
            "martin", st.martin.toFixed(2), "| underwater", st.underwater.months, "mo from",
            mKey(st.underwater.start), "ongoing:", st.underwater.ongoing);
assert(Math.abs(st.calmar - st.cagr / -st.maxDD) < 1e-12, "calmar = cagr/|maxDD|");
assert(st.underwater.months > 70 && st.underwater.months < 80 && !st.underwater.ongoing,
       "SPY longest underwater ~74 mo (dot-com stretch), recovered");
assert(st.ulcer > 0.05 && st.ulcer < 0.30, "SPY ulcer in plausible range");
assert(isFinite(st.martin) && st.martin > 0, "SPY martin finite and positive");
{
  const cashSt = computeStats(simulate([{ t: "CASHX", w: 100 }], s0, endM, 10000, 0, 0), rfFrom(s0), null);
  assert(cashSt.maxDD > -0.001, "cash has no material drawdown");
  assert(cashSt.ulcer < 1e-3, "cash ulcer ~0");
}

// Rolling CAGR
{
  const flat = Array(24).fill(0.01);
  const r12 = rollingCAGR(flat, 12);
  assert(r12.length === 13, "rolling length = n - w + 1");
  assert(r12.every(v => Math.abs(v - (Math.pow(1.01, 12) - 1)) < 1e-12), "constant 1%/mo -> 12.68% everywhere");
  const spyRoll = rollingCAGR(spy.twr, 12);
  const manual = spy.twr.slice(0, 12).reduce((p, r) => p * (1 + r), 1) - 1;
  assert(Math.abs(spyRoll[0] - manual) < 1e-9, "first 12m window = product of first 12 months");
  assert(rollingCAGR(flat, 120).length === 0, "window longer than sample -> empty");
  const spy10 = rollingCAGR(spy.twr, 120);
  const w10 = Math.min(...spy10), b10 = Math.max(...spy10);
  console.log("SPY 10y rolling: worst", (w10 * 100).toFixed(2), "best", (b10 * 100).toFixed(2));
  assert(w10 > -0.05 && w10 < 0.02, "SPY worst 10y ~ lost decade (slightly negative)");
  assert(b10 > 0.13 && b10 < 0.22, "SPY best 10y in teens");
}

// Anchor 2: All Weather worst year 2022 (30 SPY / 40 TLT / 15 IEF / 7.5 GLD / 7.5 DBC)
const aw = [{ t: "SPY", w: 30 }, { t: "TLT", w: 40 }, { t: "IEF", w: 15 }, { t: "GLD", w: 7.5 }, { t: "DBC", w: 7.5 }];
const awStart = Math.max(...aw.map(a => mIdx(PV_DATA.series[a.t].start)), mIdx(PV_DATA.series.CASHX.start));
const awSim = simulate(aw, awStart, endM, 10000, 0, 12);
const awSt = computeStats(awSim, rfFrom(awStart), null);
console.log("AW start", mKey(awStart), "worst year", awSt.worst.y, (awSt.worst.r * 100).toFixed(1));
assert(awSt.worst.y === 2022, "All Weather worst year 2022");

// Anchor 3: contributions leave TWR unchanged (single asset)
const a = simulate([{ t: "SPY", w: 100 }], s0, endM, 10000, 0, 0).twr;
const b = simulate([{ t: "SPY", w: 100 }], s0, endM, 10000, 500, 0).twr;
const maxDiff = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
assert(maxDiff < 1e-12, "contributions don't move TWR (maxDiff=" + maxDiff + ")");

// Benchmark-relative stats
{
  const s1 = mIdx("2004-01"); // after AGG + QQQ inception
  const sim1 = (alloc) => simulate(alloc, s1, endM, 10000, 0, 12).twr;
  const rf1 = rfFrom(s1);
  const spyT = sim1([{ t: "SPY", w: 100 }]);
  const self = computeBenchStats(spyT, spyT, rf1);
  assert(Math.abs(self.beta - 1) < 1e-12, "SPY vs SPY beta = 1");
  assert(Math.abs(self.alpha) < 1e-12, "SPY vs SPY alpha = 0");
  assert(Math.abs(self.r2 - 1) < 1e-12, "SPY vs SPY R2 = 1");
  assert(self.te === 0 && Number.isNaN(self.ir), "SPY vs SPY TE = 0, IR NaN");
  assert(Math.abs(self.corr - 1) < 1e-12, "SPY vs SPY corr = 1");
  const bal = computeBenchStats(sim1([{ t: "SPY", w: 60 }, { t: "AGG", w: 40 }]), spyT, rf1);
  console.log("60/40 vs SPY: beta", bal.beta.toFixed(3), "alpha", (bal.alpha * 100).toFixed(2),
              "R2", bal.r2.toFixed(3), "TE", (bal.te * 100).toFixed(2), "IR", bal.ir.toFixed(2));
  assert(bal.beta > 0.52 && bal.beta < 0.68, "60/40 beta ~0.6");
  assert(bal.r2 > 0.9, "60/40 R2 > 0.9");
  const qqq = computeBenchStats(sim1([{ t: "QQQ", w: 100 }]), spyT, rf1);
  console.log("QQQ vs SPY: beta", qqq.beta.toFixed(3), "corr", qqq.corr.toFixed(3));
  assert(qqq.beta > 1, "QQQ beta > 1");
  const cash = computeBenchStats(spyT, sim1([{ t: "CASHX", w: 100 }]), rf1);
  assert(Number.isNaN(cash.beta), "cash benchmark -> beta NaN (rendered as em dash)");
}

// Cashflows: withdrawals, step-up, percent mode, depletion
{
  const s2 = mIdx("2004-01");
  const bal6040 = [{ t: "SPY", w: 60 }, { t: "AGG", w: 40 }];
  // pro-rata withdrawals preserve weights -> TWR identical even multi-asset
  const a = simulate(bal6040, s2, endM, 10000, 0, 12).twr;
  const b = simulate(bal6040, s2, endM, 10000, { amount: -30 }, 12).twr;
  assert(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) < 1e-12,
         "pro-rata withdrawal leaves multi-asset TWR unchanged");
  // percent-of-balance: TWR unchanged, balance = product of (1+r)(1-rate/12)
  const pc = simulate([{ t: "SPY", w: 100 }], s2, endM, 10000, { rate: 4 }, 0);
  const spy2 = simulate([{ t: "SPY", w: 100 }], s2, endM, 10000, 0, 0);
  assert(Math.max(...spy2.twr.map((v, i) => Math.abs(v - pc.twr[i]))) < 1e-12,
         "percent withdrawal leaves TWR unchanged");
  let man = 10000;
  for (const r of spy2.twr) man *= (1 + r) * (1 - 4 / 100 / 12);
  assert(Math.abs(pc.balances.at(-1).v - man) < 1e-6, "percent-mode balance matches manual product");
  assert(!pc.depleted, "percent mode never depletes");
  // fixed withdrawal big enough to exhaust cash -> depletion, flat after
  const dep = simulate([{ t: "CASHX", w: 100 }], s2, endM, 10000, { amount: -500 }, 0);
  assert(dep.depleted !== null, "excessive withdrawal depletes");
  const depIdx = dep.depleted - s2;
  console.log("depletion month:", mKey(dep.depleted), "(month", depIdx + 1, "of the sim)");
  assert(depIdx >= 19 && depIdx <= 23, "10k at ~cash rates less 500/mo lasts ~20-21 months");
  assert(dep.balances.at(-1).v === 0, "depleted balance is exactly 0");
  assert(dep.twr.slice(depIdx + 1).every(v => v === 0), "post-depletion twr is flat 0");
  assert(isFinite(computeStats(dep, rfFrom(s2), null).cagr), "stats stay finite after depletion");
  // step-up: reconstruct 36 months of stepped contributions manually
  const st3 = simulate([{ t: "SPY", w: 100 }], s2, s2 + 35, 10000, { amount: 100, stepUp: 50 }, 0);
  let mv = 10000, mAmt = 100;
  for (let m = s2; m <= s2 + 35; m++) {
    if (m % 12 === 0 && m > s2) mAmt *= 1.5;
    mv = mv * (1 + ret("SPY", m)) + mAmt;
  }
  assert(Math.abs(st3.balances.at(-1).v - mv) < 1e-6, "step-up balance matches manual reconstruction");
}

// Tolerance-band rebalancing
{
  const s3 = mIdx("2004-01");
  const bal = [{ t: "SPY", w: 60 }, { t: "AGG", w: 40 }];
  const eq = (x, y, msg) => {
    const bx = x.balances.map(b => b.v), by = y.balances.map(b => b.v);
    assert(Math.max(...bx.map((v, i) => Math.abs(v - by[i]))) < 1e-6, msg);
  };
  // band ~0 (any drift triggers) === monthly; band huge === never
  eq(simulate(bal, s3, endM, 10000, 0, { band: 1e-9 }),
     simulate(bal, s3, endM, 10000, 0, 1), "band ~0 equals monthly rebalancing");
  eq(simulate(bal, s3, endM, 10000, 0, { band: 1e9 }),
     simulate(bal, s3, endM, 10000, 0, 0), "band inf equals never rebalancing");
  const b5 = simulate(bal, s3, endM, 10000, 0, { band: 5 });
  const months = endM - s3 + 1;
  console.log("60/40 5% band:", b5.rebals, "rebalances over", months, "months");
  assert(b5.rebals >= 3 && b5.rebals < months / 4, "5% band triggers occasionally, not monthly");
  assert(simulate([{ t: "SPY", w: 100 }], s3, endM, 10000, 0, { band: 5 }).rebals === 0,
         "single asset never drifts, band never triggers");
  assert(simulate(bal, s3, endM, 10000, 0, 12).rebals === Math.floor(months / 12),
         "annual mode counts one rebalance per December");
}

// Data freshness + shape
// freshness: the data must end at the previous complete month, or at most one
// month behind it (a normal mid-month run before the next refresh)
{
  const now = new Date();
  const prevM = now.getFullYear() * 12 + now.getMonth() - 1;
  assert(endM <= prevM && endM >= prevM - 1,
         "data end " + PV_DATA.end + " within a month of current (prev complete = " + mKey(prevM) + ")");
}
// the expected universe is parsed from refresh_data.py, so adding a ticker
// there is the only edit needed — this stays in sync automatically while
// still catching silently-dropped series (in UNIVERSE but absent from data)
{
  const py = fs.readFileSync("refresh_data.py", "utf8");
  const uni = [...py.matchAll(/^\s*"([A-Z0-9.=-]+)":\s*\(/gm)].map(m => m[1]);
  assert(uni.length >= 30, "parsed UNIVERSE from refresh_data.py (" + uni.length + " entries)");
  const missing = uni.filter(t => !PV_DATA.series[t]);
  assert(missing.length === 0, "every UNIVERSE ticker embedded" + (missing.length ? " — MISSING: " + missing : ""));
  assert(Object.keys(PV_DATA.series).length === uni.length + 1,
         (uni.length + 1) + " series embedded (UNIVERSE + CASHX)");
}
assert(PV_DATA.series.VT?.group === "International" && PV_DATA.series.VT.start === "2008-07", "VT embedded from 2008-07");
assert(PV_DATA.series.AVUV?.group === "US Equity" && PV_DATA.series.AVUV.start === "2019-10", "AVUV embedded from 2019-10");
assert(PV_DATA.series.AVDV?.group === "International" && PV_DATA.series.AVDV.start === "2019-10", "AVDV embedded from 2019-10");

// Malaysia group: USD-converted Bursa listings + EWM
{
  const my = ["EWM", "MAYBANK", "PBBANK", "CIMB", "TENAGA", "RHBBANK", "IHH", "SUNWAY"];
  my.forEach(t => assert(PV_DATA.series[t]?.group === "Malaysia", t + " in Malaysia group"));
  assert(PV_DATA.series.MAYBANK.start === "2004-01", "MAYBANK starts 2004-01 (FX history limit)");
  my.filter(t => t !== "EWM").forEach(t => {
    const r = PV_DATA.series[t].r;
    assert(Math.min(...r) > -0.30 && Math.max(...r) < 0.45,
           t + " returns free of OTC-style garbage prints");
  });
  const mb = computeStats(simulate([{ t: "MAYBANK", w: 100 }], mIdx("2004-01"), endM, 10000, 0, 0),
                          rfFrom(mIdx("2004-01")), null);
  console.log("MAYBANK USD CAGR", (mb.cagr * 100).toFixed(2), "maxDD", (mb.maxDD * 100).toFixed(1));
  assert(mb.cagr > 0 && mb.cagr < 0.15, "MAYBANK USD CAGR plausible");
}

// Singapore group: USD-converted SGX listings + EWS
{
  const sg = ["EWS", "DBS", "OCBC", "UOB", "SINGTEL", "SIA"];
  sg.forEach(t => assert(PV_DATA.series[t]?.group === "Singapore", t + " in Singapore group"));
  assert(PV_DATA.series.DBS.start === "2004-01", "DBS starts 2004-01 (FX history limit)");
  assert(PV_DATA.series.EWS.start === "1996-04", "EWS reaches back to 1996");
  sg.filter(t => t !== "EWS").forEach(t => {
    const r = PV_DATA.series[t].r;
    assert(Math.min(...r) > -0.45 && Math.max(...r) < 0.45,
           t + " returns free of garbage prints");
  });
  const dbs = computeStats(simulate([{ t: "DBS", w: 100 }], mIdx("2004-01"), endM, 10000, 0, 0),
                           rfFrom(mIdx("2004-01")), null);
  console.log("DBS USD CAGR", (dbs.cagr * 100).toFixed(2), "maxDD", (dbs.maxDD * 100).toFixed(1));
  assert(dbs.cagr > 0.03 && dbs.cagr < 0.20, "DBS USD CAGR plausible");
}
for (const [t, s] of Object.entries(PV_DATA.series)) {
  const expected = endM - mIdx(s.start) + 1;
  assert(s.r.length === expected, t + " contiguous to end (" + s.r.length + "/" + expected + ")");
}
