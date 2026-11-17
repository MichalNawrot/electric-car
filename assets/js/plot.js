/* ==========================================================================
   plot.js — a small canvas chart: lines, washes, stacked areas, markers,
   crosshair tooltip, keyboard access and a data-table twin for every chart.
   One y-scale per chart, by design.

   const P = EV.plot(host, { h, x:{label,min,max,fmt}, y:{label,min,max|'auto',fmt}, legend, under, over, tipExtra })
   P.set({ series:[{ name, color:'s1', pts:[[x,y],...], area, stack, dash, w, hide }],
           points:[{ x, y, color, label }], vlines:[{ x, label }], hlines:[{ y, label }], bands:[{ x0, x1, label }] })
   ========================================================================== */
(function () {
  'use strict';
  const EV = window.EV;
  const { clamp } = EV.phys;
  const FONT = '11.5px system-ui, "Segoe UI", sans-serif';

  function niceStep(span, target) {
    const raw = span / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function ticks(min, max, target) {
    const step = niceStep(max - min, target), out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { step, vals: out };
  }
  const decOf = (step) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9) + (/25/.test(String(step)) ? 1 : 0)));

  /** y at x by linear interpolation on sorted points; null outside the data or across gaps. */
  function yAt(pts, x) {
    if (!pts.length || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    if (a[1] == null || b[1] == null) return null;
    return b[0] === a[0] ? a[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }

  EV.plot = function (host, o) {
    o = Object.assign({ h: 300, legend: true, table: true }, o);
    const wrap = EV.el(`<div class="plot"><div class="plot-top"><span class="plot-y"></span><div class="legend"></div></div>
      <canvas tabindex="0" role="img"></canvas><div class="plot-x"></div><div class="tip" role="status"></div>
      <div class="plot-tools"><button type="button" class="linkbtn">Show data table</button></div><div class="plot-table" hidden></div></div>`);
    host.appendChild(wrap);
    const cv = EV.$('canvas', wrap), ctx = cv.getContext('2d'), tip = EV.$('.tip', wrap), legend = EV.$('.legend', wrap);
    const tableBox = EV.$('.plot-table', wrap), tableBtn = EV.$('.linkbtn', wrap);
    EV.$('.plot-y', wrap).textContent = o.y.label || '';
    EV.$('.plot-x', wrap).textContent = o.x.label || '';
    cv.setAttribute('aria-label', `${o.y.label || 'chart'} versus ${o.x.label || 'x'}. Use arrow keys to read values.`);
    if (!o.table) EV.$('.plot-tools', wrap).hidden = true;

    const m = { l: 48, r: 14, t: 8, b: o.x2 ? 40 : 24 };
    let W = 0, H = o.h, data = { series: [] }, hoverX = null;
    let xr = [o.x.min || 0, o.x.max || 1], yr = [0, 1], legendKey = '';

    const P = {
      host: wrap, opts: o,
      X: (x) => m.l + (x - xr[0]) / (xr[1] - xr[0]) * (W - m.l - m.r),
      Y: (y) => H - m.b - (y - yr[0]) / (yr[1] - yr[0]) * (H - m.t - m.b),
      invX: (px) => xr[0] + (px - m.l) / (W - m.l - m.r) * (xr[1] - xr[0]),
      invY: (py) => yr[0] + (H - m.b - py) / (H - m.t - m.b) * (yr[1] - yr[0]),
      area: () => ({ x: m.l, y: m.t, w: W - m.l - m.r, h: H - m.t - m.b }),
      get xr() { return xr; }, get yr() { return yr; }, ctx,
      set(d) { data = Object.assign({}, data, d); layout(); draw(); if (!tableBox.hidden) buildTable(); },
      redraw: () => draw(),
    };

    function visible() { return (data.series || []).filter((s) => !s.hide && s.pts && s.pts.length); }

    function layout() {
      const ss = visible();
      xr = [data.xMin != null ? data.xMin : o.x.min || 0, data.xMax != null ? data.xMax : o.x.max];
      if (xr[1] == null) xr[1] = Math.max(1, ...ss.map((s) => s.pts[s.pts.length - 1][0]));
      let lo = o.y.min === 'auto' ? Infinity : (o.y.min || 0), hi = -Infinity;
      const fixed = data.yMax != null ? data.yMax : o.y.max;
      if (fixed == null || fixed === 'auto' || o.y.min === 'auto') {
        const stackTop = {};
        ss.forEach((s) => s.pts.forEach(([x, y]) => {
          if (y == null || x < xr[0] || x > xr[1]) return;
          let v = y;
          if (s.stack) { stackTop[x] = (stackTop[x] || 0) + Math.max(0, y); v = stackTop[x]; }
          if (v > hi) hi = v; if (v < lo) lo = v;
        }));
        (data.points || []).forEach((p) => { if (p.y > hi) hi = p.y; if (p.y < lo) lo = p.y; });
        (data.hlines || []).forEach((p) => { if (p.y > hi) hi = p.y; });
        if (!isFinite(hi)) hi = 1;
        if (!isFinite(lo)) lo = 0;
        const pad = (hi - Math.min(lo, 0)) * 0.08 || 1;
        const st = niceStep((hi + pad) - Math.min(lo, 0), 5);
        hi = Math.ceil((hi + pad * 0.5) / st) * st;
        if (o.y.min === 'auto') lo = Math.floor((lo - pad * 0.5) / st) * st; else lo = o.y.min || 0;
        if (o.y.minMax) hi = Math.max(hi, o.y.minMax);
      }
      yr = [data.yMin != null ? data.yMin : (o.y.min === 'auto' ? lo : (o.y.min || 0)), (fixed == null || fixed === 'auto') ? hi : fixed];
      if (yr[1] <= yr[0]) yr[1] = yr[0] + 1;
      // legend (rebuilt only when the set of series changes)
      const key = ss.map((s) => s.name + s.color + (s.dash ? 'd' : '') + (s.stack || s.area ? 'a' : '')).join('|');
      if (key !== legendKey) {
        legendKey = key;
        legend.textContent = '';
        if (o.legend && ss.length > 1 || o.legend === 'always') ss.forEach((s) => {
          if (s.noLegend) return;
          const item = document.createElement('span'), sw = document.createElement('i');
          sw.style.background = `var(--${s.color})`; sw.style.color = `var(--${s.color})`;
          if (s.stack) sw.className = 'box'; else if (s.dash) sw.className = 'dash';
          item.appendChild(sw); item.appendChild(document.createTextNode(s.name));
          legend.appendChild(item);
        });
      }
    }

    function size() {
      const w = Math.max(240, Math.floor(wrap.clientWidth));
      if (w === W) return;
      W = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function path(pts, close) {
      let pen = false;
      ctx.beginPath();
      for (const [x, y] of pts) {
        if (y == null || !isFinite(y)) { pen = false; continue; }
        const px = P.X(x), py = P.Y(y);
        if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      }
      if (close) ctx.closePath();
    }

    function draw() {
      if (!W) return;
      const A = P.area(), col = EV.col;
      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT;
      // bands behind everything
      (data.bands || []).forEach((b) => {
        const x0 = clamp(P.X(b.x0), A.x, A.x + A.w), x1 = clamp(P.X(b.x1), A.x, A.x + A.w);
        ctx.fillStyle = EV.rgba(b.color || 'muted', b.alpha || 0.1);
        ctx.fillRect(x0, A.y, x1 - x0, A.h);
        if (b.label) EV.text(ctx, b.label, (x0 + x1) / 2, A.y + 13, { align: 'center', size: 11, color: col('ink-2') });
      });
      // grid + y ticks
      const yt = ticks(yr[0], yr[1], Math.max(3, Math.round(A.h / 52)));
      const yd = decOf(yt.step);
      ctx.lineWidth = 1; ctx.strokeStyle = col('grid'); ctx.fillStyle = col('muted');
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      yt.vals.forEach((v) => {
        const y = Math.round(P.Y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke();
        ctx.fillText(o.y.fmt ? o.y.fmt(v) : EV.fmt(v, yd), A.x - 8, y);
      });
      // x ticks
      const xt = ticks(xr[0], xr[1], Math.max(3, Math.round(A.w / 84)));
      const xd = decOf(xt.step);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      xt.vals.forEach((v) => {
        const x = Math.round(P.X(v)) + 0.5;
        ctx.strokeStyle = col('axis');
        ctx.beginPath(); ctx.moveTo(x, A.y + A.h); ctx.lineTo(x, A.y + A.h + 4); ctx.stroke();
        ctx.fillText(o.x.fmt ? o.x.fmt(v) : EV.fmt(v, xd), x, A.y + A.h + 7);
      });
      if (o.x2) {  // second row of labels: the same axis in another unit (x2 = k * x)
        const t2 = ticks(xr[0] * o.x2.k, xr[1] * o.x2.k, Math.max(3, Math.round(A.w / 96)));
        const d2 = decOf(t2.step);
        ctx.fillStyle = col('muted');
        t2.vals.forEach((v) => ctx.fillText((o.x2.fmt ? o.x2.fmt(v) : EV.fmt(v, d2)), P.X(v / o.x2.k), A.y + A.h + 22));
        ctx.textAlign = 'right';
        ctx.fillText(o.x2.label, A.x - 8, A.y + A.h + 22);
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(A.x, A.y - 2, A.w + 1, A.h + 3); ctx.clip();
      if (o.under) o.under(ctx, P);
      // stacked areas
      const ss = visible(), stacked = ss.filter((s) => s.stack);
      if (stacked.length) {
        const base = stacked[0].pts.map(() => 0);
        stacked.forEach((s) => {
          const top = s.pts.map(([x, y], i) => [x, base[i] + Math.max(0, y || 0)]);
          ctx.beginPath();
          top.forEach(([x, y], i) => (i ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y))));
          for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(P.X(top[i][0]), P.Y(base[i]));
          ctx.closePath();
          ctx.fillStyle = EV.rgba(s.color, 0.42); ctx.fill();
          ctx.strokeStyle = col('surface'); ctx.lineWidth = 2; ctx.stroke();    // surface gap between bands
          path(top); ctx.strokeStyle = col(s.color); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
          top.forEach(([, y], i) => { base[i] = y; });
        });
      }
      // washes then lines
      ss.filter((s) => !s.stack && s.area).forEach((s) => {
        const pts = s.pts.filter((p) => p[1] != null);
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(P.X(pts[0][0]), P.Y(Math.max(yr[0], 0)));
        pts.forEach(([x, y]) => ctx.lineTo(P.X(x), P.Y(y)));
        ctx.lineTo(P.X(pts[pts.length - 1][0]), P.Y(Math.max(yr[0], 0)));
        ctx.closePath();
        ctx.fillStyle = EV.rgba(s.color, s.alpha || 0.12); ctx.fill();
      });
      ss.filter((s) => !s.stack).forEach((s) => {
        path(s.pts);
        ctx.strokeStyle = col(s.color); ctx.lineWidth = s.w || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.setLineDash(s.dash ? [5, 5] : []); ctx.stroke(); ctx.setLineDash([]);
      });
      // reference lines
      (data.hlines || []).forEach((l) => {
        const y = Math.round(P.Y(l.y)) + 0.5;
        ctx.strokeStyle = col(l.color || 'ink-2'); ctx.lineWidth = 1.25; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke(); ctx.setLineDash([]);
        if (l.label) EV.text(ctx, l.label, l.left ? A.x + 6 : A.x + A.w - 6, y - 5, { align: l.left ? 'left' : 'right', size: 11, halo: true });
      });
      (data.vlines || []).forEach((l) => {
        const x = Math.round(P.X(l.x)) + 0.5;
        if (x < A.x || x > A.x + A.w) return;
        ctx.strokeStyle = col(l.color || 'ink-2'); ctx.lineWidth = 1.25; ctx.setLineDash(l.solid ? [] : [5, 4]);
        ctx.beginPath(); ctx.moveTo(x, A.y); ctx.lineTo(x, A.y + A.h); ctx.stroke(); ctx.setLineDash([]);
        if (l.label) { const right = x < A.x + A.w - 90; EV.text(ctx, l.label, x + (right ? 6 : -6), A.y + (l.ly || 12), { align: right ? 'left' : 'right', size: 11, halo: true }); }
      });
      if (o.over) o.over(ctx, P);
      // crosshair
      if (hoverX != null) {
        const x = Math.round(P.X(hoverX)) + 0.5;
        ctx.strokeStyle = col('muted'); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, A.y); ctx.lineTo(x, A.y + A.h); ctx.stroke();
        let base = 0;
        ss.forEach((s) => {
          let y = yAt(s.pts, hoverX);
          if (y == null) return;
          if (s.stack) { base += Math.max(0, y); y = base; }
          dot(x, P.Y(y), col(s.color), 4);
        });
      }
      ctx.restore();
      // markers sit above the clip so labels are never cut
      (data.points || []).forEach((p) => {
        const x = P.X(p.x), y = P.Y(p.y);
        if (x < A.x - 1 || x > A.x + A.w + 1 || y < A.y - 6 || y > A.y + A.h + 6) return;
        dot(x, y, col(p.color || 'ink'), p.r || 5);
        if (p.label) {
          const right = p.align ? p.align === 'right' : x < A.x + A.w - 120;
          EV.text(ctx, p.label, x + (right ? 10 : -10), y + (p.dy == null ? -9 : p.dy), { align: right ? 'left' : 'right', size: 11.5, weight: 600, color: col('ink'), halo: true });
        }
      });
      // baseline
      ctx.strokeStyle = col('axis'); ctx.lineWidth = 1;
      const y0 = Math.round(P.Y(clamp(0, yr[0], yr[1]))) + 0.5;
      ctx.beginPath(); ctx.moveTo(A.x, y0); ctx.lineTo(A.x + A.w, y0); ctx.stroke();
    }
    function dot(x, y, color, r) {
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fillStyle = EV.col('surface'); ctx.fill();   // surface ring
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = color; ctx.fill();
    }

    /* tooltip ------------------------------------------------------------- */
    const fx = (v) => (o.x.tip ? o.x.tip(v) : EV.fmt(v, decOf(niceStep(xr[1] - xr[0], 40))) + (o.x.unit ? ' ' + o.x.unit : ''));
    const fy = (v) => (o.y.tip ? o.y.tip(v) : EV.fmt(v, decOf(niceStep(yr[1] - yr[0], 60))) + (o.y.unit ? ' ' + o.y.unit : ''));
    function showTip(px, py) {
      const A = P.area();
      if (px < A.x - 4 || px > A.x + A.w + 4) return hideTip();
      hoverX = clamp(P.invX(px), xr[0], xr[1]);
      draw();
      tip.textContent = '';
      const head = document.createElement('div'); head.className = 'th';
      head.textContent = (o.x.short || o.x.label || 'x').replace(/\s*\(.*\)$/, '') + ' ' + fx(hoverX);
      tip.appendChild(head);
      let any = false, total = 0, nStack = 0;
      visible().forEach((s) => {
        const y = yAt(s.pts, hoverX);
        if (y == null) return;
        any = true;
        if (s.stack) { total += Math.max(0, y); nStack++; }
        addRow(`var(--${s.color})`, fy(y), s.name);
      });
      if (nStack > 1) addRow('transparent', fy(total), 'total');
      if (o.tipExtra) (o.tipExtra(hoverX, P.invY(py)) || []).forEach((r) => { any = true; addRow('transparent', r[1], r[0]); });
      if (!any) return hideTip();
      tip.classList.add('on');
      const tw = tip.offsetWidth, th = tip.offsetHeight, cx = cv.offsetLeft + P.X(hoverX);
      tip.style.left = clamp(cx + 14 + tw > wrap.clientWidth ? cx - tw - 14 : cx + 14, 0, Math.max(0, wrap.clientWidth - tw)) + 'px';
      tip.style.top = clamp(cv.offsetTop + py - th - 10, cv.offsetTop, cv.offsetTop + H - th) + 'px';
    }
    function addRow(color, value, name) {
      const r = document.createElement('div'); r.className = 'tr';
      const k = document.createElement('i'); k.style.background = color;
      const b = document.createElement('b'); b.textContent = value;
      const n = document.createElement('span'); n.textContent = name;
      r.append(k, b, n); tip.appendChild(r);
    }
    function hideTip() { if (hoverX != null) { hoverX = null; draw(); } tip.classList.remove('on'); }
    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); showTip(e.clientX - r.left, e.clientY - r.top); });
    cv.addEventListener('pointerleave', hideTip);
    cv.addEventListener('blur', hideTip);
    cv.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.key === 'Escape') return hideTip();
      const step = (xr[1] - xr[0]) / 50 * (e.key === 'ArrowLeft' ? -1 : 1);
      const x = clamp((hoverX == null ? (xr[0] + xr[1]) / 2 : hoverX) + step, xr[0], xr[1]);
      showTip(P.X(x), P.area().y + 30);
    });

    /* data table twin ------------------------------------------------------ */
    function buildTable() {
      const ss = visible(), rows = 13;
      const t = document.createElement('table'), hd = t.createTHead().insertRow();
      [o.x.label || 'x'].concat(ss.map((s) => s.name)).forEach((h) => { const th = document.createElement('th'); th.textContent = h; hd.appendChild(th); });
      const body = t.createTBody();
      for (let i = 0; i < rows; i++) {
        const x = xr[0] + (xr[1] - xr[0]) * i / (rows - 1), tr = body.insertRow();
        tr.insertCell().textContent = fx(x);
        ss.forEach((s) => { const y = yAt(s.pts, x); tr.insertCell().textContent = y == null ? '–' : fy(y); });
      }
      tableBox.textContent = ''; tableBox.appendChild(t);
    }
    tableBtn.addEventListener('click', () => {
      tableBox.hidden = !tableBox.hidden;
      tableBtn.textContent = tableBox.hidden ? 'Show data table' : 'Hide data table';
      if (!tableBox.hidden) buildTable();
    });

    const ro = new ResizeObserver(size);
    ro.observe(wrap);
    EV.onCleanup(() => ro.disconnect());
    EV.onTheme(draw);
    layout(); size();
    return P;
  };

  /** Sample a function into plot points. */
  EV.sample = (f, a, b, n = 120) => { const out = []; for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; out.push([x, f(x)]); } return out; };
})();
