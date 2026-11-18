/* Chapter 4 — Tyres, grip and handling: contact patch, rolling resistance, slip, friction circle, rollover, braking. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, G = P.G, { clamp } = P;

  // Pacejka "magic formula" friction vs slip ratio for four surfaces: [B, C, D (peak), E]
  const SURF = { dry: ['Dry asphalt', 10, 1.9, 1.0, 0.97, 's1'], wet: ['Wet asphalt', 12, 2.3, 0.82, 1.0, 's2'], snow: ['Packed snow', 5, 2.0, 0.3, 1.0, 's3'], ice: ['Ice', 4, 2.0, 0.1, 1.0, 's4'] };
  const muSlip = (k, s) => { const [, B, C, D, E] = SURF[k]; return D * Math.sin(C * Math.atan(B * s - E * (B * s - Math.atan(B * s)))); };
  const peakOf = (k) => { let best = 0, at = 0; for (let s = 0; s <= 1; s += 0.005) { const m = muSlip(k, s); if (m > best) { best = m; at = s; } } return { mu: best, slip: at }; };

  EV.chapter({
    id: 'tires', n: '4', title: 'Tyres, grip and handling', nav: 'Tyres and grip', color: 's2',
    blurb: 'Four hand-sized patches of rubber carry every force. Rolling resistance, slip, the friction circle, and why a heavy floor makes a stable car.',
    lead: 'Everything the car does to the road, and the road to the car, passes through four patches of rubber. They set the rolling losses that dominate city driving, and they set the limits of acceleration, braking and cornering.',
    html(car) {
      const m = car.curb + 75, fz = m * G / 4, area = fz / 290e3 * 1e4;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>The contact patch area is set by load ÷ tyre pressure. For this car, about the size of a hand per tyre.</li>
        <li>Rolling resistance is rubber <strong>hysteresis</strong>: energy spent flexing the tyre that does not spring back. It scales with weight, not speed.</li>
        <li>A tyre makes force only by <strong>slipping</strong> a little. On dry asphalt grip peaks at roughly 10–20% slip and then falls.</li>
        <li>Each tyre has one grip budget, shared between driving, braking and cornering: the <strong>friction circle</strong>.</li>
        <li>A low centre of gravity means less load transfer, more total grip, and a car that slides long before it could roll.</li>
      </ul></div>

      <h2><span class="n">4.1</span>The contact patch</h2>
      <p>A tyre is a pressure vessel. It supports its load by pressing a flat patch against the road, and the air pressure inside sets how large that patch must be: ${M`A \approx F_z / p`}. Each tyre of the ${car.name} carries about ${fmt(fz)} N. At the recommended 2.9 bar (290 kPa) that needs ${fmt(area)} cm², a patch roughly ${fmt(Math.sqrt(area))} cm on a side. Four of them, the area of a sheet of A4 paper, hold two tonnes to the road at 200 km/h.</p>

      <h2><span class="n">4.2</span>Rolling resistance</h2>
      <p>As the tyre rolls, each piece of tread is squashed flat as it enters the contact patch and springs back as it leaves. Rubber is not a perfect spring. It returns less energy than it took to deform: the difference becomes heat. This is <em class="t">hysteresis</em>, and it is why tyres are warm after a drive.</p>
      <p>There is a neat mechanical way to see the same thing. Because the rubber pushes back harder while being compressed (front of the patch) than while relaxing (rear), the road's supporting force acts slightly <em>ahead</em> of the axle. That offset, only a few millimetres, creates a torque opposing rotation.</p>
      ${eq(String.raw`F_{roll} = C_{rr} \cdot F_z \quad\quad C_{rr} = \frac{e}{r}`, '<b>e</b> forward offset of the road force · <b>r</b> wheel radius. With C<sub>rr</sub> = ' + car.crr + ' and r = 0.35 m, e is about ' + fmt(car.crr * 350, 1) + ' mm.')}
      <div data-fig="roll"></div>
      <p>Rolling resistance barely depends on speed, so it sets the floor of the consumption curve in Chapter 2. Around town it is the largest single consumer. This is why EV tyres use low-hysteresis silica compounds, why the recommended pressure is high, and why wide sticky performance tyres cost range: the Performance model's tyres have about ${fmt((EV.variants.perf.crr / EV.variants.lr.crr - 1) * 100)}% more rolling resistance than the standard ones.</p>

      <h2><span class="n">4.3</span>Grip comes from slip</h2>
      <p>Friction between tyre and road is usually written ${M`F_{max} = \mu F_z`}, with μ about 1.0 on dry asphalt. But a tyre is not a rigid block. To transmit a driving force the tread must stretch as it passes through the contact patch, and the wheel ends up turning slightly faster than the car's speed requires. The difference is the <em class="t">slip ratio</em>:</p>
      ${eq(String.raw`\kappa = \frac{\omega r - v}{v}`, '<b>ω r</b> speed of the tyre surface · <b>v</b> speed of the car. κ = 0 is free rolling, κ = 1 is a wheel spinning at twice road speed. Under braking κ is negative.')}
      <p>The force a tyre delivers depends on slip in a very particular way. It rises steeply, peaks, then falls as more and more of the patch is sliding.</p>
      <div data-fig="slip"></div>
      <p>Everything left of the peak is stable: more slip gives more force. Right of the peak the tyre is spinning or locked, grip is lower, and the driver has lost steering. Traction control and ABS exist to hold each wheel near the peak. Here an electric car has a real advantage: a motor's torque can be changed in a few milliseconds and measured exactly, where an engine responds in tenths of a second. The motor itself is the traction-control actuator.</p>

      <h2><span class="n">4.4</span>Load transfer and the friction circle</h2>
      <p>A tyre does not care in which direction it is asked for force. It has one budget, ${M`\mu F_z`}, and it can spend it on acceleration, braking, cornering, or a mix. Plot the forward and sideways force together and the limit is a circle. Ask for 80% of the budget in braking and only 60% is left for steering, since ${M`\sqrt{0.8^2 + 0.6^2} = 1`}.</p>
      <p>The budget of each tyre changes from moment to moment, because accelerating, braking and cornering shift load between the wheels. The car's mass acts at the centre of gravity, a height <em>h</em> above the road, while the tyre forces act at ground level. The resulting torque must be balanced by extra load on some tyres and less on others:</p>
      ${eq(String.raw`\Delta F_z = \frac{m \, a \, h}{L} \quad \text{(front to rear)} \quad\quad \Delta F_z = \frac{m \, a_y \, h}{T} \quad \text{(side to side)}`, '<b>h</b> centre-of-gravity height (' + car.cgH + ' m) · <b>L</b> wheelbase (' + car.wheelbase + ' m) · <b>T</b> track width (' + car.track + ' m)')}
      <div data-fig="circle"></div>
      <p>Two things to take from this. First, load transfer is proportional to the height of the centre of gravity. With ${car.packKg} kg of battery in the floor the Model Y's sits at about ${car.cgH} m, about as low as a saloon's and well below the 0.65–0.75 m of a conventional SUV. Second, a tyre's grip does not grow quite in proportion to its load, so every newton moved from one tyre to another loses a little total grip. Less transfer means more grip overall.</p>

      <h2><span class="n">4.5</span>Cornering and rollover</h2>
      <p>Going round a bend of radius <em>r</em> at speed <em>v</em> needs a sideways acceleration ${M`a_y = v^2 / r`}. The tyres can supply at most ${M`\mu g`}, so the fastest possible speed is ${M`v = \sqrt{\mu g r}`}: ${fmt(Math.sqrt(1.0 * G * 100) * 3.6)} km/h for a 100 m radius on dry asphalt, ${fmt(Math.sqrt(0.3 * G * 100) * 3.6)} km/h on snow.</p>
      <p>Could the car tip over instead? Sideways force at the tyres and inertia at the centre of gravity form a torque that tries to roll the car. It tips when that torque exceeds the restoring torque of its weight acting over half the track width:</p>
      ${eq(String.raw`\frac{a_y}{g} > \frac{T}{2h}`, 'The ratio T / 2h is the <b>static stability factor</b>. For the Model Y: ' + car.track + ' / (2 × ' + car.cgH + ') = <b>' + fmt(car.track / (2 * car.cgH), 2) + '</b>.')}
      <p>The tyres run out of grip at about 1.0 g. The car would need ${fmt(car.track / (2 * car.cgH), 2)} g to tip. So on a flat road it slides before it can roll. Tilt the table below to see the same condition geometrically.</p>
      <div data-fig="tilt"></div>

      <h2><span class="n">4.6</span>Stopping</h2>
      <p>Braking at the limit is uniform deceleration at ${M`\mu g`}. From ${M`v^2 = 2 a d`}, the distance is</p>
      ${eq(String.raw`d = v \, t_{react} + \frac{v^2}{2 \mu g}`, 'The first term is the distance covered before the driver reacts. The second does not depend on the mass of the car.')}
      <div data-fig="brake"></div>
      <p>Mass cancels because a heavier car presses its tyres down harder in exactly the proportion it needs more force. That is why a ${fmt(m)} kg electric car can stop as short as a light hatchback, provided its tyres and brakes are sized for it.</p>`;
    },

    init(root, car) {
      const m0 = car.curb + 75;
      /* -------------------------------------------------- rolling resistance -- */
      const f = EV.fig(root, 'roll', { side: true, title: 'Inside the contact patch', hint: 'A tyre rolling to the right. Deformation and the forward offset of the road force are exaggerated so you can see them.',
        cap: '<b>Try this.</b> Drop the pressure to 2.0 bar. The patch grows, the tyre flexes more on every turn, and the range cost appears in the readouts.' });
      const C = EV.canvas(f.stage, { ratio: 0.62, minH: 260, maxH: 400, label: 'Tyre rolling on the road, flattened at the contact patch' });
      const R = EV.readouts(f.out, { a: ['Contact patch, per tyre', 'cm²'], crr: ['Rolling coefficient', ''], f: ['Rolling force, car', 'N', 's2'], p: ['Power lost', 'kW'], e: ['Energy cost', 'Wh/km'], off: ['Road-force offset', 'mm'] });
      const s = EV.controls(f.ctl, {
        p: { label: 'Tyre pressure', min: 1.8, max: 3.6, step: 0.1, value: 2.9, unit: 'bar' },
        load: { label: 'Passengers and cargo', min: 0, max: 450, step: 25, value: 75, unit: 'kg' },
        temp: { label: 'Temperature', min: -20, max: 35, step: 1, value: 20, unit: '°C' },
        speed: { label: 'Speed', min: 10, max: 200, step: 5, value: 90, unit: 'km/h' },
      }, upd);
      let crr = car.crr, spin = 0, ground = 0;
      function upd() {
        const mass = car.curb + s.load, fz = mass * G / 4;
        crr = car.crr * Math.pow(2.9 / s.p, 0.5) * P.crrTempFactor(s.temp);
        const F = crr * mass * G, v = s.speed / 3.6;
        R({ a: fmt(fz / (s.p * 1e5) * 1e4), crr: crr.toFixed(4), f: fmt(F), p: fmt(F * v / 1000, 1), e: fmt(F / 3.6), off: fmt(crr * 350, 1) });
      }
      function draw(t, dt) {
        const { ctx, w, h } = C, col = EV.col;
        const Rw = Math.min(h * 0.33, w * 0.22), cx = w * 0.56, gy = h * 0.76;
        const defl = Rw * clamp(0.075 * (2.9 / s.p) * ((car.curb + s.load) / m0), 0.03, 0.2), cy = gy - Rw + defl;
        const half = Math.sqrt(Rw * Rw - (Rw - defl) ** 2), vis = 0.6 + s.speed / 60;
        spin += vis * dt; ground = (ground + vis * dt * Rw) % 40;
        ctx.clearRect(0, 0, w, h);
        // road
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 2;
        for (let x = -ground; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, gy + 5); ctx.lineTo(x - 9, gy + 13); ctx.stroke(); }
        // tyre: circle cut flat by the road
        const a0 = Math.asin(clamp((Rw - defl) / Rw, -1, 1));
        ctx.beginPath(); ctx.arc(cx, cy, Rw, Math.PI - a0, 2 * Math.PI + a0); ctx.closePath();
        ctx.fillStyle = col('tyre'); ctx.fill();
        // heat glow where the rubber is working
        const gl = ctx.createRadialGradient(cx, gy, 2, cx, gy, half * 1.5);
        gl.addColorStop(0, EV.rgba('s2', 0.75)); gl.addColorStop(1, EV.rgba('s2', 0));
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Rw, Math.PI - a0, 2 * Math.PI + a0); ctx.closePath(); ctx.clip();
        ctx.fillStyle = gl; ctx.fillRect(cx - half * 2, gy - half * 1.6, half * 4, half * 1.6); ctx.restore();
        // tread marks rotating
        ctx.strokeStyle = col('rim'); ctx.lineWidth = 2;
        for (let i = 0; i < 28; i++) {
          const a = spin + i * Math.PI * 2 / 28, x1 = cx + Math.cos(a) * Rw * 0.9, y1 = cy + Math.sin(a) * Rw * 0.9;
          if (y1 > gy - 3) continue;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx + Math.cos(a) * Rw * 0.985, Math.min(gy - 1, cy + Math.sin(a) * Rw * 0.985)); ctx.stroke();
        }
        // rim and spokes
        ctx.fillStyle = col('rim'); ctx.beginPath(); ctx.arc(cx, cy, Rw * 0.62, 0, 7); ctx.fill();
        ctx.strokeStyle = col('tyre'); ctx.lineWidth = 5; ctx.globalAlpha = 0.55;
        for (let i = 0; i < 5; i++) { const a = spin + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * Rw * 0.58, cy + Math.sin(a) * Rw * 0.58); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.fillStyle = col('tyre'); ctx.beginPath(); ctx.arc(cx, cy, Rw * 0.08, 0, 7); ctx.fill();
        // pressure distribution under the patch, skewed toward the leading (right) edge
        const skew = clamp(crr / car.crr * 0.38, 0.2, 0.75), n = 17, ph = h - gy - 26;
        ctx.fillStyle = EV.rgba('s2', 0.55);
        let sum = 0, mom = 0;
        for (let i = 0; i < n; i++) {
          const u = -1 + 2 * (i + 0.5) / n, pr = (1 - u * u) * (1 + skew * u), x = cx + u * half;
          sum += pr; mom += pr * u;
          ctx.fillRect(x - half / n + 1, gy + 3, 2 * half / n - 2, pr * ph * 0.75);
        }
        const ex = mom / sum * half;
        // axle line and offset road force
        ctx.setLineDash([4, 4]); ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, h - 4); ctx.stroke(); ctx.setLineDash([]);
        EV.arrow(ctx, cx + ex, h - 6, cx + ex, gy + 4, col('ink'), 3.5, 11);
        EV.text(ctx, 'road pushes up here', cx + ex + 9, h - 9, { size: 11.5, weight: 600, color: col('ink'), halo: true });
        EV.text(ctx, 'axle', cx - 7, h - 9, { size: 11.5, align: 'right', color: col('muted') });
        EV.text(ctx, 'weight on the axle', cx + 9, cy - Rw - 16, { size: 11.5, color: col('ink-2') });
        EV.arrow(ctx, cx, cy - Rw - 34, cx, cy - Rw - 3, col('ink-2'), 3, 9);
        EV.text(ctx, 'direction of travel →', w - 10, 18, { size: 11.5, align: 'right', color: col('muted') });
        EV.text(ctx, w < 480 ? 'squashed' : 'rubber being squashed', cx + half + 12, gy + 22, { size: 11, color: col('ink-2') });
        EV.text(ctx, w < 480 ? 'relaxing' : 'rubber relaxing', cx - half - 12, gy + 22, { size: 11, color: col('ink-2'), align: 'right' });
        // rolling resistance arrow
        EV.arrow(ctx, cx - Rw - 8, cy, cx - Rw - 30 - crr * 3600, cy, col('s2'), 4, 10);
        EV.text(ctx, 'rolling resistance', w < 480 ? cx - Rw - 6 : cx - Rw - 36 - crr * 3600, w < 480 ? cy - 12 : cy + 4, { size: 11.5, weight: 600, align: 'right', color: col('ink') });
      }
      upd();
      C.draw = () => draw(0, 0);
      EV.loop(C.cv, draw);

      /* ------------------------------------------------------------------ slip -- */
      const g = EV.fig(root, 'slip', { side: true, title: 'Grip versus slip', hint: 'The force a tyre can transmit, as a fraction of the load on it, against how much faster the tread moves than the road.',
        cap: '<b>Try this.</b> On wet asphalt, find the slip that gives the most grip. Then push the slip to 100% and see how much is lost. That is a spinning wheel.' });
      const gp = EV.plot(g.stage, { h: 280, x: { label: 'Slip ratio (%)', min: 0, max: 100, unit: '%' }, y: { label: 'Friction coefficient μ = force ÷ load', min: 0, max: 1.2 } });
      const GC = EV.canvas(g.stage, { h: 120, label: 'Wheel turning faster than the road moves underneath it' });
      const GR = EV.readouts(g.out, { mu: ['Grip at this slip', 'μ'], pk: ['Peak grip', 'μ'], at: ['Slip at the peak', '%'], a: ['Best acceleration or braking', 'g'] });
      const gs = EV.controls(g.ctl, {
        surf: { type: 'seg', label: 'Surface', options: Object.entries(SURF).map(([k, v]) => [k, v[0]]), value: 'dry' },
        slip: { label: 'Slip ratio', min: 0, max: 100, step: 1, value: 8, unit: '%' },
      }, gUpd);
      let wa = 0, gx = 0;
      function gUpd() {
        const pk = peakOf(gs.surf), mu = muSlip(gs.surf, gs.slip / 100);
        gp.set({
          series: Object.entries(SURF).map(([k, v]) => ({ name: v[0], color: v[5], pts: EV.sample((x) => muSlip(k, x / 100), 0, 100, 100), w: k === gs.surf ? 3 : 1.5 })),
          vlines: [{ x: gs.slip }],
          points: [{ x: gs.slip, y: mu, color: SURF[gs.surf][5], label: `μ = ${fmt(mu, 2)}` }, { x: pk.slip * 100, y: pk.mu, color: 'muted', r: 4, label: 'peak', dy: -10 }],
          bands: [{ x0: 0, x1: pk.slip * 100, color: 's6', alpha: 0.07, label: 'stable' }],
        });
        GR({ mu: fmt(mu, 2), pk: fmt(pk.mu, 2), at: fmt(pk.slip * 100), a: fmt(pk.mu, 2) });
      }
      function gDraw(t, dt) {
        const { ctx, w, h } = GC, col = EV.col, Rw = 38, cx = w * 0.5, gy = h - 26, cy = gy - Rw, v = 70, k = gs.slip / 100;
        wa += v * (1 + k) / Rw * dt; gx = (gx + v * dt) % 46;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        ctx.strokeStyle = col('ink-2'); ctx.lineWidth = 2;
        for (let x = -gx; x < w + 46; x += 46) { ctx.beginPath(); ctx.moveTo(x, gy + 4); ctx.lineTo(x, gy + 13); ctx.stroke(); }
        ctx.fillStyle = col('tyre'); ctx.beginPath(); ctx.arc(cx, cy, Rw, 0, 7); ctx.fill();
        ctx.fillStyle = col('rim'); ctx.beginPath(); ctx.arc(cx, cy, Rw * 0.6, 0, 7); ctx.fill();
        ctx.strokeStyle = col(SURF[gs.surf][5]); ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = wa + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * Rw * 0.78, cy + Math.sin(a) * Rw * 0.78); ctx.lineTo(cx + Math.cos(a) * Rw * 0.98, cy + Math.sin(a) * Rw * 0.98); ctx.stroke(); }
        if (k > peakOf(gs.surf).slip + 0.03) for (let i = 0; i < 8; i++) {   // spray thrown back when spinning
          const ph = (t * 3 + i * 0.37) % 1; ctx.globalAlpha = (1 - ph) * 0.5; ctx.fillStyle = col('muted');
          ctx.beginPath(); ctx.arc(cx - 12 - ph * (60 + k * 80), gy - 4 - Math.sin(ph * 3) * (8 + i * 2), 2 + ph * 5, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        EV.text(ctx, `tread speed = ${fmt(100 + gs.slip)}% of road speed`, cx + Rw + 14, cy + 4, { size: 12, weight: 600, color: col('ink') });
        EV.text(ctx, 'road marks pass at car speed', 10, h - 4, { size: 11, color: col('muted') });
      }
      gUpd();
      GC.draw = () => gDraw(0, 0);
      EV.loop(GC.cv, gDraw);

      /* -------------------------------------------------------- friction circle -- */
      const c = EV.fig(root, 'circle', { side: true, title: 'Four tyres, four budgets', hint: 'Left: the car from above, with each tyre\'s grip budget drawn as a circle and the force asked of it as an arrow. Right: drag the dot to choose acceleration and cornering.',
        cap: '<b>Try this.</b> Brake at 0.8 g and watch the front circles grow and the rears shrink. Add cornering until an arrow turns red. Then raise the centre of gravity and repeat.' });
      const CC = EV.canvas(c.stage, { ratio: 0.56, minH: 280, maxH: 400, label: 'Top view of the car with tyre grip circles, and a g-g diagram' });
      const CR = EV.readouts(c.out, { used: ['Grip in use', '%'], fl: ['Front left load', 'kg'], fr: ['Front right load', 'kg'], rl: ['Rear left load', 'kg'], rr: ['Rear right load', 'kg'], tot: ['Total grip vs no transfer', '%'] });
      const cs = EV.controls(c.ctl, {
        ax: { label: 'Accelerate (+) / brake (−)', min: -1.2, max: 1.2, step: 0.05, value: -0.5, unit: 'g' },
        ay: { label: 'Cornering: left (+) / right (−)', min: -1.2, max: 1.2, step: 0.05, value: 0.4, unit: 'g' },
        h: { label: 'Centre-of-gravity height', min: 0.35, max: 0.95, step: 0.01, value: car.cgH, unit: 'm' },
        mu: { type: 'seg', label: 'Surface', options: [['1', 'Dry'], ['0.8', 'Wet'], ['0.3', 'Snow']], value: '1' },
      }, cUpd);
      let st = null;
      function cUpd() {
        const mu0 = +cs.mu, W = m0 * G, ax = cs.ax * G, ay = cs.ay * G, rs = car.rearStatic;
        const dL = m0 * ax * cs.h / car.wheelbase;                       // moves to the rear when accelerating
        const Ff = Math.max(0, W * (1 - rs) - dL), Fr = Math.max(0, W * rs + dL);
        const dFf = m0 * ay * cs.h / car.track * (Ff / W), dFr = m0 * ay * cs.h / car.track * (Fr / W);   // + ay = left turn, load to the right
        const fz = { fl: Math.max(0, Ff / 2 - dFf), fr: Ff / 2 + Math.min(dFf, Ff / 2), rl: Math.max(0, Fr / 2 - dFr), rr: Fr / 2 + Math.min(dFr, Fr / 2) };
        const cap = {}, dem = {}; let capSum = 0, worst = 0;
        const sumF = fz.fl + fz.fr + fz.rl + fz.rr, drive = cs.ax > 0 && car.drive === 'RWD';
        for (const k in fz) {
          cap[k] = mu0 * (1 - 0.12 * (fz[k] / (W / 4) - 1)) * fz[k]; capSum += cap[k];
          const share = fz[k] / sumF, rear = k[0] === 'r';
          const fx = drive ? (rear ? m0 * ax * fz[k] / (fz.rl + fz.rr || 1) : 0) : m0 * ax * share;
          dem[k] = { x: fx, y: m0 * ay * share, use: 0 };
          dem[k].use = cap[k] > 1 ? Math.hypot(dem[k].x, dem[k].y) / cap[k] : 9;
          worst = Math.max(worst, dem[k].use);
        }
        st = { fz, cap, dem, mu0, W, worst };
        CR({ used: fmt(worst * 100), fl: fmt(fz.fl / G), fr: fmt(fz.fr / G), rl: fmt(fz.rl / G), rr: fmt(fz.rr / G), tot: fmt(capSum / (mu0 * W) * 100) });
        cDraw();
      }
      function cDraw() {
        if (!st) return;
        const { ctx, w, h } = CC, col = EV.col;
        ctx.clearRect(0, 0, w, h);
        // ---- car from above (nose up)
        const px = Math.min(h / 6.3, w * 0.5 / 4.6), cx = w * 0.27, cy = h * 0.52;
        const L = car.wheelbase * px, T = car.track * px;
        EV.rr(ctx, cx - 0.96 * px, cy - 2.42 * px, 1.92 * px, 4.79 * px, 0.45 * px);
        ctx.fillStyle = col('body-fill'); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        EV.rr(ctx, cx - 0.72 * px, cy - 1.2 * px, 1.44 * px, 2.5 * px, 0.3 * px); ctx.fillStyle = col('glass'); ctx.fill();
        EV.text(ctx, 'front of car ↑', 8, 16, { size: 11, color: col('muted') });
        const pos = { fl: [cx - T / 2, cy - L / 2 - 0.1 * px], fr: [cx + T / 2, cy - L / 2 - 0.1 * px], rl: [cx - T / 2, cy + L / 2 - 0.1 * px], rr: [cx + T / 2, cy + L / 2 - 0.1 * px] };
        const rs = px * 0.95 / (st.mu0 * st.W / 4);                      // circle radius per newton of grip
        for (const k in pos) {
          const [x, y] = pos[k], r = st.cap[k] * rs, d = st.dem[k], over = d.use > 1.001;
          ctx.fillStyle = col('tyre'); EV.rr(ctx, x - 0.13 * px, y - 0.34 * px, 0.26 * px, 0.68 * px, 3); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, 7); ctx.fillStyle = EV.rgba(over ? 's8' : 's1', 0.16); ctx.fill();
          ctx.strokeStyle = col(over ? 's8' : 's1'); ctx.lineWidth = 2; ctx.stroke();
          EV.arrow(ctx, x, y, x - d.y * rs, y - d.x * rs, col(over ? 's8' : 'ink'), 3, 9);   // force of road on tyre: left turn -> points left
        }
        // ---- g-g diagram
        const gx = w * 0.76, gy = h * 0.5, gr = Math.min(h * 0.4, w * (w < 480 ? 0.155 : 0.2)), u = gr / 1.3;
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 1;
        for (const q of [0.5, 1]) { ctx.beginPath(); ctx.arc(gx, gy, q * u, 0, 7); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(gx - gr, gy); ctx.lineTo(gx + gr, gy); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx, gy + gr); ctx.stroke();
        ctx.beginPath(); ctx.arc(gx, gy, st.mu0 * u, 0, 7); ctx.strokeStyle = col('s1'); ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = EV.rgba('s1', 0.08); ctx.fill();
        EV.text(ctx, 'accelerate', gx, gy - gr - 5, { size: 11, align: 'center', color: col('muted') });
        EV.text(ctx, 'brake', gx, gy + gr + 14, { size: 11, align: 'center', color: col('muted') });
        EV.text(ctx, 'left', gx - gr - 4, gy + 4, { size: 11, align: 'right', color: col('muted') });
        EV.text(ctx, 'right', gx + gr + 4, gy + 4, { size: 11, color: col('muted') });
        if (w >= 480) EV.text(ctx, `limit ${fmt(st.mu0, 1)} g`, gx + st.mu0 * u * 0.71 + 4, gy - st.mu0 * u * 0.71 - 4, { size: 11, color: col('ink-2'), halo: true });
        const dx = gx - cs.ay * u, dy = gy - cs.ax * u, over = st.worst > 1.001;
        ctx.strokeStyle = col('muted'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(dx, dy); ctx.stroke();
        ctx.beginPath(); ctx.arc(dx, dy, 10, 0, 7); ctx.fillStyle = col('surface'); ctx.fill();
        ctx.beginPath(); ctx.arc(dx, dy, 7.5, 0, 7); ctx.fillStyle = col(over ? 's8' : 'ink'); ctx.fill();
        EV.text(ctx, over ? 'beyond the limit: sliding' : `${fmt(Math.hypot(cs.ax, cs.ay), 2)} g total`, gx, h - 6, { size: 12, weight: 600, align: 'center', color: col(over ? 's8' : 'ink') });
        CC.gg = { gx, gy, u };
      }
      CC.draw = cDraw;
      const dragTo = (e) => {
        const r = CC.cv.getBoundingClientRect(), q = CC.gg; if (!q) return;
        cs.set('ay', Math.round(clamp(-(e.clientX - r.left - q.gx) / q.u, -1.2, 1.2) * 20) / 20, true);
        cs.set('ax', Math.round(clamp(-(e.clientY - r.top - q.gy) / q.u, -1.2, 1.2) * 20) / 20, true);
        cUpd();
      };
      let dragging = false;
      CC.cv.addEventListener('pointerdown', (e) => { const r = CC.cv.getBoundingClientRect(); if (e.clientX - r.left > CC.w * 0.5) { dragging = true; CC.cv.setPointerCapture(e.pointerId); dragTo(e); e.preventDefault(); } });
      CC.cv.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
      CC.cv.addEventListener('pointerup', () => { dragging = false; });
      CC.cv.style.touchAction = 'none'; CC.cv.style.cursor = 'grab';
      cUpd();

      /* -------------------------------------------------------------- tilt table -- */
      const tl = EV.fig(root, 'tilt', { side: true, title: 'The tilt table', hint: 'The car seen from behind on a tilting platform. It tips when the line of its weight falls outside the lower tyre.',
        cap: '<b>Try this.</b> Find the tipping angle for the Model Y. Then raise the centre of gravity until the car tips <em>before</em> it would slide: that is what a tall, narrow vehicle is like.' });
      const TC = EV.canvas(tl.stage, { ratio: 0.6, minH: 260, maxH: 380, label: 'Rear view of the car on a tilted platform with its weight vector' });
      const TR = EV.readouts(tl.out, { tip: ['Tips over at', '°'], ssf: ['Stability factor T/2h', ''], slide: ['Slides at (μ = 1)', '°'], first: ['What happens first', ''] });
      const ts = EV.controls(tl.ctl, {
        ang: { label: 'Tilt angle', min: 0, max: 65, step: 1, value: 20, unit: '°' },
        h: { label: 'Centre-of-gravity height', min: 0.35, max: 1.1, step: 0.01, value: car.cgH, unit: 'm' },
      }, tUpd);
      const presets = EV.el('<div class="btn-row"></div>');
      [['Model Y', car.cgH], ['Typical SUV', 0.7], ['Loaded van', 0.95]].forEach(([n, hh]) => { const b = EV.el(`<button type="button" class="btn">${n} · ${hh} m</button>`); b.addEventListener('click', () => ts.set('h', hh)); presets.appendChild(b); });
      tl.ctl.appendChild(presets);
      function tUpd() {
        const tip = Math.atan(car.track / (2 * ts.h)) * 180 / Math.PI;
        TR({ tip: fmt(tip, 1), ssf: fmt(car.track / (2 * ts.h), 2), slide: '45.0', first: tip > 45 ? 'slides' : 'rolls over' });
        tDraw();
      }
      function tDraw() {
        const { ctx, w, h } = TC, col = EV.col, a = ts.ang * Math.PI / 180, px = Math.min(w / 4.6, h / 3.3);
        const tipA = Math.atan(car.track / (2 * ts.h)), tipping = a > tipA;
        const pivX = w * 0.46, pivY = h * 0.66;
        ctx.clearRect(0, 0, w, h);
        ctx.save(); ctx.translate(pivX, pivY); ctx.rotate(a);               // platform tilts down to the right
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-1.75 * px, 0); ctx.lineTo(1.75 * px, 0); ctx.stroke();
        const T = car.track * px, bw = 1.92 * px, bh = 1.25 * px, gc = 0.2 * px;
        for (const sx of [-1, 1]) { ctx.fillStyle = col('tyre'); EV.rr(ctx, sx * T / 2 - 0.13 * px, -0.7 * px, 0.26 * px, 0.7 * px, 4); ctx.fill(); }
        EV.rr(ctx, -bw / 2, -gc - bh, bw, bh, 0.2 * px); ctx.fillStyle = col('body-fill'); ctx.strokeStyle = col(tipping ? 's8' : 'body-line'); ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
        EV.rr(ctx, -bw * 0.36, -gc - bh - 0.36 * px, bw * 0.72, 0.5 * px, 0.16 * px); ctx.fillStyle = col('glass'); ctx.fill(); ctx.stroke();
        ctx.fillStyle = EV.rgba('s1', 0.3); EV.rr(ctx, -bw * 0.4, -gc - 0.13 * px, bw * 0.8, 0.12 * px, 2); ctx.fill();   // battery in the floor
        const cgx = 0, cgy = -ts.h * px;
        ctx.beginPath(); ctx.arc(cgx, cgy, 7, 0, 7); ctx.fillStyle = col('ink'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cgx, cgy); ctx.arc(cgx, cgy, 7, 0, Math.PI / 2); ctx.closePath(); ctx.fillStyle = col('surface'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cgx, cgy); ctx.arc(cgx, cgy, 7, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
        ctx.restore();
        // weight vector, vertical in the world, from the centre of gravity
        const cgX = pivX + ts.h * px * Math.sin(a), cgY = pivY - ts.h * px * Math.cos(a);
        const platY = pivY + (cgX - pivX) * Math.tan(a);                  // where the vertical through the CG meets the platform
        EV.arrow(ctx, cgX, cgY, cgX, platY - 2, col(tipping ? 's8' : 's3'), 3.5, 11);
        const tyreX = pivX + T / 2 * Math.cos(a), tyreY = pivY + T / 2 * Math.sin(a);
        ctx.beginPath(); ctx.arc(tyreX, tyreY, 5, 0, 7); ctx.fillStyle = col('ink'); ctx.fill();
        EV.text(ctx, 'pivot: lower tyre', tyreX + 10, tyreY + 16, { size: 11.5, color: col('ink-2'), halo: true });
        EV.text(ctx, 'weight', cgX + 8, (cgY + platY) / 2, { size: 11.5, weight: 600, color: col('ink'), halo: true });
        EV.text(ctx, tipping ? 'Weight falls outside the tyre: it tips' : 'Weight falls between the tyres: stable', w / 2, 20, { size: 13, weight: 600, align: 'center', color: col(tipping ? 's8' : 'ink') });
        EV.text(ctx, `equivalent to cornering at ${fmt(Math.tan(a), 2)} g`, w / 2, 38, { size: 11.5, align: 'center', color: col('muted') });
      }
      TC.draw = tDraw;
      tUpd();

      /* ------------------------------------------------------------------ braking -- */
      const b = EV.fig(root, 'brake', { title: 'Stopping distance', hint: 'Distance travelled while reacting, then while braking at the grip limit. All four bars share one scale.' });
      const hosts = {};
      Object.entries({ dry: ['Dry asphalt · μ 1.0', 1.0], wet: ['Wet asphalt · μ 0.8', 0.8], snow: ['Packed snow · μ 0.3', 0.3], ice: ['Ice · μ 0.1', 0.1] }).forEach(([k, [n, mu]]) => {
        const d = document.createElement('div'); d.style.marginBottom = '12px'; b.stage.appendChild(d); hosts[k] = { mu, n, d };
      });
      const bs = EV.controls(b.ctl, { v: { label: 'Speed', min: 30, max: 200, step: 5, value: 100, unit: 'km/h' }, tr: { label: 'Reaction time', min: 0.3, max: 2.5, step: 0.1, value: 1.0, unit: 's' } }, bUpd);
      function bUpd() {
        const v = bs.v / 3.6, max = v * bs.tr + v * v / (2 * 0.1 * G);
        for (const k in hosts) {
          const o = hosts[k], dr = v * bs.tr, db = v * v / (2 * o.mu * G);
          o.d.textContent = '';
          EV.segbar(o.d, { title: o.n, unit: 'm', max })([{ label: 'Reacting', value: dr, color: 'muted' }, { label: 'Braking', value: db, color: 's8' }], `${fmt(dr + db)} m · ${fmt(db / v * 2 + bs.tr, 1)} s`);
        }
      }
      bUpd();
    },

    quiz: (car) => [
      { q: 'You lower the tyre pressure from 2.9 to 2.2 bar. What happens to the contact patch and to rolling resistance?', o: ['Patch shrinks, resistance falls', 'Patch grows, resistance rises', 'Patch grows, resistance falls', 'Neither changes'], a: 1, why: 'Patch area ≈ load ÷ pressure, so lower pressure means a bigger patch. The tyre deforms more on each revolution, more energy is lost to hysteresis, and rolling resistance rises.' },
      { q: 'Where does a tyre deliver its maximum driving force on dry asphalt?', o: ['At zero slip', 'At roughly 10–20% slip', 'At 50% slip', 'At 100% slip (wheel spinning)'], a: 1, why: 'Force rises with slip as the tread stretches, peaks when parts of the patch begin to slide, then falls. A spinning wheel has less grip than one held near the peak, and no sideways grip to speak of.' },
      { q: 'A tyre is using 80% of its grip for braking. How much can it still supply for cornering?', o: ['20%', '40%', '60%', '80%'], a: 2, why: 'The forces add as vectors inside the friction circle: √(1 − 0.8²) = 0.6. That is why braking hard and steering hard at once does not work.' },
      { q: `The Model Y's static stability factor is about ${fmt(car.track / (2 * car.cgH), 2)} and its tyres grip at about 1.0 g. On a flat dry road, if you corner too fast, the car will…`, o: ['Roll over', 'Slide', 'Do both at once', 'Neither, electronics prevent it'], a: 1, why: 'Rolling needs a sideways acceleration above T/2h, far more than the tyres can transmit. Grip runs out first, so the car slides. Rollovers need a "trip": a kerb, soft ground, or a slope.' },
      { q: 'Two cars brake at the limit from 100 km/h on the same road with the same tyres. One weighs 1200 kg, the other 2100 kg. Which stops shorter?', o: ['The lighter car', 'The heavier car', 'They stop in the same distance', 'It depends on the brake size only'], a: 2, why: 'Maximum deceleration is μ·g: the heavier car needs more force but presses its tyres down proportionally harder. In practice tyre load sensitivity gives the lighter car a small edge.' },
    ],
  });
})();
