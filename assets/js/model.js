/* ==========================================================================
   model.js — the physics model of the car.
   Pure functions, no DOM. Everything the charts and simulations show is
   computed here, so the numbers on every page agree with each other.
   Works in the browser (window.EV) and in Node (globalThis.EV) for tests.

   Published figures (mass, battery size, 0-100 time, WLTP range) are for the
   2025-on European-market Model Y as best publicly known. Parameters Tesla
   does not publish (torque curve, loss coefficients, internal resistance)
   are ESTIMATES, tuned so the model reproduces published acceleration times
   and typical measured consumption. Treat them as representative, not exact.
   ========================================================================== */
(function (root) {
  'use strict';
  const EV = (root.EV = root.EV || {});
  const G = 9.81;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Piecewise-linear interpolation through a table [[x, y], ...] sorted by x. */
  function interp(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    const n = tab.length - 1;
    if (x >= tab[n][0]) return tab[n][1];
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m][0] <= x) lo = m; else hi = m; }
    const [x0, y0] = tab[lo], [x1, y1] = tab[hi];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }

  /* ---------------------------------------------------------------- the cars */
  const COMMON = {
    cd: 0.23, area: 2.66,            // drag coefficient, frontal area (m^2)  -> CdA = 0.61 m^2
    gear: 9.0, etaGear: 0.98,        // single-speed reduction, gear mesh efficiency
    rWheel: 0.35,                    // effective rolling radius (m), 255/45 R19
    wheelbase: 2.89, track: 1.64, cgH: 0.56,
    length: 4.79, width: 1.92, height: 1.62,
    rot: 1.05,                       // rotating-inertia factor: wheels + rotors act like 5 % extra mass
    auxW: 300,                       // always-on electronics, pumps (W)
    rpmMax: 18000,                   // motor speed limit
    // motor + inverter loss model (combined, at the motor shaft)
    kc: 0.055,                       // copper:  kc * T^2            [W / (N m)^2]
    kh: 0.5, ke: 0.0009,             // iron:    kh * w + ke * w^2   [w in rad/s]
    kf: 0.3, kw: 2e-7,               // bearings kf * w, windage kw * w^3
    kinv: 0.012, pinv0: 100,         // inverter: 1.2 % of power + 100 W
  };

  const VARIANTS = {
    rwd: Object.assign({}, COMMON, {
      key: 'rwd', name: 'RWD', full: 'Rear-Wheel Drive', drive: 'RWD', motors: 1,
      curb: 1928, chem: 'LFP', gross: 62.5, usable: 60, s: 106, p: 1, cellAh: 184, cellV: 3.2, cellR: 0.0005,
      packKg: 440, cellFormat: 'large prismatic LFP cells',
      tPeak: 420, pPeak: 228e3, frontShare: 0, rearStatic: 0.53, vMax: 201, crr: 0.009, mu: 1.0,
      dcPeak: 175, regenMax: 70e3,
      pub: { t100: 5.9, wltp: 500, power: 220, vmax: 201 },
    }),
    lr: Object.assign({}, COMMON, {
      key: 'lr', name: 'Long Range AWD', full: 'Long Range All-Wheel Drive', drive: 'AWD', motors: 2,
      curb: 1997, chem: 'NMC', gross: 78.1, usable: 75, s: 96, p: 46, cellAh: 4.76, cellV: 3.72, cellR: 0.024,
      packKg: 480, cellFormat: '2170 cylindrical NMC cells',
      tPeak: 510, pPeak: 335e3, frontShare: 0.42, rearStatic: 0.52, vMax: 201, crr: 0.009, mu: 1.0,
      kf: 0.36,                      // second drive unit adds a little spin loss
      dcPeak: 250, regenMax: 85e3,
      pub: { t100: 4.8, wltp: 586, power: 378, vmax: 201 },
    }),
    perf: Object.assign({}, COMMON, {
      key: 'perf', name: 'Performance', full: 'Performance All-Wheel Drive', drive: 'AWD', motors: 2,
      curb: 2033, chem: 'NMC', gross: 82, usable: 79, s: 96, p: 46, cellAh: 5.0, cellV: 3.72, cellR: 0.022,
      packKg: 485, cellFormat: '2170 cylindrical NMC cells',
      tPeak: 830, pPeak: 362e3, frontShare: 0.42, rearStatic: 0.52, vMax: 250, crr: 0.0105, mu: 1.1,
      kc: 0.03, kf: 0.36,
      dcPeak: 250, regenMax: 85e3,
      pub: { t100: 3.5, wltp: 580, power: 343, vmax: 250 },
    }),
  };

  /* ------------------------------------------------------------- environment */
  /** Air density (kg/m^3) from temperature (deg C) and altitude (m). Ideal gas + barometric formula. */
  function rho(tempC = 20, alt = 0) {
    const p = 101325 * Math.pow(1 - 2.25577e-5 * alt, 5.25588);
    return p / (287.05 * (tempC + 273.15));
  }

  /** Tyres get stiffer and lossier in the cold: roughly +0.6 % rolling resistance per deg C below 20. */
  function crrTempFactor(tempC = 20) { return 1 + 0.006 * Math.max(0, 20 - tempC); }

  /* ---------------------------------------------------------------- road load */
  /**
   * Forces opposing motion at steady speed.
   * o: { v (m/s), grade (rise/run, e.g. 0.05), wind (headwind m/s), mass (kg), tempC, alt, crrMul, cdaMul }
   */
  function roadLoad(car, o) {
    const v = o.v || 0, mass = o.mass || car.curb + 75;
    const theta = Math.atan(o.grade || 0);
    const vAir = v + (o.wind || 0);
    const dens = rho(o.tempC == null ? 20 : o.tempC, o.alt || 0);
    const cda = car.cd * car.area * (o.cdaMul || 1);
    const aero = 0.5 * dens * cda * vAir * Math.abs(vAir);
    const crr = car.crr * (o.crrMul || 1) * crrTempFactor(o.tempC == null ? 20 : o.tempC);
    const roll = v > 0.05 ? crr * mass * G * Math.cos(theta) : 0;
    const grade = mass * G * Math.sin(theta);
    return { aero, roll, grade, total: aero + roll + grade, rho: dens, crr, cda };
  }

  /* ------------------------------------------------------------------- motor */
  const wOf = (car, v) => v / car.rWheel * car.gear;              // motor speed (rad/s) from road speed
  const vOf = (car, w) => w * car.rWheel / car.gear;

  /** Peak combined shaft torque available at motor speed w (rad/s). Constant torque, then constant power, then fade. */
  function torqueMax(car, w, soc) {
    if (w <= 0) return car.tPeak;
    const wFade = wOf(car, 115 / 3.6), wTop = wOf(car, 255 / 3.6);
    let p = car.pPeak;
    if (w > wFade) p *= 1 - 0.38 * (w - wFade) / (wTop - wFade);   // back-EMF eats into power at very high rpm
    if (soc != null) p *= clamp(packOcv(car, soc) / packOcv(car, 0.9), 0.6, 1.05);
    return Math.min(car.tPeak, p / w);
  }

  /** Motor + inverter losses (W) at shaft torque T (N m, either sign) and speed w (rad/s). */
  function motorLoss(car, T, w) {
    const cu = car.kc * T * T * Math.max(1, w * car.tPeak / car.pPeak);   // field weakening needs extra current per unit torque
    const fe = car.kh * w + car.ke * w * w;
    const mech = car.kf * w + car.kw * w * w * w;
    const inv = car.kinv * Math.abs(T * w) + (w > 0.5 || Math.abs(T) > 0.5 ? car.pinv0 : 0);
    return { cu, fe, mech, inv, total: cu + fe + mech + inv };
  }

  /** Motor + inverter efficiency (0..1) when motoring at (T, w). */
  function motorEff(car, T, w) {
    const pm = T * w;
    if (pm <= 0) return 0;
    return pm / (pm + motorLoss(car, T, w).total);
  }

  /**
   * Wheel force + speed -> electrical power at the battery terminals (W, negative = charging).
   * Returns the loss breakdown too.
   */
  function drivetrain(car, F, v) {
    const w = wOf(car, v);
    const Pw = F * v;
    const Tm = F >= 0 ? F * car.rWheel / (car.gear * car.etaGear) : F * car.rWheel * car.etaGear / car.gear;
    const Pm = Tm * w;
    const L = motorLoss(car, Tm, w);
    const gear = Math.abs(Pw - Pm);
    return { Pw, Pm, Tm, w, Pel: Pm + L.total, loss: { cu: L.cu, fe: L.fe, mech: L.mech, inv: L.inv, gear, total: L.total + gear } };
  }

  /* ----------------------------------------------------------------- battery */
  const OCV = {
    NMC: [[0, 3.0], [0.02, 3.2], [0.05, 3.36], [0.1, 3.47], [0.2, 3.57], [0.3, 3.64], [0.4, 3.69], [0.5, 3.75],
      [0.6, 3.84], [0.7, 3.93], [0.8, 4.02], [0.9, 4.1], [1, 4.18]],
    LFP: [[0, 2.5], [0.02, 2.95], [0.05, 3.1], [0.1, 3.19], [0.2, 3.23], [0.3, 3.26], [0.4, 3.275], [0.5, 3.285],
      [0.6, 3.295], [0.7, 3.31], [0.8, 3.325], [0.9, 3.335], [0.97, 3.36], [1, 3.45]],
  };
  const cellOcv = (chem, soc) => interp(OCV[chem], clamp(soc, 0, 1));
  const packOcv = (car, soc) => car.s * cellOcv(car.chem, soc);
  /** Internal resistance grows as the cells get cold (roughly doubling every ~22 deg C below 25). */
  const tempRFactor = (tempC = 25) => Math.pow(2, Math.max(-0.4, (25 - tempC) / 22));
  const packR = (car, tempC = 25) => car.s * car.cellR / car.p * tempRFactor(tempC) + 0.006; // + busbars, contactors
  const packAh = (car) => car.p * car.cellAh;

  /** Solve the pack for a requested terminal power (W). Returns current, terminal voltage, heat. */
  function packAtPower(car, soc, P, tempC = 25) {
    const V0 = packOcv(car, soc), R = packR(car, tempC);
    const disc = V0 * V0 - 4 * R * P;
    const pMax = V0 * V0 / (4 * R);
    const I = disc >= 0 ? (V0 - Math.sqrt(disc)) / (2 * R) : V0 / (2 * R);
    return { I, V: V0 - I * R, V0, R, heat: I * I * R, pMax, ok: disc >= 0 };
  }

  /* ---------------------------------------------------------------- charging */
  // DC fast-charge power the pack will accept (kW) vs state of charge, warm battery, 250 kW-class charger.
  const DC_CURVE = {
    lr: [[0, 170], [0.03, 250], [0.2, 250], [0.3, 190], [0.4, 152], [0.5, 126], [0.6, 102], [0.7, 80], [0.8, 60], [0.9, 38], [0.95, 26], [1, 6]],
    perf: [[0, 170], [0.03, 250], [0.22, 250], [0.3, 200], [0.4, 158], [0.5, 130], [0.6, 105], [0.7, 82], [0.8, 62], [0.9, 40], [0.95, 27], [1, 6]],
    rwd: [[0, 130], [0.03, 175], [0.25, 172], [0.35, 140], [0.45, 118], [0.55, 100], [0.65, 86], [0.75, 70], [0.85, 52], [0.93, 36], [0.98, 20], [1, 5]],
  };
  // Cold (and very hot) cells cannot accept fast charging: fraction of full rate allowed vs battery temperature.
  const DC_TEMP = [[-20, 0.06], [-10, 0.16], [0, 0.34], [10, 0.6], [20, 0.88], [28, 1], [48, 1], [55, 0.7]];

  /** Power into the battery (kW) at a given SoC. o: { charger (kW limit), tempC (battery), ac (bool) } */
  function chargePower(car, soc, o = {}) {
    if (soc >= 1) return 0;
    if (o.ac) {
      const p = Math.min(o.charger == null ? 11 : o.charger, 11) * 0.9;   // on-board charger ~90 % efficient
      return soc > 0.97 ? p * clamp((1 - soc) / 0.03, 0.08, 1) : p;
    }
    const curve = interp(DC_CURVE[car.key], soc);
    const tf = interp(DC_TEMP, o.tempC == null ? 30 : o.tempC);
    return Math.min(curve, o.charger == null ? 250 : o.charger, 250 * tf);
  }

  /** Simulate a charging session. Returns time series and totals. */
  function chargeSession(car, o = {}) {
    const from = o.from == null ? 0.1 : o.from, to = o.to == null ? 0.8 : o.to;
    const E = car.usable;                         // kWh
    const dt = o.ac ? 30 : 2;                     // seconds
    let soc = from, t = 0;
    const out = { t: [], soc: [], p: [] };
    let guard = 0;
    while (soc < to && guard++ < 200000) {
      const p = chargePower(car, soc, o);
      if (guard % (o.ac ? 4 : 5) === 1) { out.t.push(t / 60); out.soc.push(soc * 100); out.p.push(p); }
      soc += p * dt / 3600 / E;
      t += dt;
    }
    out.t.push(t / 60); out.soc.push(Math.min(soc, to) * 100); out.p.push(chargePower(car, Math.min(soc, to), o));
    out.minutes = t / 60;
    out.kWh = (to - from) * E;
    out.avgKW = out.kWh / (t / 3600 || 1);
    return out;
  }

  /* ------------------------------------------------------------------ climate */
  /** Heating COP of the heat pump vs outside temperature: a fraction of the Carnot limit. */
  function copHeat(tAmb, tCabin = 21) {
    const Th = tCabin + 25 + 273.15, Tc = tAmb - 8 + 273.15;
    const carnot = Th / Math.max(8, Th - Tc);
    const frac = tAmb >= -10 ? 0.45 : lerp(0.45, 0.3, clamp((-10 - tAmb) / 20, 0, 1));
    return { carnot, cop: clamp(frac * carnot, 1, 5) };
  }
  function copCool(tAmb) {
    const Tc = 5 + 273.15, Th = tAmb + 12 + 273.15;
    const carnot = Tc / Math.max(8, Th - Tc);
    return { carnot, cop: clamp(0.45 * carnot, 1, 5) };
  }
  /**
   * Steady-state cabin climate load. Returns thermal demand (W, + heating / - cooling) and
   * electrical power with a heat pump or a resistive heater.
   */
  function climate(tAmb, o = {}) {
    const tSet = o.tSet == null ? 21 : o.tSet;
    const UA = 110;                                // W/K: glass + body conduction + fresh-air ventilation
    const gains = (o.sun == null ? 150 : o.sun) + 100;   // solar + occupants (W)
    const q = UA * (tSet - tAmb) - gains;
    if (q > 0) {
      const c = copHeat(tAmb, tSet);
      return { q, mode: 'heat', cop: c.cop, carnot: c.carnot, pHeatPump: q / c.cop, pResistive: q };
    }
    const c = copCool(Math.max(tAmb, tSet + 1));
    const qc = -q;
    return { q, mode: qc > 50 ? 'cool' : 'off', cop: c.cop, carnot: c.carnot, pHeatPump: qc / c.cop, pResistive: qc / c.cop };
  }
  /** Cold cells give up less of their energy (rough rule of thumb, battery not pre-heated). */
  const usableTempFactor = (tempC) => 1 - 0.004 * Math.max(0, 15 - tempC);

  /* -------------------------------------------------------------- consumption */
  /**
   * Steady-speed energy use.
   * o: { v (m/s), grade, wind, tempC, alt, payload, crrMul, cdaMul, hvac: 'off'|'heatpump'|'resistive', sun }
   * Returns powers in W and Wh/km split by where the energy goes.
   */
  function consumption(car, o) {
    const v = Math.max(o.v, 0.1);
    const mass = car.curb + (o.payload == null ? 75 : o.payload);
    const rl = roadLoad(car, Object.assign({}, o, { v, mass }));
    const dt = drivetrain(car, rl.total, v);
    let hvac = 0;
    if (o.hvac && o.hvac !== 'off') {
      const c = climate(o.tempC == null ? 20 : o.tempC, { sun: o.sun });
      hvac = o.hvac === 'resistive' ? c.pResistive : c.pHeatPump;
    }
    const aux = car.auxW;
    let pBatt = dt.Pel + aux + hvac;
    let regenCapped = 0;
    if (pBatt < -car.regenMax) { regenCapped = -car.regenMax - pBatt; pBatt = -car.regenMax; }
    const perKm = (p) => p / v / 3.6;              // W -> Wh/km
    return {
      v, mass, rl, dt, aux, hvac, pBatt, regenCapped,
      whkm: perKm(pBatt),
      parts: {                                     // Wh/km, only meaningful when driving forward under power
        aero: perKm(rl.aero * v), roll: perKm(rl.roll * v), grade: perKm(rl.grade * v),
        drivetrain: perKm(dt.loss.total), aux: perKm(aux), hvac: perKm(hvac),
      },
    };
  }

  /** Range (km) at steady conditions from a full usable pack. */
  function range(car, o) {
    const c = consumption(car, o);
    const e = car.usable * 1000 * usableTempFactor(o.tempC == null ? 20 : o.tempC) * (o.socWindow || 1);
    return c.whkm > 0 ? e / c.whkm : Infinity;
  }

  /* -------------------------------------------------------------- acceleration */
  /**
   * Full-throttle run from rest. o: { mu, grade, payload, tempC, soc, tMax, vStop (m/s), gear }
   * Integrates F = m a with motor limits, per-axle grip limits and weight transfer.
   */
  function accelRun(car0, o = {}) {
    const car = o.gear ? Object.assign({}, car0, { gear: o.gear }) : car0;
    const mass = car.curb + (o.payload == null ? 75 : o.payload);
    const mu = o.mu == null ? car.mu : o.mu;
    const mEff = mass * car.rot;
    const dt = 0.005, tMax = o.tMax || 40;
    const vCap = Math.min(car.vMax / 3.6, vOf(car, car.rpmMax * Math.PI / 30));
    const vStop = Math.min(o.vStop || vCap, vCap);
    const out = { t: [], v: [], a: [], x: [], pw: [], lim: [], marks: {} };
    let v = 0, x = 0, t = 0, i = 0;
    const want = [[50, 't50'], [100, 't100'], [150, 't150'], [200, 't200']];
    while (t <= tMax) {
      const w = wOf(car, v);
      const Fm = torqueMax(car, w, o.soc) * car.gear * car.etaGear / car.rWheel;
      const rl = roadLoad(car, { v, grade: o.grade || 0, mass, tempC: o.tempC });
      let F = Fm, a = (F - rl.total) / mEff, lim = 'motor';
      for (let k = 0; k < 5; k++) {
        const dFz = mass * a * car.cgH / car.wheelbase;                  // load shifts rearward under acceleration
        const capR = mu * Math.max(0, mass * G * car.rearStatic + dFz);
        const capF = mu * Math.max(0, mass * G * (1 - car.rearStatic) - dFz);
        const Fr = Math.min(Fm * (1 - car.frontShare), capR);
        const Ff = Math.min(Fm * car.frontShare, capF);
        F = Fr + Ff;
        a = (F - rl.total) / mEff;
      }
      if (F < Fm - 1) lim = 'grip';
      else lim = car.tPeak * w < car.pPeak ? 'torque' : 'power';
      if (v >= vCap - 0.01) { a = 0; lim = 'vmax'; }
      if (i % 4 === 0) { out.t.push(t); out.v.push(v * 3.6); out.a.push(a / G); out.x.push(x); out.pw.push(F * v / 1000); out.lim.push(lim); }
      for (const [kmh, key] of want) if (out.marks[key] == null && v * 3.6 >= kmh) out.marks[key] = t;
      if (out.marks.t400 == null && x >= 402.3) { out.marks.t400 = t; out.marks.v400 = v * 3.6; }
      if (v >= vStop && (o.vStop || t > 0.5 && a <= 0)) break;
      v = Math.min(vCap, Math.max(0, v + a * dt)); x += v * dt; t += dt; i++;
      if (a <= 0 && v < 0.01 && t > 1) break;                            // cannot move (too steep / no grip)
    }
    out.vTop = v * 3.6;
    return out;
  }

  /** Wheel force available vs speed (N): the tractive-effort curve. */
  function tractiveForce(car, v, soc) {
    const w = wOf(car, v);
    if (w > car.rpmMax * Math.PI / 30) return 0;
    return torqueMax(car, w, soc) * car.gear * car.etaGear / car.rWheel;
  }

  /* ---------------------------------------------------------------- selection */
  let current = 'lr';
  const listeners = [];
  EV.G = G;
  EV.variants = VARIANTS;
  EV.car = () => VARIANTS[current];
  EV.setVariant = (k) => { if (VARIANTS[k] && k !== current) { current = k; listeners.forEach((f) => f(VARIANTS[k])); } };
  EV.onVariant = (f) => { listeners.push(f); };
  EV.phys = {
    G, clamp, lerp, interp, rho, crrTempFactor, roadLoad, wOf, vOf, torqueMax, motorLoss, motorEff, drivetrain,
    OCV, cellOcv, packOcv, packR, packAh, packAtPower, tempRFactor, DC_CURVE, DC_TEMP, chargePower, chargeSession,
    copHeat, copCool, climate, usableTempFactor, consumption, range, accelRun, tractiveForce,
  };
})(typeof window !== 'undefined' ? window : globalThis);
