/* Справочник экономиста — автообновление: приложение само берёт свежий архив, выложенный сборщиком на Google Диск.
   Архив зашифрован; ключ выводится из PIN (тот же, что для зарплаты) и хранится только в этом телефоне.
   Ключ зарплаты из него получить нельзя — зарплата по-прежнему открывается только PIN-кодом. */
"use strict";

const LS_SYNC = "spr_sync_v1";
let SYNC = (() => { try { return JSON.parse(localStorage.getItem(LS_SYNC) || "null"); } catch (e) { return null; } })();
let syncBusy = false, syncLast = 0, syncMsg = "";

function syncSave() { try { if (SYNC) localStorage.setItem(LS_SYNC, JSON.stringify(SYNC)); else localStorage.removeItem(LS_SYNC); } catch (e) { /* */ } }
function b64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return s; }
function bytesB64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }

async function syncFetch(a) {
  const r = await fetch(SYNC.u + (SYNC.u.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(SYNC.k) + "&a=" + a, { cache: "no-store" });
  const t = await r.text();
  if (t.trim().startsWith("<")) throw new Error("скрипт не отвечает (нужен доступ «Все» в развертывании)");
  return t;
}

async function syncDerive(pin, meta) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64(meta.salt), iterations: meta.iter }, base, 512));
  const hk = await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ek = new Uint8Array(await crypto.subtle.sign("HMAC", hk, new TextEncoder().encode("spr-archive")));
  const mk = new Uint8Array(await crypto.subtle.sign("HMAC", hk, new TextEncoder().encode("spr-archive-mac")));
  return { ek: bytesB64(ek), mk: bytesB64(mk) };
}

async function syncDecrypt(p) {
  const iv = b64(p.iv), ct = b64(p.ct);
  const mk = await crypto.subtle.importKey("raw", b64(SYNC.mk), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const msg = new Uint8Array(iv.length + ct.length); msg.set(iv); msg.set(ct, iv.length);
  if (!(await crypto.subtle.verify("HMAC", mk, b64(p.mac), msg))) return null;
  const ak = await crypto.subtle.importKey("raw", b64(SYNC.ek), "AES-CTR", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CTR", counter: iv, length: 128 }, ak, ct));
}

/* проверить и подтянуть новый архив; quiet — без сообщений, если нового нет */
async function syncNow(quiet) {
  if (!SYNC || !SYNC.ek || syncBusy) return;
  if (!navigator.onLine) { if (!quiet) toast("Нет интернета — показаны данные на " + (DATA ? DATA.meta.data_na_utro : "—")); return; }
  syncBusy = true; syncLast = Date.now();
  try {
    const meta = JSON.parse(await syncFetch("meta") || "{}");
    if (!meta.sobrano) { syncMsg = "на Диске пока нет архива"; if (!quiet) toast("На Диске пока нет архива — соберите на ПК"); return; }
    if (DATA && DATA.meta.sobrano === meta.sobrano) { syncMsg = "данные свежие · собрано " + meta.sobrano; if (!quiet) toast("Новых данных нет · собрано " + meta.sobrano); return; }
    const t = await syncFetch("get");
    if (!t.startsWith("OK:")) throw new Error(t.slice(0, 120));
    const zip = await syncDecrypt(JSON.parse(t.slice(3)));
    if (!zip) { SYNC.ek = SYNC.mk = null; syncSave(); syncMsg = "PIN сменился — введите заново"; toast("Автообновление: PIN на ПК сменился — введите его заново в «Ещё → Загрузить данные»"); return; }
    const res = await loadArchive(new File([zip], "Urozhai_dannye_" + (meta.data_na_utro || "") + ".zip"), false);
    if (res.older) { syncMsg = "на Диске архив старше текущих данных"; return; }
    res.d.fileName = "автообновления";
    saveData(res.d);
    syncMsg = "обновлено · собрано " + meta.sobrano;
    toast("Данные обновлены: на " + res.d.meta.data_na_utro);
    render();
  } catch (e) {
    syncMsg = "ошибка: " + e.message;
    if (!quiet) toast("Автообновление: " + e.message);
  } finally { syncBusy = false; }
}

/* ссылка из Telegram: …/#setup=<base64> — запоминаем адрес и ключ, дальше просим PIN */
function syncTakeSetup() {
  const m = /^#setup=([A-Za-z0-9_\-]+)/.exec(location.hash);
  if (!m) return false;
  try {
    const c = JSON.parse(atob(b64u(m[1])));
    SYNC = { u: c.u, k: c.k, ek: null, mk: null };
    syncSave();
  } catch (e) { /* */ }
  history.replaceState(null, "", "#load");
  return true;
}

function syncCard() {
  if (!SYNC) return `<div class="h2">Автообновление</div><div class="card big" style="gap:6px"><div style="font-weight:800">Не подключено</div>
    <div class="note" style="padding:0">После сборки на ПК бот пришлёт в Telegram ссылку «Подключить автообновление». Откройте её на этом телефоне и введите PIN.</div></div>`;
  if (!SYNC.ek) return `<div class="h2">Автообновление</div><div class="card big lock">
    <div style="font-weight:800">Введите PIN, чтобы подключить</div>
    <div class="note" style="padding:0">Тот же PIN, что для зарплаты. Нужен один раз — дальше данные будут обновляться сами при открытии приложения.</div>
    <input id="spin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="PIN" aria-label="PIN-код">
    <button class="btn" data-sync="pin">Подключить</button><div id="spinerr" class="bad" style="font-weight:700;min-height:18px"></div></div>`;
  return `<div class="h2">Автообновление</div><div class="card kv">
    <div><span>Состояние</span><b class="ok">подключено</b></div>
    ${syncMsg ? `<div><span>Последняя проверка</span><b>${esc(syncMsg)}</b></div>` : ""}
  </div>
  <button class="btn sec" data-sync="now">Проверить сейчас</button>
  <button class="btn sec" data-sync="off" style="background:var(--surface2);color:var(--muted)">Отключить автообновление</button>`;
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-sync]");
  if (!b) return;
  e.stopPropagation();
  const a = b.dataset.sync;
  if (a === "now") { await syncNow(false); render(); }
  else if (a === "off") { if (b.dataset.sure) { SYNC = null; syncSave(); render(); } else { b.dataset.sure = "1"; b.textContent = "Точно отключить? Нажмите ещё раз"; } }
  else if (a === "pin") {
    const pin = (document.getElementById("spin").value || "").trim(), err = document.getElementById("spinerr");
    if (!/^\d{4,6}$/.test(pin)) { err.textContent = "Нужно 4–6 цифр"; return; }
    err.textContent = "Проверяю…";
    try {
      const meta = JSON.parse(await syncFetch("meta") || "{}");
      if (!meta.salt) { err.textContent = "На Диске пока нет архива — соберите на ПК и попробуйте снова"; return; }
      Object.assign(SYNC, await syncDerive(pin, meta));
      const t = await syncFetch("get");
      const ok = t.startsWith("OK:") && (await syncDecrypt(JSON.parse(t.slice(3))));
      if (!ok) { SYNC.ek = SYNC.mk = null; err.textContent = "Неверный PIN"; return; }
      syncSave();
      await syncNow(false);
      render();
    } catch (x) { err.textContent = "Не получилось: " + x.message; }
  }
}, true);

document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - syncLast > 60000) syncNow(true); });
window.addEventListener("online", () => syncNow(true));
