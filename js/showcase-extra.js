"use strict";
/* ── витрина: сравнение сборок и ссылка «Поделиться» ── */

/* ═══ сравнение: текущая сборка против другого персонажа или прошлой сборки этого же ═══ */
let scCmpOpen = false;
const scCmpSel = {};
const scNum = v => parseFloat(String(v).replace(/[\s  ]/g, "").replace(",", ".").replace("%", ""));
function scCmpOptions(game, u, cur){
  const opts = [], rec = u.agents[cur] || {};
  (rec.hist || []).forEach((x, i) => opts.push({ v: "h:" + i, t: "Прошлая сборка от " + scDate(x.at), a: x.a }));
  Object.keys(u.agents).filter(id => id !== cur).forEach(id => {
    let nm = "#" + id; try { nm = SCG[game].vm(u.agents[id].a).name; } catch(e){}
    opts.push({ v: "c:" + id, t: nm, a: u.agents[id].a });
  });
  return opts;
}
function scCmpHtml(game, uid, cur, vm, u){
  const opts = scCmpOptions(game, u, cur), key = game + ":" + uid + ":" + cur;
  if(!opts.length) return '<div class="sc-cmp"><p class="hint">Сравнивать не с кем: загрузите ещё персонажей или дождитесь, пока у этого появится прошлая сборка.</p></div>';
  let sel = opts.find(o => o.v === scCmpSel[key]) || opts[0];
  let other = null;
  try { other = SCG[game].vm(sel.a); } catch(e){ console.error(e); }
  if(!other) return "";
  const pct = v => /%/.test(String(v));
  const fmt = (d, p, dig) => (d > 0 ? "+" : "−") + Math.abs(d).toLocaleString("ru-RU", { maximumFractionDigits: dig !== undefined ? dig : p ? 1 : 0 }) + (p ? "%" : "");
  const row = (n, a, b, d, hl) => '<tr' + (hl ? ' class="hl"' : "") + '><th>' + esc(n) + '</th><td>' + esc(a) + '</td><td>' + esc(b) + '</td><td class="' + (d === "" || d === 0 ? "" : d > 0 ? "up" : "dn") + '">' + (d === "" || d === 0 ? "" : fmt(d.v !== undefined ? d.v : d, d.p, d.dig)) + "</td></tr>";
  let rows = "";
  const names = [];
  vm.stats.forEach(r => names.push(r.n));
  other.stats.forEach(r => { if(names.indexOf(r.n) === -1) names.push(r.n); });
  names.forEach(n => {
    const a = vm.stats.find(r => r.n === n), b = other.stats.find(r => r.n === n);
    const av = a ? a.v : "—", bv = b ? b.v : "—", x = scNum(av), y = scNum(bv);
    const d = isNaN(x) || isNaN(y) ? "" : Math.round((x - y) * 10) / 10;
    rows += '<tr' + (a && a.hl ? ' class="hl"' : "") + '><th>' + esc(n) + '</th><td>' + esc(av) + '</td><td>' + esc(bv) + '</td><td class="' + (!d ? "" : d > 0 ? "up" : "dn") + '">' + (!d ? "" : fmt(d, pct(av))) + "</td></tr>";
  });
  const cva = Math.round((vm.cv || 0) / 10) / 10, cvb = Math.round((other.cv || 0) / 10) / 10, dcv = Math.round((cva - cvb) * 10) / 10;
  rows += '<tr class="sep"><th>Крит-ценность</th><td>' + cva.toLocaleString("ru-RU") + '</td><td>' + cvb.toLocaleString("ru-RU") + '</td><td class="' + (!dcv ? "" : dcv > 0 ? "up" : "dn") + '">' + (!dcv ? "" : fmt(dcv, false, 1)) + "</td></tr>";
  if(game !== "nap"){
    const fl = game === "hkrpg" ? HX_FLAT : GX_FLAT, n = game === "hkrpg" ? 6 : 5;
    const ga = gxGrade(vm, n, fl), gb = gxGrade(other, n, fl), dg = Math.round((ga.n - gb.n) * 10) / 10;
    rows += '<tr><th>Полезные усиления</th><td>' + ga.n.toLocaleString("ru-RU") + " (" + ga.g + ')</td><td>' + gb.n.toLocaleString("ru-RU") + " (" + gb.g + ')</td><td class="' + (!dg ? "" : dg > 0 ? "up" : "dn") + '">' + (!dg ? "" : fmt(dg, false, 1)) + "</td></tr>";
  } else {
    const ga = zxGrade(vm), gb = zxGrade(other), dg = Math.round((ga.n - gb.n) * 10) / 10;
    rows += '<tr><th>Полезные усиления</th><td>' + ga.n.toLocaleString("ru-RU") + " (" + ga.g + ')</td><td>' + gb.n.toLocaleString("ru-RU") + " (" + gb.g + ')</td><td class="' + (!dg ? "" : dg > 0 ? "up" : "dn") + '">' + (!dg ? "" : fmt(dg, false, 1)) + "</td></tr>";
  }
  const w = x => x.weapon ? x.weapon.name + " · ур. " + x.weapon.lvl + " · " + x.weapon.refine.label + x.weapon.refine.n : "—";
  const st = x => (x.sets || []).map(s => s.name + (s.full ? " ×4" : " ×2")).join(", ") || "—";
  rows += '<tr class="txt"><th>' + esc((vm.weapon || other.weapon || {}).title || "Оружие") + '</th><td>' + esc(w(vm)) + '</td><td>' + esc(w(other)) + "</td><td></td></tr>";
  rows += '<tr class="txt"><th>Комплекты</th><td>' + esc(st(vm)) + '</td><td>' + esc(st(other)) + "</td><td></td></tr>";
  return '<div class="sc-cmp"><div class="sc-cmph"><b>Сравнение</b><select data-ck="' + esc(key) + '">' +
    opts.map(o => '<option value="' + esc(o.v) + '"' + (o === sel ? " selected" : "") + ">с: " + esc(o.t) + "</option>").join("") + "</select></div>" +
    '<div class="sc-cmpt"><table><thead><tr><th></th><th>' + esc(vm.name) + '</th><th>' + esc(sel.v[0] === "h" ? "Прошлая сборка" : other.name) + '</th><th>Разница</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
}
document.addEventListener("change", e => {
  const s = e.target.closest && e.target.closest(".sc-cmp select[data-ck]");
  if(!s) return;
  scCmpSel[s.dataset.ck] = s.value;
  renderShowcase();
});
document.addEventListener("click", e => {
  if(!(e.target.closest && e.target.closest("#scCmp"))) return;
  scCmpOpen = !scCmpOpen;
  renderShowcase();
});
// вызывается из renderShowcase после карточки
function scExtraAfter(card, game, uid, cur, vm, u){
  if(scCmpOpen) card.insertAdjacentHTML("beforeend", scCmpHtml(game, uid, cur, vm, u));
  const sh = document.getElementById("scShare"); if(sh) sh.hidden = false;
}

/* ═══ «Поделиться»: сборка сжимается прямо в ссылку (#b=…), сервер не нужен ═══ */
const SC_NAV = { hk4e:"gi", hkrpg:"hsr", nap:"zzz" };
async function scPack(obj){
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out = bytes, z = "j";
  if(window.CompressionStream){
    out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    z = "z";
  }
  let s = ""; out.forEach(b => { s += String.fromCharCode(b); });
  return z + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function scUnpack(str){
  const z = str[0], b64 = str.slice(1).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  let raw = bytes;
  if(z === "z") raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(raw));
}
let scShared = null;
document.getElementById("scShare").addEventListener("click", async e => {
  const btn = e.currentTarget, game = scGame(), uid = scUid(), u = enkaData[game + ":" + uid];
  const id = (ui.scAgentG || {})[game], rec = u && u.agents[id];
  const note = document.getElementById("scNote");
  if(!rec){ note.textContent = "Сначала выберите персонажа."; return; }
  // в ссылку кладём только то, что нужно карточке: сборку, ник и уровень (UID — нет)
  const url = location.origin + location.pathname + "#b=" + await scPack({ g: game, id, a: rec.a, n: u.nick || "", l: u.level || 0, at: rec.at });
  const t = btn.textContent;
  try {
    if(navigator.share && matchMedia("(hover:none)").matches) await navigator.share({ title: "Сборка — PityReon", url });
    else { await navigator.clipboard.writeText(url); btn.textContent = "Ссылка скопирована"; setTimeout(() => { btn.textContent = t; }, 1800); }
    note.textContent = "Ссылка на карточку готова (" + url.length.toLocaleString("ru-RU") + " символов). По ней откроется эта сборка — без вашего UID и без загрузки витрины.";
  } catch(err){ if(err && err.name !== "AbortError") note.textContent = "Не получилось скопировать ссылку."; }
});
// открыть сборку из ссылки
async function scOpenShared(){
  const m = /^#b=([A-Za-z0-9_\-]+)$/.exec(location.hash);
  if(!m) return;
  try {
    scShared = await scUnpack(m[1]);
    if(!scShared || !SCG[scShared.g] || !scShared.a) throw new Error("bad");
    setNav(SC_NAV[scShared.g], "showcase");
  } catch(e){ scShared = null; console.error(e); }
}
// вызывается из renderShowcase: показать карточку из ссылки вместо своих
function scRenderShared(game){
  const card = document.getElementById("scCard"), tabs = document.getElementById("scTabs");
  tabs.innerHTML = ""; document.getElementById("scTabTog").hidden = true;
  let vm = null;
  try { vm = SCG[game].vm(scShared.a); } catch(e){ console.error(e); }
  document.getElementById("hSub").textContent = SCG[game].title + (scShared.n ? " · " + scShared.n + (scShared.l ? ", ур. " + scShared.l : "") : "");
  if(!vm){ card.innerHTML = '<div class="sc-empty">Не удалось открыть сборку из ссылки — возможно, персонаж новее справочника.</div>'; return; }
  scLayoutSeg(game);
  document.getElementById("scPng").hidden = false; document.getElementById("scCopy").hidden = !(navigator.clipboard && window.ClipboardItem);
  document.getElementById("scShare").hidden = true;
  if(scAltWanted(game)) scRenderAlt(card, game, vm, "", scShared.id);
  else scRenderCard(card, { agents:{ [scShared.id]: { at: scShared.at || new Date().toISOString(), a: scShared.a } }, shown:[scShared.id], at: scShared.at || new Date().toISOString() }, scShared.id, vm);
  document.getElementById("scNote").innerHTML = '<span class="sc-shared">Открыта сборка по ссылке' + (scShared.at ? " · от " + scDate(scShared.at) : "") + '</span> <button class="linkbtn" id="scSharedClose">Вернуться к своим</button>';
  artCur = { game, id: String(scShared.id), tr: !scAltWanted(game) };
  requestAnimationFrame(() => { scFitText(); artFit(); });
}
document.addEventListener("click", e => {
  if(!(e.target.closest && e.target.closest("#scSharedClose"))) return;
  scShared = null;
  history.replaceState(null, "", location.pathname + location.search);
  renderShowcase();
});
window.addEventListener("hashchange", scOpenShared);
// после того как сайт построил свой начальный вид
if(document.readyState === "complete") setTimeout(scOpenShared, 0); else window.addEventListener("load", () => setTimeout(scOpenShared, 0));
