/* Chapter 12 — Drive simulator: every model in the guide running at once. */
(function () {
  'use strict';
  const EV = window.EV, { M, fmt } = EV, P = EV.phys, G = P.G, { clamp } = P;
  const TAU = Math.PI * 2;

  const ROUTES = {
    flat: { name: 'Flat motorway', limit: 130, h: () => 0, slope: () => 0 },
    hills: { name: 'Rolling hills', limit: 100, h: (x) => 45 * Math.sin(TAU * x / 6000) + 12 * Math.sin(TAU * x / 1900), slope: (x) => 45 * TAU / 6000 * Math.cos(TAU * x / 6000) + 12 * TAU / 1900 * Math.cos(TAU * x / 1900) },
    pass: { name: 'Mountain pass', limit: 80, h: (x) => 300 * (1 - Math.cos(TAU * x / 18000)), slope: (x) => 300 * TAU / 18000 * Math.sin(TAU * x / 18000) },
    city: { name: 'City streets', limit: 50, h: () => 0, slope: () => 0, stops: 400 },
  };

  EV.chapter({
    id: 'sim', n: '12', title: 'Drive it: the simulator', nav: 'Drive simulator', color: 's8',
    blurb: 'Every chapter running at once. Pick a road, set the conditions, and watch forces, power and energy play out in real time.',
    lead: 'Each earlier chapter isolated one piece of physics. On a real road they all act together, every instant. This simulator runs the full model of the car in real time, and keeps the accounts.',
    html(car) {
      return `
      <div class="keys"><h4>How to use it</h4><ul>
        <li><strong>Choose a road</strong> and let cruise control drive, or switch to the pedal and drive it yourself (the <span class="kbd">↑</span> <span class="kbd">↓</span> keys work once you have clicked the scene).</li>
        <li><strong>Watch three things</strong>: the force arrows on the car, the power flowing between battery and wheels, and the ledger of where the energy has gone.</li>
        <li><strong>Speed up time</strong> for long climbs. The physics is computed at the same resolution; only the clock runs faster.</li>
      </ul></div>

      <div data-fig="sim"></div>

      <h2><span class="n">12.1</span>Experiments to run</h2>
      <p>Make a prediction first, then run each one and see whether the ledger agrees with you.</p>
      <div class="grid2">
        <div class="card"><h4>1 · The price of speed</h4><p>Flat motorway, cruise at 100 km/h for a few kilometres, note the consumption, reset, repeat at 130 and 160. Which bar of the ledger grows? By what factor does the air share change between 100 and 130?</p><p class="small">Chapters 1 to 3: drag force grows with v², so the air energy per km at 130 is about 1.7 times that at 100.</p></div>
        <div class="card"><h4>2 · Borrowing from gravity</h4><p>Mountain pass at 80 km/h, time ×20. Watch the state of charge fall on the way up and the power turn negative on the way down. After one full up-and-down, compare the average consumption with a flat road at the same speed.</p><p class="small">Chapter 2: the climb is a loan. Most of it is repaid.</p></div>
        <div class="card"><h4>3 · City accounting</h4><p>City streets under cruise control. The car stops at every light. Look at how much energy regeneration has returned, and how small the friction-brake segment is. Then take the pedal yourself, brake late and hard, and watch that segment grow.</p><p class="small">Chapter 10: braking power is force × speed, and the battery has a ceiling.</p></div>
        <div class="card"><h4>4 · Winter</h4><p>Any road, set −15 °C. Three things change at once: the arrows for air and tyres grow, the electronics-and-climate segment appears in the ledger, and regeneration on the descent is weaker because the battery is cold.</p><p class="small">Chapters 3, 4, 7 and 11.</p></div>
        <div class="card"><h4>5 · Full throttle</h4><p>Flat road, pedal to +100% from rest. The drive arrow starts long and constant, then shrinks as the car passes the base speed and becomes power-limited. Watch the battery power settle at its peak while the acceleration fades.</p><p class="small">Chapters 5 and 9: constant torque, then constant power.</p></div>
        <div class="card"><h4>6 · Coasting</h4><p>Reach 130 km/h, then set the pedal to exactly 0. Nothing drives the car and nothing brakes it. Time how long it takes to fall to 60 km/h. That glide is the kinetic energy being spent against a few hundred newtons.</p><p class="small">Chapter 1: the coast-down test.</p></div>
      </div>

      <h2><span class="n">12.2</span>The whole picture</h2>
      <p>If you remember one paragraph from this guide, make it this one.</p>
      <div class="callout y"><h5>An electric car in seven sentences</h5>
        <p>A battery holds lithium at high energy in graphite and releases that energy as the lithium moves to the cathode, driving electrons round an external circuit. An inverter chops the battery's direct current into three alternating currents whose frequency sets the motor's speed and whose size sets its torque. Those currents make a magnetic field that rotates inside the motor and drags a magnet rotor round with it. A single fixed gear multiplies that torque, and four hand-sized patches of rubber turn it into force on the road. Most of that force is spent pushing air aside, a cost that grows with the square of speed, and the rest flexing the tyres and lifting the car up hills. When the car slows down or descends, the same motor runs as a generator and returns most of that energy. And because the drivetrain wastes so little, what an engine would have given away as heat must be collected with a heat pump or made on purpose.</p></div>
      <p>From here the <a href="#/ref">cheat sheet</a> gathers every formula and number in one place.</p>`;
    },

    init(root, car) {
      const f = EV.fig(root, 'sim', { side: true, title: `${car.name} on the road`, hint: 'Arrow lengths are compressed so small and large forces fit together; the numbers beside them are exact.' });
      const C = EV.canvas(f.stage, { ratio: 0.56, minH: 300, maxH: 420, label: 'Driving scene with the car, the road, force arrows and power flow' });
      C.cv.tabIndex = 0; C.cv.style.outline = 'none';
      const ledHost = document.createElement('div'); ledHost.style.margin = '10px 0 4px'; f.stage.appendChild(ledHost);
      const ledger = EV.segbar(ledHost, { title: 'Where the energy drawn from the battery has gone', unit: 'Wh' });
      const note = EV.el('<div class="small" style="margin:6px 0 10px"></div>'); f.stage.appendChild(note);
      const sp = EV.plot(f.stage, { h: 170, x: { label: '', min: 0, unit: 'km' }, y: { label: 'Speed (km/h)', min: 0, max: 'auto', unit: 'km/h', minMax: 60 }, legend: false, table: false });
      const pp = EV.plot(f.stage, { h: 190, x: { label: 'Distance (km)', min: 0, unit: 'km' }, y: { label: 'Battery power (kW): above zero drains, below zero charges', min: 'auto', max: 'auto', unit: 'kW' }, legend: false, table: false });
      const R = EV.readouts(f.out, { v: ['Speed', 'km/h'], p: ['Battery power', 'kW', 's1'], soc: ['State of charge', '%'], now: ['Consumption now', 'Wh/km'], avg: ['Trip average', 'Wh/km'], rng: ['Range at this average', 'km'], d: ['Distance', 'km'], alt: ['Height above start', 'm'], t: ['Time', ''] });
      const s = EV.controls(f.ctl, {
        route: { type: 'seg', label: 'Road', options: Object.entries(ROUTES).map(([k, r]) => [k, r.name]), value: 'hills' },
        mode: { type: 'seg', label: 'Driver', options: [['cc', 'Cruise control'], ['man', 'Pedal']], value: 'cc' },
        cruise: { label: 'Cruise speed', min: 0, max: car.vMax, step: 5, value: 100, unit: 'km/h' },
        pedal: { label: 'Pedal: brake (−) / drive (+)', min: -100, max: 100, step: 5, value: 30, unit: '%' },
        temp: { label: 'Outside temperature', min: -20, max: 40, step: 1, value: 20, unit: '°C' },
        warp: { type: 'seg', label: 'Clock', options: [['1', 'Real time'], ['5', '× 5'], ['20', '× 20']], value: '1' },
      }, (st, key) => { if (key === 'route') { s.set('cruise', ROUTES[s.route].limit, true); reset(); } });
      const btn = EV.el('<div class="btn-row"><button type="button" class="btn pri">Reset the trip</button></div>');
      btn.firstElementChild.addEventListener('click', reset);
      f.ctl.appendChild(btn);

      const mass = car.curb + 75, mEff = mass * car.rot;
      let S, hist, spin = 0, lastPlot = 0, lastHud = 0;
      function reset() {
        S = { x: 0, v: 0, t: 0, soc: 0.8, a: 0, F: 0, Ff: 0, rl: { aero: 0, roll: 0, grade: 0, total: 0 }, d: { Pel: 0, Pm: 0, Pw: 0, loss: { total: 0 } }, pB: 0, wait: 0, nextStop: ROUTES[s.route].stops || 0,
          e: { roll: 0, aero: 0, pe: 0, dt: 0, aux: 0, fric: 0 }, out: 0, back: 0 };
        hist = { x: [0], v: [0], p: [0] }; lastPlot = -1;
        plots();
      }
      function step(dt) {
        const R0 = ROUTES[s.route], grade = R0.slope(S.x), v = S.v;
        const rl = P.roadLoad(car, { v, grade, mass, tempC: s.temp });
        const Fmax = Math.min(P.tractiveForce(car, v, S.soc), car.drive === 'AWD' ? car.mu * mass * G : car.mu * mass * G * car.rearStatic / (1 - car.mu * car.cgH / car.wheelbase));
        let Freq;
        if (s.mode === 'cc') {
          let target = s.cruise / 3.6;
          if (R0.stops) {                                             // a red light every few hundred metres
            const dist = S.nextStop - S.x;
            if (S.wait > 0) { target = 0; S.wait -= dt; if (S.wait <= 0) S.nextStop += R0.stops; }
            else { target = Math.min(target, Math.sqrt(Math.max(0, 2 * 1.4 * (dist - 1.5)))); if (dist < 2.5 && v < 0.4) S.wait = 3; }
          }
          Freq = mEff * clamp(0.9 * (target - v), -2.6, 2.2) + rl.total;
          if (target === 0 && v < 0.05) Freq = Math.max(0, rl.grade);
        } else Freq = s.pedal >= 0 ? s.pedal / 100 * Fmax : s.pedal / 100 * mass * G * 0.95;
        let F, Ff = 0;
        if (Freq >= 0) F = Math.min(Freq, Fmax);
        else { const rg = P.regenForce(car, v, mass, P.regenLimitW(car, S.soc, s.temp + 12)); const fr = Math.min(-Freq, rg.F); F = -fr; Ff = v > 0.05 ? -Freq - fr : 0; }
        let a = (F - Ff - rl.total) / mEff;
        if (v <= 0.02 && a < 0) { a = 0; }
        const d = P.drivetrain(car, F, Math.max(v, 0.01)), cl = P.climate(s.temp), hvac = Math.abs(s.temp - 21) > 4 ? cl.pHeatPump : 0;
        const pB = (v > 0.02 || F > 0 ? d.Pel : 0) + car.auxW + hvac, heat = P.packAtPower(car, S.soc, pB).heat;
        S.soc = clamp(S.soc - (pB + heat) * dt / (car.usable * 3.6e6 * P.usableTempFactor(s.temp)), 0, 1);
        S.e.roll += rl.roll * v * dt; S.e.aero += rl.aero * v * dt; S.e.pe += rl.grade * v * dt; S.e.fric += Ff * v * dt;
        S.e.dt += (d.loss.total + heat) * dt; S.e.aux += (car.auxW + hvac) * dt;
        if (pB + heat > 0) S.out += (pB + heat) * dt; else S.back += -(pB + heat) * dt;      // counted at the cells, so the ledger balances
        S.x += v * dt; S.v = Math.max(0, v + a * dt); S.t += dt; S.a = a; S.F = F; S.Ff = Ff; S.rl = rl; S.d = d; S.pB = pB; S.grade = grade;
        if (S.soc <= 0) S.v = Math.max(0, S.v - 3 * dt);
        if (S.x - hist.x[hist.x.length - 1] * 1000 >= 12 || S.t - (hist.tLast || 0) > 1.5) { hist.x.push(S.x / 1000); hist.v.push(S.v * 3.6); hist.p.push(pB / 1000); hist.tLast = S.t; if (hist.x.length > 2500) { hist.x.splice(0, 500); hist.v.splice(0, 500); hist.p.splice(0, 500); } }
      }
      function plots() {
        const x1 = Math.max(1, hist.x[hist.x.length - 1]), x0 = Math.max(0, x1 - 12);
        sp.set({ xMin: x0, xMax: x1, series: [{ name: 'Speed', color: 'ink-2', area: true, pts: hist.x.map((x, i) => [x, hist.v[i]]) }] });
        pp.set({ xMin: x0, xMax: x1, series: [{ name: 'Battery power', color: 's1', pts: hist.x.map((x, i) => [x, hist.p[i]]) }] });
      }
      function hud() {
        const ke = 0.5 * mEff * S.v * S.v, e = S.e, net = S.out - S.back, km = S.x / 1000;
        R({ v: fmt(S.v * 3.6), p: fmt(S.pB / 1000, Math.abs(S.pB) < 20000 ? 1 : 0), soc: fmt(S.soc * 100, 1), now: S.v > 1 ? fmt(clamp(S.pB / S.v / 3.6, -999, 999)) : '–', avg: km > 0.05 ? fmt(net / 3600 / km) : '–',
          rng: km > 0.2 && net > 0 ? fmt(S.soc * car.usable * 1000 * P.usableTempFactor(s.temp) / (net / 3600 / km)) : '–', d: fmt(km, 2), alt: fmt(ROUTES[s.route].h(S.x)), t: `${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, '0')}` });
        ledger([{ label: 'Tyres', value: e.roll / 3600, color: 's2' }, { label: 'Air', value: e.aero / 3600, color: 's1' }, { label: 'Height gained', value: Math.max(0, e.pe) / 3600, color: 's3' }, { label: 'Motion (now)', value: ke / 3600, color: 's4' },
          { label: 'Drivetrain + battery heat', value: e.dt / 3600, color: 's5' }, { label: 'Electronics + climate', value: e.aux / 3600, color: 's7' }, { label: 'Friction brakes', value: e.fric / 3600, color: 's8' }], `${fmt(net / 3600)} Wh net`);
        note.textContent = `Sent out of the battery: ${fmt(S.out / 3600)} Wh. Returned by regeneration: ${fmt(S.back / 3600)} Wh${S.out > 0 ? ` (${fmt(S.back / S.out * 100)}%)` : ''}.${S.soc <= 0 ? ' The battery is empty.' : ''}`;
      }
      const alen = (F, w) => Math.sign(F) * Math.min(26 * Math.sqrt(Math.abs(F) / 100), 270) * Math.min(1, w / 700);
      function draw(t, dt) {
        const n = +s.warp, h1 = Math.min(dt, 0.05);
        if (dt > 0) for (let i = 0; i < n; i++) step(h1);
        const { ctx, w, h } = C, col = EV.col, A = EV.art, R0 = ROUTES[s.route];
        const theta = Math.atan(S.grade || 0), sc = Math.min(0.42, w / 1000 * 0.6), cx = w * 0.4, cy = h * 0.78, vis = 11;
        spin += S.v * dt * n * 0.1 / 0.35;
        ctx.clearRect(0, 0, w, h);
        // distant hills (parallax)
        for (const [amp, per, par, tone] of [[26, 520, 0.6, 'surface-2'], [16, 300, 1.4, 'grid']]) {
          ctx.beginPath(); ctx.moveTo(0, cy);
          for (let x = 0; x <= w; x += 12) ctx.lineTo(x, cy - 60 - amp - amp * Math.sin((x + S.x * par) / per * TAU) - amp * 0.4 * Math.sin((x + S.x * par) / per * TAU * 2.7));
          ctx.lineTo(w, cy + 40); ctx.lineTo(0, cy + 40); ctx.closePath(); ctx.fillStyle = col(tone); ctx.fill();
        }
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-theta);
        ctx.fillStyle = col('surface'); ctx.fillRect(-w, 0, 2 * w, h);
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke();
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 3; ctx.setLineDash([24, 36]); ctx.lineDashOffset = (S.x * vis) % 60;
        ctx.beginPath(); ctx.moveTo(-w, 9); ctx.lineTo(w, 9); ctx.stroke(); ctx.setLineDash([]);
        // roadside posts every 50 m, and traffic lights in the city
        const first = Math.ceil((S.x - cx / vis - 5) / 50) * 50;
        for (let px = first; (px - S.x) * vis < w; px += 50) {
          const X = (px - S.x) * vis;
          ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, -16); ctx.stroke();
        }
        if (R0.stops) { const X = (S.nextStop - S.x) * vis; if (X < w) { ctx.strokeStyle = col('ink-2'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, -92); ctx.stroke(); EV.rr(ctx, X - 9, -122, 18, 34, 5); ctx.fillStyle = col('ink'); ctx.fill(); ctx.beginPath(); ctx.arc(X, S.wait > 0 || X > 40 ? -113 : -97, 5, 0, TAU); ctx.fillStyle = col(S.wait > 0 || X > 40 ? 's8' : 's6'); ctx.fill(); } }
        ctx.restore();
        A.drawCar(ctx, cx, cy, { scale: sc, angle: theta, spin, pitch: clamp(S.a * 0.012, -0.05, 0.05) });
        // force arrows in the road frame
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-theta);
        const nose = 474 * sc, rear = -289 * sc, front = 289 * sc, cg = -112 * sc, rl = S.rl;
        const lab = (txt, x, y, align) => EV.text(ctx, txt, x, y, { align, size: 11.5, weight: 600, color: col('ink'), halo: true });
        if (rl.aero > 5) { const L = alen(rl.aero, w), y = -150 * sc; EV.arrow(ctx, nose + 6 + L, y, nose + 6, y, col('s1'), 4, 10); lab(`air ${fmt(rl.aero)} N`, nose + 10, y - 9, 'left'); }
        if (rl.roll > 5) { const L = alen(rl.roll, w); EV.arrow(ctx, front, 20, front - L, 20, col('s2'), 4, 9); lab(`tyres ${fmt(rl.roll)} N`, front + 8, 24, 'left'); }
        if (Math.abs(rl.grade) > 20) { const L = alen(rl.grade, w); EV.arrow(ctx, 0, cg, -L, cg, col('s3'), 4, 10, true); lab(`gravity ${fmt(Math.abs(rl.grade))} N`, -L + (L > 0 ? -8 : 8), cg - 9, L > 0 ? 'right' : 'left'); }
        if (Math.abs(S.F) > 20) { const L = alen(S.F, w); EV.arrow(ctx, rear, 46, rear + L, 46, col(S.F > 0 ? 'ink' : 's6'), 5, 12); lab(`${S.F > 0 ? 'drive' : 'regen'} ${fmt(Math.abs(S.F))} N`, rear + L + (L > 0 ? 8 : -8), 50, L > 0 ? 'left' : 'right'); }
        if (S.Ff > 20) { const L = alen(S.Ff, w); EV.arrow(ctx, front, 46, front - L, 46, col('s8'), 5, 12); lab(`brakes ${fmt(S.Ff)} N`, front + 8, 50, 'left'); }
        ctx.restore();
        // power-flow strip
        const names = ['Battery', 'Inverter', 'Motor', 'Wheels'], gp = w < 480 ? 10 : Math.min(40, w * 0.045), bw = w < 480 ? (w - 24 - 3 * gp) / 4 : Math.min(82, w * 0.115), by = 12, bh = 40, dirn = Math.abs(S.d.Pw) > 300 ? Math.sign(S.d.Pw) : 0;
        for (let i = 0; i < 3; i++) {
          const xa = 12 + bw + i * (bw + gp), y = by + bh / 2;
          ctx.strokeStyle = col('axis'); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(xa + 3, y); ctx.lineTo(xa + gp - 3, y); ctx.stroke();
          if (dirn) { ctx.fillStyle = col(dirn > 0 ? 's1' : 's6'); const spd = 24 + Math.min(110, Math.abs(S.d.Pel) / 2500); for (let j = 0; j < 2; j++) { let u = (t * spd + j * gp / 2) % gp; if (dirn < 0) u = gp - u; ctx.beginPath(); ctx.arc(xa + u, y, 3.5, 0, TAU); ctx.fill(); } }
        }
        names.forEach((nm, i) => {
          const x = 12 + i * (bw + gp);
          EV.rr(ctx, x, by, bw, bh, 8); ctx.fillStyle = col('surface'); ctx.fill();
          if (i === 0) { ctx.save(); EV.rr(ctx, x, by, bw, bh, 8); ctx.clip(); ctx.fillStyle = EV.rgba(S.soc > 0.15 ? 's1' : 's8', 0.3); ctx.fillRect(x, by, bw * S.soc, bh); ctx.restore(); }
          EV.rr(ctx, x, by, bw, bh, 8); ctx.strokeStyle = col(i === 0 ? 's1' : 'body-line'); ctx.lineWidth = 1.5; ctx.stroke();
          EV.text(ctx, i === 0 ? `${w < 480 ? 'Batt.' : 'Battery'} ${fmt(S.soc * 100)}%` : nm, x + bw / 2, by + 17, { size: w < 480 ? 10.5 : 11.5, weight: 600, align: 'center', color: col('ink') });
          const val = [S.pB, S.d.Pel, S.d.Pm, S.d.Pw][i] / 1000;
          EV.text(ctx, `${fmt(val, Math.abs(val) < 20 ? 1 : 0)} kW`, x + bw / 2, by + 32, { size: 11, align: 'center', mono: true, color: col('ink-2') });
        });
        // slope and mini-map
        EV.text(ctx, `${S.grade > 0.002 ? 'uphill' : S.grade < -0.002 ? 'downhill' : 'level'} ${fmt(Math.abs((S.grade || 0) * 100), 1)}%`, w - 12, h - 10, { size: 11.5, align: 'right', color: col('muted') });
        if (s.route === 'hills' || s.route === 'pass') {
          const mw = Math.min(200, w * 0.3), mh = 46, mx = w - mw - 12, my = w < 480 ? 64 : 12, span = s.route === 'pass' ? 18000 : 8000, hs = s.route === 'pass' ? 600 : 60;
          ctx.fillStyle = col('surface'); EV.rr(ctx, mx - 4, my - 4, mw + 8, mh + 20, 6); ctx.fill();
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) { const xx = S.x - span * 0.3 + span * i / 60, yy = my + mh - (R0.h(xx) + (s.route === 'pass' ? 0 : 60)) / (s.route === 'pass' ? hs : 120) * mh; if (i) ctx.lineTo(mx + mw * i / 60, yy); else ctx.moveTo(mx, yy); }
          ctx.strokeStyle = col('s3'); ctx.lineWidth = 2; ctx.stroke();
          const yy = my + mh - (R0.h(S.x) + (s.route === 'pass' ? 0 : 60)) / (s.route === 'pass' ? hs : 120) * mh;
          ctx.beginPath(); ctx.arc(mx + mw * 0.3, yy, 4.5, 0, TAU); ctx.fillStyle = col('ink'); ctx.fill();
          EV.text(ctx, `road profile, ${fmt(span / 1000)} km`, mx + mw / 2, my + mh + 13, { size: 10.5, align: 'center', color: col('muted') });
        }
        if (t - lastHud > 0.1 || dt === 0) { lastHud = t; hud(); }
        if (t - lastPlot > 0.5 || dt === 0) { lastPlot = t; plots(); }
      }
      C.cv.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const k = s.mode === 'cc' ? 'cruise' : 'pedal', step2 = (e.key === 'ArrowUp' ? 1 : -1) * (s.mode === 'cc' ? 5 : 10);
        s.set(k, s[k] + step2, true);
      });
      reset();
      C.draw = () => draw(0, 0); draw(0, 0); EV.loop(C.cv, draw);
    },

    quiz: (car) => [
      { q: 'On the flat motorway route you raise the cruise speed from 100 to 130 km/h. Which segment of the energy ledger grows fastest per kilometre?', o: ['Tyres', 'Air', 'Drivetrain losses', 'Electronics'], a: 1, why: 'Rolling resistance is nearly independent of speed, electronics cost less per km at higher speed, and drivetrain losses grow modestly. Air drag force grows with the square of speed: (130/100)² ≈ 1.7.' },
      { q: 'Climbing the mountain pass, battery power is several times higher than on the flat. Where is most of that extra energy going?', o: ['Into heat in the motor', 'Into air resistance', 'Into gravitational potential energy, the "height gained" segment', 'Into the tyres'], a: 2, why: 'On a 7–10% grade the gravity force is several times the air and tyre forces together. The energy is stored as height and largely returns on the descent.' },
      { q: 'Descending the pass at −15 °C, the car uses its friction brakes even though the slope is no steeper than before. Why?', o: ['Cold air is denser', 'The cold battery accepts less charging power, so regeneration is limited and the brakes must take the rest', 'The tyres have less grip', 'The motor is less efficient when cold'], a: 1, why: 'Regeneration is charging, and a cold pack must limit charging current to avoid lithium plating. Whatever braking the motors cannot do falls to the friction brakes and is lost as heat.' },
      { q: 'With the pedal held at +100% from rest, the battery power rises, then levels off while the car is still accelerating. What has happened?', o: ['The tyres have started to slip', 'The motors have passed their base speed and are now limited by power, not torque', 'The battery is empty', 'The gearbox has shifted'], a: 1, why: 'Below base speed torque is constant, so power = torque × speed rises linearly. Above it the back-EMF limits the motor to constant power, and the wheel force falls as 1/speed.' },
    ],
  });
})();
