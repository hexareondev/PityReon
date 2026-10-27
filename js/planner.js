"use strict";
/* ── планировщик прокачки: Star Rail и ZZZ ──
   Стоимость берётся из items/data/cost_<игра>.json (собирает items/fetch_costs.py из данных Hakushin
   и открытых таблиц игры). План хранится вместе с историей (hdata.plans) и попадает в резервную копию.
   Будущий персонаж (заглушка) считается по похожим персонажам той же редкости и пути/специальности:
   общие для всех них материалы известны точно, остальное помечается как «неизвестный материал». */

const PLC = {
  hkrpg: { max:80, breaks:[20,30,40,50,60,70], wName:"Световой конус", wShort:"Конус", money:"2", moneyRu:"Кредиты",
    typeWord:"Путь", rarities:[5,4], star: r => r + "★" },
  nap:   { max:60, breaks:[10,20,30,40,50], wName:"Амплификатор", wShort:"Амплификатор", money:"10", moneyRu:"Денни",
    typeWord:"Специальность", rarities:[4,3], star: r => r >= 4 ? "S" : r === 3 ? "A" : "B" }
};
const PL_SK_HSR = { "01":"Обычная атака", "02":"Навык", "03":"Абсолютная техника", "04":"Талант" };
const PL_SK_ZZZ = { basic:["Обычная атака",0], special:["Особая атака",1], dodge:["Уклонение",2], chain:["Цепная атака",3], assist:["Поддержка",6] };
const PL_SK_ZZZ_ORDER = ["basic", "dodge", "assist", "special", "chain"];
// русские названия: валюта и книги опыта (остальное пока по-английски — у источника нет русского)
const PL_RU = { hkrpg: { "2":"Кредиты", "211":"Путевые заметки", "212":"Журнал приключений", "213":"Путеводитель",
                         "221":"Разреженный эфир", "222":"Сгущённый эфир", "223":"Очищенный эфир", "241":"Следы судьбы" },
                nap:   { "10":"Денни", "100941":"Пропуск в «Хомячью клетку»", "300001":"Журнал новичка", "300002":"Журнал специалиста", "300003":"Журнал эксперта",
                         "301001":"Аккумулятор амплификатора", "301002":"Источник питания амплификатора", "301003":"Энергомодуль амплификатора" } };

const COST = {}, costWait = {}, costFail = {};
function ensureCost(game, cb){
  if(COST[game]){ if(cb) cb(COST[game]); return COST[game]; }
  if(cb) (costWait[game] = costWait[game] || []).push(cb);
  if(costWait[game] && costWait[game].loading) return null;
  (costWait[game] = costWait[game] || []).loading = true;
  fetch("items/data/cost_" + game + ".json", { cache:"no-cache" })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { COST[game] = j; delete costFail[game]; })
    .catch(() => { costFail[game] = true; })
    .finally(() => { const w = costWait[game] || []; delete costWait[game]; w.forEach(f => { try { f(COST[game]); } catch(e){ console.error(e); } }); });
  return null;
}

/* ── хранилище плана ── */
function plList(game){ hdata.plans = hdata.plans || {}; return hdata.plans[game] = hdata.plans[game] || []; }
function plSave(){ hSave(); }

/* ── справочники ── */
function plChar(game, p){ const C = COST[game]; return C && !p.ph ? C.chars[p.id] || null : null; }
function plWeaponData(game, w){ const C = COST[game]; return C && w && w.id && !w.ph ? (game === "hkrpg" ? C.lcs : C.weapons)[w.id] || null : null; }
function plDbItem(game, id){ const db = itemsDb[game]; return db && db.items[String(id)] || null; }
// разметка игры в английских названиях: <i>…</i>, <unbreak>, {NICKNAME}
function plClean(n){ return String(n || "").replace(/<[^>]*>/g, "").replace(/\{NICKNAME\}/g, "Trailblazer").replace(/\{[^}]*\}/g, "").trim(); }
function plCharName(game, id){ const it = plDbItem(game, id); const c = COST[game] && COST[game].chars[id]; return it ? dbName(it) : c ? plClean(c.n) : "#" + id; }
function plWeaponName(game, id){ const it = plDbItem(game, id); const C = COST[game]; const w = C && (game === "hkrpg" ? C.lcs : C.weapons)[id]; return it ? dbName(it) : w ? plClean(w.n) : "#" + id; }
// ZZZ: чипы, жетоны и компоненты строятся по номеру (последняя цифра — элемент или специальность)
(function(){
  const R = PL_RU.nap;
  const el = { 0:"физический", 1:"огненный", 2:"ледяной", 3:"электрический", 5:"эфирный", 6:"ветряной", 7:"световой" };
  const pro = ["Нападение", "Устрашение", "Аномалия", "Поддержка", "Оборона", "Разрушение", "Оружейник"];
  Object.keys(el).forEach(k => {
    R[100110 + Number(k)] = "Базовый " + el[k] + " чип";
    R[100120 + Number(k)] = "Продвинутый " + el[k] + " чип";
    R[100130 + Number(k)] = "Специализированный " + el[k] + " чип";
  });
  pro.forEach((n, i) => {
    R[100211 + i] = "Жетон «" + n + "» начального уровня";
    R[100221 + i] = "Жетон «" + n + "» высшего уровня";
    R[100231 + i] = "Жетон " + ["пионера", "победителя", "контролёра", "правителя", "защитника", "судьи", "мечника"][i];
    R[101010 + i] = "Компонент «" + n + "»";
    R[101020 + i] = "Усиленный компонент «" + n + "»";
    R[101030 + i] = "Специализированный компонент «" + n + "»";
  });
  ["Кровожадный кулак", "Агония тирана", "Последний танец", "Алый движок", "Слепок фанатизма", "Претворённая оболочка",
   "Алый шип скверны", "Мутный кристалл", "Пункционный шип", "Иссохший панцирь", "Поддельный нуклеус"].forEach((n, i) => { R[110001 + i] = n; });
  // данные элитных боссов — по английским названиям Hakushin (110501 Murderous Obituary … 110516 Imitation Core)
  ["Некролог", "Багровый ужас", "Погоня за призраками", "Стальное коварство", "Разрушительный рывок", "Пикирующий кулак",
   "Скрытый фантом", "Громовой дракон", "Рассекатель", "Элитр скверны", "Токсичное жало", "Заражённая сомносталь",
   "Закалённое ядро", "Кровавое осквернённое перо", "Контур глубокого травления", "Имитационное ядро"].forEach((n, i) => { R[110501 + i] = "Данные высшего измерения: " + n; });
})();
function plItemName(game, id){
  if(String(id).charAt(0) === "?") return "Неизвестный материал";
  const raw = COST[game] && COST[game].items[String(id)];
  // у ещё не вышедших предметов вместо названия служебный ключ (Item_BigBoss012_name)
  if(raw && /^Item_/.test(raw.n || "")) return /BigBoss/.test(raw.n) ? "Новый материал недельного босса" : /SmallBoss/.test(raw.n) ? "Новые данные элитного босса" : "Новый материал";
  const ru = (PL_RU[game] || {})[String(id)];
  if(ru && nameLang() !== "en") return ru;
  const it = COST[game] && COST[game].items[String(id)];
  return it && it.n ? plClean(it.n) : "#" + id;
}
function plTypeOf(game, c){ return game === "hkrpg" ? c.path : c.type; }
function plTypeLabel(game, t){
  if(game === "hkrpg") return (typeof HSR_PATH === "object" && HSR_PATH[t]) || t || "?";
  if(typeof ZZZ_PRO === "object" && ZZZ_PRO[t]) return ZZZ_PRO[t];
  const num = { 1:"Нападение", 2:"Устрашение", 3:"Аномалия", 4:"Поддержка", 5:"Оборона", 6:"Разрушение" }[t];
  if(num) return num;
  // в данных ZZZ специальность может прийти числом — подписываем примерами агентов
  const C = COST[game]; if(!C) return String(t);
  const names = Object.keys(C.chars).filter(id => String(C.chars[id].type) === String(t) && !C.chars[id].new).slice(-2).map(id => plCharName(game, id));
  return names.length ? "как у " + names.join(", ") : "тип " + t;
}

/* ── уровни: [уровень, число возвышений] ── */
function plPromoFor(game, l){ return PLC[game].breaks.filter(b => b < l).length; }
function plLevelOpts(game, extra){
  const cfg = PLC[game], o = [[1, 0]];
  for(let l = 10; l <= cfg.max; l += 10){
    o.push([l, plPromoFor(game, l)]);
    if(cfg.breaks.indexOf(l) !== -1) o.push([l, plPromoFor(game, l) + 1]);
  }
  if(extra && !o.some(x => x[0] === extra[0] && x[1] === extra[1])){ o.push([extra[0], extra[1]]); o.sort((a, b) => a[0] - b[0] || a[1] - b[1]); }
  return o;
}
function plLvLabel(game, x){ const asc = PLC[game].breaks.indexOf(x[0]) !== -1 && x[1] > plPromoFor(game, x[0]); return x[0] + (asc ? "+" : ""); }
function plLvKey(x){ return x[0] + ":" + x[1]; }
function plLvParse(s){ const p = String(s).split(":"); return [Number(p[0]) || 1, Number(p[1]) || 0]; }
function plLvLess(a, b){ return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }

/* ── шаги стоимости ── */
// стоимость возвышений → ровно n шагов (первый пустой «шаг 0» отбрасывается)
function plAscSteps(asc, n){
  let a = (asc || []).slice();
  while(a.length > n && !(a[0] || []).length) a.shift();
  return a.slice(0, n);
}
// стоимость уровней навыка {уровень: [...]} → список повышений; повышение до уровня L — элемент L-2
function plSkillSteps(cost, max){
  const ks = Object.keys(cost || {}).sort((a, b) => a - b);
  let a = ks.map(k => cost[k] || []);
  while(a.length && !a[0].length) a.shift();
  while(a.length && !a[a.length - 1].length) a.pop();     // ZZZ: последний уровень — без стоимости (ключ = уровень, с которого повышаем)
  if(max && a.length > max - 1) a = a.slice(a.length - (max - 1));
  return a;
}
function plExpSum(table, a, b){ let s = 0; for(let l = a; l < b; l++) s += Number(table[l - 1]) || 0; return s; }
// опыт → книги: крупными, остаток — мелкими с округлением вверх
function plBooks(exp, books){
  const bs = (books || []).slice().sort((a, b) => b[1] - a[1]), out = [];
  let rest = exp;
  bs.forEach((b, i) => {
    if(rest <= 0 || !b[1]) return;
    const n = i === bs.length - 1 ? Math.ceil(rest / b[1]) : Math.floor(rest / b[1]);
    if(n > 0){ out.push([b[0], n, b[2] || 0]); rest -= n * b[1]; }
  });
  return out;
}

/* ── подсчёт одного плана ── */
function plAdd(map, list, k){ (list || []).forEach(x => { const id = String(x[0]); map[id] = (map[id] || 0) + (Number(x[1]) || 0) * (k || 1); }); }
// стоимость реального персонажа/оружия: возвращает { map, exp, ... }
function plCharCost(game, c, p){
  const C = COST[game], cfg = PLC[game], m = {};
  const cur = p.cur || [1, 0], tgt = p.tgt || cur;
  // возвышения
  const steps = plAscSteps(c.asc, cfg.breaks.length);
  for(let i = cur[1]; i < tgt[1]; i++) plAdd(m, steps[i]);
  // опыт → книги
  if(cur[0] < tgt[0]){
    const table = game === "hkrpg" ? (C.exp.avatar[c.exp] || C.exp.avatar["1"] || []) : (c.exp || []);
    const exp = plExpSum(table, cur[0], tgt[0]);
    plBooks(exp, game === "hkrpg" ? C.exp.avatar_books : (C.books || {}).agent).forEach(b => plAdd(m, [[b[0], b[1]]]));
  }
  // навыки
  if(game === "hkrpg"){
    (c.skills || []).forEach(s => {
      const v = (p.sk || {})[s.k]; if(!v) return;
      const st = plSkillSteps(s.cost, s.max);
      for(let L = Math.max(2, v[0] + 1); L <= v[1]; L++) plAdd(m, st[L - 2]);
    });
    if(p.trWant){
      const have = p.trHave === "all" ? null : (p.trHave || []);
      Object.keys(c.tr || {}).forEach(pid => { if(have && have.indexOf(pid) === -1) plAdd(m, c.tr[pid]); });
    }
  } else {
    Object.keys(c.skills || {}).forEach(k => {
      const v = (p.sk || {})[k]; if(!v) return;
      const st = plSkillSteps(c.skills[k]);
      for(let L = Math.max(2, v[0] + 1); L <= v[1]; L++) plAdd(m, st[L - 2]);
    });
    if(p.core){
      let st = plSkillSteps(c.core); if(st.length > 6) st = st.slice(st.length - 6);
      for(let L = p.core[0] + 1; L <= p.core[1]; L++) plAdd(m, st[L - 1]);
    }
  }
  return m;
}
function plWeaponCost(game, w, wd){
  const C = COST[game], cfg = PLC[game], m = {};
  const cur = w.cur || [1, 0], tgt = w.tgt || cur;
  const steps = plAscSteps(wd.asc, cfg.breaks.length);
  for(let i = cur[1]; i < tgt[1]; i++) plAdd(m, steps[i]);
  if(cur[0] < tgt[0]){
    const table = game === "hkrpg" ? (C.exp.lc[wd.exp] || C.exp.lc[Object.keys(C.exp.lc)[0]] || []) : (wd.exp || []).slice((wd.exp || []).length > PLC.nap.max ? 1 : 0);   // у амплификатора таблица с уровня 0
    const exp = plExpSum(table, cur[0], tgt[0]);
    plBooks(exp, game === "hkrpg" ? C.exp.lc_books : (C.books || {}).weapon).forEach(b => {
      plAdd(m, [[b[0], b[1]]]);
      if(b[2]) plAdd(m, [[cfg.money, b[1] * b[2]]]);       // конусы: опыт стоит кредитов
    });
  }
  return m;
}
// заглушка: шаблон — самый новый из той же редкости и пути; материалы, которые есть не у всех из группы, — неизвестные
function plGroup(game, kind, r, type){
  const C = COST[game]; if(!C) return [];
  const src = kind === "c" ? C.chars : (game === "hkrpg" ? C.lcs : C.weapons);
  return Object.keys(src).filter(id => src[id].r === r && String(plTypeOf(game, src[id])) === String(type) && !src[id].new && (src[id].asc || []).some(a => a.length))
    .sort((a, b) => Number(a) - Number(b)).map(id => src[id]);
}
function plGuess(game, kind, r, type, calc){
  const g = plGroup(game, kind, r, type);
  if(!g.length) return { m:{}, unknown:true };
  const tpl = g[g.length - 1], m = calc(tpl), out = {};
  const peers = g.slice(-6).map(calc);
  const C = COST[game];
  Object.keys(m).forEach(id => {
    if(peers.every(pm => pm[id])) out[id] = (out[id] || 0) + m[id];
    else { const k = "?" + (((C.items[id] || {}).r) || 0); out[k] = (out[k] || 0) + m[id]; }
  });
  return { m: out, tpl };
}
function plCost(game, p){
  const res = { m:{}, notes:[] };
  const add = mm => Object.keys(mm).forEach(k => { res.m[k] = (res.m[k] || 0) + mm[k]; });
  if(p.ph){
    const g = plGuess(game, "c", p.ph.r, p.ph.t, c => plCharCost(game, c, plFill(game, c, p)));
    add(g.m);
    res.notes.push(g.tpl ? "оценка по похожим персонажам" : "нет похожих персонажей для оценки");
  } else {
    const c = plChar(game, p);
    if(c) add(plCharCost(game, c, p)); else res.notes.push("нет данных о стоимости");
  }
  const w = p.w;
  if(w && (w.id || w.ph)){
    if(w.ph){
      const ownType = p.ph ? p.ph.t : (plChar(game, p) ? plTypeOf(game, plChar(game, p)) : null);
      const g = plGuess(game, "w", w.ph.r, ownType, wd => plWeaponCost(game, w, wd));
      add(g.m);
    } else {
      const wd = plWeaponData(game, w);
      if(wd) add(plWeaponCost(game, w, wd));
    }
  }
  return res;
}
// навыки заглушки: уровни плана переносятся на шаблонного персонажа по порядку
function plFill(game, c, p){
  if(game !== "hkrpg") return p;
  const q = Object.assign({}, p, { sk:{} });
  (c.skills || []).forEach((s, i) => { const v = (p.sk || {})["point0" + (i + 1)] || (p.sk || {})[s.k]; if(v) q.sk[s.k] = [Math.min(v[0], s.max), Math.min(v[1], s.max)]; });
  if(p.trWant) q.trHave = p.trHave === "all" ? "all" : [];
  return q;
}

/* ── начальные значения: из сборки витрины, если она есть ── */
function plBuild(game, id){
  if(typeof colFindBuild !== "function") return null;
  const b = colFindBuild(game, colAcc(), String(id));
  if(!b) return null;
  const a = ((enkaData[game + ":" + b.uid] || {}).agents || {})[String(id)];
  return a ? a.a : null;
}
function plSkillDefs(game, c){
  if(game === "hkrpg") return (c ? c.skills : [1, 2, 3, 4].map(n => ({ k:"point0" + n, max: n === 1 ? 6 : 10 }))).map(s => {
    const n = String(s.k || "").slice(-2);
    return { k: s.k, max: s.max, id: s.id, n: PL_SK_HSR[n] || (s.n && /[a-z]/i.test(s.n) ? s.n : "Навык спутника") };
  });
  const ks = c ? PL_SK_ZZZ_ORDER.filter(k => c.skills && c.skills[k]).concat(Object.keys(c.skills || {}).filter(k => PL_SK_ZZZ_ORDER.indexOf(k) === -1)) : PL_SK_ZZZ_ORDER;
  return ks.map(k => ({ k, max: c && c.skills[k] ? plSkillSteps(c.skills[k]).length + 1 : 12, n: (PL_SK_ZZZ[k] || [k])[0] }));
}
function plNew(game, id, ph){
  const cfg = PLC[game], c = ph ? null : COST[game] && COST[game].chars[id];
  const p = { id: ph ? "ph:" + Date.now().toString(36) : String(id), on: true, cur:[1, 0], tgt:[cfg.max, cfg.breaks.length], sk:{} };
  if(ph) p.ph = ph;
  plSkillDefs(game, c).forEach(s => { p.sk[s.k] = [1, s.max]; });
  if(game === "hkrpg"){ p.trHave = []; p.trWant = true; }
  else p.core = [0, 6];
  p.w = { id:"", cur:[1, 0], tgt:[cfg.max, cfg.breaks.length] };
  if(!ph) plApplyBuild(game, p, c);
  return p;
}
function plApplyBuild(game, p, c){
  const a = plBuild(game, p.id);
  if(!a) return false;
  const cfg = PLC[game];
  const fixT = (cur, tgt) => plLvLess(tgt, cur) ? cur.slice() : tgt;
  if(game === "hkrpg"){
    p.cur = [a.level || 1, a.promotion || 0];
    const lv = {}; scList(a.skillTreeList).forEach(t => { lv[String(t.pointId)] = t.level || 0; });
    plSkillDefs(game, c).forEach(s => {
      const pid = /^\d{6,}$/.test(String(s.id)) ? String(s.id) : String(Number(p.id) * 1000 + Number(String(s.k).slice(-2)));
      if(lv[pid]) p.sk[s.k] = [lv[pid], Math.max(lv[pid], (p.sk[s.k] || [0, s.max])[1])];
    });
    if(c) p.trHave = Object.keys(c.tr || {}).filter(pid => lv[pid]);
    const e = a.equipment;
    if(e && e.tid) p.w = { id: String(e.tid), cur:[e.level || 1, e.promotion || 0], tgt:[cfg.max, cfg.breaks.length] };
  } else {
    p.cur = [a.Level || 1, Math.max(0, (a.PromotionLevel || 1) - 1)];
    const lv = {}; scList(a.SkillLevelList).forEach(s => { lv[s.Index] = s.Level || 0; });
    plSkillDefs(game, c).forEach(s => { const ix = (PL_SK_ZZZ[s.k] || [])[1]; if(lv[ix]) p.sk[s.k] = [Math.min(lv[ix], s.max), s.max]; });
    p.core = [a.CoreSkillEnhancement || 0, 6];
    const w = a.Weapon;
    if(w && w.Id) p.w = { id: String(w.Id), cur:[w.Level || 1, w.BreakLevel || 0], tgt:[cfg.max, cfg.breaks.length] };
  }
  p.tgt = fixT(p.cur, p.tgt);
  if(p.w) p.w.tgt = fixT(p.w.cur, p.w.tgt);
  p.fromBuild = true;
  return true;
}

/* ── отрисовка ── */
const PS = { adding:false, phOpen:false, open:{} };
function plGame(){ const g = histGameKey(); return PLC[g] ? g : null; }
function plMode(){ return ui.plMode === "inv" ? "inv" : "plan"; }

/* ── инвентарь и распределение: материалы отдаются персонажам по порядку списка ── */
function plInv(game){ hdata.inv = hdata.inv || {}; return hdata.inv[game] = hdata.inv[game] || {}; }
// книги опыта считаются общим запасом опыта: [[id, опыт], …] для персонажей и для оружия
function plPools(game){
  const C = COST[game];
  return game === "hkrpg" ? [C.exp.avatar_books || [], (C.exp.lc_books || []).map(b => [b[0], b[1]])]
    : [(C.books || {}).agent || [], (C.books || {}).weapon || []];
}
function plAlloc(game){
  const inv = plInv(game), left = {}, pools = plPools(game);
  Object.keys(inv).forEach(k => { left[k] = Number(inv[k]) || 0; });
  const poolLeft = pools.map(pb => pb.reduce((a, b) => a + (left[String(b[0])] || 0) * b[1], 0));
  const poolOf = {}; pools.forEach((pb, i) => pb.forEach(b => { poolOf[String(b[0])] = [i, b[1]]; }));
  const res = { per:[], total:{}, short:{}, poolShort:[0, 0] };
  plList(game).forEach((p, i) => {
    const m = plCost(game, p).m, st = { m, short:{}, poolShort:[0, 0], lack:0 };
    if(p.on){
      Object.keys(m).forEach(k => { res.total[k] = (res.total[k] || 0) + m[k]; });
      // опыт: сначала весь опыт персонажа из запаса
      const needExp = [0, 0];
      Object.keys(m).forEach(k => { const po = poolOf[k]; if(po) needExp[po[0]] += m[k] * po[1]; });
      needExp.forEach((n, j) => {
        if(!n) return;
        const take = Math.min(n, poolLeft[j]); poolLeft[j] -= take;
        if(n > take){ st.poolShort[j] = n - take; res.poolShort[j] += n - take; }
      });
      Object.keys(m).forEach(k => {
        if(poolOf[k]) return;
        if(k.charAt(0) === "?"){ st.short[k] = m[k]; res.short[k] = (res.short[k] || 0) + m[k]; return; }   // неизвестное заранее не запасёшь
        const have = left[k] || 0, take = Math.min(have, m[k]);
        left[k] = have - take;
        if(m[k] > take){ st.short[k] = m[k] - take; res.short[k] = (res.short[k] || 0) + m[k] - take; }
      });
      st.lack = Object.keys(st.short).filter(k => k.charAt(0) !== "?").length + st.poolShort.filter(Boolean).length;
      st.unknown = Object.keys(st.short).some(k => k.charAt(0) === "?");
    }
    res.per[i] = st;
  });
  res.poolOf = poolOf;
  return res;
}
function plIcon(game, id, kind, fallback){
  const it = plDbItem(game, id);
  const letter = '<span>' + esc((fallback || "?").charAt(0).toUpperCase()) + '</span>';
  if(!it || !it.i || iconMode() === "off") return letter;
  return letter + '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(ENKA_HOST + it.i) + '" onerror="this.remove()">';
}
// иконки материалов: у Hakushin картинки лежат в /assets/<игра>/; запасные — StarRailRes (HSR) и Enka
function plIconUrls(game, id, icon){
  const base = String(icon || "").split("/").pop().replace(/\.\w+$/, "");
  const out = [];
  if(game === "hkrpg"){
    out.push("https://static.nanoka.cc/assets/hsr/itemfigures/" + id + ".webp",
      "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/item/" + id + ".png",
      ENKA_HOST + "/ui/hsr/SpriteOutput/ItemIcon/" + id + ".png");
  } else if(base){
    out.push("https://static.nanoka.cc/assets/zzz/" + base + ".webp", ENKA_HOST + "/ui/zzz/" + base + ".png", ENKA_HOST + "/ui/" + base + ".png");
  }
  if(icon && out.indexOf(icon) === -1) out.push(icon);
  return out;
}
function plImgErr(img){
  const rest = (img.getAttribute("data-alt") || "").split("|").filter(Boolean);
  if(!rest.length){ img.remove(); return; }
  img.setAttribute("data-alt", rest.slice(1).join("|"));
  img.src = rest[0];
}
function plItemIcon(game, id){
  const it = COST[game] && COST[game].items[String(id)];
  const ch = String(id).charAt(0) === "?" ? "?" : plItemName(game, id).charAt(0);
  const urls = String(id).charAt(0) === "?" || iconMode() === "off" ? [] : (it && it.loc ? [it.loc] : []).concat(plIconUrls(game, id, it && it.icon));
  return '<span>' + esc(ch) + '</span>' + (urls.length ? '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(urls[0]) + '" data-alt="' + esc(urls.slice(1).join("|")) + '" onerror="plImgErr(this)">' : "");
}
function plFmt(n){ return n >= 1e6 ? (Math.round(n / 1e5) / 10).toLocaleString("ru-RU") + " млн" : fmt(n); }
function plRarCls(game, r){ return (game === "nap" ? " zr" : " r") + r; }
function plItemsHtml(game, m, st, poolOf){
  const C = COST[game], money = PLC[game].money;
  const books = new Set([].concat(game === "hkrpg" ? (C.exp.avatar_books || []).concat(C.exp.lc_books || []) : ((C.books || {}).agent || []).concat((C.books || {}).weapon || [])).map(b => String(b[0])));
  // как в игре: валюта, материалы (включая боссов), затем книги опыта персонажей и оружия, в конце неизвестные
  const rank = id => id === money ? 0 : id.charAt(0) === "?" ? 3 : books.has(id) ? 2 : 1;
  const ids = Object.keys(m).filter(id => m[id] > 0).sort((a, b) => rank(a) - rank(b) ||
    (rank(a) === 1 || rank(a) === 2 ? Number(a) - Number(b) : 0) || ((C.items[b] || {}).r || 0) - ((C.items[a] || {}).r || 0) || a.localeCompare(b));
  if(!ids.length) return '<p class="hint plnone">Ничего не нужно — всё уже прокачано.</p>';
  return ids.map(id => {
    const it = C.items[id] || {}, r = id.charAt(0) === "?" ? Number(id.slice(1)) : it.r || 0;
    const name = plItemName(game, id) + (id.charAt(0) === "?" ? " (" + (r ? r + "★" : "редкость неизвестна") + ")" : "");
    let cls = "", lack = "", tip = name + " — нужно " + fmt(m[id]);
    if(st){
      const po = poolOf && poolOf[id];
      const sh = po ? st.poolShort[po[0]] : st.short[id] || 0;
      if(id.charAt(0) === "?") cls = " lack";
      else if(sh){
        cls = " lack";
        if(po){ lack = '<em>опыта −' + esc(plFmt(sh)) + '</em>'; tip += "; не хватает опыта: " + fmt(sh) + " (≈ " + fmt(Math.ceil(sh / po[1])) + " шт. этой книги)"; }
        else { lack = '<em>−' + esc(plFmt(sh)) + '</em>'; tip += "; не хватает " + fmt(sh); }
      } else { cls = " ok"; tip += "; хватает"; }
    }
    return '<div class="pli' + plRarCls(game, r) + (id.charAt(0) === "?" ? " unk" : "") + cls + '" title="' + esc(tip) + '"><i>' + plItemIcon(game, id) + '</i><b class="num">' + esc(plFmt(m[id])) + '</b>' + lack + '<small>' + esc(name) + '</small></div>';
  }).join("");
}
function plSel(f, opts, val){
  return '<select data-f="' + f + '">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>';
}
function plLvRow(game, label, f, cur, tgt){
  const oc = plLevelOpts(game, cur), ot = plLevelOpts(game, tgt);
  return '<div class="plr"><span>' + label + '</span>' + plSel(f + ".cur", oc.map(x => [plLvKey(x), plLvLabel(game, x)]), plLvKey(cur)) +
    '<i>→</i>' + plSel(f + ".tgt", ot.filter(x => !plLvLess(x, cur)).map(x => [plLvKey(x), plLvLabel(game, x)]), plLvKey(tgt)) + '</div>';
}
function plRange(n, from){ const a = []; for(let i = from || 1; i <= n; i++) a.push([i, String(i)]); return a; }

function plCardHtml(game, p, i, st, poolOf){
  const C = COST[game], cfg = PLC[game];
  const c = plChar(game, p);
  const name = p.ph ? (p.ph.n || "Будущий персонаж") : plCharName(game, p.id);
  const r = p.ph ? p.ph.r : c ? c.r : ((plDbItem(game, p.id) || {}).r || 0);
  const type = p.ph ? p.ph.t : c ? plTypeOf(game, c) : null;
  const sub = [cfg.star(r), type != null ? plTypeLabel(game, type) : "", p.ph ? "ещё не вышел" : c && c.new ? "новый" : ""].filter(Boolean).join(" · ");
  const cost = plCost(game, p);
  const hasInv = Object.keys(plInv(game)).some(k => plInv(game)[k] > 0);
  const done = !Object.keys(cost.m).some(k => cost.m[k] > 0);
  const badge = done ? '<span class="plst ok">прокачан</span>' : !p.on || !hasInv ? "" : st.lack ? '<span class="plst bad" title="Материалы распределяются по порядку списка: персонажи выше получают их первыми">не хватает: ' + st.lack + '</span>'
    : st.unknown ? '<span class="plst unk">известное — есть</span>' : '<span class="plst ok">всё есть</span>';
  let h = '<div class="plc' + (p.on ? "" : " off") + (r === cfg.rarities[0] ? " top" : "") + '" data-i="' + i + '">';
  h += '<div class="plh"><div class="colpic">' + (p.ph ? '<span>?</span>' : plIcon(game, p.id, "c", name)) + '</div><div class="pln"><b>' + esc(name) + '</b><small>' + esc(sub) + '</small>' + badge + '</div>' +
    (i > 0 ? '<button class="ghost sm plup" data-act="up" title="Выше — получает материалы раньше" aria-label="Выше">↑</button>' : "") +
    '<label class="synccheck plon" title="Учитывать в общем итоге"><input type="checkbox" data-f="on"' + (p.on ? " checked" : "") + '> в итоге</label>' +
    '<button class="ghost sm pldel" data-act="del" title="Убрать из плана" aria-label="Убрать">✕</button></div>';
  if(p.ph){
    const opts = Object.keys(C.chars).filter(id => !plList(game).some(q => q.id === id))
      .sort((a, b) => (C.chars[b].new ? 1 : 0) - (C.chars[a].new ? 1 : 0) || Number(b) - Number(a))
      .map(id => [id, plCharName(game, id) + (C.chars[id].new ? " · новый" : "")]);
    h += '<div class="plbind"><span class="hint" style="margin:0">Когда персонаж появится в базе — привяжите заглушку, план сохранится.</span>' +
      plSel("bindSel", [["", "выберите персонажа…"]].concat(opts), "") + '<button class="mark sm" data-act="bind">Привязать</button></div>';
  }
  h += '<div class="plrows">';
  h += plLvRow(game, "Уровень", "lv", p.cur, p.tgt);
  plSkillDefs(game, c).forEach(s => {
    const v = (p.sk || {})[s.k] || [1, s.max];
    h += '<div class="plr"><span>' + esc(s.n) + '</span>' + plSel("sk." + s.k + ".0", plRange(s.max), v[0]) + '<i>→</i>' + plSel("sk." + s.k + ".1", plRange(s.max, v[0]), Math.max(v[0], v[1])) + '</div>';
  });
  if(game === "hkrpg"){
    const all = c ? Object.keys(c.tr || {}) : [];
    const have = p.trHave === "all" ? all.length : (p.trHave || []).length;
    const opts = [["none", "не открыты"], ["all", "все открыты"]];
    const cv = p.trHave === "all" ? "all" : have ? "part" : "none";
    if(cv === "part") opts.splice(1, 0, ["part", "открыто " + have + " из " + all.length]);
    h += '<div class="plr"><span>Бонусные следы</span>' + plSel("trHave", opts, cv) + '<label class="synccheck"><input type="checkbox" data-f="trWant"' + (p.trWant ? " checked" : "") + '> открыть все</label></div>';
  } else {
    const L = [[0, "—"]].concat("ABCDEF".split("").map((x, k) => [k + 1, x]));
    const v = p.core || [0, 6];
    h += '<div class="plr"><span>Ядро</span>' + plSel("core.0", L, v[0]) + '<i>→</i>' + plSel("core.1", L.filter(x => x[0] >= v[0]), Math.max(v[0], v[1])) + '</div>';
  }
  // оружие
  const w = p.w || {};
  const wName = w.ph ? "будущий " + cfg.wShort.toLowerCase() + " " + cfg.star(w.ph.r) : w.id ? plWeaponName(game, w.id) : "";
  h += '<div class="plr plw"><span>' + cfg.wName + '</span><input data-f="wName" list="plWList" placeholder="не выбран — начните вводить имя" value="' + esc(wName) + '" autocomplete="off">' +
    (w.id || w.ph ? '<button class="ghost sm" data-act="wclear" title="Без оружия" aria-label="Без оружия">✕</button>' : "") + '</div>';
  if(w.id || w.ph) h += plLvRow(game, cfg.wShort + ": уровень", "wlv", w.cur || [1, 0], w.tgt || [cfg.max, cfg.breaks.length]);
  h += '</div>';
  const open = PS.open[p.id] !== false;
  h += '<details class="plmat"' + (open ? " open" : "") + '><summary>Нужно на этого персонажа' + (cost.notes.length ? ' <small>· ' + esc(cost.notes.join(", ")) + '</small>' : "") + '</summary><div class="plitems">' + plItemsHtml(game, cost.m, p.on && hasInv ? st : null, poolOf) + '</div></details>';
  if(p.fromBuild && !p.ph) h += '<p class="hint plsrc">Текущие значения взяты из сборки витрины. <button class="linkbtn" data-act="rebuild">Обновить из витрины</button></p>';
  return h + '</div>';
}

function renderPlanner(){
  const box = document.getElementById("planView");
  const game = plGame();
  document.getElementById("hTitle").childNodes[0].nodeValue = "Планировщик";
  document.getElementById("hSub").textContent = game ? gameInfo(game).name : "";
  const seg = document.getElementById("plMode");
  seg.innerHTML = "";
  [["plan", "План"], ["inv", "Инвентарь"]].forEach(([v, label]) => {
    const b = document.createElement("button");
    b.textContent = label; b.className = v === plMode() ? "on" : "";
    b.onclick = () => { ui.plMode = v; saveUI(); renderPlanner(); };
    seg.appendChild(b);
  });
  if(!game){ box.innerHTML = '<p class="hint">Планировщик работает для Star Rail и Zenless Zone Zero.</p>'; return; }
  if(!COST[game]){
    box.innerHTML = '<p class="hint">' + (costFail[game] ? "Не удалось загрузить стоимость прокачки (items/data/cost_" + game + ".json). Она появится после ближайшего обновления данных на сайте." : "Загружаю стоимость прокачки…") + '</p>';
    if(!costFail[game]) ensureCost(game, () => { if(document.body.classList.contains("tab-planner")) renderPlanner(); });
    return;
  }
  if(!itemsDb[game]) ensureItems(game, () => { if(document.body.classList.contains("tab-planner")) renderPlanner(); });
  const keepY = window.scrollY;
  if(plMode() === "inv"){ renderInventory(game, box); if(Math.abs(window.scrollY - keepY) > 2) window.scrollTo(0, keepY); return; }
  const C = COST[game], cfg = PLC[game], list = plList(game);
  const al = plAlloc(game), total = al.total;
  const hasInv = Object.keys(plInv(game)).some(k => plInv(game)[k] > 0);
  let h = '<div class="pltop"><div class="pladd"><input id="plAddName" list="plCList" placeholder="Добавить персонажа — начните вводить имя" autocomplete="off">' +
    '<button class="mark sm" id="plAddBtn">Добавить</button><button class="ghost sm" id="plPhBtn">Будущий персонаж</button></div>';
  if(PS.phOpen){
    const types = Array.from(new Set(Object.keys(C.chars).map(id => String(plTypeOf(game, C.chars[id]))).filter(t => t && t !== "undefined" && t !== "null")));
    h += '<div class="plph"><input id="plPhName" placeholder="Имя (по желанию)" autocomplete="off">' +
      '<select id="plPhR">' + cfg.rarities.map(r => '<option value="' + r + '">' + cfg.star(r) + '</option>').join("") + '</select>' +
      '<select id="plPhT" title="' + cfg.typeWord + '">' + types.map(t => '<option value="' + esc(t) + '">' + esc(plTypeLabel(game, t)) + '</option>').join("") + '</select>' +
      '<button class="mark sm" id="plPhAdd">Добавить заглушку</button></div>' +
      '<p class="hint" style="margin:6px 0 0">Материалы будущего персонажа оцениваются по похожим (та же редкость и ' + cfg.typeWord.toLowerCase() + '): общие для них — точно, остальные — как «неизвестный материал» нужной редкости. Когда персонаж выйдет, нажмите «Привязать».</p>';
  }
  h += '</div>';
  if(list.length){
    const on = list.filter(p => p.on).length;
    const lackN = Object.keys(al.short).filter(k => k.charAt(0) !== "?").length + al.poolShort.filter(Boolean).length;
    h += '<div class="card pltotal"><div class="plth"><h2>Всего нужно</h2><small class="hint" style="margin:0">' + on + ' из ' + list.length + ' в итоге' +
      (game === "hkrpg" ? " · кредиты за опыт персонажей не учтены" : " · денни за опыт не учтены") + '</small>' +
      (hasInv ? (lackN ? '<span class="plst bad">не хватает: ' + lackN + '</span>' : '<span class="plst ok">всего хватает</span>') : '<button class="linkbtn" id="plGoInv">внесите инвентарь — подсвечу, чего не хватает</button>') +
      '</div><div class="plitems">' + plItemsHtml(game, total, hasInv ? { short: al.short, poolShort: al.poolShort } : null, al.poolOf) + '</div></div>';
  } else {
    h += '<p class="hint">План пуст. Добавьте персонажа — текущие уровни подтянутся из витрины, если его сборка загружалась, — или заглушку будущего персонажа для префарма.</p>';
  }
  h += '<div class="plgrid">' + list.map((p, i) => plCardHtml(game, p, i, al.per[i], al.poolOf)).join("") + '</div>';
  // списки для поиска
  const cl = Object.keys(C.chars).filter(id => !list.some(p => p.id === id)).sort((a, b) => Number(b) - Number(a))
    .map(id => '<option value="' + esc(plCharName(game, id)) + '">' + (C.chars[id].new ? "новый" : "") + '</option>').join("");
  const ws = game === "hkrpg" ? C.lcs : C.weapons;
  const wl = cfg.rarities.map(r => '<option value="будущий ' + esc(cfg.wShort.toLowerCase()) + ' ' + cfg.star(r) + '"></option>').join("") +
    Object.keys(ws).filter(id => ws[id].r >= cfg.rarities[1]).sort((a, b) => ws[b].r - ws[a].r || Number(b) - Number(a)).map(id => '<option value="' + esc(plWeaponName(game, id)) + '"></option>').join("");
  h += '<datalist id="plCList">' + cl + '</datalist><datalist id="plWList">' + wl + '</datalist>';
  h += '<p class="hint">Стоимость — по данным игры ' + esc(C.ver || "") + ' (Hakushin).' + (game === "hkrpg" ? ' Названия материалов пока на английском.' : '') + ' Опыт пересчитан в книги: сначала крупные, остаток — мелкими.</p>';
  box.innerHTML = h;
  if(Math.abs(window.scrollY - keepY) > 2) window.scrollTo(0, keepY);
}

/* ── инвентарь ── */
function renderInventory(game, box){
  const C = COST[game], inv = plInv(game), al = plAlloc(game);
  const need = al.total;
  const money = PLC[game].money;
  const books = new Set(plPools(game).flat().map(b => String(b[0])));
  const all = !!PS.invAll;
  const rank = id => id === money ? 0 : books.has(id) ? 2 : 1;
  const ids = Object.keys(C.items).filter(id => all || need[id] || (inv[id] > 0) || id === money || books.has(id))
    .sort((a, b) => rank(a) - rank(b) || Number(a) - Number(b));
  let h = '<div class="plinvtop"><p class="hint" style="margin:0">Внесите, сколько материалов у вас есть в игре. Планировщик отдаст их персонажам по порядку списка (кто выше, получает раньше) и подсветит, чего не хватает. Книги опыта считаются общим запасом опыта.</p>' +
    '<div class="plinvtools"><label class="synccheck" style="margin:0"><input type="checkbox" id="plInvAll"' + (all ? " checked" : "") + '> все материалы игры</label>' +
    '<button class="ghost sm" id="plInvClear">Очистить</button></div></div>';
  h += '<div class="plinv">' + ids.map(id => {
    const it = C.items[id] || {}, n = Number(inv[id]) || 0, nd = need[id] || 0;
    const po = al.poolOf[id];
    const sh = po ? 0 : Math.max(0, nd - n);
    const st = !nd ? "" : po ? (al.poolShort[po[0]] ? " lack" : " ok") : sh ? " lack" : " ok";
    const sub = nd ? (po ? "в плане " + fmt(nd) : sh ? "нужно " + fmt(nd) + " · −" + fmt(sh) : "нужно " + fmt(nd) + " ✓") : "";
    return '<label class="pli plinvi' + plRarCls(game, it.r || 0) + st + '" title="' + esc(plItemName(game, id)) + '"><i>' + plItemIcon(game, id) + '</i>' +
      '<input type="number" min="0" step="1" inputmode="numeric" data-inv="' + esc(id) + '" value="' + (n || "") + '" placeholder="0">' +
      '<small>' + esc(plItemName(game, id)) + '</small>' + (sub ? '<em>' + esc(sub) + '</em>' : "") + '</label>';
  }).join("") + '</div>';
  const ps = al.poolShort;
  if(ps[0] || ps[1]) h += '<p class="hint">Не хватает опыта: ' + [ps[0] ? "персонажам " + fmt(ps[0]) : "", ps[1] ? (game === "hkrpg" ? "конусам " : "амплификаторам ") + fmt(ps[1]) : ""].filter(Boolean).join(", ") + '.</p>';
  box.innerHTML = h;
}
document.getElementById("planView").addEventListener("input", e => {
  const t = e.target; if(!t.getAttribute || !t.getAttribute("data-inv")) return;
  const game = plGame(), inv = plInv(game), id = t.getAttribute("data-inv");
  const n = Math.max(0, Math.floor(Number(t.value) || 0));
  if(n) inv[id] = n; else delete inv[id];
  plSave();
});

/* ── действия ── */
function plFindByName(game, name, kind){
  const C = COST[game], q = normName(name);
  if(!q) return null;
  const src = kind === "c" ? C.chars : (game === "hkrpg" ? C.lcs : C.weapons);
  const nm = kind === "c" ? id => plCharName(game, id) : id => plWeaponName(game, id);
  return Object.keys(src).find(id => normName(nm(id)) === q || normName(src[id].n) === q || normName((plDbItem(game, id) || {}).en) === q || normName((plDbItem(game, id) || {}).n) === q) || null;
}
function plAddByName(){
  const game = plGame(), inp = document.getElementById("plAddName");
  const id = plFindByName(game, inp.value, "c");
  if(!id){ inp.focus(); inp.classList.add("bad"); setTimeout(() => inp.classList.remove("bad"), 900); return; }
  if(plList(game).some(p => p.id === id)) return;
  plList(game).unshift(plNew(game, id));
  plSave(); renderPlanner();
}
function plAddFor(game, id){
  ensureCost(game, C => {
    if(!C || !C.chars[id]) return;
    if(!plList(game).some(p => p.id === String(id))){ plList(game).unshift(plNew(game, String(id))); plSave(); }
    ui.plMode = "plan";
    const g = navByHist(game);
    setNav(g ? g.id : ui.game, "planner");
  });
}
document.getElementById("planView").addEventListener("click", e => {
  const game = plGame(); if(!game) return;
  const t = e.target;
  if(t.id === "plAddBtn") return plAddByName();
  if(t.id === "plGoInv"){ ui.plMode = "inv"; saveUI(); renderPlanner(); return; }
  if(t.id === "plInvClear"){
    if(t.textContent !== "Точно очистить?"){ t.textContent = "Точно очистить?"; setTimeout(() => { if(t.isConnected) t.textContent = "Очистить"; }, 2500); return; }
    hdata.inv[game] = {}; plSave(); renderPlanner(); return;
  }
  if(t.id === "plPhBtn"){ PS.phOpen = !PS.phOpen; renderPlanner(); return; }
  if(t.id === "plPhAdd"){
    const ph = { n: document.getElementById("plPhName").value.trim(), r: Number(document.getElementById("plPhR").value), t: document.getElementById("plPhT").value };
    if(game === "nap" && /^\d+$/.test(ph.t)) ph.t = Number(ph.t);
    plList(game).unshift(plNew(game, null, ph)); PS.phOpen = false; plSave(); renderPlanner(); return;
  }
  const act = t.getAttribute && t.getAttribute("data-act");
  const card = t.closest && t.closest(".plc");
  if(!act || !card) return;
  const list = plList(game), i = Number(card.getAttribute("data-i")), p = list[i];
  if(!p) return;
  if(act === "up"){
    list.splice(i - 1, 0, list.splice(i, 1)[0]);
  } else if(act === "del"){
    if(!card.classList.contains("confirm")){ card.classList.add("confirm"); t.textContent = "Убрать?"; setTimeout(() => { if(card.isConnected){ card.classList.remove("confirm"); t.textContent = "✕"; } }, 2500); return; }
    list.splice(i, 1);
  } else if(act === "bind"){
    const id = card.querySelector('[data-f="bindSel"]').value;
    if(!id) return;
    const c = COST[game].chars[id];
    // перенос уровней: навыки HSR — по порядку, ZZZ — по названию
    const sk = {};
    plSkillDefs(game, c).forEach((s, k) => { const v = p.sk[s.k] || p.sk["point0" + (k + 1)]; sk[s.k] = v ? [Math.min(v[0], s.max), Math.min(v[1], s.max)] : [1, s.max]; });
    p.sk = sk; p.id = id; delete p.ph;
    if(game === "hkrpg" && p.trHave !== "all") p.trHave = [];
  } else if(act === "wclear"){
    p.w = { id:"", cur:[1, 0], tgt:[PLC[game].max, PLC[game].breaks.length] };
  } else if(act === "rebuild"){
    plApplyBuild(game, p, plChar(game, p));
  } else return;
  plSave(); renderPlanner();
});
document.getElementById("planView").addEventListener("keydown", e => { if(e.key === "Enter" && e.target.id === "plAddName") plAddByName(); });
document.getElementById("planView").addEventListener("toggle", e => {
  const d = e.target; if(!d.classList || !d.classList.contains("plmat")) return;
  const game = plGame(), card = d.closest(".plc"), p = plList(game)[Number(card.getAttribute("data-i"))];
  if(p) PS.open[p.id] = d.open;
}, true);
document.getElementById("planView").addEventListener("change", e => {
  const game = plGame(); if(!game) return;
  const t = e.target, f = t.getAttribute("data-f");
  if(t.id === "plInvAll"){ PS.invAll = t.checked; renderPlanner(); return; }
  if(t.getAttribute("data-inv")){
    // перерисовка после ввода; фокус возвращаем туда, куда пользователь перешёл (Tab)
    setTimeout(() => {
      const a = document.activeElement, id = a && a.getAttribute && a.getAttribute("data-inv");
      renderPlanner();
      if(id){ const el = document.querySelector('#planView [data-inv="' + id + '"]'); if(el){ el.focus(); try { el.select(); } catch(_){} } }
    }, 0);
    return;
  }
  const card = t.closest(".plc");
  if(!f || !card || f === "bindSel") return;
  const list = plList(game), p = list[Number(card.getAttribute("data-i"))], cfg = PLC[game];
  if(!p) return;
  const v = t.type === "checkbox" ? t.checked : t.value;
  const ord = (a, b) => plLvLess(b, a) ? a.slice() : b;
  if(f === "on") p.on = v;
  else if(f === "lv.cur"){ p.cur = plLvParse(v); p.tgt = ord(p.cur, p.tgt); }
  else if(f === "lv.tgt") p.tgt = plLvParse(v);
  else if(f === "wlv.cur"){ p.w.cur = plLvParse(v); p.w.tgt = ord(p.w.cur, p.w.tgt || p.w.cur); }
  else if(f === "wlv.tgt") p.w.tgt = plLvParse(v);
  else if(f.indexOf("sk.") === 0){
    const parts = f.split("."), k = parts.slice(1, -1).join("."), j = Number(parts[parts.length - 1]);
    const s = p.sk[k] = (p.sk[k] || [1, 1]).slice(); s[j] = Number(v);
    if(s[1] < s[0]) s[1] = s[0];
  } else if(f.indexOf("core.") === 0){
    const s = p.core = (p.core || [0, 6]).slice(); s[Number(f.slice(5))] = Number(v);
    if(s[1] < s[0]) s[1] = s[0];
  } else if(f === "trHave"){
    if(v === "all") p.trHave = "all"; else if(v === "none") p.trHave = [];
  } else if(f === "trWant") p.trWant = v;
  else if(f === "wName"){
    const q = normName(v);
    const phm = q.match(/^будущий .*?(\d|s|a)★?$/i);
    if(!q){ p.w = { id:"", cur:[1, 0], tgt:[cfg.max, cfg.breaks.length] }; }
    else if(phm){
      const r = cfg.rarities.find(r => normName(cfg.star(r)) === normName(phm[1] + (game === "hkrpg" ? "★" : ""))) || cfg.rarities[0];
      p.w = Object.assign({ cur:[1, 0], tgt:[cfg.max, cfg.breaks.length] }, p.w || {}, { id:"", ph:{ r } });
    } else {
      const id = plFindByName(game, v, "w");
      if(!id){ t.classList.add("bad"); return; }
      p.w = Object.assign({ cur:[1, 0], tgt:[cfg.max, cfg.breaks.length] }, p.w || {}, { id });
      delete p.w.ph;
    }
  } else return;
  plSave(); renderPlanner();
});

