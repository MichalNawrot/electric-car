/* Chapter 1 — Forces on the road: the road-load equation, power = force x speed, inertia, coast-down. */
(function () {
  'use strict';
  const EV = window.EV, { M, eq, fmt } = EV, P = EV.phys, G = P.G;

  EV.chapter({
    id: 'forces', n: '1', title: 'Forces on the road', color: 's1',
    blurb: 'A handful of forces decide everything the car does. Learn them and you can estimate range, top speed and hill climbing on a napkin.',
    lead: 'At every instant four forces act along the road: the drive force from the tyres, and against it air drag, rolling resistance and gravity on a slope. Whatever is left over changes the car\'s speed. Everything else in this guide follows from that balance.',
    html(car) {
      const m = car.curb + 75, rl = P.roadLoad(car, { v: 120 / 3.6, mass: m });
      const ke = (kmh) => 0.5 * m * car.rot * (kmh / 3.6) ** 2;      // including the spinning wheels and rotors
      return `
      <div class="keys"><h4>Key ideas</h4><ul>
        <li>Along the road, Newton's second law reads: drive force minus resistance equals mass times acceleration.</li>
        <li>Air drag grows with the <strong>square</strong> of speed. Rolling resistance barely changes. A hill can dwarf both.</li>
        <li>Power is force times speed, so the power to beat air drag grows with the <strong>cube</strong> of speed.</li>
        <li>Force <em>is</em> energy per distance: every newton of resistance costs 1 joule per metre, or 0.278 Wh per km.</li>
      </ul></div>

      <h2><span class="n">1.1</span>The force balance</h2>
      <p>Draw the car as a box and ask what pushes on it along the direction of travel. The tyres push it forward with the <em class="t">drive force</em>. Three things push back.</p>
      ${eq(String.raw`F_{drive} = \frac{1}{2} \rho C_d A v^2 + C_{rr} m g \cos\theta + m g \sin\theta + m_{eff} a`,
        '<b>ρ</b> air density · <b>C<sub>d</sub>A</b> drag area · <b>v</b> speed through the air · <b>C<sub>rr</sub></b> rolling-resistance coefficient · <b>m</b> mass · <b>θ</b> slope angle · <b>a</b> acceleration')}
      <ul>
        <li><strong style="color:var(--s1)">■</strong> <strong>Air drag</strong> ${M`\frac{1}{2}\rho C_d A v^2`}. The car must shove about ${fmt(P.rho() * car.area * 100 / 3.6, 0)} kg of air out of its way every second at 100 km/h. Double the speed and the force quadruples.</li>
        <li><strong style="color:var(--s2)">■</strong> <strong>Rolling resistance</strong> ${M`C_{rr} m g`}. Tyres flex as they roll and the rubber does not give all of that energy back. The loss is proportional to the weight they carry: about ${fmt(car.crr * 1000, 1)} N for every 1000 N of weight.</li>
        <li><strong style="color:var(--s3)">■</strong> <strong>Gravity on a slope</strong> ${M`m g \sin\theta`}. On a 5% grade, 5% of the car's weight points back down the road. For a ${fmt(m)} kg car that is ${fmt(m * G * 0.05)} N, more than air drag at motorway speed.</li>
        <li><strong style="color:var(--s4)">■</strong> <strong>Inertia</strong> ${M`m_{eff} a`}. Not a force on the car at all, but the price of changing its speed: the net force left over after the other three. It is covered in section 1.3.</li>
      </ul>
      <p>Set the acceleration to zero and what is left is the <em class="t">road load</em>: the force needed just to hold a steady speed. Explore it below. Before you move anything, guess: at what speed does air drag overtake rolling resistance?</p>

      <div data-fig="explorer"></div>

      <div class="callout ex"><h5>Worked example · ${car.name} at 120 km/h on a flat road</h5>
        <p>Speed ${M`v = 33.3 \text{ m/s}`}, air density 1.204 kg/m³, drag area ${fmt(car.cd * car.area, 3)} m², mass with driver ${fmt(m)} kg.</p>
        <p>Air drag ${M`= 0.5 \times 1.204 \times ${fmt(car.cd * car.area, 3)} \times 33.33^2 = ${fmt(rl.aero)} \text{ N}`}. Rolling ${M`= ${car.crr} \times ${m} \times 9.81 = ${fmt(rl.roll)} \text{ N}`}. Total <strong>${fmt(rl.total)} N</strong>, the weight of a ${fmt(rl.total / G)} kg mass. That is all it takes to keep two tonnes moving at motorway speed.</p></div>

      <h2><span class="n">1.2</span>From force to power to energy</h2>
      <p>Force alone does not drain a battery. Force applied <em>over a distance</em> does: that is work, and work per second is power.</p>
      ${eq(String.raw`P = F \cdot v \quad\quad \frac{E}{d} = F`, 'Power in watts = newtons × metres per second. Energy per metre in joules = newtons.')}
      <p>The second relation is the most useful shortcut in this guide. A resisting force of 1 N costs 1 J for every metre, which is 1000 J per km, which is 0.278 Wh per km. So <strong>divide the force in newtons by 3.6 and you have the energy use at the wheels in Wh/km</strong>. The ${fmt(rl.total)} N above is ${fmt(rl.total / 3.6)} Wh/km before any drivetrain losses.</p>
      <p>Switch the graph in the explorer between force, power and energy per km. Because power multiplies the v² force by another v, the power needed to fight the air follows <em class="t">v³</em>: going from 100 to 130 km/h raises drag power by a factor of ${fmt(1.3 ** 3, 1)}.</p>
      <div class="callout myth"><h5>Common misconception</h5><p>"Driving faster uses more energy because the motor works harder for longer." It is the opposite: at higher speed the trip is <em>shorter</em>. Energy per km rises only because the resisting <em>force</em> rises. Time does not enter the calculation at all, apart from always-on loads such as heating.</p></div>

      <h2><span class="n">1.3</span>Inertia and kinetic energy</h2>
      <p>To change speed the car needs a net force ${M`F = m_{eff} a`}. The effective mass is about 5% higher than the real mass because the wheels and motor rotors must be spun up too. Launching the ${car.name} at 0.5 g takes ${fmt(m * car.rot * 0.5 * G / 1000, 1)} kN, some ${fmt(m * car.rot * 0.5 * G / rl.total)} times the force needed to cruise at 120 km/h.</p>
      <p>The work done by that force is stored as <em class="t">kinetic energy</em>, ${M`E_k = \frac{1}{2} m v^2`}. It is not lost. It is a second, small battery that fills as you speed up and empties as you slow down. A good way to feel its size is to ask how high the same energy would lift the car, since ${M`\frac{1}{2} m v^2 = m g h`} gives ${M`h = v^2 / 2g`} whatever the mass.</p>
      <div data-fig="kinetic"></div>
      <p>At 130 km/h the car carries ${fmt(ke(130) / 3.6e6, 2)} kWh of kinetic energy, counting the spin of its wheels and rotors, ${fmt(ke(130) / 3.6e6 / car.usable * 100, 1)}% of a full battery. A friction brake turns all of it into heat. Chapter 10 shows how much of it an electric car can take back.</p>

      <h2><span class="n">1.4</span>Measuring the forces: the coast-down test</h2>
      <p>How does anyone know a car's drag area and rolling resistance? Engineers take it to a long flat track, reach about 130 km/h, select neutral and let it coast. With no drive force the equation of motion becomes</p>
      ${eq(String.raw`m_{eff} \frac{dv}{dt} = -\left( \frac{1}{2}\rho C_d A v^2 + C_{rr} m g \right)`)}
      <p>The shape of the speed trace reveals both numbers. At high speed the curve is steep and bent, which is the v² term. At low speed it becomes a straight line, which is the constant rolling term. Change the car and watch the trace respond.</p>
      <div data-fig="coast"></div>
      <p>A well-shaped two-tonne car coasts for well over two kilometres from motorway speed. That long glide is the kinetic energy of section 1.3 being spent, slowly, against a few hundred newtons.</p>`;
    },

    init(root, car) {
      /* ------------------------------------------------ force explorer ---- */
      const f = EV.fig(root, 'explorer', { side: true, title: 'Road-load explorer', hint: 'Hold a steady speed and see which forces the motor has to balance. Arrows and graph are to scale.',
        cap: '<b>Try this.</b> Find the speed where the blue and orange arrows are equal. Then add a 6% hill and see what happens to the total. Then drive at 100 km/h into a 40 km/h headwind and compare it with 140 km/h in still air.' });
      const C = EV.canvas(f.stage, { ratio: 0.46, minH: 230, maxH: 330, label: 'Car on a road with arrows showing air drag, rolling resistance, gravity and drive force' });
      const plotHost = document.createElement('div'); f.stage.appendChild(plotHost);
      const plot = EV.plot(plotHost, { h: 230, x: { label: 'Speed (km/h)', min: 0, max: 200, unit: 'km/h' }, y: { label: 'Resisting force (N)', min: 0, max: 'auto' } });
      const R = EV.readouts(f.out, { aero: ['Air drag', 'N', 's1'], roll: ['Rolling', 'N', 's2'], grade: ['Gravity', 'N', 's3'], total: ['Drive force', 'N'], power: ['Power at wheels', 'kW'], whkm: ['Energy at wheels', 'Wh/km'] });
      let rl, spin = 0, dash = 0;
      const s = EV.controls(f.ctl, {
        speed: { label: 'Speed', min: 0, max: 200, step: 1, value: 100, unit: 'km/h' },
        grade: { label: 'Road grade', min: -10, max: 10, step: 0.5, value: 0, unit: '%' },
        wind: { label: 'Headwind', min: -40, max: 40, step: 5, value: 0, unit: 'km/h' },
        load: { label: 'Passengers and cargo', min: 0, max: 450, step: 25, value: 75, unit: 'kg' },
        show: { type: 'seg', label: 'Graph shows', options: [['f', 'Force'], ['p', 'Power'], ['e', 'Energy per km']], value: 'f' },
      }, update);
      function update() {
        const mass = car.curb + s.load, v = s.speed / 3.6, o = { grade: s.grade / 100, wind: s.wind / 3.6, mass };
        rl = P.roadLoad(car, Object.assign({ v }, o));
        R({ aero: fmt(rl.aero), roll: fmt(rl.roll), grade: fmt(rl.grade), total: fmt(rl.total), power: fmt(rl.total * v / 1000, 1), whkm: fmt(rl.total / 3.6) });
        const conv = s.show === 'f' ? () => 1 : s.show === 'p' ? (kmh) => kmh / 3.6 / 1000 : () => 1 / 3.6;
        const at = (kmh) => { const r = P.roadLoad(car, Object.assign({ v: kmh / 3.6 }, o)), k = conv(kmh); return { roll: r.roll * k, aero: r.aero * k, grade: r.grade * k, total: r.total * k }; };
        const xs = EV.range(0.5, 200, 100), pts = xs.map(at);
        const series = [
          { name: 'Rolling resistance', color: 's2', stack: true, pts: xs.map((x, i) => [x, pts[i].roll]) },
          { name: 'Air drag', color: 's1', stack: true, pts: xs.map((x, i) => [x, Math.max(0, pts[i].aero)]) },
        ];
        if (s.grade > 0) series.push({ name: 'Gravity (uphill)', color: 's3', stack: true, pts: xs.map((x, i) => [x, pts[i].grade]) });
        if (s.grade < 0 || s.wind < 0) series.push({ name: 'Net, with help from gravity or tailwind', color: 'ink', pts: xs.map((x, i) => [x, pts[i].total]) });
        plot.opts.y.unit = { f: 'N', p: 'kW', e: 'Wh/km' }[s.show];
        EV.$('.plot-y', plot.host).textContent = { f: 'Resisting force (N)', p: 'Power needed at the wheels (kW)', e: 'Energy at the wheels (Wh/km)' }[s.show];
        const cur = at(Math.max(0.5, s.speed));
        plot.set({ series, yMin: Math.min(0, Math.floor(Math.min(...pts.map((p) => p.total)) / 50) * 50) || 0, points: [{ x: s.speed, y: cur.total, color: 'ink', label: `${fmt(cur.total, s.show === 'p' ? 1 : 0)} ${plot.opts.y.unit}` }], vlines: [{ x: s.speed }] });
      }
      function draw(t, dt) {
        const { ctx, w, h } = C, col = EV.col;
        const v = s.speed / 3.6, theta = Math.atan(s.grade / 100);
        const sc = Math.min(0.5, w / 1000 * 0.7), k = 0.11 * w / 700;   // car scale, px per newton
        const cx = w * 0.4, cy = h * 0.76;
        spin += v * dt * 0.1 / (0.35) ; dash = (dash + v * dt * 0.1 * 200 * sc) % 60;
        ctx.clearRect(0, 0, w, h);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-theta);
        ctx.strokeStyle = col('axis'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke();
        ctx.strokeStyle = col('grid'); ctx.lineWidth = 3; ctx.setLineDash([24, 36]); ctx.lineDashOffset = dash;
        ctx.beginPath(); ctx.moveTo(-w, 9); ctx.lineTo(w, 9); ctx.stroke(); ctx.setLineDash([]);
        // air streaks
        const va = v + s.wind / 3.6;
        if (Math.abs(va) > 0.5) {
          ctx.strokeStyle = EV.rgba('s1', 0.35); ctx.lineWidth = 1.5;
          for (let i = 0; i < 9; i++) {
            const y = -30 - i * 21 * sc / 0.42 - 10, ph = ((t * va * 2.2 + i * 137) % (w * 1.1));
            const x = w * 0.62 - ph, len = 14 + Math.abs(va) * 0.9;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
          }
        }
        ctx.restore();
        EV.art.drawCar(ctx, cx, cy, { scale: sc, angle: theta, spin });
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-theta);
        const nose = 474 * sc, rear = -289 * sc, front = 289 * sc, cg = -112 * sc;
        const lab = (txt, x, y, align) => EV.text(ctx, txt, x, y, { align, size: 12, weight: 600, color: col('ink'), halo: true });
        // air drag pushes on the nose
        if (Math.abs(rl.aero) > 1) {
          const L = rl.aero * k, y = -150 * sc;
          EV.arrow(ctx, nose + 6 + Math.max(L, 0), y, nose + 6 + Math.max(-L, 0), y, col('s1'), 4, 11);
          lab(`Air drag ${fmt(rl.aero)} N`, nose + 8, y - 10, 'left');
        }
        // rolling resistance at both contact patches
        if (rl.roll > 1) {
          const L = rl.roll * k / 2;
          EV.arrow(ctx, rear, 20, rear - L, 20, col('s2'), 4, 9);
          EV.arrow(ctx, front, 20, front - L, 20, col('s2'), 4, 9);
          lab(`Rolling ${fmt(rl.roll)} N`, rear - L - 10, 24, 'right');
        }
        // gravity component along the road, from the centre of gravity
        if (Math.abs(rl.grade) > 1) {
          const L = rl.grade * k;
          EV.arrow(ctx, 0, cg, -L, cg, col('s3'), 4, 11);
          ctx.fillStyle = col('s3'); ctx.beginPath(); ctx.arc(0, cg, 4, 0, 7); ctx.fill();
          lab(`Gravity ${fmt(Math.abs(rl.grade))} N ${rl.grade > 0 ? 'back' : 'forward'}`, -L / 2, cg - 11, 'center');
        }
        // drive force at the driven axle
        const Ld = rl.total * k, yd = 48;
        EV.arrow(ctx, rear, yd, rear + Ld, yd, col('ink'), 5, 12);
        lab(rl.total >= 0 ? `Drive force ${fmt(rl.total)} N` : `Braking (regen) ${fmt(-rl.total)} N`, rear + Math.max(Ld, 0) + 8, yd + 4, 'left');
        ctx.restore();
        if (Math.abs(s.grade) > 0) EV.text(ctx, `slope ${fmt(Math.atan(s.grade / 100) * 180 / Math.PI, 1)}°`, 10, 18, { size: 11.5, color: col('muted') });
      }
      update();
      C.draw = () => draw(0, 0);
      EV.loop(C.cv, draw);

      /* ------------------------------------------------ kinetic energy ---- */
      const k = EV.fig(root, 'kinetic', { title: 'Speed is height', hint: 'Kinetic energy, expressed as the height the same energy would lift the car. Brake from this speed and that is the drop you are absorbing.' });
      const kp = EV.plot(k.stage, { h: 250, x: { label: 'Speed (km/h)', min: 0, max: 250, unit: 'km/h' }, y: { label: 'Equivalent height (m)', min: 0, max: 260, unit: 'm' }, legend: false });
      const KR = EV.readouts(k.out, { e: ['Kinetic energy', 'kWh', 's4'], pct: ['Share of a full battery', '%'], h: ['Equivalent height', 'm'], d: ['Could carry the car, at this speed', 'm'] });
      const ks = EV.controls(k.ctl, { speed: { label: 'Speed', min: 0, max: 250, step: 5, value: 100, unit: 'km/h' } }, kUpdate);
      const hOf = (kmh) => (kmh / 3.6) ** 2 / (2 * G);
      function kUpdate() {
        const v = ks.speed / 3.6, m = car.curb + 75, e = 0.5 * m * car.rot * v * v, rlk = P.roadLoad(car, { v, mass: m });
        KR({ e: fmt(e / 3.6e6, 2), pct: fmt(e / 3.6e6 / car.usable * 100, 1), h: fmt(hOf(ks.speed)), d: v > 1 ? fmt(Math.round(e / rlk.total / 10) * 10) : '0' });
        kp.set({
          series: [{ name: 'Equivalent height', color: 's4', area: true, pts: EV.sample(hOf, 0, 250, 100) }],
          points: [{ x: ks.speed, y: hOf(ks.speed), color: 's4', label: `${fmt(hOf(ks.speed))} m` }],
          hlines: [{ y: 30, label: '10-storey building, 30 m', left: true }, { y: 96, label: 'Big Ben, 96 m', left: true }, { y: 139, label: 'Great Pyramid, 139 m', left: true }],
        });
      }
      kUpdate();

      /* ------------------------------------------------------ coast-down ---- */
      const c = EV.fig(root, 'coast', { title: 'Coast-down from 130 km/h', hint: 'The dashed line is the standard car. Change the car and compare how far it glides.' });
      const cp = EV.plot(c.stage, { h: 270, x: { label: 'Time since lifting off (s)', min: 0, max: 360, unit: 's' }, y: { label: 'Speed (km/h)', min: 0, max: 140, unit: 'km/h' } });
      const CR = EV.readouts(c.out, { t: ['Time to reach 20 km/h', 's'], d: ['Distance covered', 'km'], a0: ['Deceleration at 130 km/h', 'm/s²'], a1: ['Deceleration at 30 km/h', 'm/s²'] });
      const cs = EV.controls(c.ctl, {
        cda: { label: 'Drag area C<sub>d</sub>A', min: 0.45, max: 1.0, step: 0.01, value: +(car.cd * car.area).toFixed(2), unit: 'm²' },
        crr: { label: 'Rolling coefficient C<sub>rr</sub>', min: 0.005, max: 0.02, step: 0.0005, value: car.crr, dec: 4 },
        load: { label: 'Passengers and cargo', min: 0, max: 450, step: 25, value: 75, unit: 'kg' },
      }, cUpdate);
      function coast(cda, crr, mass) {
        const pts = []; let v = 130 / 3.6, t = 0, d = 0, t20 = null, d20 = null;
        const acc = (vv) => -(0.5 * P.rho() * cda * vv * vv + crr * mass * G) / (mass * car.rot);
        while (t <= 360 && v > 0.3) {
          if (Math.round(t * 10) % 10 === 0) pts.push([t, v * 3.6]);
          v += acc(v) * 0.1; d += v * 0.1; t += 0.1;
          if (t20 == null && v * 3.6 <= 20) { t20 = t; d20 = d; }
        }
        return { pts, t20, d20, a0: -acc(130 / 3.6), a1: -acc(30 / 3.6) };
      }
      function cUpdate() {
        const ref = coast(car.cd * car.area, car.crr, car.curb + 75), me = coast(cs.cda, cs.crr, car.curb + cs.load);
        cp.set({ series: [{ name: 'Your car', color: 's1', pts: me.pts }, { name: `Standard ${car.name}`, color: 'muted', dash: true, pts: ref.pts }] });
        CR({ t: me.t20 ? fmt(me.t20) : '> 360', d: me.d20 ? fmt(me.d20 / 1000, 2) : '–', a0: fmt(me.a0, 2), a1: fmt(me.a1, 2) });
      }
      cUpdate();
    },

    quiz: (car) => [
      { q: 'A car cruises at 80 km/h, then at 160 km/h. How does the air-drag <em>force</em> change?', o: ['It doubles', 'It quadruples', 'It increases eightfold', 'It stays the same'], a: 1, why: 'Drag force is proportional to v². Twice the speed gives four times the force. The <em>power</em> needed to overcome it rises eightfold, because power is force times speed.' },
      { q: 'The total resisting force on the car is 450 N. Roughly how much energy does it use at the wheels per kilometre?', o: ['45 Wh/km', '125 Wh/km', '450 Wh/km', '1620 Wh/km'], a: 1, why: '1 N is 1 J per metre, so 450 N is 450 kJ per km. Divide by 3.6 to convert kJ to Wh: 125 Wh/km.' },
      { q: `On a 6% uphill grade, the gravity force on a ${fmt(car.curb + 75)} kg car is about…`, o: [`${fmt((car.curb + 75) * G * 0.006)} N`, `${fmt((car.curb + 75) * G * 0.06)} N`, `${fmt((car.curb + 75) * G * 0.6)} N`, 'zero, gravity acts vertically'], a: 1, why: 'For small slopes sin θ ≈ grade, so the force is m·g·0.06. That is several times the rolling resistance and far more than air drag at city speeds.' },
      { q: 'You drive the same 100 km at 130 km/h instead of 100 km/h. Why does the battery lose more energy?', o: ['The motor runs for a longer time', 'The resisting force is larger over the same distance', 'The battery voltage drops at speed', 'The tyres slip more'], a: 1, why: 'Energy = force × distance. The distance is unchanged, the trip is actually shorter in time, but the drag force is about 70% larger.' },
      { q: 'In a coast-down test the speed trace is steep and curved at first, then becomes a gentle straight line. What does the straight part tell you?', o: ['The drag coefficient', 'The rolling resistance, which does not depend on speed', 'The motor efficiency', 'The mass of the car'], a: 1, why: 'A constant force gives constant deceleration, which is a straight line on a speed-time graph. At low speed the v² drag term has faded and only rolling resistance remains.' },
    ],
  });
})();
