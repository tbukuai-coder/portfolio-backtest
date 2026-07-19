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

// Data freshness + shape
// freshness: the data must end at the previous complete month, or at most one
// month behind it (a normal mid-month run before the next refresh)
{
  const now = new Date();
  const prevM = now.getFullYear() * 12 + now.getMonth() - 1;
  assert(endM <= prevM && endM >= prevM - 1,
         "data end " + PV_DATA.end + " within a month of current (prev complete = " + mKey(prevM) + ")");
}
assert(Object.keys(PV_DATA.series).length === 37, "37 series embedded");

// Malaysia group: USD-converted Bursa listings + EWM
{
  const my = ["EWM", "MAYBANK", "PBBANK", "CIMB", "TENAGA", "GENTING"];
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
for (const [t, s] of Object.entries(PV_DATA.series)) {
  const expected = endM - mIdx(s.start) + 1;
  assert(s.r.length === expected, t + " contiguous to end (" + s.r.length + "/" + expected + ")");
}
