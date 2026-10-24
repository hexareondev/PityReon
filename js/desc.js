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
  let cur = null, hideT = 0;
  const hide = () => { clearTimeout(hideT); tip.hidden = true; cur = null; };
  const hideSoon = () => { clearTimeout(hideT); hideT = setTimeout(hide, 180); };   // успеть перевести мышь на подсказку
  tip.addEventListener("mouseenter", () => clearTimeout(hideT));
  tip.addEventListener("mouseleave", hideSoon);
  // подсказка всегда целиком в пределах экрана: шире для длинных текстов, со стороны, где больше места,
  // а если не помещается и там — с прокруткой внутри (на неё можно навести мышь)
  const show = el => {
    const h = descTipHtml(el.dataset.tip);
    if(!h){ hide(); return; }
    clearTimeout(hideT);
    cur = el; tip.innerHTML = h; tip.hidden = false;
    tip.style.maxHeight = ""; tip.classList.remove("scroll");
    const VW = document.documentElement.clientWidth, VH = window.innerHeight, M = 8, GAP = 6;
    const r = el.getBoundingClientRect();
    let w = Math.min(360, VW - M * 2);
    tip.style.width = w + "px";
    if(tip.offsetHeight > VH * 0.5){ w = Math.min(560, VW - M * 2); tip.style.width = w + "px"; }
    const th = tip.offsetHeight, below = VH - r.bottom - GAP - M, above = r.top - GAP - M;
    let y;
    if(th <= below) y = r.bottom + GAP;
    else if(th <= above) y = r.top - GAP - th;
    else {
      const room = Math.max(below, above, 120);
      tip.style.maxHeight = Math.min(room, VH - M * 2) + "px"; tip.classList.add("scroll");
      y = below >= above ? r.bottom + GAP : Math.max(M, r.top - GAP - Math.min(room, VH - M * 2));
    }
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(M, Math.min(x, VW - w - M));
    tip.style.left = x + "px"; tip.style.top = Math.max(M, Math.min(y, VH - M - tip.offsetHeight)) + "px";
  };
  document.addEventListener("mouseover", e => {
    if(matchMedia("(hover:none)").matches) return;   // на сенсорных экранах — только по нажатию
    const el = e.target.closest && e.target.closest("[data-tip]");
    if(el && el !== cur) show(el);
    else if(!el && cur && !tip.contains(e.target)) hideSoon();
  });
  // на телефоне — по нажатию; повторное нажатие или нажатие мимо закрывает
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if(!el){ if(!tip.contains(e.target)) hide(); return; }
    if(el === cur && matchMedia("(hover:none)").matches){ hide(); return; }
    show(el);
  });
  window.addEventListener("scroll", e => { if(!tip.contains(e.target)) hide(); }, { passive:true, capture:true });
  window.addEventListener("resize", hide);
})();
