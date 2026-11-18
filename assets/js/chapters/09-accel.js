/* Chapter 9 — Acceleration and traction: gearing, the tractive-effort diagram, weight transfer, the 0-100 run. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, G = P.G, { clamp } = P;
  const VAR = [['rwd', 's1'], ['lr', 's2'], ['perf', 's3']];
  const MU = { dry: ['Dry', null], wet: ['Wet', 0.8], snow: ['Snow', 0.3] };

  /** Wheel force of a petrol car with the same peak power, in each of six gears. Returns [[kmh, N], ...] per gear. */
  function petrol(car) {
    const tq = (rpm) => 1 - ((rpm - 4000) / 4500) ** 2;                        // normalised torque curve, peak at 4000 rpm
    const Tmax = car.pPeak / (tq(6000) * 6000 * Math.PI / 30);
    return [3.9, 2.3, 1.55, 1.15, 0.9, 0.72].map((g) => {
      const pts = [];
      for (let rpm = 1300; rpm <= 6500; rpm += 100) pts.push([rpm * Math.PI / 30 / (g * 3.7) * car.rWheel * 3.6, Tmax * tq(rpm) * g * 3.7 * 0.92 / car.rWheel]);
      return pts;
    });
  }

  EV.chapter({
    id: 'accel', n: '9', title: 'Acceleration and traction', nav: 'Acceleration', color: 's4',
    blurb: 'Why an electric car launches so hard with one gear, what really limits a 0–100 run, and how weight shifting to the rear decides who wins.',
    lead: 'Acceleration is force divided by mass. The interesting part is where the force comes from and what caps it: first the grip of the tyres, then the torque of the motors, then the power of the battery.',
    html(car) {
      const m = car.curb + 75, F0 = car.tPeak * car.gear * car.etaGear / car.rWheel, run = P.accelRun(car, { vStop: 105 / 3.6 });
      const vBase = P.vOf(car, car.pPeak / car.tPeak) * 3.6;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>The gearbox is a lever: it multiplies motor torque by ${car.gear} and divides speed by ${car.gear}. Wheel force is ${M`F = T G \eta / r`}.</li>
        <li>Three limits apply in turn during a full-throttle run: <strong>grip</strong>, then motor <strong>torque</strong>, then <strong>power</strong>.</li>
        <li>Once power-limited, acceleration falls as 1/speed: ${M`a = P / (m v)`}.</li>
        <li>Accelerating shifts load onto the rear tyres, which is why rear-wheel drive launches better than front-wheel drive, and all-wheel drive best of all.</li>
        <li>A motor's flat torque and wide power band make a multi-speed gearbox unnecessary.</li>
      </ul></div>

      <h2><span class="n">9.1</span>From motor torque to push at the road</h2>
      <p>The motor makes torque. The road needs force. Between them are two levers: the gearbox, which trades speed for torque, and the wheel radius, which turns torque into force at the contact patch.</p>
      ${eq(String.raw`F_{wheel} = \frac{T_{motor} \cdot G \cdot \eta_{gear}}{r_{wheel}}`, '<b>G</b> gear ratio (' + car.gear + ') · <b>η</b> gear efficiency (' + car.etaGear + ') · <b>r</b> wheel radius (' + car.rWheel + ' m)')}
      <div class="callout ex"><h5>Worked example · ${car.name} from standstill</h5>
        <p>Peak motor torque ${fmt(car.tPeak)} N·m, so ${M`F = ${fmt(car.tPeak)} \times ${car.gear} \times ${car.etaGear} / ${car.rWheel} = ${fmt(F0)} \text{ N}`}. With a mass of ${fmt(m)} kg plus 5% for rotating parts, ${M`a = F / m_{eff} = ${fmt(F0 / (m * car.rot), 1)} \text{ m/s}^2`}, which is ${fmt(F0 / (m * car.rot) / G, 2)} g, provided the tyres can transmit it. In the full simulation of section 9.4, which checks the grip of each axle, the launch peaks at ${fmt(Math.max(...run.a), 2)} g.</p></div>

      <h2><span class="n">9.2</span>The tractive-effort diagram</h2>
      <p>Plot the force available at the wheels against road speed and you have the single most useful picture in vehicle engineering. On the same axes draw the force that resists motion (Chapter 1) and the most the tyres can transmit (Chapter 4). Everything about straight-line performance can be read off it:</p>
      <ul>
        <li>The <strong>gap</strong> between available force and resistance, divided by mass, is the acceleration at that speed.</li>
        <li>Where the two curves <strong>cross</strong> is the highest speed the car could reach, unless the motor hits its own speed limit first. (The real car is held to ${car.vMax} km/h by software before either happens.)</li>
        <li>Where the available force exceeds the <strong>grip line</strong>, the tyres would spin, and traction control holds the force at the line.</li>
      </ul>
      <div data-fig="tractive"></div>
      <p>The motor curve has a flat part and a falling part. Below about ${fmt(vBase)} km/h the motors give constant torque, so constant force. Above it they give constant power, and since ${M`P = F v`}, force falls as 1/v. That hyperbola is the ideal shape for a vehicle: the most force exactly where it is useful, with no interruptions.</p>
      <div class="callout deep"><h5>Why one gear is enough</h5><p>A petrol engine makes its peak power only near the top of its rev range. Gears exist to keep it there: each one moves the engine's narrow hump of useful force to a different road speed, and together the humps approximate the constant-power hyperbola from below. The electric motor traces that hyperbola by itself. One fixed ratio is then a compromise between two ends only: a higher ratio gives more launch force but reaches the motor's speed limit sooner. Try the gear-ratio slider with the petrol comparison switched on.</p></div>

      <h2><span class="n">9.3</span>Weight transfer: why the nose lifts</h2>
      <p>The drive force acts at the road. The car's mass resists at the centre of gravity, ${car.cgH} m higher. Those two forces form a couple that tries to rotate the car nose-up. The suspension resists by loading the rear tyres harder and the front tyres less:</p>
      ${eq(String.raw`\Delta F_z = \frac{m \, a \, h}{L}`, 'At 0.5 g the ' + car.name + ' moves <b>' + fmt(m * 0.5 * G * car.cgH / car.wheelbase / G) + ' kg</b> of load from the front axle to the rear.')}
      <div data-fig="transfer"></div>
      <p>More load means more grip (${M`F = \mu F_z`}), so acceleration rewards the driven axle if it is the rear one. That is why powerful two-wheel-drive cars are rear-driven. With both axles driven all of the car's weight can contribute, and the upper limit becomes ${M`a = \mu g`}. A real two-motor car gets close to it but not all the way: each motor has its own torque limit, so at a hard launch the lightly loaded front tyres can run out of grip before the front motor runs out of torque, while the rear motor is already giving all it has. The low centre of gravity is a mixed blessing here: less load transfer means a rear-drive car gains less at launch, but an all-wheel-drive one loses less at the front.</p>

      <h2><span class="n">9.4</span>The full-throttle run</h2>
      <p>Put the pieces together and integrate ${M`a = (F - F_{resist}) / m_{eff}`} from rest. A 0–100 km/h run of the ${car.name} takes ${fmt(run.marks.t100, 1)} s in this model (published: ${car.pub.t100} s) and passes through distinct phases, each with its own limit.</p>
      <div data-fig="race"></div>
      <p>Look at the acceleration traces. Each starts as a plateau, where either the tyres or the motor torque sets the limit, then bends into a falling curve where the power limit takes over. From that point ${M`a = P / (m v)`}: doubling the speed halves the acceleration. This is why an electric car that feels violent from rest feels merely quick at motorway speed, and why 0–100 times flatter electric cars compared with 100–200 times.</p>
      <div class="callout myth"><h5>Common misconception</h5><p>"Electric cars are fast because of instant torque." Torque at the motor shaft means little by itself; a small motor with a large gear ratio can make any wheel torque you like. What matters is wheel force at each speed, which is set by <em>power</em> once the car is moving. Electric cars launch hard because their motors hold full torque from zero rpm, with no clutch to slip and no gears to change, and because the control of that torque is fast enough to ride right on the limit of grip.</p></div>`;
    },

    init(root, car) {
      const m0 = car.curb + 75;
      /* --------------------------------------------------------- tractive -- */
      const f = EV.fig(root, 'tractive', { side: true, title: 'Force available, force required', hint: 'Wheel force the motors can deliver, the grip limit of the tyres, and the resistance to overcome. The gap between them is what accelerates the car.',
        cap: '<b>Try this.</b> Raise the gear ratio to 13: launch force grows but the motor hits its speed limit before the car reaches top speed. Lower it to 6: the top end improves, the launch suffers. Then add the petrol car.' });
      const tp = EV.plot(f.stage, { h: 340, x: { label: 'Road speed (km/h)', min: 0, max: 270, unit: 'km/h' }, y: { label: 'Force at the wheels (kN)', min: 0, max: 'auto', unit: 'kN' } });
      const TR = EV.readouts(f.out, { a0: ['Launch acceleration', 'g'], a: ['Acceleration at this speed', 'g'], sur: ['Surplus force', 'kN'], vt: ['Top speed without the software limit', 'km/h'], hill: ['Steepest hill at 30 km/h', '%'], rpm: ['Motor speed at this speed', 'rpm'] });
      const ts = EV.controls(f.ctl, {
        v: { label: 'Road speed', min: 0, max: 250, step: 5, value: 100, unit: 'km/h' },
        gear: { label: 'Gear ratio', min: 5, max: 14, step: 0.5, value: car.gear, fmt: (x) => x.toFixed(1) + ' : 1' },
        grade: { label: 'Road grade', min: 0, max: 30, step: 1, value: 0, unit: '%' },
        mu: { type: 'seg', label: 'Surface', options: Object.entries(MU).map(([k, v]) => [k, v[0]]), value: 'dry' },
        ice: { type: 'toggle', label: 'Compare a 6-speed petrol car of equal peak power', value: false },
      }, tUpd);
      function tUpd() {
        const c = Object.assign({}, car, { gear: ts.gear }), mu = MU[ts.mu][1] == null ? car.mu : MU[ts.mu][1];
        const grip = car.drive === 'AWD' ? mu * m0 * G : mu * m0 * G * car.rearStatic / (1 - mu * car.cgH / car.wheelbase);
        const F = (kmh) => P.tractiveForce(c, kmh / 3.6), Rz = (kmh) => P.roadLoad(car, { v: kmh / 3.6, grade: ts.grade / 100, mass: m0 }).total;
        const road = (kmh) => P.driveForce(c, kmh / 3.6, { mu, mass: m0, resist: Rz(kmh) }).F;      // what the tyres can actually put down, axle by axle
        const vLim = P.vOf(c, car.rpmMax * Math.PI / 30) * 3.6;
        const fPts = EV.sample((x) => (x > vLim ? null : F(x) / 1000), 0, 270, 270);
        let vTop = 0; for (let x = 1; x <= Math.min(270, vLim); x += 0.5) if (road(x) >= Rz(x)) vTop = x;
        let hill = 0; for (let g = 0; g <= 100; g += 0.5) { const need = P.roadLoad(car, { v: 30 / 3.6, grade: g / 100, mass: m0 }).total; if (P.driveForce(c, 30 / 3.6, { mu: mu * Math.cos(Math.atan(g / 100)), mass: m0, resist: need }).F >= need) hill = g; }
        const series = [{ name: 'Motors can deliver', color: 's3', pts: fPts, area: true, w: 2.5 }, { name: 'Tyres can transmit, axle by axle', color: 'ink', dash: true, w: 1.6, pts: EV.sample((x) => (x > vLim ? null : road(Math.max(x, 0.5)) / 1000), 0, 270, 270) }, { name: 'Resistance: air + tyres + hill', color: 's1', pts: EV.sample((x) => Rz(x) / 1000, 0, 270, 135) }];
        if (ts.ice) petrol(car).forEach((pts, i) => series.push({ name: i ? '' : 'Petrol car, gears 1–6', noLegend: i > 0, color: 'muted', w: 1.5, pts: pts.map(([x, y]) => [x, y / 1000]) }));
        const fa = road(Math.max(ts.v, 0.5)), sur = fa - Rz(ts.v), atLimit = vTop >= Math.min(270, vLim) - 1;
        tp.set({
          series, yMax: Math.max(8, Math.ceil(Math.max(F(0), grip) / 1000 * 1.12 / 2) * 2),
          hlines: [{ y: grip / 1000, left: true, label: car.drive === 'AWD' ? `ideal grip limit, ${MU[ts.mu][0].toLowerCase()} road: μ × weight` : `grip limit of the rear tyres, ${MU[ts.mu][0].toLowerCase()} road` }],
          vlines: [{ x: ts.v }, { x: car.vMax, label: `software limit ${car.vMax} km/h`, color: 'muted', ly: 46 }].concat(vLim < 270 && Math.abs(vLim - car.vMax) > 8 ? [{ x: vLim, label: atLimit ? '' : 'motor speed limit', color: 'muted', ly: 64 }] : []),
          points: [{ x: ts.v, y: fa / 1000, color: 's3', label: `${fmt(fa / 1000, 1)} kN` }, { x: vTop, y: Rz(vTop) / 1000, color: 'ink', r: 4, label: atLimit ? `motor speed limit: ${fmt(vTop)} km/h` : `forces balance at ${fmt(vTop)} km/h`, dy: -12, align: 'left' }],
        });
        TR({ a0: fmt(Math.max(0, road(0.5) - Rz(0.5)) / (m0 * car.rot) / G, 2), a: fmt(Math.max(0, sur) / (m0 * car.rot) / G, 2), sur: fmt(sur / 1000, 1), vt: fmt(vTop), hill: fmt(hill), rpm: fmt(Math.round(P.wOf(c, ts.v / 3.6) * 30 / Math.PI / 10) * 10) });
      }
      tUpd();

      /* --------------------------------------------------------- transfer -- */
      const g = EV.fig(root, 'transfer', { side: true, title: 'Load on each axle while accelerating and braking', hint: 'Arrows under the wheels show how hard each axle presses on the road. Body pitch is exaggerated.' });
      const GC = EV.canvas(g.stage, { ratio: 0.52, minH: 250, maxH: 360, label: 'Side view of the car with axle loads' });
      const GR = EV.readouts(g.out, { f: ['Front axle load', 'kg'], r: ['Rear axle load', 'kg'], pc: ['Share on the rear', '%'], d: ['Load moved', 'kg'], rwd: ['Grip-limited launch, rear drive', 'g'], awd: ['Grip-limited launch, all-wheel drive', 'g'] });
      const gs = EV.controls(g.ctl, {
        a: { label: 'Brake (−) / accelerate (+)', min: -1.1, max: 1.0, step: 0.05, value: 0.5, unit: 'g' },
        mu: { type: 'seg', label: 'Surface', options: [['1', 'Dry'], ['0.8', 'Wet'], ['0.3', 'Snow']], value: '1' },
      }, gUpd);
      function gUpd() {
        const d = m0 * gs.a * car.cgH / car.wheelbase, fr = m0 * (1 - car.rearStatic) - d, re = m0 * car.rearStatic + d, mu = +gs.mu;
        GR({ f: fmt(fr), r: fmt(re), pc: fmt(re / m0 * 100), d: fmt(Math.abs(d)), rwd: fmt(mu * car.rearStatic / (1 - mu * car.cgH / car.wheelbase), 2), awd: fmt(mu, 2) });
        const { ctx, w, h } = GC, col = EV.col, sc = Math.min(0.48, w / 1000 * 0.64), cx = w * 0.5, gy = h * 0.6, A = EV.art;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        A.drawCar(ctx, cx, gy, { scale: sc, pitch: gs.a * 0.045 });
        const xr = cx + (A.REAR - A.MID) * sc, xf = cx + (A.FRONT - A.MID) * sc, k = (h - gy - 26) / (m0 * 0.85);
        [[xr, re, 'rear'], [xf, fr, 'front']].forEach(([x, load, nm]) => {
          EV.arrow(ctx, x, gy + 6 + Math.max(4, load * k), x, gy + 4, col('s3'), 5, 12);
          EV.text(ctx, `${nm} ${fmt(load)} kg`, x + 10, gy + 20, { size: 12, weight: 600, color: col('ink') });
        });
        const cgx = cx, cgy = gy - car.cgH * A.PX_PER_M * sc;
        ctx.beginPath(); ctx.arc(cgx, cgy, 6, 0, 7); ctx.fillStyle = col('ink'); ctx.fill();
        if (Math.abs(gs.a) > 0.02) {
          const L = gs.a * 150 * Math.min(1, w / 600);
          EV.arrow(ctx, cgx, cgy, cgx - L, cgy, col('s4'), 4, 11, true);
          EV.text(ctx, 'inertia m·a', cgx - L - (L > 0 ? 8 : -8), cgy - 9, { size: 11.5, weight: 600, align: L > 0 ? 'right' : 'left', color: col('ink'), halo: true });
          EV.arrow(ctx, xr, gy - 3, xr + L, gy - 3, col('ink'), 4, 11, true);
          EV.text(ctx, gs.a > 0 ? 'drive force' : 'braking force', xr + L + (L > 0 ? 8 : -8), gy - 9, { size: 11.5, weight: 600, align: L > 0 ? 'left' : 'right', color: col('ink'), halo: true });
        }
        EV.text(ctx, 'centre of gravity', cgx + 10, cgy + 16, { size: 11, color: col('muted'), halo: true });
      }
      GC.draw = gUpd; gUpd();

      /* ------------------------------------------------------------- race -- */
      const r = EV.fig(root, 'race', { side: true, title: 'Three Model Ys from a standing start', hint: 'A quarter-mile strip (402 m). The selected car is highlighted. Cars are drawn larger than scale.',
        cap: '<b>Try this.</b> Run it on a dry road, then on snow. On snow the two all-wheel-drive cars are nearly identical: power no longer matters, only how many tyres are driven.' });
      const RC = EV.canvas(r.stage, { ratio: 0.3, minH: 170, maxH: 230, label: 'Drag strip with three cars' });
      const sp = EV.plot(r.stage, { h: 210, x: { label: '', min: 0, max: 14, unit: 's' }, y: { label: 'Speed (km/h)', min: 0, max: 'auto', unit: 'km/h' }, table: false });
      const ap = EV.plot(r.stage, { h: 190, x: { label: 'Time (s)', min: 0, max: 14, unit: 's' }, y: { label: 'Acceleration (g)', min: 0, max: 1.2, unit: 'g' }, legend: false });
      const RR = EV.readouts(r.out, { t50: ['0–50 km/h', 's'], t100: ['0–100 km/h', 's'], t400: ['400 m', 's'], v400: ['Speed at 400 m', 'km/h'], pk: ['Peak acceleration', 'g'], lim: ['Limited at launch by', ''] });
      let runs = {}, T = 0, going = false;
      const rs = EV.controls(r.ctl, {
        mu: { type: 'seg', label: 'Surface', options: Object.entries(MU).map(([k, v]) => [k, v[0]]), value: 'dry' },
        grade: { label: 'Road grade', min: 0, max: 15, step: 1, value: 0, unit: '%' },
        load: { label: 'Passengers and cargo', min: 75, max: 450, step: 25, value: 75, unit: 'kg' },
      }, rUpd);
      const go = EV.el('<button type="button" class="btn pri">▶ Start the run</button>');
      go.addEventListener('click', () => { T = 0; going = true; });
      r.ctl.appendChild(go);
      const at = (arr, ts2, t) => { const i = Math.min(arr.length - 1, Math.floor(t / (ts2[1] - ts2[0]))); const j = Math.min(arr.length - 1, i + 1), q = clamp((t - ts2[i]) / ((ts2[j] - ts2[i]) || 1), 0, 1); return arr[i] + (arr[j] - arr[i]) * q; };
      function rUpd() {
        VAR.forEach(([k]) => { const c = EV.variants[k]; runs[k] = P.accelRun(c, { mu: MU[rs.mu][1] == null ? c.mu : MU[rs.mu][1], grade: rs.grade / 100, payload: rs.load, tMax: 16 }); });
        const me = runs[car.key], mk = me.marks;
        RR({ t50: mk.t50 ? fmt(mk.t50, 1) : '–', t100: mk.t100 ? fmt(mk.t100, 1) : '–', t400: mk.t400 ? fmt(mk.t400, 1) : '–', v400: mk.v400 ? fmt(mk.v400) : '–', pk: fmt(Math.max(...me.a), 2), lim: { grip: 'tyre grip', torque: 'motor torque', power: 'power' }[me.lim[3]] || me.lim[3] });
        T = 16; going = false; plots(); rDraw(0, 0);
      }
      function plots() {
        const ser = (key) => VAR.map(([k, c]) => ({ name: EV.variants[k].name, color: c, w: k === car.key ? 3 : 1.6, pts: runs[k].t.map((t, i) => [t, runs[k][key][i]]).filter((p) => p[0] <= 14) }));
        const me = runs[car.key], bands = []; let s0 = 0;
        for (let i = 1; i <= me.t.length; i++) if (i === me.t.length || me.lim[i] !== me.lim[s0]) {
          const nm = me.lim[s0]; if (me.t[s0] < 14 && nm !== 'vmax') bands.push({ x0: me.t[s0], x1: Math.min(14, me.t[Math.min(i, me.t.length - 1)]), color: { grip: 's8', torque: 's4', power: 's1' }[nm] || 'muted', alpha: 0.1, label: (Math.min(14, me.t[Math.min(i, me.t.length - 1)]) - me.t[s0]) > 1.2 ? { grip: 'grip-limited', torque: 'torque-limited', power: 'power-limited' }[nm] : '' });
          s0 = i;
        }
        const tl = Math.min(T, 14), vl = going || T < 16 ? [{ x: tl }] : [];
        const pts = me.marks.t100 && me.marks.t100 < 14 ? [{ x: me.marks.t100, y: 100, color: VAR.find((v) => v[0] === car.key)[1], label: `100 km/h in ${fmt(me.marks.t100, 1)} s` }] : [];
        sp.set({ series: ser('v'), vlines: vl, points: pts });
        ap.set({ series: ser('a'), vlines: vl, bands });
      }
      function rDraw(t, dt) {
        if (going) { T += dt; if (T >= 14) { going = false; } if (Math.round(T * 60) % 6 === 0) plots(); }
        const { ctx, w, h } = RC, col = EV.col, x0 = 30, x1 = w - 30, lane = (h - 34) / 3, tt = Math.min(T, 15.9);
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 1; ctx.fillStyle = col('muted');
        for (let d = 0; d <= 400; d += 100) { const x = x0 + (x1 - x0) * d / 402; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, h - 24); ctx.stroke(); EV.text(ctx, d + ' m', x, h - 8, { size: 11, align: 'center', color: col('muted') }); }
        ctx.strokeStyle = col('ink'); ctx.lineWidth = 2.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x1, 8); ctx.lineTo(x1, h - 24); ctx.stroke(); ctx.setLineDash([]);
        VAR.forEach(([k, c], i) => {
          const run = runs[k], y = 8 + lane * (i + 1) - 6, x = at(run.x, run.t, tt), v = at(run.v, run.t, tt), px = x0 + (x1 - x0) * Math.min(x, 402) / 402, me = k === car.key;
          ctx.strokeStyle = col('axis'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 - 20, y); ctx.lineTo(x1 + 20, y); ctx.stroke();
          ctx.strokeStyle = col(c); ctx.lineWidth = me ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(x0, y + 1); ctx.lineTo(px, y + 1); ctx.stroke();
          if (run.marks.t100 && tt >= run.marks.t100) { const xm = x0 + (x1 - x0) * Math.min(at(run.x, run.t, run.marks.t100), 402) / 402; ctx.fillStyle = col(c); ctx.fillRect(xm - 1, y - 8, 2, 22); EV.text(ctx, `100 km/h · ${fmt(run.marks.t100, 1)} s`, xm + 5, y + 13, { size: 10.5, color: col('ink-2') }); }
          EV.art.drawCar(ctx, px - 22, y, { scale: 0.05, spin: x * 3, alpha: me ? 1 : 0.75 });
          EV.text(ctx, `${EV.variants[k].name} · ${fmt(v)} km/h`, Math.min(px + 6, x1 - 150), y - 16, { size: 11.5, weight: me ? 700 : 500, color: col(me ? 'ink' : 'ink-2'), halo: true });
        });
        EV.text(ctx, `t = ${fmt(Math.min(T, 14), 1)} s`, x0 - 20, 14, { size: 12, weight: 600, mono: true, color: col('ink') });
      }
      rUpd(); RC.draw = () => rDraw(0, 0); EV.loop(RC.cv, rDraw);
    },

    quiz: (car) => [
      { q: `The gearbox ratio is ${car.gear}:1. Compared with the motor shaft, the wheels turn…`, o: [`${car.gear} times faster with ${car.gear} times less torque`, `${car.gear} times slower with about ${car.gear} times more torque`, 'At the same speed with more torque', `${car.gear} times slower with the same torque`], a: 1, why: 'A reduction gear is a lever. Power in equals power out (minus a couple of percent), so if speed is divided by the ratio, torque is multiplied by it.' },
      { q: 'During a full-throttle run on a dry road, what typically limits acceleration at 150 km/h?', o: ['Tyre grip', 'Motor torque', 'Available power', 'The gearbox'], a: 2, why: 'At speed the motors are in their constant-power range. Force is power ÷ speed, far below the grip limit, and it keeps falling as speed rises.' },
      { q: 'A car is power-limited at both 60 and 120 km/h. Ignoring drag, its acceleration at 120 km/h compared with 60 km/h is…', o: ['The same', 'Half', 'A quarter', 'Double'], a: 1, why: 'With constant power, F = P/v, so a = P/(m·v). Twice the speed, half the force, half the acceleration.' },
      { q: 'Why does a powerful rear-wheel-drive car launch better than an equally powerful front-wheel-drive car?', o: ['Rear tyres are wider', 'Accelerating shifts load onto the rear axle, increasing grip there and reducing it at the front', 'The motor is closer to the wheels', 'Rear wheels have less rolling resistance'], a: 1, why: 'Load transfer ΔF = m·a·h/L moves weight rearward under acceleration. Grip is proportional to load, so the driven rear tyres gain exactly when they need it; driven front tyres would lose it.' },
      { q: 'On packed snow (μ ≈ 0.3), the Long Range and Performance versions reach 50 km/h in almost the same time. Why?', o: ['They have the same motors', 'Both are limited by tyre grip, not by torque or power', 'Snow reduces battery power', 'The gear ratios are identical'], a: 1, why: 'On a slippery surface the grip limit μ·m·g lies far below what either car\'s motors can deliver. Both ride the same limit, so the extra power of the Performance goes unused.' },
    ],
  });
})();
