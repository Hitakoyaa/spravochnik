/* Справочник экономиста — ГСМ и уголь: остатки, расход, на сколько хватит, расход по технике. */
"use strict";

let GSMP = "m";   // период для расхода по технике: 7 · m (текущий месяц) · y

function GS() { return DATA && DATA.gsm ? DATA.gsm : null; }
function L(x) { return nf0.format(Math.round(x || 0)) + " л"; }
function gIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

/* средний расход в календарный день за последние n дней (листы есть не за каждый день — пропуск = расхода не было) */
function gAvg(get, n) {
  const g = GS(), end = parseRu(g.data);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const h = g.istoriya[gIso(d)];
    if (h) s += get(h) || 0;
  }
  return s / n;
}
function gDays(ost, avg) { return avg > 0 ? ost / avg : null; }
function gDaysTxt(d) { return d == null ? "расхода не было" : "хватит на ~" + nf0.format(Math.floor(d)) + " " + plural(Math.floor(d), "день", "дня", "дней"); }

function gSeries(get, n) {
  const g = GS(), end = parseRu(g.data), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    const k = gIso(d), h = g.istoriya[k];
    out.push({ l: k.slice(8, 10), t: k.slice(8, 10) + "." + k.slice(5, 7), v: h ? get(h) || 0 : 0 });
  }
  return out;
}
function gBars(items, label, unit) {
  const W = 320, H = 100, n = items.length, step = (W - 8) / n, bw = Math.max(2, Math.min(18, step - 2));
  const mx = Math.max(...items.map((x) => x.v), 1), every = Math.ceil(n / 8);
  const bars = items.map((x, i) => {
    const h = x.v ? Math.max(2, x.v / mx * (H - 20)) : 0, X = 4 + i * step + (step - bw) / 2, Y = H - 16 - h, r = Math.min(3, bw / 2);
    return `<g><title>${esc(x.t)}: ${nf0.format(x.v)} ${unit}</title>${h ? `<path d="M${X},${H - 16} V${Y + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${H - 16} z" fill="var(--accent)"/>` : ""}
      ${i % every === 0 ? `<text x="${X + bw / 2}" y="${H - 3}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(x.l)}</text>` : ""}</g>`;
  }).join("");
  return `<div class="card" style="padding:12px 12px 6px"><div class="note" style="margin-bottom:4px">${esc(label)}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(label)}"><line x1="0" x2="${W}" y1="${H - 16}" y2="${H - 16}" stroke="var(--line)"/>${bars}</svg></div>`;
}

function gsmFuelCard(b, f) {
  const ost = (b.ost || {})[f] || 0, avg = gAvg((h) => (h.r || {})[f], 30), d = gDays(ost, avg);
  const cls = d == null ? "b-mute" : d < 7 ? "b-bad" : d < SET.porog ? "b-warn" : "b-ok";
  return `<div class="card shg"><div class="shh"><span class="m"><span class="n">${esc(f[0].toUpperCase() + f.slice(1))}</span>
      <span class="d num">остаток ${L(ost)}</span></span><span class="badge ${cls}" style="align-self:center">${esc(gDaysTxt(d))}</span></div>
    <div class="card kv" style="border:0;border-radius:0">
      <div><span>Расход за день</span><b class="num">${L((b.rashod_den || {})[f])}</b></div>
      <div><span>В среднем в день (30 дн.)</span><b class="num">${L(avg)}</b></div>
      <div><span>Расход с начала года</span><b class="num">${L((b.rashod_s_nach || {})[f])}</b></div>
      <div><span>Приход с начала года</span><b class="num">${L((b.prihod_s_nach || {})[f])}</b></div>
      <div><span>Остаток на начало года</span><b class="num">${L((b.ost_nach_goda || {})[f])}</b></div>
    </div></div>`;
}

function gsmPotr() {
  const g = GS(), end = gIso(parseRu(g.data));
  let a = end.slice(0, 8) + "01", lbl = MON[parseRu(g.data).getMonth()];
  if (GSMP === "7") { const d = parseRu(g.data); d.setDate(d.getDate() - 6); a = gIso(d); lbl = "7 дней"; }
  if (GSMP === "y") { a = end.slice(0, 4) + "-01-01"; lbl = "с начала года"; }
  if (GSMP === "1") { a = end; lbl = "за " + g.data; }
  const rows = g.potrebiteli.map((p) => {
    const s = {};
    Object.entries(p.d).forEach(([k, v]) => { if (k >= a && k <= end) Object.entries(v).forEach(([f, l]) => { s[f] = (s[f] || 0) + l; }); });
    return { p, s, tot: Object.values(s).reduce((x, y) => x + y, 0) };
  }).filter((x) => x.tot > 0 && match(Q, x.p.tehnika, x.p.kto, x.p.naznach));
  rows.sort((x, y) => y.tot - x.tot);
  const sumF = {};
  rows.forEach((x) => Object.entries(x.s).forEach(([f, l]) => { sumF[f] = (sumF[f] || 0) + l; }));
  const chips = [["1", "Вчера"], ["7", "7 дней"], ["m", "Месяц"], ["y", "С начала года"]];
  let h = `<div class="h2">Расход по технике · ${esc(lbl)}</div><div class="chips scroll">${chips.map(([k, l]) => `<button class="chip ${GSMP === k ? "on" : ""}" data-gp="${k}">${l}</button>`).join("")}</div>`;
  if (!rows.length) return h + `<div class="card empty" style="padding:14px">Расхода нет</div>`;
  h += `<div class="total"><span>Итого</span><b class="num">${esc(Object.entries(sumF).map(([f, l]) => f + " " + L(l)).join(" · "))}</b></div>`;
  h += `<div class="card shg">${rows.map(({ p, s }) => `<div class="shr"><span class="m"><span class="n2">${esc(p.tehnika || p.kto)}${p.blok ? ` <span class="badge b-info">сторонние</span>` : ""}</span>
      <span class="d">${esc([p.tehnika ? p.kto : "", p.naznach].filter(Boolean).join(" · "))}</span></span>
      <span class="r2">${Object.entries(s).map(([f, l]) => `<span class="num rv2">${L(l)}</span><span class="d">${esc(f)}</span>`).join("")}</span></div>`).join("")}</div>`;
  return h;
}

function viewGsmBody() {
  const g = GS();
  if (!g) return `<div class="card empty">Сводки ГСМ и угля в архиве нет. Положите файл «Сведения движения ГСМ» в папку «Данные» на ПК и соберите архив заново.</div>`;
  const b0 = g.bloki[0];
  let h = `<div class="note" style="font-weight:700">ГСМ и уголь на ${esc(g.data)}</div>`;
  if (b0) {
    const fuels = b0.toplivo.filter((f) => (b0.ost || {})[f] || (b0.rashod_s_nach || {})[f]);
    h += `<div class="h2">Топливо · ТОО «Урожай»</div>` + fuels.map((f) => gsmFuelCard(b0, f)).join("");
    if (fuels.includes("дизтопливо")) h += gBars(gSeries((x) => (x.r || {})["дизтопливо"], 30), "Расход дизтоплива по дням, л (30 дней)", "л");
  }
  if (g.balans && g.balans.length) {
    h += `<div class="h2">Баланс дизтоплива по организациям</div><div class="card kv">${g.balans.map((x) => `<div><span>${esc(x.label)}</span><b class="num ${x.v < 0 ? "bad" : ""}">${L(x.v)}</b></div>`).join("")}</div>
      <div class="note">Минус — организация взяла с АЗС «Урожая» больше, чем завезла.</div>`;
  }
  const b1 = g.bloki[1];
  if (b1 && b1.toplivo.some((f) => (b1.rashod_s_nach || {})[f] || (b1.ost || {})[f])) {
    h += `<div class="h2">Сторонние организации</div><div class="card kv">${b1.toplivo.filter((f) => (b1.rashod_s_nach || {})[f] || (b1.rashod_den || {})[f]).map((f) => `<div><span>${esc(f)}: расход за день / с начала</span><b class="num">${L((b1.rashod_den || {})[f])} / ${L((b1.rashod_s_nach || {})[f])}</b></div>`).join("")}</div>`;
  }
  const u = g.ugol;
  if (u) {
    const avg7 = gAvg((x) => x.ur, 7), d = gDays(u.ost || 0, avg7);
    const cls = d == null ? "b-mute" : d < 7 ? "b-bad" : d < SET.porog ? "b-warn" : "b-ok";
    h += `<div class="h2">Уголь · котельная</div><div class="card shg"><div class="shh"><span class="m"><span class="n">Остаток ${T(u.ost)} т</span>
        <span class="d num">на ${esc(g.data)}</span></span><span class="badge ${cls}" style="align-self:center">${esc(gDaysTxt(d))}</span></div>
      <div class="card kv" style="border:0;border-radius:0">
        <div><span>Расход за день</span><b class="num">${T(u.rashod_den)} т</b></div>
        <div><span>В среднем в день (7 дн.)</span><b class="num">${T(avg7)} т</b></div>
        <div><span>Приход за день</span><b class="num">${T(u.prihod_den)} т</b></div>
        <div><span>Расход с начала сезона</span><b class="num">${T(u.rashod_s_nach)} т</b></div>
        <div><span>Приход с начала сезона</span><b class="num">${T(u.prihod_s_nach)} т</b></div>
        <div><span>Остаток на начало сезона</span><b class="num">${T(u.sezon_nach)} т</b></div>
        ${(u.marki || []).filter((m) => m.ost).map((m) => `<div><span>${esc(m.marka)}</span><b class="num">${T(m.ost)} т</b></div>`).join("")}
      </div></div>` + gBars(gSeries((x) => x.ur, 30), "Расход угля по дням, кг (30 дней)", "кг");
  }
  h += gsmPotr();
  return h;
}

/* «Требует внимания» на Главной: топливо и уголь, которых хватит меньше чем на порог дней */
function gsmAttention() {
  const g = GS(), out = [];
  if (!g) return out;
  const b0 = g.bloki[0];
  if (b0) b0.toplivo.forEach((f) => {
    const ost = (b0.ost || {})[f] || 0, d = gDays(ost, gAvg((h) => (h.r || {})[f], 30));
    if (d != null && d < SET.porog) out.push({ t: f[0].toUpperCase() + f.slice(1) + " · " + L(ost), v: gDaysTxt(d).replace("хватит на ", ""), sort: d, h: "#stock/gsm", bad: d < 7 });
  });
  if (g.ugol) {
    const d = gDays(g.ugol.ost || 0, gAvg((x) => x.ur, 7));
    if (d != null && d < SET.porog) out.push({ t: "Уголь · " + T(g.ugol.ost) + " т", v: gDaysTxt(d).replace("хватит на ", ""), sort: d, h: "#stock/gsm", bad: d < 7 });
  }
  return out;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-gp]");
  if (!b) return;
  e.stopPropagation();
  GSMP = b.dataset.gp;
  render(true);
}, true);
