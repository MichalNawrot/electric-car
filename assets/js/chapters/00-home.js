/* Start page: x-ray tour of the car, the energy story in one diagram, the example car, the chapter map. */
(function () {
  'use strict';
  const EV = window.EV, { M, fmt } = EV, P = EV.phys;

  const COMPONENTS = [
    { k: 'pack', x: 506, y: 281, name: 'Battery pack', ch: 'battery',
      text: (c) => `${fmt(c.s * c.p)} ${c.cellFormat} under the floor store ${c.gross} kWh of chemical energy at roughly ${fmt(c.s * c.cellV)} V. At about ${c.packKg} kg it is the heaviest single part of the car, and it sits below the wheel hubs, which is why the centre of gravity is so low.` },
    { k: 'rdu', x: 215, y: 259, name: 'Rear drive unit', ch: 'motor',
      text: () => 'Three machines in one housing: an inverter that turns battery DC into three-phase AC, a permanent-magnet synchronous motor that turns AC into torque, and a single-speed 9:1 gearbox that trades motor speed for wheel force.' },
    { k: 'fdu', x: 793, y: 259, name: 'Front drive unit', ch: 'motor', awd: true,
      text: () => 'All-wheel-drive cars add an induction motor in front. It has no magnets, so when it is not needed it can be switched off and spin freely with almost no drag.' },
    { k: 'port', x: 88, y: 152, name: 'Charge port', ch: 'charging',
      text: () => 'One socket, two routes. AC from a wallbox is converted to DC inside the car by the on-board charger (up to 11 kW). DC from a fast charger skips that and flows straight into the pack at up to 250 kW.' },
    { k: 'pcs', x: 342, y: 246, name: 'On-board charger and DC-DC', ch: 'inverter',
      text: () => 'A power-conversion box on top of the pack. One half rectifies grid AC into DC to charge the battery. The other half steps the pack voltage down to feed lights, computers and pumps.' },
    { k: 'hp', x: 856, y: 206, name: 'Heat pump', ch: 'thermal',
      text: () => 'A refrigerant circuit with a valve manifold that can move heat between outside air, battery, motors and cabin in a dozen combinations. It delivers 2 to 4 units of heat per unit of electricity.' },
    { k: 'lv', x: 700, y: 176, name: 'Low-voltage battery', ch: 'inverter',
      text: () => 'A small 16 V lithium-ion battery runs the computers and the contactors that connect the main pack. Without it the big battery cannot even be switched on.' },
    { k: 'tyre', x: 793, y: 326, name: 'Tyres', ch: 'tires',
      text: () => 'Four contact patches, each about the size of a hand, transmit every force the car makes: drive, braking, cornering. Their rolling resistance is the biggest energy consumer at town speeds.' },
  ];

  const MODES = {
    drive: { label: 'Driving', flows: ['rear', 'front'], arrow: 1,
      text: 'The battery pushes direct current to the inverters. Each inverter synthesises three-phase AC, the motor turns it into torque, the gearbox multiplies it, and the tyres push backward on the road. The road pushes the car forward.' },
    regen: { label: 'Regenerative braking', flows: ['rear', 'front'], rev: true, color: 's6', arrow: -1,
      text: 'Lift off the pedal and the same hardware runs backwards. The wheels drive the motors, the motors act as generators, the inverters rectify AC back into DC, and kinetic energy returns to the pack instead of heating brake discs.' },
    dc: { label: 'DC fast charging', flows: ['dc', 'cool'],
      text: 'A fast charger does the AC-to-DC conversion in its own cabinet and connects straight to the pack. Hundreds of amps heat the cells, so the heat pump pulls heat out of the battery while it charges.' },
    ac: { label: 'AC charging', flows: ['ac1', 'ac2'],
      text: 'A home wallbox is only a safety switch. The grid\'s alternating current enters the car and the on-board charger rectifies it. That charger is the bottleneck: 11 kW, about 60 km of range per hour.' },
    heat: { label: 'Winter heating', flows: ['amb', 'waste', 'cabin', 'warm'],
      text: 'The heat pump collects low-grade heat from outside air and from the warm motors, raises its temperature with a compressor, and delivers it to the cabin and, when needed, to the battery.' },
  };

  const FLOW_PATHS = {
    rear: ['M300 281 L262 281 L243 268', 's1'], front: ['M712 281 L752 281 L772 268', 's1'],
    dc: ['M94 158 C140 232 220 284 300 284', 's1'], ac1: ['M94 156 C150 214 250 244 316 246', 's1'], ac2: ['M342 258 L342 270', 's1'],
    cool: ['M700 262 C760 250 810 232 842 216', 's2'],
    amb: ['M996 208 L884 208', 's2'], waste: ['M800 236 C812 226 826 218 842 212', 's2'],
    cabin: ['M846 194 C800 150 700 138 600 150', 's2'], warm: ['M850 222 C830 250 790 262 716 268', 's2'],
  };

  function xraySVG(car) {
    const awd = car.drive === 'AWD';
    const flows = Object.entries(FLOW_PATHS).map(([k, [d, c]]) => `<path class="flowline" data-flow="${k}" d="${d}" stroke="var(--${c})" style="display:none"/>`).join('');
    const hot = COMPONENTS.map((c, i) => (c.awd && !awd ? '' : `<g class="hot" data-k="${c.k}" tabindex="0" role="button" aria-label="${c.name}">
        <circle cx="${c.x}" cy="${c.y}" r="26" fill="transparent"/><circle class="hot-ring" cx="${c.x}" cy="${c.y}" r="17"/>
        <circle cx="${c.x}" cy="${c.y}" r="12.5" fill="var(--ink)"/><text x="${c.x}" y="${c.y + 4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--surface)" style="font-family:var(--f-mono)">${i + 1}</text></g>`)).join('');
    return `<svg viewBox="0 0 1000 392" role="group" aria-label="X-ray side view of the car with numbered components">
      <g transform="translate(0 34)">
        <line class="d-road" x1="0" y1="331" x2="1000" y2="331"/>
        ${EV.art.carSVG({ xray: true, noWheels: true })}
        ${[215, 793].map((x) => `<circle cx="${x}" cy="259" r="71" fill="var(--tyre)" opacity=".28"/><circle cx="${x}" cy="259" r="47" fill="none" stroke="var(--rim)" stroke-width="3"/>`).join('')}
        <rect x="300" y="268" width="412" height="26" rx="6" fill="var(--s1)" fill-opacity=".2" stroke="var(--s1)" stroke-width="2"/>
        <path d="M403 268v26M506 268v26M609 268v26" stroke="var(--s1)" stroke-width="1.5" opacity=".6"/>
        <circle cx="215" cy="259" r="30" fill="var(--surface)" stroke="var(--body-line)" stroke-width="2"/>
        <rect x="232" y="224" width="46" height="22" rx="4" class="d-box"/>
        ${awd ? '<circle cx="793" cy="259" r="25" fill="var(--surface)" stroke="var(--body-line)" stroke-width="2"/><rect x="748" y="228" width="40" height="19" rx="4" class="d-box"/>' : ''}
        <rect x="314" y="236" width="56" height="22" rx="4" class="d-box"/>
        <rect x="830" y="190" width="52" height="34" rx="6" class="d-box"/>
        <rect x="922" y="200" width="10" height="56" rx="3" class="d-box"/>
        <rect x="684" y="166" width="32" height="20" rx="4" class="d-box"/>
        <rect x="78" y="143" width="20" height="18" rx="4" class="d-box"/>
        ${flows}
        <g data-arrow style="display:none"><path d="M0 0h54" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/><path d="M62 0l-13-7v14z" fill="var(--ink)"/></g>
        ${hot}
      </g></svg>`;
  }

  EV.chapter({
    id: 'home', n: '', title: 'Start here', nav: 'Start here', custom: true,
    html(car) {
      const c = P.consumption(car, { v: 110 / 3.6 });
      const wall = c.pBatt / 0.9;
      const chapters = EV.chapters.filter((ch) => ch.n);
      const v = EV.variants, row = (label, f, note) => `<tr><td>${label}${note ? ` <span class="est">${note}</span>` : ''}</td>${['rwd', 'lr', 'perf'].map((k) => `<td class="r"${k === car.key ? ' style="font-weight:650"' : ''}>${f(v[k])}</td>`).join('')}</tr>`;
      return `
      <section class="hero">
        <div class="kicker">An interactive field guide</div>
        <h1>The physics of an <em>electric car</em></h1>
        <p class="lead">Twelve chapters that take one real machine apart, the Tesla Model Y, and rebuild it from first principles: forces, energy, magnetism, electrochemistry, heat. Every graph is computed live from one shared physics model, so you can change the conditions and watch the consequences.</p>
      </section>

      <div data-fig="xray"></div>

      <h2><span class="n">THE SHORT VERSION</span>An electric car is an energy converter on wheels</h2>
      <p>Strip away the screens and the software and an electric car does four things. It <em class="t">stores</em> energy chemically in a battery. It <em class="t">converts</em> that energy to motion through an inverter, a motor and a gearbox. It <em class="t">spends</em> the motion pushing air aside and flexing its tyres. And when you slow down it <em class="t">recovers</em> part of the motion back into the battery.</p>
      <p>Each of those steps is ordinary physics, and each has a price. The diagram follows one unit of energy from the wall socket to the road for the ${car.name} cruising at 110 km/h on a mild day.</p>
      <div data-fig="chain"></div>
      <p>Two things stand out. First, <strong>${fmt(c.rl.total * c.v / wall * 100)}% of the electricity you pay for reaches the road</strong>; a petrol car manages about a quarter. Second, at this speed almost all of that useful energy is spent on one thing: air. Chapters 1 to 4 explain what the car must overcome, chapters 5 to 8 explain how it produces force, and chapters 9 to 12 put the pieces to work.</p>

      <h2><span class="n">THE EXAMPLE CAR</span>Three versions of the same machine</h2>
      <p>The guide uses the 2025-on Model Y in its three European trims. Pick one in the bar at the top and every number, graph and simulation on every page recalculates for it.</p>
      <div class="tiles">
        <div class="tile"><div class="k">Mass, ready to drive</div><div class="v">${fmt(car.curb)}<small>kg</small></div><div class="d">of which battery ≈ ${car.packKg} kg</div></div>
        <div class="tile"><div class="k">Usable battery energy</div><div class="v">${car.usable}<small>kWh</small></div><div class="d">${car.chem === 'LFP' ? 'lithium iron phosphate' : 'nickel-manganese-cobalt'} cells</div></div>
        <div class="tile"><div class="k">0 to 100 km/h</div><div class="v">${car.pub.t100}<small>s</small></div><div class="d">${car.drive === 'AWD' ? 'two motors, four driven wheels' : 'one motor, rear wheels'}</div></div>
        <div class="tile"><div class="k">Drag area C<sub>d</sub>·A</div><div class="v">${fmt(car.cd * car.area, 2)}<small>m²</small></div><div class="d">C<sub>d</sub> ${car.cd} × ${car.area} m² frontal area</div></div>
        <div class="tile"><div class="k">Range at a steady 110 km/h</div><div class="v">${fmt(P.range(car, { v: 110 / 3.6 }))}<small>km</small></div><div class="d">model estimate, 20 °C, no wind</div></div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Quantity</th><th class="r">RWD</th><th class="r">Long Range AWD</th><th class="r">Performance</th></tr></thead>
        <tbody>
          ${row('Curb mass', (x) => fmt(x.curb) + ' kg')}
          ${row('Battery, usable / total', (x) => `${x.usable} / ${x.gross} kWh`)}
          ${row('Cell chemistry', (x) => x.chem)}
          ${row('Pack layout', (x) => `${x.s}s${x.p}p`, 'series × parallel')}
          ${row('Nominal pack voltage', (x) => fmt(x.s * x.cellV) + ' V')}
          ${row('Driven wheels', (x) => x.drive)}
          ${row('0–100 km/h', (x) => x.pub.t100.toFixed(1) + ' s')}
          ${row('Top speed', (x) => x.pub.vmax + ' km/h')}
          ${row('WLTP range', (x) => x.pub.wltp + ' km')}
          ${row('Peak DC charging', (x) => x.dcPeak + ' kW')}
          ${row('Peak motor torque', (x) => fmt(x.tPeak) + ' N·m', 'estimate')}
          ${row('Peak mechanical power', (x) => fmt(x.pPeak / 1000) + ' kW', 'estimate')}
          ${row('Rolling-resistance coefficient', (x) => x.crr.toFixed(4), 'estimate')}
        </tbody></table></div>
      <div class="callout"><h5>How far to trust the numbers</h5>
        <p>Mass, battery size, acceleration, top speed and range are published figures for European-market cars; they change a little between model years and markets (the drag coefficient, for instance, is quoted as 0.23 for the original car and 0.22 for the 2025 refresh). Rows marked <em>estimate</em> are not published. They are tuned so that the model reproduces the published 0–100 km/h times and typical measured motorway consumption. The physics is exact; the parameters are representative. This guide is independent and is not affiliated with Tesla.</p></div>

      <h2><span class="n">THE MAP</span>Twelve chapters, one mental picture</h2>
      <div class="cards">${chapters.map((ch) => `<a class="ccard" href="#/${ch.id}" style="--c:var(--${ch.color || 's1'})"><span class="n">CHAPTER ${ch.n}</span><b>${ch.title}</b><span>${ch.blurb || ''}</span></a>`).join('')}
        <a class="ccard" href="#/ref" style="--c:var(--muted)"><span class="n">REFERENCE</span><b>Cheat sheet</b><span>Every formula, constant and Model Y number on one page, plus a glossary.</span></a></div>

      <h2><span class="n">HOW TO USE IT</span>Read, predict, then move the slider</h2>
      <ul>
        <li><strong>Predict before you touch.</strong> Each interactive poses a question. Guess the answer, then drag the control. The surprise is where the learning happens.</li>
        <li><strong>Follow the colours.</strong> A colour means the same thing everywhere: ${['s1:air drag and electrical power', 's2:rolling resistance and heat', 's3:gravity', 's4:inertia and kinetic energy', 's5:drivetrain losses', 's6:regenerated energy', 's7:climate and accessories', 's8:friction brakes'].map((s) => { const [c, t] = s.split(':'); return `<span style="white-space:nowrap"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--${c});margin-right:5px"></i>${t}</span>`; }).join(', ')}.</li>
        <li><strong>Hover any graph</strong> for exact values, or focus it and use <span class="kbd">←</span> <span class="kbd">→</span>. Every graph also has a data table.</li>
        <li><strong>Finish each chapter with its quiz.</strong> The dots in the sidebar turn green as you go. Chapter 12 is a driving simulator that uses everything at once.</li>
      </ul>`;
    },
    init(root, car) {
      /* x-ray tour ---------------------------------------------------------- */
      const f = EV.fig(root, 'xray', { tag: 'Interactive · the car in x-ray', title: 'Where the energy lives and how it moves', hint: 'Choose what the car is doing to see the energy paths. Click a numbered part to learn what it does.' });
      f.stage.innerHTML = xraySVG(car);
      const svg = f.stage.firstElementChild, info = EV.el('<div class="info" aria-live="polite"></div>');
      let mode = 'drive', sel = null;
      const paint = () => {
        const m = MODES[mode];
        EV.$$('[data-flow]', svg).forEach((p) => {
          const on = m.flows.includes(p.dataset.flow) && !(p.dataset.flow === 'front' && car.drive !== 'AWD');
          p.style.display = on ? '' : 'none';
          p.style.animationDirection = m.rev ? 'reverse' : 'normal';
          if (on && m.color) p.setAttribute('stroke', `var(--${m.color})`); else p.setAttribute('stroke', `var(--${FLOW_PATHS[p.dataset.flow][1]})`);
        });
        const arrow = EV.$('[data-arrow]', svg);
        arrow.style.display = m.arrow ? '' : 'none';
        if (m.arrow) arrow.setAttribute('transform', m.arrow > 0 ? 'translate(470 350)' : 'translate(540 350) scale(-1 1)');
        EV.$$('.hot', svg).forEach((g) => g.classList.toggle('on', g.dataset.k === sel));
        const comp = COMPONENTS.find((c) => c.k === sel);
        info.innerHTML = comp
          ? `<h5>${COMPONENTS.indexOf(comp) + 1} · ${comp.name}</h5><p>${comp.text(car)}</p><a href="#/${comp.ch}">Go to the chapter →</a>`
          : `<h5>${m.label}</h5><p>${m.text}</p><span class="small">${m.arrow ? 'The arrow under the car shows the force of the road on the car.' : 'Dotted lines move in the direction energy flows: blue is electrical, orange is heat.'}</span>`;
      };
      const seg = EV.seg(Object.entries(MODES).map(([k, m]) => [k, m.label]), mode, (v) => { mode = v; sel = null; paint(); }, 'What the car is doing');
      f.ctl.style.gridTemplateColumns = '1fr';
      f.ctl.append(seg, info);
      const pick = (g) => { sel = sel === g.dataset.k ? null : g.dataset.k; paint(); };
      svg.addEventListener('click', (e) => { const g = e.target.closest('.hot'); if (g) pick(g); });
      svg.addEventListener('keydown', (e) => { const g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(g); } });
      paint();

      /* wall-to-road Sankey --------------------------------------------------- */
      const c = P.consumption(car, { v: 110 / 3.6 }), wall = c.pBatt / 0.9, L = c.dt.loss;
      const g = EV.fig(root, 'chain', { tag: 'Energy flow · computed for the selected car', title: 'From the wall socket to the road at 110 km/h', hint: 'Width is power. Each branch that peels off is energy turned to heat before it can move the car.' });
      g.stage.innerHTML = EV.art.sankey({
        input: { label: 'From the grid', value: wall / 1000 }, unit: 'kW', dec: 1,
        losses: [
          { label: 'Charging', value: (wall - c.pBatt) / 1000, color: 's2' },
          { label: 'Motor + inverter', value: (L.cu + L.fe + L.mech + L.inv) / 1000, color: 's5' },
          { label: 'Gearbox', value: L.gear / 1000, color: 's5' },
          { label: 'Electronics', value: c.aux / 1000, color: 's7' },
        ],
        out: { label: 'Moves the car', color: 's1' },
      });
      const bar = EV.segbar(g.out, { title: 'What the energy at the wheels is spent on', unit: 'kW', dec: 1 });
      g.out.style.gridTemplateColumns = '1fr';
      bar([{ label: 'Pushing air aside', value: c.rl.aero * c.v / 1000, color: 's1' }, { label: 'Flexing the tyres', value: c.rl.roll * c.v / 1000, color: 's2' }], `${fmt(c.rl.total * c.v / 1000, 1)} kW at the wheels`);
    },
  });
})();
