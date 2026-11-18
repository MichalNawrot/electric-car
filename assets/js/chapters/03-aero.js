/* Chapter 3 — Aerodynamics: dynamic pressure, where drag comes from, shape vs size, the air itself. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, { clamp } = P;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // Side profiles in metres: x from the tail (0) to the nose, flow arrives from +x. top = upper surface as [x, height].
  const SHAPES = {
    plate: { name: 'Flat plate', cd: 1.17, top: [[2.2, 1.8], [2.4, 1.8]], sep: 2.2, wake: 5.2, note: 'Air piles up in front and tears away at the edges. Almost the whole frontal area is dragged along as a low-pressure wake.' },
    box: { name: 'Boxy SUV', cd: 0.38, top: [[0, 1.5], [0.15, 1.72], [3.2, 1.75], [3.6, 1.15], [4.55, 1.02], [4.7, 0.6]], sep: 0.12, wake: 3.4, wheels: true, note: 'An upright tail cannot guide the air back together. The flow separates at the roof edge and leaves a wake as tall as the car.' },
    y: { name: 'Model Y', cd: 0.23, top: [[0, 0.63], [0.18, 1.11], [0.31, 1.12], [1.0, 1.4], [1.51, 1.57], [2.0, 1.61], [2.66, 1.5], [3.54, 0.96], [4.61, 0.69], [4.73, 0.34]], sep: 0.3, wake: 1.7, car: true, note: 'The roof falls away gently so the air stays attached almost to the tail. The sharp lip then releases it cleanly, leaving a wake only as tall as the boot lid.' },
    drop: { name: 'Teardrop', cd: 0.09, top: [[0, 0.22], [0.9, 0.62], [2.0, 1.12], [3.0, 1.5], [3.7, 1.6], [4.3, 1.4], [4.65, 0.95], [4.75, 0.4]], sep: 0.0, wake: 0.5, wheels: true, note: 'A long tapered tail lets the pressure recover fully. Almost no wake. Solar racers and record cars look like this, at the cost of all practicality.' },
  };
  const LAM = 5;                               // how quickly the body's influence fades with height (m)
  function topAt(sh, x) { const t = sh.top; if (x <= t[0][0]) return t[0][1]; if (x >= t[t.length - 1][0]) return t[t.length - 1][1]; return P.interp(t, x); }
  /** Displacement surface: body, plus the air cushion ahead of the nose, plus the wake behind the separation point. */
  function disp(sh, x) {
    const t = sh.top, front = t[t.length - 1][0], hF = t[t.length - 1][1], hS = topAt(sh, sh.sep);
    if (x > front) return hF * (1 - smooth((x - front) / 1.3));
    if (x >= sh.sep) return topAt(sh, x);
    return hS * (1 - smooth((sh.sep - x) / sh.wake));
  }

  EV.chapter({
    id: 'aero', n: '3', title: 'Aerodynamics', color: 's1',
    blurb: 'Why the back of the car matters more than the front, and why drag area, not drag coefficient, is what the battery pays for.',
    lead: 'Above roughly 80 to 90 km/h more than half of the energy at the wheels goes into stirring air. Understanding where that drag comes from explains the shape of every modern electric car.',
    html(car) {
      const q = (kmh) => 0.5 * P.rho() * (kmh / 3.6) ** 2;
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>Drag force = dynamic pressure × drag area: ${M`F = q \cdot C_d A`} with ${M`q = \frac{1}{2}\rho v^2`}.</li>
        <li>On a car, drag is mostly a <strong>pressure difference</strong>: high pressure on the nose, low pressure in the wake. Surface friction is a minor part.</li>
        <li>The size of the wake is set by the <strong>rear</strong> of the car. A gentle taper beats a sharp nose.</li>
        <li>The battery pays for C<sub>d</sub> × A. A slippery shape on a big frontal area can still cost more than a boxy small one.</li>
      </ul></div>

      <h2><span class="n">3.1</span>Dynamic pressure: the weight of moving air</h2>
      <p>Air has mass, about ${fmt(P.rho(), 2)} kg in every cubic metre. Bring moving air to rest against a surface and its kinetic energy turns into pressure. That pressure is the <em class="t">dynamic pressure</em>:</p>
      ${eq(String.raw`q = \frac{1}{2} \rho v^2`, 'At 100 km/h: ½ × 1.20 × 27.8² = <b>' + fmt(q(100)) + ' Pa</b>. At 130 km/h: <b>' + fmt(q(130)) + ' Pa</b>.')}
      <p>${fmt(q(100))} pascals is tiny, less than half a percent of atmospheric pressure. But it acts on a large area. If the full dynamic pressure pressed on the whole ${car.area} m² frontal area, the force would be ${M`q \cdot A = ${fmt(q(100) * car.area)} \text{ N}`} at 100 km/h. That is the reference force. The <em class="t">drag coefficient</em> C<sub>d</sub> compares the real drag with it. A flat plate held face-on to the wind scores about 1.2, more than 1 because suction behind it adds to the pressure in front. The Model Y scores ${car.cd}, so its drag is ${fmt(q(100) * car.area * car.cd)} N.</p>
      ${eq(String.raw`F_{drag} = q \cdot C_d \cdot A = \frac{1}{2} \rho v^2 C_d A`)}

      <h2><span class="n">3.2</span>Where drag comes from</h2>
      <p>Air approaching the nose slows down and its pressure rises: that pushes the car back. Air squeezing over the roof speeds up and its pressure drops (Bernoulli's principle). If the air could close up smoothly behind the car, the pressure would recover at the tail and push the car <em>forward</em> almost as hard as the nose is pushed back. In an ideal fluid the two would cancel exactly.</p>
      <p>Real air has viscosity. A thin <em class="t">boundary layer</em> next to the body loses momentum, and where the surface curves away too sharply it can no longer follow. The flow <em class="t">separates</em> and leaves a churning, low-pressure <em class="t">wake</em>. High pressure in front, low pressure behind: that difference is pressure drag, and it is most of the drag of any road vehicle.</p>
      <div data-fig="flow"></div>
      <div class="callout myth"><h5>Common misconception</h5><p>"A pointed nose makes a car slippery." The nose only needs to be rounded enough for the air to stay attached. The drag is decided at the back, by how much of the car's cross-section the wake inherits. That is why efficient cars have blunt noses and long, tapering, cut-off tails, and why the Model Y's roofline starts falling just behind the driver's head.</p></div>

      <h3>The drag budget of a real car</h3>
      <p>Wind-tunnel work on a modern car is a hunt through many small contributions. The split below is typical of a current passenger car (approximate; it varies by design).</p>
      <div data-fig="budget"></div>
      <p>An electric car gets three of these almost for free. The battery makes the <strong>underbody</strong> a flat sealed plate. With no radiator to feed a hot engine, <strong>cooling drag</strong> shrinks and the front can be closed. And designers add <strong>wheel covers</strong> because rotating open wheels act like fans: Tesla's own figures put the covers at a few percent of range.</p>

      <h2><span class="n">3.3</span>Shape times size</h2>
      <p>C<sub>d</sub> describes shape only. What enters the force equation is the product C<sub>d</sub>·A, the <em class="t">drag area</em>: the frontal area an object with C<sub>d</sub> = 1 would need to have the same drag. The Model Y's is ${fmt(car.cd * car.area, 2)} m², a square about ${fmt(Math.sqrt(car.cd * car.area) * 100)} cm on a side. Compare some typical vehicles, and what each needs to push through the air at 120 km/h.</p>
      <div data-fig="cda"></div>

      <h2><span class="n">3.4</span>The air itself: temperature, altitude, wind</h2>
      <p>Drag is proportional to air density, and density follows the ideal gas law ${M`\rho = p / (R T)`}. Cold air is denser. Mountain air is thinner. Wind changes the speed that goes into ${M`v^2`}.</p>
      <div data-fig="air"></div>
      <p>This is one of the four reasons winter range is shorter (the others are tyres, the battery itself and heating, in Chapters 4, 7 and 11). At −10 °C the air is ${fmt((P.rho(-10) / P.rho(20) - 1) * 100)}% denser than at 20 °C, and so is the drag.</p>`;
    },

    init(root, car) {
      /* ---------------------------------------------------------------- flow -- */
      const f = EV.fig(root, 'flow', { side: true, title: 'Air flowing past four shapes', hint: 'All four have the same frontal area. Streaks follow the air; colour shows pressure relative to the surrounding air.',
        cap: '<b>What to look for.</b> The size of the grey churning region behind each body. Its pressure is below ambient, so it pulls the body backward. A qualitative picture built from simple flow rules, not a wind-tunnel simulation.' });
      const C = EV.canvas(f.stage, { ratio: 0.43, minH: 220, maxH: 360, label: 'Animated airflow around a body, with a wake behind it' });
      const legend = EV.el('<div class="legend" style="margin-top:8px"><span><i style="background:var(--s8)"></i>higher pressure (air slowed)</span><span><i style="background:var(--s1)"></i>lower pressure (air sped up)</span><span><i style="background:var(--muted)"></i>separated wake</span></div>');
      f.stage.appendChild(legend);
      const note = EV.el('<div class="info" style="min-height:0;margin-top:4px"></div>');
      const R = EV.readouts(f.out, { cd: ['Drag coefficient', ''], f: ['Drag force', 'N', 's1'], p: ['Power to push the air', 'kW'], e: ['Air energy per km', 'Wh/km'] });
      const s = EV.controls(f.ctl, {
        shape: { type: 'seg', label: 'Shape', options: Object.entries(SHAPES).map(([k, v]) => [k, v.name]), value: 'y' },
        speed: { label: 'Speed', min: 30, max: 200, step: 5, value: 120, unit: 'km/h' },
      }, upd);
      f.ctl.appendChild(note);
      const N = 300, parts = [], wake = [];
      const X0 = -4.6, X1 = 8.2, YTOP = 4.9;
      const spawn = (p, anywhere) => { p.x = anywhere ? X0 + Math.random() * (X1 - X0) : X1 + Math.random() * 0.6; p.y0 = 0.04 + Math.pow(Math.random(), 1.5) * 4.7; };
      for (let i = 0; i < N; i++) { const p = {}; spawn(p, true); parts.push(p); }
      for (let i = 0; i < 70; i++) wake.push({ r: 0.15 + Math.random() * 0.85, ph: Math.random() * 6.28, w: 0.6 + Math.random() * 0.9, j: Math.random() * 6.28 });
      function upd() {
        const sh = SHAPES[s.shape], v = s.speed / 3.6, F = 0.5 * P.rho() * sh.cd * car.area * v * v;
        R({ cd: sh.cd.toFixed(2), f: fmt(F), p: fmt(F * v / 1000, 1), e: fmt(F / 3.6) });
        note.innerHTML = `<p style="margin:0"><b style="color:var(--ink)">${sh.name}.</b> ${sh.note}</p>`;
      }
      // local speed relative to the free stream, from streamline spacing (continuity) plus a stagnation zone at a blunt nose
      function speedAt(sh, x, y0) {
        const t = sh.top, front = t[t.length - 1][0], hF = t[t.length - 1][1];
        let sp = 1 / (1 - disp(sh, x) / LAM * Math.exp(-y0 / LAM) * 1.6);
        sp *= 1 - 0.8 * (hF / 1.8) * Math.exp(-(((x - front - 0.25) / 0.7) ** 2)) * Math.exp(-y0 / 1.1);
        return clamp(sp, 0.12, 2.2);
      }
      const yOf = (sh, x, y0) => y0 + disp(sh, x) * Math.exp(-y0 / LAM);
      function draw(t, dt) {
        const { ctx, w, h } = C, col = EV.col, sh = SHAPES[s.shape];
        const k = w / (X1 - X0), gy = h - 22, px = (x) => (x - X0) * k, py = (y) => gy - y * k;
        const U = 1.2 + s.speed / 40;                                   // visual speed, m per second of animation
        ctx.clearRect(0, 0, w, h);
        // wake wash
        const hS = topAt(sh, sh.sep);
        if (sh.wake > 0.8) {
          ctx.beginPath(); ctx.moveTo(px(sh.sep), py(0));
          for (let x = sh.sep; x >= sh.sep - sh.wake; x -= 0.1) ctx.lineTo(px(x), py(disp(sh, x)));
          ctx.lineTo(px(sh.sep - sh.wake), py(0)); ctx.closePath();
          ctx.fillStyle = EV.rgba('muted', 0.12); ctx.fill();
        }
        // streamlines
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (const p of parts) {
          const sp = speedAt(sh, p.x, p.y0);
          p.x -= U * sp * dt;
          if (p.x < X0) spawn(p);
          const y = yOf(sh, p.x, p.y0);
          if (y > YTOP) continue;
          if (p.x < sh.sep && p.x > sh.sep - sh.wake && y < disp(sh, p.x) + 0.02) continue;
          const cp = 1 - sp * sp, len = 0.16 + 0.22 * sp, x2 = p.x + len;
          ctx.strokeStyle = cp >= 0 ? EV.mix('muted', 's8', clamp(cp * 1.3, 0, 1)) : EV.mix('muted', 's1', clamp(-cp * 0.9, 0, 1));
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(px(p.x), py(y)); ctx.lineTo(px(x2), py(yOf(sh, x2, p.y0))); ctx.stroke();
        }
        // wake eddies
        if (sh.wake > 0.8) {
          ctx.strokeStyle = col('muted'); ctx.globalAlpha = 0.6; ctx.lineWidth = 1.4;
          const cxw = sh.sep - sh.wake * 0.3, a = sh.wake * 0.27, b = hS * 0.42;
          for (const q of wake) {
            q.ph += dt * q.w * (0.8 + U * 0.5) / (0.4 + q.r);
            q.j += dt * 7;
            const x = cxw + a * q.r * Math.cos(q.ph) + 0.04 * Math.sin(q.j), y = hS * 0.47 + b * q.r * Math.sin(q.ph) + 0.04 * Math.cos(q.j * 1.3);
            const x2 = cxw + a * q.r * Math.cos(q.ph - 0.25), y2 = hS * 0.47 + b * q.r * Math.sin(q.ph - 0.25);
            if (y < 0.03 || y2 < 0.03) continue;
            ctx.beginPath(); ctx.moveTo(px(x), py(y)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        // ground
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        // body
        if (sh.car) EV.art.drawCar(ctx, px(2.37), gy, { scale: k / 200 });
        else {
          const tp = sh.top; ctx.beginPath(); ctx.moveTo(px(tp[0][0]), py(sh.wheels ? 0.2 : 0.02));
          tp.forEach(([x, y]) => ctx.lineTo(px(x), py(y)));
          ctx.lineTo(px(tp[tp.length - 1][0]), py(sh.wheels ? 0.2 : 0.02)); ctx.closePath();
          ctx.fillStyle = col('body-fill'); ctx.strokeStyle = col('body-line'); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
          if (sh.wheels) for (const wx of [0.93, 3.82]) { ctx.fillStyle = col('tyre'); ctx.beginPath(); ctx.arc(px(wx), py(0.35), 0.35 * k, 0, 7); ctx.fill(); ctx.fillStyle = col('rim'); ctx.beginPath(); ctx.arc(px(wx), py(0.35), 0.22 * k, 0, 7); ctx.fill(); }
        }
        // labels and drag arrow
        const tp = sh.top, front = tp[tp.length - 1][0];
        EV.text(ctx, 'high pressure', px(front + 0.35), py(0.25), { size: 11.5, color: col('ink-2'), halo: true });
        if (sh.wake > 0.8) EV.text(ctx, 'low-pressure wake', px(sh.sep - sh.wake * 0.3), py(hS + 0.25), { size: 11.5, color: col('ink-2'), align: 'center', halo: true });
        const F = 0.5 * P.rho() * sh.cd * car.area * (s.speed / 3.6) ** 2, L = Math.min(F * 0.085 * w / 700, px(front) - 20);
        const ax = px((sh.sep + front) / 2 + 0.6), ay = py(topAt(sh, (sh.sep + front) / 2) + 0.75);
        EV.arrow(ctx, ax, ay, ax - L, ay, col('s1'), 4, 11);
        EV.text(ctx, `drag ${fmt(F)} N`, ax + 6, ay + 4, { size: 12, weight: 600, color: col('ink'), halo: true });
        EV.text(ctx, '← air', w - 12, 16, { size: 11.5, align: 'right', color: col('muted') });
      }
      upd();
      C.draw = () => draw(0, 0);
      EV.loop(C.cv, draw);

      /* -------------------------------------------------------------- budget -- */
      const b = EV.fig(root, 'budget', { tag: 'Breakdown · typical values', title: 'Where a modern car\'s drag comes from' });
      const seg = EV.segbar(b.stage, { title: 'Share of total drag', unit: '%' });
      seg([{ label: 'Body shape and wake', value: 45, color: 's1' }, { label: 'Wheels and wheel arches', value: 25, color: 's2' }, { label: 'Underbody', value: 15, color: 's3' }, { label: 'Cooling airflow', value: 8, color: 's4' }, { label: 'Mirrors, gaps, details', value: 7, color: 's5' }], '100%');

      /* ----------------------------------------------------------------- CdA -- */
      const c = EV.fig(root, 'cda', { tag: 'Comparison · approximate values', title: 'Drag area and what it costs at 120 km/h' });
      c.stage.innerHTML = '<div class="fig-row"><div><div class="small" style="margin-bottom:8px">Drag area C<sub>d</sub>·A (m²)</div><div data-a></div></div><div><div class="small" style="margin-bottom:8px">Power needed to push the air at 120 km/h (kW)</div><div data-b></div></div></div>';
      const list = [['Streamlined saloon, C_d 0.20', 0.20, 2.3], [`Model Y, C_d ${car.cd}`, car.cd, car.area, true], ['Typical hatchback, C_d 0.30', 0.30, 2.2], ['Typical SUV, C_d 0.34', 0.34, 2.7], ['Large pickup, C_d 0.42', 0.42, 3.3], ['Delivery van, C_d 0.36', 0.36, 4.6]];
      const pw = (cda) => 0.5 * P.rho() * cda * (120 / 3.6) ** 3 / 1000;
      EV.bars(EV.$('[data-a]', c.stage), { dec: 2, unit: 'm²' })(list.map(([n, cd, a, hi]) => ({ label: n.replace('C_d', 'Cd'), value: cd * a, color: 's1', hi })));
      EV.bars(EV.$('[data-b]', c.stage), { dec: 1, unit: 'kW' })(list.map(([n, cd, a, hi]) => ({ label: n.replace(/,.*/, ''), value: pw(cd * a), color: 's1', hi })));

      /* ----------------------------------------------------------------- air -- */
      const a = EV.fig(root, 'air', { side: true, title: 'Thick air, thin air, moving air', hint: 'Power needed to overcome air drag, in standard air and in the conditions you choose.' });
      const ap = EV.plot(a.stage, { h: 290, x: { label: 'Road speed (km/h)', min: 0, max: 200, unit: 'km/h' }, y: { label: 'Power to push the air (kW)', min: 0, max: 'auto', unit: 'kW' } });
      const AR = EV.readouts(a.out, { rho: ['Air density', 'kg/m³'], d: ['Density vs standard', '%'], f: ['Drag force at this speed', 'N', 's1'], x: ['Drag vs standard air, no wind', '%'] });
      const as = EV.controls(a.ctl, {
        speed: { label: 'Road speed', min: 30, max: 200, step: 5, value: 120, unit: 'km/h' },
        temp: { label: 'Air temperature', min: -30, max: 45, step: 1, value: 20, unit: '°C' },
        alt: { label: 'Altitude', min: 0, max: 3000, step: 100, value: 0, unit: 'm' },
        wind: { label: 'Headwind', min: -40, max: 40, step: 5, value: 0, unit: 'km/h' },
        box: { type: 'toggle', label: 'Roof box fitted (drag area +25%, typical)', value: false },
      }, aUpd);
      function aUpd() {
        const cda = car.cd * car.area * (as.box ? 1.25 : 1), rho = P.rho(as.temp, as.alt), w = as.wind / 3.6;
        const pwr = (kmh, r, wd, cd) => { const v = kmh / 3.6, va = v + wd; return 0.5 * r * cd * va * Math.abs(va) * v / 1000; };
        const cur = pwr(as.speed, rho, w, cda), std = pwr(as.speed, P.rho(), 0, car.cd * car.area), v = as.speed / 3.6;
        ap.set({
          series: [{ name: 'Your conditions', color: 's1', area: true, pts: EV.sample((x) => pwr(x, rho, w, cda), 0, 200, 80) }, { name: 'Standard: 20 °C, sea level, no wind', color: 'muted', dash: true, pts: EV.sample((x) => pwr(x, P.rho(), 0, car.cd * car.area), 0, 200, 80) }],
          vlines: [{ x: as.speed }], points: [{ x: as.speed, y: cur, color: 's1', label: `${fmt(cur, 1)} kW` }],
        });
        AR({ rho: fmt(rho, 3), d: (rho >= P.rho() ? '+' : '') + fmt((rho / P.rho() - 1) * 100), f: fmt(cur * 1000 / v), x: (cur >= std ? '+' : '') + fmt((cur / std - 1) * 100) });
      }
      aUpd();
    },

    quiz: (car) => [
      { q: 'Most of the aerodynamic drag on a car comes from…', o: ['Friction of air sliding along the paint', 'The pressure difference between the front and the wake behind', 'Air resistance of the tyres\' tread', 'Turbulence from the windscreen wipers'], a: 1, why: 'Road vehicles are "bluff bodies". The flow separates at the rear and leaves a low-pressure wake. High pressure in front minus low pressure behind is pressure drag, typically 80% or more of the total.' },
      { q: `Car A has C<sub>d</sub> 0.25 and frontal area 2.8 m². Car B has C<sub>d</sub> 0.30 and frontal area 2.1 m². Which has more air drag at the same speed?`, o: ['Car A', 'Car B', 'They are equal', 'It depends on the speed'], a: 0, why: 'Compare drag areas: A is 0.25 × 2.8 = 0.70 m², B is 0.30 × 2.1 = 0.63 m². Car A has more drag despite the better coefficient. The ratio is the same at every speed.' },
      { q: 'Why do efficient cars have a roofline that tapers toward a sharp cut-off tail?', o: ['To reduce weight', 'To keep the air attached as long as possible and make the wake small', 'To increase downforce', 'To make room for the battery'], a: 1, why: 'A gentle taper lets the pressure recover before the flow separates. Cutting the tail off sharply where it has become small (a "Kamm tail") fixes the separation point and leaves a small wake.' },
      { q: 'On a −10 °C day at sea level, compared with a 20 °C day, air drag at the same speed is about…', o: ['11% lower', 'the same', '11% higher', '30% higher'], a: 2, why: 'Density is inversely proportional to absolute temperature: 293 K / 263 K = 1.11. Drag is proportional to density.' },
      { q: 'Dynamic pressure at 100 km/h is about 460 Pa. At 200 km/h it is…', o: ['920 Pa', '1840 Pa', '3680 Pa', '460 Pa'], a: 1, why: 'q = ½ρv² grows with the square of speed: doubling the speed multiplies it by four.' },
    ],
  });
})();
