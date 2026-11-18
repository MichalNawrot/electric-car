/* Chapter 10 — Regenerative braking: the motor as generator, how much comes back, its limits, stop-and-go driving. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, G = P.G, { clamp } = P;
  const TAU = Math.PI * 2;

  /** Energy that actually ends up stored (or is actually drawn) once the cells' own I²R heat is counted. */
  const stored = (car, p) => (p > 0 ? p - P.packAtPower(car, 0.6, -p).heat : 0);
  const drawn = (car, p) => (p > 0 ? p + P.packAtPower(car, 0.6, p).heat : p);

  const regenForce = P.regenForce;
  /** Simulate one stop from v0 at constant deceleration a (m/s²). regen=false -> friction brakes only. */
  function stop(car, v0, a, o = {}) {
    const mass = car.curb + 75, mEff = mass * car.rot, dt = 0.02, limitW = o.limit == null ? car.regenMax : o.limit;
    const out = { t: [], pRegen: [], pFric: [], v: [], eRoad: 0, eFric: 0, eWheel: 0, eBatt: 0, e0: 0.5 * mEff * v0 * v0, dist: 0, time: 0 };
    let v = v0, t = 0, i = 0;
    while (v > 0.05) {
      const rl = P.roadLoad(car, { v, mass }), need = Math.max(0, mEff * a - rl.total);
      let Fr = 0, pB = 0;
      if (o.regen !== false && need > 0) { const r = regenForce(car, v, mass, limitW); Fr = Math.min(need, r.F); pB = Fr > 0 ? Math.max(0, -P.drivetrain(car, -Fr, v).Pel) : 0; }
      const Ff = need - Fr;
      if (i++ % 5 === 0) { out.t.push(t); out.pRegen.push(Fr * v / 1000); out.pFric.push(Ff * v / 1000); out.v.push(v * 3.6); }
      out.eRoad += Math.min(rl.total, mEff * a) * v * dt; out.eFric += Ff * v * dt; out.eWheel += Fr * v * dt; out.eBatt += stored(car, pB) * dt;
      out.dist += v * dt; v -= a * dt; t += dt;
    }
    out.t.push(t); out.pRegen.push(0); out.pFric.push(0); out.v.push(0); out.time = t;
    return out;
  }
  /** One stop-and-go cycle of length Lm: accelerate to v, cruise, brake to rest. Returns energy trace along the cycle. */
  function cycle(car, vKmh, Lm, regen) {
    const mass = car.curb + 75, mEff = mass * car.rot, a = 1.5, dt = 0.05, vT = vKmh / 3.6;
    const x = [0], e = [0], sp = [0];
    let v = 0, d = 0, E = 0, phase = 0, n = 0, eTrac = 0, eBack = 0;
    while (d < Lm && n++ < 40000) {
      if (phase === 0 && v >= vT) phase = 1;
      if (phase < 2 && Lm - d <= v * v / (2 * a) + 0.01) phase = 2;
      const rl = P.roadLoad(car, { v, mass });
      let pB;
      if (phase === 0) { pB = drawn(car, P.drivetrain(car, mEff * a + rl.total, Math.max(v, 0.3)).Pel); v += a * dt; eTrac += pB * dt; }
      else if (phase === 1) { pB = drawn(car, P.drivetrain(car, rl.total, v).Pel); eTrac += pB * dt; }
      else {
        const need = Math.max(0, mEff * a - rl.total); let got = 0;
        if (regen && need > 0) { const r = regenForce(car, v, mass, car.regenMax), Fr = Math.min(need, r.F); got = Fr > 0 ? stored(car, Math.max(0, -P.drivetrain(car, -Fr, v).Pel)) : 0; }
        pB = -got; eBack += got * dt; v = Math.max(0, v - a * dt);
        if (v <= 0) { d = Lm; }
      }
      E += (pB + car.auxW) * dt; d += v * dt;
      if (n % 4 === 0 || d >= Lm) { x.push(Math.min(d, Lm)); e.push(E / 3600); sp.push(v * 3.6); }
    }
    return { x, e, sp, wh: E / 3600, eTrac: eTrac / 3600, eBack: eBack / 3600 };
  }

  EV.chapter({
    id: 'regen', n: '10', title: 'Regenerative braking', nav: 'Regeneration', color: 's6',
    blurb: 'The motor runs backwards as a generator and returns kinetic energy to the battery. How much comes back, what stops it, and why city driving suits an electric car.',
    lead: 'A friction brake is a machine for turning motion into heat and throwing it away. An electric car has a second way to slow down: ask the motor for negative torque, and let the car\'s motion drive current back into the battery.',
    html(car) {
      const m = car.curb + 75, s100 = stop(car, 100 / 3.6, 0.2 * G), ke = (kmh) => 0.5 * m * car.rot * (kmh / 3.6) ** 2 / 3600;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>The same motor and inverter work in both directions. Negative torque at positive speed means negative power: energy flows from the wheels to the battery.</li>
        <li>Regeneration cannot return everything. Air and tyres take their share during the stop, and the drivetrain loses a few percent each way.</li>
        <li>Regeneration has a <strong>power ceiling</strong> set by the battery and a <strong>force ceiling</strong> set by stability. Anything above them goes to the friction brakes.</li>
        <li>Braking power is force × speed, so a hard stop from high speed exceeds the ceiling at first and falls under it as the car slows.</li>
        <li>In stop-and-go traffic, regeneration cuts energy use by a quarter or more.</li>
      </ul></div>

      <h2><span class="n">10.1</span>One machine, two directions</h2>
      <p>Chapter 5 ended with ${M`E \cdot I = T \cdot \omega`}: the electrical power absorbed by the motor's back-EMF equals the mechanical power it delivers. The equation has no preferred direction. If the inverter times its currents so the stator field pulls the rotor <em>backward</em> instead of forward, torque is negative, mechanical power ${M`T \omega`} is negative, and so is the electrical power: current flows out of the motor, through the inverter's diodes and transistors, into the battery.</p>
      <p>No hardware changes. Nothing is switched over. The only difference between driving and regenerating is the angle between the stator field and the rotor: the field leads the rotor to drive it, and lags it to brake it. Move the pedal below and watch the power turn round.</p>
      <div data-fig="quad"></div>
      <p>This is the principle behind <em class="t">one-pedal driving</em>. The accelerator does not command throttle opening as in a petrol car. It commands torque, positive or negative. Press for drive, lift for regeneration, and somewhere between is a position where the car coasts.</p>

      <h2><span class="n">10.2</span>How much of the kinetic energy comes back?</h2>
      <p>At 100 km/h the ${car.name} carries ${fmt(ke(100))} Wh of kinetic energy. During a gentle stop it is shared out like this:</p>
      <ol>
        <li><strong>Air and tyres</strong> keep taking their force for as long as the car is moving. The gentler the stop, the longer it lasts and the more they take. This energy is not wasted: it is distance covered without drawing on the battery.</li>
        <li>What remains reaches the motors as mechanical power. <strong>Gearbox, motor, inverter and the cells themselves</strong> each turn a few percent of it into heat.</li>
        <li>The rest is <strong>stored</strong>. In the example stop from 100 km/h at 0.2 g that is ${fmt(s100.eBatt / 3600)} Wh, ${fmt(s100.eBatt / s100.e0 * 100)}% of the kinetic energy.</li>
        <li>If the stop is too hard for regeneration alone, the <strong>friction brakes</strong> take the excess as heat.</li>
      </ol>
      <div data-fig="stop"></div>
      <p>The graph makes one thing plain. Braking power is force times speed, so it is highest at the start of a stop and falls to zero at the end. A hard stop from motorway speed begins far above what the battery can absorb, and most of the energy is gone into the discs before the power drops under the ceiling. Gentle, early braking keeps the whole stop below it.</p>

      <h2><span class="n">10.3</span>What limits regeneration</h2>
      <div class="grid2">
        <div class="card"><h4>The battery's appetite</h4><p>Regeneration is charging, and the rules of Chapter 8 apply. A warm, half-full pack takes about ${fmt(car.regenMax / 1000)} kW. A cold pack or a nearly full one takes much less, because forcing lithium into cold or full graphite risks plating. This is why regeneration is weak on a winter morning or just after charging to 100%.</p></div>
        <div class="card"><h4>Stability</h4><p>Braking with the motors brakes only the driven wheels. ${car.drive === 'AWD' ? 'With two motors the car can share it between axles, but' : 'On a rear-drive car that means the rear wheels only, and'} braking shifts load to the front (Chapter 9), so too much rear braking would make the car unstable. Regenerative deceleration is therefore capped at roughly 0.2–0.3 g.</p></div>
        <div class="card"><h4>Very low speed</h4><p>The power available to recover falls with speed, while the losses in motor and inverter do not vanish. Below walking pace regeneration returns almost nothing; the car holds itself with a little motor torque or the friction brakes.</p></div>
        <div class="card"><h4>Emergency stops</h4><p>A full stop at 1 g from 130 km/h needs over 700 kW of braking power at first. No battery can take that. Friction brakes, which can turn megawatts into heat for a few seconds, remain essential.</p></div>
      </div>

      <h2><span class="n">10.4</span>Stop and go</h2>
      <p>On the motorway the car rarely brakes, and regeneration barely matters. In town it changes everything. Every traffic light, in a car with friction brakes only, throws away all the kinetic energy the motor has just paid for. With regeneration the same energy makes a round trip: battery to wheels at about 90%, wheels to battery at about 85–90%, so three quarters or more of it returns.</p>
      <div data-fig="city"></div>
      <p>This is why electric cars reverse the pattern of petrol cars, which are thirstiest in town. An EV's consumption is lowest in slow urban traffic, where drag is small and the stops are nearly free, and highest on the motorway.</p>
      <div class="callout myth"><h5>Common misconception</h5><p>"More regeneration is always more efficient." Regeneration is a round trip with losses. It is better than friction braking, but coasting, when it achieves the same thing, is better still: the kinetic energy carries the car forward directly, with no conversion at all. The most efficient driver anticipates, lifts early, and uses regeneration only for the slowing that cannot be avoided.</p></div>`;
    },

    init(root, car) {
      const m0 = car.curb + 75;
      /* -------------------------------------------------------------- quad -- */
      const f = EV.fig(root, 'quad', { side: true, title: 'Driving and regenerating', hint: 'Left: where the power is flowing. Right: the operating point on the force-speed plane. Above the line the motors drive; below it they generate.',
        cap: '<b>Try this.</b> At 80 km/h, sweep the pedal from 100% to 0%. Find the pedal position where no power flows. Then repeat at 10 km/h and at 180 km/h.' });
      const QC = EV.canvas(f.stage, { ratio: 0.6, minH: 300, maxH: 420, label: 'Power flow between battery, inverter, motor and wheels, and the operating point' });
      const QR = EV.readouts(f.out, { F: ['Force at the wheels', 'kN'], pw: ['Power at the wheels', 'kW'], pb: ['Power at the battery', 'kW', 's1'], loss: ['Lost as heat', 'kW', 's5'], eta: ['Conversion efficiency', '%'], a: ['Acceleration', 'g'] });
      const qs = EV.controls(f.ctl, {
        pedal: { label: 'Accelerator pedal', min: 0, max: 100, step: 1, value: 0, unit: '%' },
        v: { label: 'Speed', min: 5, max: car.vMax, step: 5, value: 80, unit: 'km/h' },
      }, qUpd);
      let q = {}, qt = 0;
      function qUpd() {
        const v = qs.v / 3.6, Fmax = P.tractiveForce(car, v), rg = regenForce(car, v, m0, car.regenMax);
        const F = qs.pedal >= 20 ? Fmax * (qs.pedal - 20) / 80 : -rg.F * (1 - qs.pedal / 20);
        const d = P.drivetrain(car, F, v), rl = P.roadLoad(car, { v, mass: m0 });
        q = { v, F, Fmax, rgF: rg.F, d, acc: (F - rl.total) / (m0 * car.rot) };
        const eta = Math.abs(d.Pw) < 200 ? null : F > 0 ? d.Pw / d.Pel : d.Pel / d.Pw;
        QR({ F: fmt(F / 1000, 1), pw: fmt(d.Pw / 1000, 1), pb: fmt(d.Pel / 1000, 1), loss: fmt(d.loss.total / 1000, 1), eta: eta == null || eta < 0 ? '–' : fmt(eta * 100), a: fmt(q.acc / G, 2) });
      }
      function qDraw(t, dt) {
        const { ctx, w, h } = QC, col = EV.col; qt += dt;
        ctx.clearRect(0, 0, w, h);
        // ---- power-flow strip
        const names = ['Battery', 'Inverter', 'Motor', 'Wheels'], bw = Math.min(104, (w - 40) / 4 - 26), by = 20, bh = 50, gap = (w - 40 - 4 * bw) / 3;
        const dirn = Math.sign(q.d.Pw) || 0, pw = Math.abs(q.d.Pel), col2 = dirn >= 0 ? 's1' : 's6';
        for (let i = 0; i < 3; i++) {
          const xa = 20 + bw + i * (bw + gap), xb = xa + gap, y = by + bh / 2;
          ctx.strokeStyle = col('axis'); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(xa + 4, y); ctx.lineTo(xb - 4, y); ctx.stroke();
          if (dirn && pw > 300) {
            const n = 3, sp = 26 + Math.min(120, pw / 2500);
            ctx.fillStyle = col(col2);
            for (let j = 0; j < n; j++) { let u = ((qt * sp + j * gap / n) % gap); if (dirn < 0) u = gap - u; ctx.beginPath(); ctx.arc(xa + u, y, 4, 0, TAU); ctx.fill(); }
          }
        }
        names.forEach((nm, i) => {
          const x = 20 + i * (bw + gap);
          EV.rr(ctx, x, by, bw, bh, 9); ctx.fillStyle = i === 0 ? EV.rgba('s1', 0.18) : col('surface-2'); ctx.strokeStyle = i === 0 ? col('s1') : col('body-line'); ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
          EV.text(ctx, nm, x + bw / 2, by + 22, { size: 12.5, weight: 600, align: 'center', color: col('ink') });
          const val = [q.d.Pel, q.d.Pel, q.d.Pm, q.d.Pw][i] / 1000;
          EV.text(ctx, `${fmt(val, Math.abs(val) < 20 ? 1 : 0)} kW`, x + bw / 2, by + 40, { size: 11.5, align: 'center', mono: true, color: col('ink-2') });
        });
        EV.text(ctx, dirn > 0 ? 'energy flows to the wheels →' : dirn < 0 ? '← energy flows back to the battery' : 'coasting: no power flows', w / 2, by + bh + 20, { size: 12, weight: 600, align: 'center', color: col(dirn < 0 ? 's6' : 'ink') });
        // ---- force-speed plane
        const x0 = 50, x1 = w - 16, y0 = by + bh + 40, y1 = h - 28, vmaxK = car.vMax, Ftop = P.tractiveForce(car, 0) * 1.08, Fbot = -0.34 * m0 * G;
        const X = (kmh) => x0 + (x1 - x0) * kmh / vmaxK, Y = (F) => y0 + (y1 - y0) * (Ftop - F) / (Ftop - Fbot);
        ctx.fillStyle = EV.rgba('s1', 0.08); ctx.beginPath(); ctx.moveTo(X(0), Y(0));
        for (let k = 0; k <= vmaxK; k += 2) ctx.lineTo(X(k), Y(P.tractiveForce(car, k / 3.6))); ctx.lineTo(X(vmaxK), Y(0)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = EV.rgba('s6', 0.1); ctx.beginPath(); ctx.moveTo(X(0), Y(0));
        for (let k = 0; k <= vmaxK; k += 2) ctx.lineTo(X(k), Y(-regenForce(car, k / 3.6, m0, car.regenMax).F)); ctx.lineTo(X(vmaxK), Y(0)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col('s1'); ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k <= vmaxK; k += 2) { const yy = Y(P.tractiveForce(car, k / 3.6)); if (k) ctx.lineTo(X(k), yy); else ctx.moveTo(X(k), yy); } ctx.stroke();
        ctx.strokeStyle = col('s6'); ctx.beginPath(); for (let k = 0; k <= vmaxK; k += 2) { const yy = Y(-regenForce(car, k / 3.6, m0, car.regenMax).F); if (k) ctx.lineTo(X(k), yy); else ctx.moveTo(X(k), yy); } ctx.stroke();
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k <= vmaxK; k += 4) { const yy = Y(P.roadLoad(car, { v: k / 3.6, mass: m0 }).total); if (k) ctx.lineTo(X(k), yy); else ctx.moveTo(X(k), yy); } ctx.stroke(); ctx.setLineDash([]);
        EV.text(ctx, 'driving: force forward', X(vmaxK * 0.42), Y(Ftop * 0.62), { size: 11.5, color: col('ink-2') });
        EV.text(ctx, 'regenerating: force backward', X(vmaxK * 0.56), Y(Fbot * 0.82), { size: 11.5, color: col('ink-2') });
        EV.text(ctx, 'steady speed', X(vmaxK) - 4, Y(P.roadLoad(car, { v: vmaxK / 3.6, mass: m0 }).total) - 6, { size: 11, align: 'right', color: col('muted') });
        for (let k = 0; k <= vmaxK; k += 50) EV.text(ctx, String(k), X(k), y1 + 14, { size: 11, align: 'center', color: col('muted') });
        EV.text(ctx, 'km/h', x1, y1 + 26, { size: 11, align: 'right', color: col('muted') });
        EV.text(ctx, 'force', x0 - 6, y0 + 4, { size: 11, align: 'right', color: col('muted') });
        EV.text(ctx, '0', x0 - 6, Y(0) + 4, { size: 11, align: 'right', color: col('muted') });
        const px = X(qs.v), py = Y(q.F);
        ctx.strokeStyle = col('muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, Y(0)); ctx.lineTo(px, py); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fillStyle = col('surface'); ctx.fill(); ctx.beginPath(); ctx.arc(px, py, 6.5, 0, TAU); ctx.fillStyle = col(q.F >= 0 ? 's1' : 's6'); ctx.fill();
        EV.text(ctx, `${fmt(q.F / 1000, 1)} kN`, px + 12, py + (q.F >= 0 ? -8 : 16), { size: 12, weight: 600, color: col('ink'), halo: true, align: px > x1 - 80 ? 'right' : 'left' });
      }
      qUpd(); QC.draw = () => qDraw(0, 0); EV.loop(QC.cv, qDraw);

      /* -------------------------------------------------------------- stop -- */
      const g = EV.fig(root, 'stop', { side: true, title: 'Anatomy of one stop', hint: 'Braking power during the stop, split between the motors and the friction brakes, and where the car\'s kinetic energy ended up.',
        cap: '<b>Try this.</b> Stop from 130 km/h at 0.15 g, then at 0.8 g. Then set a cold battery and see the green area shrink to a sliver.' });
      const sp = EV.plot(g.stage, { h: 280, x: { label: 'Time since braking began (s)', min: 0, unit: 's' }, y: { label: 'Braking power at the wheels (kW)', min: 0, max: 'auto', unit: 'kW' } });
      const bh = document.createElement('div'); bh.style.marginTop = '10px'; g.stage.appendChild(bh);
      const sb = EV.segbar(bh, { title: 'Where the kinetic energy went', unit: 'Wh' });
      const SR = EV.readouts(g.out, { ke: ['Kinetic energy at the start', 'Wh'], back: ['Returned to the battery', 'Wh', 's6'], pc: ['Share returned', '%'], km: ['Worth this much town driving', 'm'], d: ['Stopping distance', 'm'], t: ['Stopping time', 's'] });
      const ss = EV.controls(g.ctl, {
        v: { label: 'Speed before braking', min: 30, max: 200, step: 5, value: 100, unit: 'km/h' },
        a: { label: 'Deceleration', min: 0.05, max: 1.0, step: 0.05, value: 0.2, unit: 'g' },
        lim: { type: 'seg', label: 'Battery', options: [['n', 'Warm, part full'], ['c', 'Cold or nearly full']], value: 'n' },
      }, sUpd);
      function sUpd() {
        const lim = ss.lim === 'n' ? car.regenMax : 15e3, r = stop(car, ss.v / 3.6, ss.a * G, { limit: lim });
        sp.set({
          xMax: r.time,
          series: [{ name: 'Regeneration', color: 's6', stack: true, pts: r.t.map((t, i) => [t, r.pRegen[i]]) }, { name: 'Friction brakes', color: 's8', stack: true, pts: r.t.map((t, i) => [t, r.pFric[i]]) }],
        });
        sb([{ label: 'Friction brakes', value: r.eFric / 3600, color: 's8' }, { label: 'Stored in the battery', value: r.eBatt / 3600, color: 's6' }, { label: 'Air and tyres', value: r.eRoad / 3600, color: 's1' }, { label: 'Drivetrain and battery heat', value: (r.eWheel - r.eBatt) / 3600, color: 's5' }], `${fmt(r.e0 / 3600)} Wh`);
        const town = P.consumption(car, { v: 50 / 3.6 }).whkm;
        SR({ ke: fmt(r.e0 / 3600), back: fmt(r.eBatt / 3600), pc: fmt(r.eBatt / r.e0 * 100), km: fmt(Math.round(r.eBatt / 3600 / town * 100) * 10), d: fmt(r.dist), t: fmt(r.time, 1) });
      }
      sUpd();

      /* -------------------------------------------------------------- city -- */
      const c = EV.fig(root, 'city', { side: true, title: 'One kilometre of city driving', hint: 'Accelerate, cruise, brake to a stop, repeat. Energy drawn from the battery along the way, with regeneration and with friction brakes only.',
        cap: '<b>Try this.</b> Set zero stops and the two lines coincide: with no braking there is nothing to recover. Add stops and they separate by the kinetic energy of each one.' });
      const vp = EV.plot(c.stage, { h: 150, x: { label: '', min: 0, max: 1000, unit: 'm' }, y: { label: 'Speed (km/h)', min: 0, max: 'auto', unit: 'km/h' }, legend: false, table: false });
      const ep = EV.plot(c.stage, { h: 250, x: { label: 'Distance (m)', min: 0, max: 1000, unit: 'm' }, y: { label: 'Energy drawn from the battery so far (Wh)', min: 0, max: 'auto', unit: 'Wh' } });
      const CR = EV.readouts(c.out, { w: ['With regeneration', 'Wh/km', 's6'], wo: ['Friction brakes only', 'Wh/km', 's8'], save: ['Energy saved', '%'], rec: ['Share of traction energy returned', '%'] });
      const cs = EV.controls(c.ctl, {
        v: { label: 'Cruising speed', min: 20, max: 90, step: 5, value: 50, unit: 'km/h' },
        n: { label: 'Stops per kilometre', min: 0, max: 6, step: 1, value: 3 },
      }, cUpd);
      function cUpd() {
        const n = cs.n, L = n ? 1000 / n : 1000;
        const build = (regen) => {
          if (!n) { const k = P.consumption(car, { v: cs.v / 3.6 }); return { pts: [[0, 0], [1000, k.whkm]], sp: [[0, cs.v], [1000, cs.v]], wh: k.whkm, eTrac: k.whkm, eBack: 0 }; }
          const one = cycle(car, cs.v, L, regen), pts = [], spd = [];
          for (let i = 0; i < n; i++) one.x.forEach((x, j) => { pts.push([i * L + x, i * one.wh + one.e[j]]); spd.push([i * L + x, one.sp[j]]); });
          return { pts, sp: spd, wh: one.wh * n, eTrac: one.eTrac * n, eBack: one.eBack * n };
        };
        const a = build(true), b = build(false);
        vp.set({ series: [{ name: 'Speed', color: 'ink-2', pts: a.sp, area: true }] });
        ep.set({ series: [{ name: 'Friction brakes only', color: 's8', pts: b.pts }, { name: 'With regeneration', color: 's6', pts: a.pts }] });
        CR({ w: fmt(a.wh), wo: fmt(b.wh), save: fmt((1 - a.wh / b.wh) * 100), rec: a.eTrac > 0 ? fmt(a.eBack / a.eTrac * 100) : '0' });
      }
      cUpd();
    },

    quiz: (car) => [
      { q: 'What physically changes inside the drive unit when the car switches from driving to regenerating?', o: ['A clutch connects a separate generator', 'The battery polarity is reversed', 'Only the timing of the inverter currents: the stator field now lags the rotor instead of leading it', 'The gearbox selects a different ratio'], a: 2, why: 'The motor is a reversible machine. Torque direction is set by the angle between the stator field and the rotor, which the inverter controls electronically. Nothing mechanical is switched.' },
      { q: `A ${fmt(car.curb + 75)} kg car brakes at a constant 0.3 g. At which moment is the braking power largest?`, o: ['At the start, when the speed is highest', 'In the middle of the stop', 'Just before it comes to rest', 'It is constant throughout'], a: 0, why: 'Power = force × speed. The force is constant, so power is proportional to speed: greatest at the start and falling linearly to zero.' },
      { q: 'Why is regenerative braking weak right after charging the battery to 100%?', o: ['The motor is too hot', 'A full battery has no room for more charge, so the car limits the charging current', 'The tyres have less grip', 'The inverter is switched off'], a: 1, why: 'Regeneration is charging. A cell at its voltage ceiling cannot accept more current without over-voltage or lithium plating, so the car cuts regeneration and uses the friction brakes instead.' },
      { q: 'In which kind of driving does regeneration save the largest share of energy?', o: ['Steady motorway cruising', 'Stop-and-go city traffic', 'A long gentle climb', 'High-speed driving on a track'], a: 1, why: 'Regeneration recovers kinetic (and potential) energy when slowing down. Steady cruising has no slowing down, so there is nothing to recover; city driving is mostly speeding up and slowing down.' },
      { q: 'You see a red light 300 m ahead. Which is the most efficient way to deal with it?', o: ['Keep speed, then brake hard at the end', 'Keep speed, then use maximum regeneration', 'Lift early and let the car lose speed gently, coasting where possible', 'Accelerate to get there sooner'], a: 2, why: 'Kinetic energy that carries the car forward directly is used at 100%. Regenerated energy makes a round trip through the drivetrain and returns at 75–80%. Friction braking returns 0%.' },
    ],
  });
})();
