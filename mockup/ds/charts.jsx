// charts.jsx — full chart set, ported from FlowBase components/charts/*.
// 13 types, all hand-drawn SVG in Vector tokens. Each takes simple data props.
// data: [{k,v}] for category charts; rows+fields for cross-tab (heatmap/scatter/pivot).
(function () {
  const PAL = ["#4C8DFF", "#4CB782", "#F2C94C", "#F2994A", "#BB6BD9", "#EB5757", "#2D9CDB", "#E879B9"];
  const A = (props) => React.createElement(React.Fragment, null, props.children);

  function Bar({ data, horizontal }) {
    const W = 460, H = 200, P = 30, max = Math.max(...data.map(d => d.v), 1);
    if (horizontal) {
      const bh = (H - 2 * P) / Math.max(1, data.length);
      return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {data.map((d, i) => { const y = P + bh * i; const w = (W - 2 * P - 80) * d.v / max; return <g key={i}>
          <text x={P} y={y + bh / 2 + 3} className="ins-axis" style={{ fill: "var(--fg-2)" }}>{d.k}</text>
          <rect x={P + 78} y={y + bh * 0.2} width={Math.max(1, w)} height={bh * 0.6} rx="3" fill={PAL[0]} />
          <text x={P + 82 + w} y={y + bh / 2 + 3} className="ins-axis" style={{ fill: "var(--fg-3)" }}>{d.v}</text></g>; })}
      </svg>;
    }
    const bw = (W - 2 * P) / Math.max(1, data.length), y = v => P + (H - 2 * P) * (1 - v / max);
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, .5, 1].map((f, i) => <line key={i} x1={P} x2={W - P} y1={P + (H - 2 * P) * f} y2={P + (H - 2 * P) * f} stroke="var(--border)" />)}
      {data.map((d, i) => { const cx = P + bw * (i + .5); return <g key={i}>
        <rect x={cx - bw * .3} y={y(d.v)} width={bw * .6} height={(H - P) - y(d.v)} rx="3" fill={PAL[i % PAL.length]} />
        <text x={cx} y={H - 8} textAnchor="middle" className="ins-axis">{d.k}</text>
        <text x={cx} y={y(d.v) - 5} textAnchor="middle" className="ins-axis" style={{ fill: "var(--fg-3)" }}>{d.v}</text></g>; })}
    </svg>;
  }
  function Line({ data, area }) {
    const W = 460, H = 200, P = 30, max = Math.max(...data.map(d => d.v), 1);
    const x = i => P + (W - 2 * P) * i / Math.max(1, data.length - 1), y = v => P + (H - 2 * P) * (1 - v / max);
    const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(" ");
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, .5, 1].map((f, i) => <line key={i} x1={P} x2={W - P} y1={P + (H - 2 * P) * f} y2={P + (H - 2 * P) * f} stroke="var(--border)" />)}
      {area && data.length > 1 && <path d={`${path} L${x(data.length - 1)} ${H - P} L${x(0)} ${H - P} Z`} fill="var(--accent-soft)" />}
      <path d={path} fill="none" stroke={PAL[0]} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => <g key={i}><circle cx={x(i)} cy={y(d.v)} r="2.5" fill={PAL[0]} /><text x={x(i)} y={H - 8} textAnchor="middle" className="ins-axis">{d.k}</text></g>)}
    </svg>;
  }
  function Pie({ data, donut }) {
    const cx = 95, cy = 100, r = 78; let acc = 0; const total = data.reduce((s, d) => s + d.v, 0) || 1;
    return <svg viewBox="0 0 320 200" style={{ width: "100%", height: "auto" }}>
      {data.map((d, i) => { const a0 = acc / total * Math.PI * 2 - Math.PI / 2; acc += d.v; const a1 = acc / total * Math.PI * 2 - Math.PI / 2; const lg = (a1 - a0) > Math.PI ? 1 : 0; const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); return <path key={i} d={`M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`} fill={PAL[i % PAL.length]} />; })}
      {donut && <circle cx={cx} cy={cy} r="44" fill="var(--bg-app)" />}
      {data.map((d, i) => <g key={i} transform={`translate(200 ${44 + i * 22})`}><rect width="11" height="11" rx="3" fill={PAL[i % PAL.length]} /><text x="18" y="10" className="ins-axis" style={{ fill: "var(--fg-2)", fontSize: 12 }}>{d.k} · {d.v}</text></g>)}
    </svg>;
  }
  function Area({ data }) { return <Line data={data} area />; }
  function StackedBar({ series, cats }) {
    // series: [{name,color,vals:[]}], cats: [labels]
    const W = 460, H = 200, P = 30;
    const totals = cats.map((_, i) => series.reduce((s, sr) => s + (sr.vals[i] || 0), 0));
    const max = Math.max(...totals, 1), bw = (W - 2 * P) / Math.max(1, cats.length);
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {cats.map((c, i) => { const cx = P + bw * (i + .5); let yAcc = H - P; return <g key={i}>
        {series.map((sr, j) => { const h = (sr.vals[i] || 0) / max * (H - 2 * P); yAcc -= h; return <rect key={j} x={cx - bw * .3} y={yAcc} width={bw * .6} height={Math.max(0, h)} fill={sr.color || PAL[j % PAL.length]} />; })}
        <text x={cx} y={H - 8} textAnchor="middle" className="ins-axis">{c}</text></g>; })}
    </svg>;
  }
  function CategoryBar({ data }) { return <Bar data={data} horizontal />; }
  function Histogram({ values, bins }) {
    bins = bins || 8; const nums = values.map(Number).filter(n => Number.isFinite(n));
    if (!nums.length) return <Empty />;
    const min = Math.min(...nums), max = Math.max(...nums), span = (max - min) || 1, step = span / bins;
    const buckets = Array.from({ length: bins }, (_, i) => ({ k: (min + step * i).toFixed(0), v: 0 }));
    nums.forEach(n => { let b = Math.floor((n - min) / step); if (b >= bins) b = bins - 1; buckets[b].v++; });
    return <Bar data={buckets} />;
  }
  function Scatter({ points }) {
    const W = 460, H = 200, P = 30;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const xmin = Math.min(...xs, 0), xmax = Math.max(...xs, 1), ymin = Math.min(...ys, 0), ymax = Math.max(...ys, 1);
    const sx = v => P + (W - 2 * P) * (v - xmin) / ((xmax - xmin) || 1), sy = v => P + (H - 2 * P) * (1 - (v - ymin) / ((ymax - ymin) || 1));
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, .5, 1].map((f, i) => <line key={i} x1={P} x2={W - P} y1={P + (H - 2 * P) * f} y2={P + (H - 2 * P) * f} stroke="var(--border)" />)}
      {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={PAL[0]} fillOpacity="0.6" />)}
    </svg>;
  }
  function Funnel({ stages }) {
    const data = stages.filter(s => s.v > 0); if (!data.length) return <Empty />;
    const max = Math.max(...data.map(s => s.v), 1), W = 320, sh = 34, gap = 5, padX = 8, innerW = W - padX * 2;
    const totalH = data.length * sh + (data.length - 1) * gap;
    return <svg viewBox={`0 0 ${W} ${totalH}`} style={{ width: "100%", maxWidth: 360, height: "auto", display: "block", margin: "0 auto" }}>
      {data.map((s, i) => { const y = i * (sh + gap); const tw = (i === 0 ? 1 : data[i - 1].v / max) * innerW, bw2 = (s.v / max) * innerW; const tx = padX + (innerW - tw) / 2, bx = padX + (innerW - bw2) / 2; const pts = [[tx, y], [tx + tw, y], [bx + bw2, y + sh], [bx, y + sh]].map(p => p.join(",")).join(" "); const c = PAL[i % PAL.length]; return <g key={i}><polygon points={pts} fill={c} fillOpacity="0.7" stroke={c} /><text x={W / 2} y={y + sh / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--fg)">{s.k} · {s.v}</text></g>; })}
    </svg>;
  }
  function Heatmap({ rows, catField, groupField }) {
    const cells = {}, catT = {}, grpT = {};
    rows.forEach(r => { const c = String(r[catField] ?? ""), g = String(r[groupField] ?? ""); if (!c || !g) return; const k = c + "|" + g; cells[k] = (cells[k] || 0) + 1; catT[c] = (catT[c] || 0) + 1; grpT[g] = (grpT[g] || 0) + 1; });
    const cats = Object.keys(catT).sort((a, b) => catT[b] - catT[a]), grps = Object.keys(grpT).sort((a, b) => grpT[b] - grpT[a]);
    const max = Math.max(1, ...Object.values(cells));
    if (!cats.length || !grps.length) return <Empty />;
    return <div style={{ overflowX: "auto" }}><div style={{ display: "grid", gap: 2, gridTemplateColumns: `minmax(70px,1fr) repeat(${grps.length}, minmax(28px,1fr))`, fontSize: 11 }}>
      <div />{grps.map(g => <div key={g} style={{ textAlign: "center", color: "var(--fg-3)", padding: "2px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g}>{g}</div>)}
      {cats.map(c => <React.Fragment key={c}><div style={{ color: "var(--fg-2)", padding: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c}>{c}</div>
        {grps.map(g => { const v = cells[c + "|" + g] || 0; const op = v ? Math.max(0.18, Math.min(1, v / max)) : 0; return <div key={g} title={`${c} × ${g}: ${v}`} style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, fontFamily: "var(--font-mono)", background: v ? "var(--accent)" : "var(--bg-elevated-2)", opacity: v ? op : 0.5, color: v > 0 ? "var(--fg-on-accent)" : "var(--fg-4)" }}>{v || ""}</div>; })}
      </React.Fragment>)}
    </div></div>;
  }
  function Pivot({ rows, rowField, colField }) {
    const grid = {}, rowsK = {}, colsK = {};
    rows.forEach(r => { const rk = String(r[rowField] ?? "—"), ck = String(r[colField] ?? "—"); const k = rk + "|" + ck; grid[k] = (grid[k] || 0) + 1; rowsK[rk] = 1; colsK[ck] = 1; });
    const rk = Object.keys(rowsK), ck = Object.keys(colsK);
    return <div style={{ overflowX: "auto" }}><table className="db-table" style={{ fontSize: 12 }}>
      <thead><tr><th><span className="db-th"> </span></th>{ck.map(c => <th key={c}><span className="db-th">{c}</span></th>)}<th><span className="db-th">Σ</span></th></tr></thead>
      <tbody>{rk.map(r => { let rowTotal = 0; const cellsR = ck.map(c => { const v = grid[r + "|" + c] || 0; rowTotal += v; return v; }); return <tr key={r}><td className="db-td" style={{ fontWeight: 600 }}>{r}</td>{cellsR.map((v, i) => <td key={i} className="db-td" style={{ textAlign: "center", color: v ? "var(--fg)" : "var(--fg-4)" }}>{v || ""}</td>)}<td className="db-td" style={{ textAlign: "center", fontWeight: 600 }}>{rowTotal}</td></tr>; })}</tbody>
    </table></div>;
  }
  function Bullet({ label, value, target, max }) {
    const W = 460, H = 46, m = max || Math.max(value, target) * 1.2;
    const sx = v => 90 + (W - 110) * v / m;
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <text x="0" y={H / 2 + 4} className="ins-axis" style={{ fill: "var(--fg-2)" }}>{label}</text>
      <rect x="90" y={H / 2 - 7} width={W - 110} height="14" rx="3" fill="var(--bg-elevated-2)" />
      <rect x="90" y={H / 2 - 5} width={sx(value) - 90} height="10" rx="2" fill={PAL[0]} />
      <line x1={sx(target)} y1={H / 2 - 10} x2={sx(target)} y2={H / 2 + 10} stroke="var(--fg)" strokeWidth="2" />
    </svg>;
  }
  function Kpi({ label, value, sub }) {
    return <div><div className="ins-kpi" style={{ font: "var(--fw-semi) 30px var(--font-sans)", color: "var(--fg)" }}>{value}</div><div className="ins-stat-lab">{label}</div>{sub && <div className="ins-stat-sub">{sub}</div>}</div>;
  }
  function Empty() { return <div className="empty" style={{ height: 140 }}><div className="etext">No data</div></div>; }

  const CHART_TYPES = [
    { id: "bar", label: "Bar", icon: "bar-chart-3" },
    { id: "hbar", label: "Horizontal bar", icon: "bar-chart-horizontal" },
    { id: "line", label: "Line", icon: "line-chart" },
    { id: "area", label: "Area", icon: "area-chart" },
    { id: "pie", label: "Pie", icon: "pie-chart" },
    { id: "donut", label: "Donut", icon: "circle-dot" },
    { id: "stacked", label: "Stacked bar", icon: "chart-no-axes-column" },
    { id: "histogram", label: "Histogram", icon: "bar-chart-4" },
    { id: "scatter", label: "Scatter", icon: "scatter-chart" },
    { id: "funnel", label: "Funnel", icon: "filter" },
    { id: "heatmap", label: "Heatmap", icon: "grid-3x3" },
    { id: "pivot", label: "Pivot table", icon: "table-2" },
    { id: "bullet", label: "Bullet", icon: "target" },
  ];
  if (typeof window !== "undefined") Object.assign(window, {
    VChart: { Bar, Line, Pie, Area, StackedBar, CategoryBar, Histogram, Scatter, Funnel, Heatmap, Pivot, Bullet, Kpi },
    CHART_TYPES,
  });
})();
