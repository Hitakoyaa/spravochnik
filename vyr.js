/* Справочник экономиста — раздел «Выработка»: по подразделениям, за период, по видам продукции и по дням. */
"use strict";

const PV = { k: "m" };
const VGROUPS = ["Мука", "Кормовая мука и отруби", "Крупа", "Комбикорм"];

function V() { return DATA && DATA.vyr ? DATA.vyr : null; }
function isoD(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ruD(s) { return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4); }
function ruDs(s) { return s.slice(8, 10) + "." + s.slice(5, 7); }
function vT(kg) { return nf1.format((kg || 0) / 1000); }

function vMonths() {
  const set = new Set();
  V().podr.forEach((d) => Object.values(d.produkty).forEach((p) => Object.keys(p.d).forEach((k) => set.add(k.slice(0, 7)))));
  return [...set].sort();
}
function vRange() {
  const po = parseRu(V().po), end = isoD(po);
  if (PV.k === "w") { const a = new Date(po); a.setDate(a.getDate() - 6); return [isoD(a), end, "7 дней"]; }
  if (PV.k === "y") return [end.slice(0, 4) + "-01-01", end, "с начала года"];
  if (PV.k === "c") {
    let a = PV.a || end.slice(0, 8) + "01", b = PV.b || end;
    if (a > b) [a, b] = [b, a];
    return [a, b, ruD(a) + " — " + ruD(b)];
  }
  const ms = vMonths(), m = PV.m && ms.includes(PV.m) ? PV.m : end.slice(0, 7);
  const [y, mm] = m.split("-").map(Number);
  const last = isoD(new Date(y, mm, 0));
  return [m + "-01", last < end ? last : end, mLabel(m)];
}
function vPicker() {
  const kinds = [["w", "Неделя"], ["m", "Месяц"], ["y", "С начала года"], ["c", "Свой"]];
  let h = `<div class="seg">${kinds.map(([k, l]) => `<button class="${PV.k === k ? "on" : ""}" data-pv="k:${k}">${l}</button>`).join("")}</div>`;
  const [a, b] = vRange();
  if (PV.k === "m") {
    const ms = vMonths().slice().reverse(), cur = a.slice(0, 7);
    h += `<div class="chips scroll">${ms.map((m) => `<button class="chip ${m === cur ? "on" : ""}" data-pv="m:${m}">${mLabel(m, true)}</button>`).join("")}</div>`;
  } else if (PV.k === "c") {
    h += `<div class="pp"><label>с <input type="date" data-pvd="a" value="${a}"></label><label>по <input type="date" data-pvd="b" value="${b}"></label></div>`;
  }
  return h;
}

function vStat(d, a, b) {
  const days = {}, byP = [], byG = {};
  let waste = 0;
  Object.entries(d.produkty).forEach(([k, p]) => {
    let s = 0;
    Object.entries(p.d).forEach(([dd, v]) => {
      if (dd < a || dd > b) return;
      s += v;
      if (p.g !== "Отходы") days[dd] = (days[dd] || 0) + v;
    });
    if (!s) return;
    if (p.g === "Отходы") waste += s; else byG[p.g] = (byG[p.g] || 0) + s;
    byP.push({ k, n: p.n, g: p.g, kg: s });
  });
  byP.sort((x, y) => y.kg - x.kg);
  const total = Object.values(byG).reduce((s, v) => s + v, 0);
  const work = Object.entries(days).filter(([, v]) => v > 0).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  let zerno = 0;
  Object.entries(d.zerno || {}).forEach(([dd, v]) => { if (dd >= a && dd <= b) zerno += v; });
  const mx = work.reduce((m, x) => (!m || x[1] > m[1] ? x : m), null);
  const mn = work.reduce((m, x) => (!m || x[1] < m[1] ? x : m), null);
  return { total, byG, byP, waste, days, work, n: work.length, avg: work.length ? total / work.length : 0, mx, mn, zerno };
}

function vBars(items, label) {
  if (!items.length) return "";
  const W = 320, H = 110, n = items.length, step = (W - 8) / n, bw = Math.max(2, Math.min(24, step - (n > 40 ? 1 : 3)));
  const mx = Math.max(...items.map((x) => x.v), 1);
  const every = Math.ceil(n / 8);
  const bars = items.map((x, i) => {
    const h = x.v ? Math.max(2, x.v / mx * (H - 22)) : 0, X = 4 + i * step + (step - bw) / 2, Y = H - 18 - h;
    const r = Math.min(3, bw / 2);
    return `<g><title>${esc(x.t)}: ${vT(x.v)} т</title><rect x="${X - (step - bw) / 2}" y="0" width="${step}" height="${H}" fill="transparent"/>
      ${h ? `<path d="M${X},${H - 18} V${Y + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${H - 18} z" fill="var(--accent)"/>` : ""}
      ${i % every === 0 ? `<text x="${X + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(x.l)}</text>` : ""}</g>`;
  }).join("");
  return `<div class="card" style="padding:12px 12px 6px"><div class="note" style="margin-bottom:4px">${esc(label)}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(label)}"><line x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="var(--line)"/>${bars}</svg></div>`;
}
function vSeries(st, a, b) {
  const out = [], d0 = new Date(a), d1 = new Date(b);
  const span = Math.round((d1 - d0) / 864e5) + 1;
  if (span <= 62) {
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
      const k = isoD(d);
      out.push({ l: ruDs(k).slice(0, 2), t: ruD(k), v: st.days[k] || 0 });
    }
    return [out, "По дням, т"];
  }
  const m = {};
  Object.entries(st.days).forEach(([k, v]) => { m[k.slice(0, 7)] = (m[k.slice(0, 7)] || 0) + v; });
  Object.keys(m).sort().forEach((k) => out.push({ l: MON_S[+k.slice(5) - 1], t: mLabel(k), v: m[k] }));
  return [out, "По месяцам, т"];
}

function viewVyr() {
  if (!V()) return { top: backbar("Выработка", "Выработка"), main: DATA ? `<div class="card empty">Выработки в архиве нет — соберите архив новым сборщиком.</div>` : noData() };
  const [a, b, lbl] = vRange();
  const sts = V().podr.map((d) => ({ d, st: vStat(d, a, b) }));
  const g = {};
  sts.forEach(({ st }) => Object.entries(st.byG).forEach(([k, v]) => { g[k] = (g[k] || 0) + v; }));
  const sum = `<div class="card kv">${VGROUPS.filter((k) => g[k]).map((k) => `<div><span>${esc(k)}</span><b class="num">${vT(g[k])} т</b></div>`).join("") || `<div><span>За период</span><b>выработки нет</b></div>`}</div>`;
  const cards = sts.map(({ d, st }) => `<button class="row" data-go="#vyrd/${encodeURIComponent(d.id)}" style="align-items:flex-start">
      <span class="m"><span class="n">${esc(d.name)}</span>
        <span class="d num">${st.n ? `${st.n} ${plural(st.n, "рабочий день", "рабочих дня", "рабочих дней")} · в среднем ${vT(st.avg)} т/день` : "выработки нет"}</span>
        ${st.total ? `<span class="d">${esc(Object.entries(st.byG).sort((x, y) => y[1] - x[1]).map(([k, v]) => k.toLowerCase() + " " + vT(v)).join(" · "))}</span>` : ""}</span>
      <span class="r"><span class="rv num" style="white-space:nowrap">${vT(st.total)} т</span></span>${I.chev}</button>`).join("");
  return {
    top: backbar("Выработка · данные по " + V().po, "Выработка · " + lbl),
    main: vPicker() + `<div class="h2">Всего за период · ${esc(ruD(a))} — ${esc(ruD(b))}</div>` + sum + `<div class="h2">По подразделениям</div>` + cards +
      `<div class="note">Источник — ежедневные сводки (мельницы — «Остатки производства», комбикорм — «Сведения кормоцех», крупы — «Сведения по крупяному заводу»). Сечка и зерноотходы в выработку не входят. Манка — на Мельнице №4.</div>`
  };
}

function viewVyrD(id) {
  if (!V()) return viewVyr();
  const d = V().podr.find((x) => x.id === id);
  if (!d) return { top: backbar("Выработка", ""), main: `<div class="empty">Нет в текущих данных</div>` };
  const [a, b, lbl] = vRange();
  const st = vStat(d, a, b);
  let h = vPicker();
  h += `<div class="card big"><div class="l">${esc(lbl)} · ${esc(ruD(a))} — ${esc(ruD(b))}</div>
      <div class="v num">${vT(st.total)} <small style="font-size:15px;color:var(--muted)">т</small></div>
      <div class="note num" style="padding:0">${st.n ? `в среднем ${vT(st.avg)} т в рабочий день` : "выработки нет"}</div></div>`;
  const kv = [];
  kv.push(["Рабочих дней", st.n]);
  if (st.mx) kv.push(["Максимальный день", ruD(st.mx[0]) + " · " + vT(st.mx[1]) + " т"]);
  if (st.mn && st.n > 1) kv.push(["Минимальный день", ruD(st.mn[0]) + " · " + vT(st.mn[1]) + " т"]);
  if (d.tip === "mill" && st.zerno) {
    kv.push(["Зерно в переработку", vT(st.zerno) + " т"]);
    if (st.byG["Мука"]) kv.push(["Выход муки", nf1.format(st.byG["Мука"] / st.zerno * 100) + " %"]);
  }
  if (st.waste) kv.push(["Отходы (сечка, зерноотходы)", vT(st.waste) + " т"]);
  h += `<div class="card kv">${kv.map(([k, v]) => `<div><span>${esc(k)}</span><b class="num">${esc(v)}</b></div>`).join("")}</div>`;
  const [ser, sl] = vSeries(st, a, b);
  if (st.total) h += vBars(ser, sl);
  if (st.byP.length) {
    const groups = [...VGROUPS, "Отходы"].filter((g) => st.byP.some((p) => p.g === g));
    h += `<div class="h2">По видам продукции</div>` + groups.map((g) => {
      const l = st.byP.filter((p) => p.g === g), gs = l.reduce((s, p) => s + p.kg, 0);
      return `<div class="card shg"><div class="shh"><span class="m"><span class="n">${esc(g)}</span><span class="d num">${vT(gs)} т${g !== "Отходы" && st.total ? " · " + nf1.format(gs / st.total * 100) + " %" : ""}</span></span></div>
        ${l.map((p) => `<div class="shr"><span class="m"><span class="n2">${esc(p.n)}</span><span class="d num">${st.n ? "в среднем " + vT(p.kg / st.n) + " т/день" : ""}</span></span><span class="num rv2">${vT(p.kg)} т</span></div>`).join("")}</div>`;
    }).join("");
  }
  return { top: backbar("Выработка · данные по " + V().po, d.name), main: h };
}

/* плитка на Главной: мука, в среднем за рабочий день текущего месяца */
function vyrTile() {
  if (!V()) return "";
  const po = parseRu(V().po), end = isoD(po), a = end.slice(0, 8) + "01";
  let muka = 0; const days = {};
  V().podr.forEach((d) => {
    if (d.tip !== "mill") return;
    Object.values(d.produkty).forEach((p) => {
      if (p.g !== "Мука") return;
      Object.entries(p.d).forEach(([dd, v]) => { if (dd >= a && dd <= end) { muka += v; days[dd] = 1; } });
    });
  });
  const n = Object.keys(days).length;
  return `<button class="tile" style="grid-column:span 2" data-go="#vyr"><span class="l">Выработка муки · ${esc(MON[po.getMonth()])}</span>
    <span class="v num">${n ? vT(muka / n) : "0,0"} <small>т/день</small></span>
    <span class="s num">всего ${vT(muka)} т за ${n} ${plural(n, "рабочий день", "рабочих дня", "рабочих дней")} · все подразделения →</span></button>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pv]");
  if (!b) return;
  e.stopPropagation();
  const [f, v] = b.dataset.pv.split(":");
  if (f === "k") PV.k = v; else PV[f] = v;
  render(true);
}, true);
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-pvd]");
  if (!el || !el.value) return;
  PV.k = "c"; PV[el.dataset.pvd] = el.value;
  render(true);
});
