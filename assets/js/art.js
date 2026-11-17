/* ==========================================================================
   art.js — shared drawings: the car in side view (SVG and canvas),
   and the energy-flow (Sankey) diagram.
   Car coordinates: 1 unit = 5 mm, car faces right, ground at y = 330,
   rear axle x = 215, front axle x = 793 (wheelbase 578 units = 2.89 m).
   A generic crossover outline with Model Y proportions.
   ========================================================================== */
(function () {
  'use strict';
  const EV = window.EV;
  const A = (EV.art = {});

  A.GROUND = 330; A.REAR = 215; A.FRONT = 793; A.WHEEL_R = 71; A.MID = 504; A.PX_PER_M = 200;
  A.BODY = 'M34 268 C30 286 40 294 60 295 L137 296 A86.3 86.3 0 1 1 293 296 L715 296 A86.3 86.3 0 1 1 871 296 L948 294 C968 292 976 280 976 262 C977 236 972 206 952 192 C905 170 812 150 738 138 C690 100 622 46 562 30 C500 12 402 6 332 16 C244 30 158 68 92 106 L66 108 C44 126 30 160 30 204 Z';
  A.GLASS = 'M704 135 C662 100 606 60 556 45 C498 30 410 24 342 32 C282 42 216 68 170 99 L198 128 Z';

  const wheel = (x) => `<g><circle class="d-tyre" cx="${x}" cy="259" r="71"/><circle class="d-rim" cx="${x}" cy="259" r="47"/>
    <g stroke="var(--tyre)" stroke-width="5" opacity=".55">${[0, 72, 144, 216, 288].map((a) => `<line x1="${x}" y1="259" x2="${x + 44 * Math.cos(a * Math.PI / 180)}" y2="${259 + 44 * Math.sin(a * Math.PI / 180)}"/>`).join('')}</g>
    <circle cx="${x}" cy="259" r="9" fill="var(--tyre)"/></g>`;

  /** SVG markup of the car. o.xray -> translucent body so components drawn afterwards show through. */
  A.carSVG = (o = {}) => `
    <path class="d-body" d="${A.BODY}"${o.xray ? ' fill-opacity=".5"' : ''}/>
    <path class="d-glass" d="${A.GLASS}"${o.xray ? ' fill-opacity=".45"' : ''}/>
    <path class="d-line" d="M468 28 L462 131 M462 131 L458 262 M704 135 L712 250 M198 128 L206 160" opacity=".55"/>
    <path class="d-line" d="M952 196 C930 190 905 187 885 186" stroke-width="4" opacity=".7"/>
    <path d="M34 150 C40 140 52 132 66 128" fill="none" stroke="var(--s8)" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    ${o.noWheels ? '' : wheel(A.REAR) + wheel(A.FRONT)}`;

  /* canvas version ------------------------------------------------------- */
  let body2d, glass2d;
  /**
   * Draw the car on a canvas. (cx, gy) = point on the ground under the middle of the wheelbase.
   * o: { scale (px per car unit), angle (rad, road slope: + = nose up), spin (wheel angle rad), pitch (rad), alpha, ghost }
   */
  A.drawCar = (ctx, cx, gy, o = {}) => {
    if (!body2d) { body2d = new Path2D(A.BODY); glass2d = new Path2D(A.GLASS); }
    const s = o.scale || 0.3, col = EV.col;
    ctx.save();
    ctx.translate(cx, gy); ctx.rotate(-(o.angle || 0)); ctx.scale(s, s); ctx.translate(-A.MID, -A.GROUND);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // body pitches about the middle of the wheelbase (squat / dive)
    ctx.save();
    if (o.pitch) { ctx.translate(A.MID, 259); ctx.rotate(-o.pitch); ctx.translate(-A.MID, -259); }
    ctx.fillStyle = o.fill || col('body-fill'); ctx.strokeStyle = o.stroke || col('body-line'); ctx.lineWidth = 2 / Math.max(s, 0.15) * 0.6; ctx.lineJoin = 'round';
    ctx.fill(body2d); ctx.stroke(body2d);
    if (!o.ghost) { ctx.fillStyle = col('glass'); ctx.fill(glass2d); ctx.lineWidth = 1.2 / Math.max(s, 0.15) * 0.6; ctx.stroke(glass2d); }
    ctx.restore();
    for (const x of [A.REAR, A.FRONT]) {
      ctx.fillStyle = col('tyre'); ctx.beginPath(); ctx.arc(x, 259, 71, 0, 7); ctx.fill();
      ctx.fillStyle = col('rim'); ctx.beginPath(); ctx.arc(x, 259, 47, 0, 7); ctx.fill();
      ctx.strokeStyle = col('tyre'); ctx.globalAlpha *= 0.6; ctx.lineWidth = 6;
      for (let k = 0; k < 5; k++) {
        const a = (o.spin || 0) + k * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.moveTo(x, 259); ctx.lineTo(x + 44 * Math.cos(a), 259 + 44 * Math.sin(a)); ctx.stroke();
      }
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
      ctx.fillStyle = col('tyre'); ctx.beginPath(); ctx.arc(x, 259, 9, 0, 7); ctx.fill();
    }
    ctx.restore();
  };

  /* energy-flow diagram ---------------------------------------------------- */
  /**
   * Linear Sankey: energy enters on the left, losses peel off downward, the useful remainder exits right.
   * o: { input:{label,value}, losses:[{label,value,color}], out:{label,color}, unit, dec, w }
   */
  A.sankey = (o) => {
    const w = o.w || 900, T0 = o.thick || 96, y0 = 44, r = 12, x0 = 16, n = o.losses.length;
    const k = T0 / o.input.value, xEnd = w - 150, gap = (xEnd - 150) / Math.max(1, n);
    const yEnd = y0 + T0 + 58, col = o.out.color || 's1', dec = o.dec == null ? 0 : o.dec;
    const pct = (v) => EV.fmt(v / o.input.value * 100, 0) + '%';
    let t = T0, branches = '', labels = '', bottom = [];
    bottom.push([x0, y0 + T0]);
    o.losses.forEach((L, i) => {
      const xi = 150 + gap * i + gap * 0.25, h = Math.max(1.5, k * L.value), yb = y0 + t;
      branches += `<path d="M${xi} ${yb - h} A${r + h} ${r + h} 0 0 1 ${xi + r + h} ${yb + r} L${xi + r + h} ${yEnd} L${xi + r + h + 5} ${yEnd} L${xi + r + h / 2} ${yEnd + 11} L${xi + r - 5} ${yEnd} L${xi + r} ${yEnd} L${xi + r} ${yb + r} A${r} ${r} 0 0 0 ${xi} ${yb} Z" fill="var(--${L.color})"><title>${EV.esc(L.label)}: ${EV.fmt(L.value, dec)} ${o.unit || ''}</title></path>`;
      labels += `<text class="d-txt b" x="${xi + r + h / 2}" y="${yEnd + 30}" text-anchor="middle">${EV.esc(L.label)}</text>
        <text class="d-txt s" x="${xi + r + h / 2}" y="${yEnd + 47}" text-anchor="middle">${EV.fmt(L.value, dec)} ${o.unit || ''} · ${pct(L.value)}</text>`;
      bottom.push([xi, yb], [xi, yb - h]);
      t -= h;
    });
    const tip = Math.max(14, t * 0.5);
    const trunk = `M${x0} ${y0} L${xEnd} ${y0} L${xEnd + tip} ${y0 + t / 2} L${xEnd} ${y0 + t} ` + bottom.reverse().map((p) => `L${p[0]} ${p[1]}`).join(' ') + ' Z';
    const outVal = o.input.value - o.losses.reduce((a, L) => a + L.value, 0);
    return `<svg viewBox="0 0 ${w} ${yEnd + 58}" role="img" aria-label="${EV.esc(o.input.label)} ${EV.fmt(o.input.value, dec)} ${o.unit || ''}; ${o.losses.map((L) => EV.esc(L.label) + ' ' + pct(L.value)).join(', ')}; ${EV.esc(o.out.label)} ${pct(outVal)}">
      <path d="${trunk}" fill="var(--${col})" opacity=".78"/>${branches}
      <text class="d-txt b" x="${x0}" y="${y0 - 26}">${EV.esc(o.input.label)}</text>
      <text class="d-txt s" x="${x0}" y="${y0 - 10}">${EV.fmt(o.input.value, dec)} ${o.unit || ''} · 100%</text>
      <text class="d-txt b" x="${xEnd + tip + 8}" y="${y0 + t / 2 - 2}">${EV.esc(o.out.label)}</text>
      <text class="d-txt s" x="${xEnd + tip + 8}" y="${y0 + t / 2 + 15}">${EV.fmt(outVal, dec)} ${o.unit || ''} · ${pct(outVal)}</text>
      ${labels}</svg>`;
  };
})();
