/* Sanity checks for the physics model. Run:  node tests/model.test.js
   Each check compares the model against a published or independently
   hand-calculated figure, with a tolerance. */
require('../assets/js/model.js');
const { variants: V, phys: P } = globalThis.EV;

let fail = 0;
const rows = [];
function check(name, got, lo, hi, unit = '') {
  const ok = got >= lo && got <= hi;
  if (!ok) fail++;
  rows.push(`${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(58)} ${got.toFixed(2).padStart(9)} ${unit.padEnd(7)} expected ${lo}..${hi}`);
}

// --- environment
check('air density at 20 C, sea level', P.rho(20), 1.19, 1.21, 'kg/m3');
check('air density at -10 C', P.rho(-10), 1.33, 1.35, 'kg/m3');
check('air density at 20 C, 2000 m', P.rho(20, 2000), 0.93, 0.96, 'kg/m3');

// --- road load, hand calc: 0.5*1.204*0.6118*27.78^2 = 284 N ; 0.009*2072*9.81 = 183 N
const lr = V.lr;
const rl = P.roadLoad(lr, { v: 100 / 3.6, mass: 2072 });
check('LR aero drag at 100 km/h', rl.aero, 280, 288, 'N');
check('LR rolling resistance', rl.roll, 180, 186, 'N');
check('LR grade force on 10 % slope', P.roadLoad(lr, { v: 10, mass: 2072, grade: 0.1 }).grade, 2015, 2030, 'N');

// --- steady-speed consumption vs typical measured values
const c = (car, kmh, o = {}) => P.consumption(car, Object.assign({ v: kmh / 3.6 }, o)).whkm;
check('LR consumption at 50 km/h', c(lr, 50), 80, 105, 'Wh/km');
check('LR consumption at 90 km/h', c(lr, 90), 120, 140, 'Wh/km');
check('LR consumption at 100 km/h', c(lr, 100), 140, 160, 'Wh/km');
check('LR consumption at 120 km/h', c(lr, 120), 175, 200, 'Wh/km');
check('LR consumption at 130 km/h', c(lr, 130), 195, 225, 'Wh/km');
check('LR range at 90 km/h', P.range(lr, { v: 25 }), 520, 620, 'km');
check('RWD range at 90 km/h', P.range(V.rwd, { v: 25 }), 420, 520, 'km');
check('LR battery-to-wheel efficiency at 100 km/h', (() => { const r = P.consumption(lr, { v: 100 / 3.6 }); return r.dt.Pw / r.dt.Pel; })(), 0.85, 0.93);

// --- acceleration vs published 0-100 km/h
for (const k of ['rwd', 'lr', 'perf']) {
  const run = P.accelRun(V[k], { vStop: 105 / 3.6 });
  const pub = V[k].pub.t100;
  check(`${k} 0-100 km/h (published ${pub} s)`, run.marks.t100, pub - 0.2, pub + 0.2, 's');
}
check('Performance launch acceleration', P.accelRun(V.perf, { vStop: 20 }).a[20], 0.8, 1.1, 'g');
check('RWD on ice (mu 0.1) is grip-limited', P.accelRun(V.rwd, { vStop: 5, mu: 0.1 }).a[20], 0.04, 0.08, 'g');
check('LR top speed reached', P.accelRun(lr, { tMax: 60 }).vTop, 199, 202, 'km/h');
check('motor rpm at 201 km/h', P.wOf(lr, 201 / 3.6) * 30 / Math.PI, 13000, 15000, 'rpm');

// --- motor efficiency map
check('peak-region motor+inverter efficiency', P.motorEff(lr, 150, 600), 0.94, 0.975);
check('low-speed high-torque efficiency is poor', P.motorEff(lr, 500, 60), 0.5, 0.8);

// --- battery
check('LR pack voltage at 100 %', P.packOcv(lr, 1), 398, 404, 'V');
check('LR pack nominal energy from cells', lr.s * lr.p * lr.cellAh * lr.cellV / 1000, 77, 79.5, 'kWh');
check('RWD pack nominal energy from cells', V.rwd.s * V.rwd.cellAh * V.rwd.cellV / 1000, 61, 64, 'kWh');
check('LR pack resistance at 25 C', P.packR(lr) * 1000, 45, 65, 'mOhm');
const pk = P.packAtPower(lr, 0.8, 330e3);
check('LR voltage sag at full power', pk.V0 - pk.V, 35, 75, 'V');

// --- charging
check('LR 10-80 % DC charge time', P.chargeSession(lr, { from: 0.1, to: 0.8 }).minutes, 24, 30, 'min');
check('RWD 10-80 % DC charge time', P.chargeSession(V.rwd, { from: 0.1, to: 0.8 }).minutes, 22, 31, 'min');
check('LR 0-100 % at 11 kW AC', P.chargeSession(lr, { from: 0, to: 1, ac: true }).minutes / 60, 7.3, 8.6, 'h');

// --- climate
check('heat pump COP at 0 C', P.copHeat(0).cop, 2.2, 3.1);
check('heat pump COP at -20 C', P.copHeat(-20).cop, 1.3, 2.0);
check('cabin heat demand at -10 C', P.climate(-10).q, 2800, 3800, 'W');
check('heat-pump electric draw at -10 C', P.climate(-10).pHeatPump, 1200, 1800, 'W');

console.log(rows.join('\n'));
console.log(fail ? `\n${fail} check(s) FAILED` : `\nall ${rows.length} checks passed`);
process.exit(fail ? 1 : 0);
