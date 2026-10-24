"use strict";
/* ── описания навыков, созвездий/эйдолонов/кинограмм, комплектов и амплификаторов — подсказки в карточках ──
   Общая база — items/data/desc_<игра>.json: её пополняет workflow из HoYoLAB раз в неделю.
   Плюс своя: описания из загруженных файлов HoYoLAB хранятся в браузере и дополняют общую. */

const DESC = {}, descStore = makeStore("pityreon-desc-v1");
let descLoc = descStore.load();
if(!descLoc || typeof descLoc !== "object") descLoc = {};

function descLoad(game, cb){
  if(DESC[game]){ cb && cb(); return; }
  if(DESC[game] === false) return;
  DESC[game] = false;
  fetch("items/data/desc_" + game + ".json", { cache:"no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    .then(j => { DESC[game] = j || {}; cb && cb(); });
}
function descGet(game, kind, key){
  const l = ((descLoc[game] || {})[kind] || {})[key], r = (((DESC[game] || {})[kind]) || {})[key];
  return r || l || null;   // общая база (на русском) важнее своей: файл HoYoLAB для ZZZ бывает на английском
}
// дополнить свою базу описаний (из файла HoYoLAB)
function descMerge(game, d){
  if(!d) return;
  const cur = descLoc[game] = descLoc[game] || {};
  Object.keys(d).forEach(kind => { cur[kind] = Object.assign(cur[kind] || {}, d[kind]); });
  descStore.save(descLoc);
}

// разметка игры → безопасный HTML: <color=#RRGGBBAA> — цвет, \n — перенос, прочие теги убираем
function descHtml(t){
  let s = esc(String(t || "")).replace(/\\n/g, "\n");
  s = s.replace(/&lt;color=#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?&gt;([\s\S]*?)&lt;\/color&gt;/g, '<span style="color:#$1">$2</span>');
  s = s.replace(/&lt;\/?[a-zA-Z][^&]*?&gt;/g, "").replace(/&lt;IconMap:[^&]*&gt;/g, "");
  return s.trim().replace(/\n/g, "<br>");
}

/* всплывающая подсказка: элементы с data-tip="вид|игра|ключ[|номер]" */
function descTipHtml(spec){
  const [kind, game, key, pos] = String(spec).split("|");
  if(kind === "con"){
    const all = descGet(game, "cons", key), x = all && all[pos];
    if(!x) return "";
    const lb = { hk4e:"Созвездие", hkrpg:"Эйдолон", nap:"Кинограмма" }[game] || "";
    return "<b>" + esc(lb + " " + pos + (x.n ? " · " + x.n : "")) + "</b>" + (x.d ? "<p>" + descHtml(x.d) + "</p>" : "");
  }
  if(kind === "set"){
    const x = descGet(game, "sets", key);
    if(!x) return "";
    return "<b>" + esc(x.n || key) + "</b>" + (x["2"] ? "<p><em>2 предмета.</em> " + descHtml(x["2"]) + "</p>" : "") + (x["4"] ? "<p><em>4 предмета.</em> " + descHtml(x["4"]) + "</p>" : "");
  }
  const x = descGet(game, kind === "wpn" ? "weapons" : "skills", key);
  if(!x) return "";
  return "<b>" + esc(x.n || "") + "</b>" + (x.d ? "<p>" + descHtml(x.d) + "</p>" : "");
}
(function(){
  const tip = document.createElement("div");
  tip.className = "dtip"; tip.hidden = true; tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let cur = null;
  const hide = () => { tip.hidden = true; cur = null; };
  const show = el => {
    const h = descTipHtml(el.dataset.tip);
    if(!h){ hide(); return; }
    cur = el; tip.innerHTML = h; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(360, window.innerWidth - 24);
    tip.style.width = w + "px";
    const th = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
    x = Math.max(12, Math.min(x, window.innerWidth - w - 12));
    if(y + th > window.innerHeight - 8 && r.top - th - 8 > 8) y = r.top - th - 8;
    tip.style.left = x + "px"; tip.style.top = Math.max(8, y) + "px";
  };
  document.addEventListener("mouseover", e => {
    if(matchMedia("(hover:none)").matches) return;   // на сенсорных экранах — только по нажатию
    const el = e.target.closest && e.target.closest("[data-tip]");
    if(el && el !== cur) show(el);
    else if(!el && cur && !tip.contains(e.target)) hide();
  });
  // на телефоне — по нажатию; повторное нажатие или нажатие мимо закрывает
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if(!el){ if(!tip.contains(e.target)) hide(); return; }
    if(el === cur && matchMedia("(hover:none)").matches){ hide(); return; }
    show(el);
  });
  window.addEventListener("scroll", hide, { passive:true });
  window.addEventListener("resize", hide);
})();
