"use strict";
/* ── витрина из файла HoYoLAB (tools/hoyolab-export.js) ──
   Файл содержит всех персонажей сразу трёх игр. Каждую игру переводим в вид ответа Enka —
   дальше работает всё как обычно: карточки, история сборок, полезные характеристики. */

const hoyoNum = v => parseFloat(String(v == null ? "" : v).replace(",", ".").replace("%", "")) || 0;
const hoyoPct = v => /%/.test(String(v));
// повышение (возвышение) по уровню: 20/30/…/80 — потолки, после потолка уровень растёт только после возвышения
const hoyoPromo = (lvl, first, step) => Math.max(0, Math.ceil((lvl - first) / step));

/* Star Rail */
const HOYO_HSR_PROP = { 27:"HPDelta", 32:"HPAddedRatio", 29:"AttackDelta", 33:"AttackAddedRatio", 31:"DefenceDelta", 34:"DefenceAddedRatio",
  51:"SpeedDelta", 52:"CriticalChanceBase", 53:"CriticalDamageBase", 59:"BreakDamageAddedRatioBase", 56:"StatusProbabilityBase",
  57:"StatusResistanceBase", 55:"HealRatioBase", 54:"SPRatioBase", 12:"PhysicalAddedRatio", 14:"FireAddedRatio", 16:"IceAddedRatio",
  18:"ThunderAddedRatio", 20:"WindAddedRatio", 22:"QuantumAddedRatio", 24:"ImaginaryAddedRatio" };
function hoyoHsr(g){
  const B = SCB.hkrpg;
  const list = ((g.info || {}).avatar_list || []).map(a => {
    const relics = (a.relics || []).concat(a.ornaments || []).map(r => {
      const it = B.relics[String(r.id)]; if(!it) return null;
      const mainGroup = String(it[2]), subGroup = String(it[3]);
      const mp = HOYO_HSR_PROP[(r.main_property || {}).property_type];
      const subs = (r.properties || []).map(p => {
        const prop = HOYO_HSR_PROP[p.property_type], aid = prop && Object.keys(B.sub[subGroup] || {}).find(k => B.sub[subGroup][k].Property === prop);
        if(!aid) return null;
        const x = B.sub[subGroup][aid], cnt = Math.max(1, p.times || 1);   // в Star Rail «times» — число выпадений (в Genshin — усилений)
        const v = hoyoPct(p.value) ? hoyoNum(p.value) / 100 : hoyoNum(p.value);
        const step = x.StepValue ? Math.max(0, Math.round((v - x.BaseValue * cnt) / x.StepValue)) : 0;
        return { affixId: Number(aid), cnt, step };
      }).filter(Boolean);
      const mainId = mp ? Object.keys(B.main[mainGroup] || {}).find(k => B.main[mainGroup][k].Property === mp) : null;
      return { tid: r.id, type: r.pos, level: r.level || 0, mainAffixId: mainId ? Number(mainId) : 0, subAffixList: subs };
    }).filter(Boolean);
    // у персонажей 1xxx HoYoLAB дописывает к номеру узла следов лишнюю «1» в начале
    const tree = (a.skills || []).filter(s => s.is_activated !== false && s.level > 0).map(s => {
      let pid = String(s.point_id);
      if(pid.length === 8 && pid[0] === "1") pid = pid.slice(1);
      return { pointId: Number(pid), level: s.level };
    });
    const e = a.equip, fin = {};
    (a.properties || []).forEach(p => { fin[p.property_type] = { v: hoyoPct(p.final) ? hoyoNum(p.final) / 100 : hoyoNum(p.final), b: hoyoNum(p.base) }; });
    return { _name: a.name, _final: fin, avatarId: a.id, level: a.level, promotion: hoyoPromo(a.level, 20, 10), rank: a.rank || 0, skillTreeList: tree, relicList: relics,
      equipment: e ? { tid: e.id, level: e.level, promotion: hoyoPromo(e.level, 20, 10), rank: e.rank || 1 } : undefined };
  });
  return { uid: g.uid, detailInfo: { uid: g.uid, nickname: g.nick, level: g.level, avatarDetailList: list } };
}

/* Genshin: номера характеристик HoYoLAB совпадают с FIGHT_PROP игры */
const HOYO_GI_SLOT = { 1:"EQUIP_BRACER", 2:"EQUIP_NECKLACE", 3:"EQUIP_SHOES", 4:"EQUIP_RING", 5:"EQUIP_DRESS" };
function hoyoGi(g){
  const list = [];
  (g.details || []).forEach(d => (d.list || []).forEach(c => {
    const b = c.base || {}, fp = {};
    const props = [].concat(c.base_properties || [], c.selected_properties || [], c.extra_properties || [], c.element_properties || []);
    props.forEach(p => { fp[String(p.property_type)] = hoyoPct(p.final) ? hoyoNum(p.final) / 100 : hoyoNum(p.final); });
    const baseOf = t => { const p = props.find(x => x.property_type === t); return p ? hoyoNum(p.base) : 0; };
    fp["1"] = baseOf(2000); fp["4"] = baseOf(2001); fp["7"] = baseOf(2002);
    const equip = [];
    const w = c.weapon;
    if(w){
      const stat = p => p && GI_FP[p.property_type] ? { appendPropId: GI_FP[p.property_type], statValue: hoyoNum(p.final) } : null;
      equip.push({ itemId: w.id, weapon: { level: w.level, affixMap: { "1": (w.affix_level || 1) - 1 } },
        flat: { icon: w.icon, rankLevel: w.rarity, weaponStats: [stat(w.main_property), stat(w.sub_property)].filter(Boolean) } });
    }
    (c.relics || []).forEach(r => {
      const mp = r.main_property || {};
      equip.push({ itemId: r.id, reliquary: { level: (r.level || 0) + 1, appendPropIdList: [] },
        flat: { equipType: HOYO_GI_SLOT[r.pos], rankLevel: r.rarity, icon: r.icon, setNameTextMapHash: "hoyo:" + ((r.set || {}).id || ""), setName: (r.set || {}).name || "",
          reliquaryMainstat: { mainPropId: GI_FP[mp.property_type] || "", statValue: hoyoNum(mp.value) },
          reliquarySubstats: (r.sub_property_list || []).filter(p => GI_FP[p.property_type]).map(p => ({ appendPropId: GI_FP[p.property_type], statValue: hoyoNum(p.value), _rolls: (p.times || 0) + 1 })) } });
    });
    const skillLevelMap = {};
    (c.skills || []).filter(s => s.skill_type === 1).forEach(s => { skillLevelMap[String(s.skill_id)] = s.level; });
    list.push({ _name: b.name, avatarId: b.id, propMap: { "4001": { val: String(b.level || 1) } }, fightPropMap: fp,
      talentIdList: Array.from({ length: b.actived_constellation_num || 0 }, (_, i) => i + 1),
      skillLevelMap, proudSkillExtraLevelMap: {}, fetterInfo: { expLevel: b.fetter || 0 }, equipList: equip });
  }));
  return { uid: g.uid, playerInfo: { nickname: g.nick, level: g.level }, avatarInfoList: list };
}

/* ZZZ: номера характеристик совпадают с игрой; значения переводим в «сырые» единицы Enka */
function hoyoZzz(g){
  const raw = v => hoyoPct(v) ? Math.round(hoyoNum(v) * 100) : Math.round(hoyoNum(v));
  const list = [];
  (g.info || []).forEach(d => (d.avatar_list || []).forEach(a => {
    const eq = (a.equip || []).map(e => {
      const rar = e.rarity === "S" ? 4 : e.rarity === "A" ? 3 : 2, k = { 4:.2, 3:.25, 2:.3 }[rar], lvl = e.level || 0;
      return { Slot: e.equipment_type, Equipment: { Id: e.id, Level: lvl,
        // главная: в файле — значение на текущем уровне, Enka хранит значение на нулевом
        MainPropertyList: (e.main_properties || []).map(m => ({ PropertyId: m.property_id, PropertyValue: Math.round(raw(m.base) / (1 + lvl * k)), PropertyLevel: 1 })),
        // дополнительные: в файле — итог, Enka хранит одно усиление и их число
        RandomPropertyList: (e.properties || []).map(p => ({ PropertyId: p.property_id, PropertyValue: Math.round(raw(p.base) / Math.max(1, p.level || 1)), PropertyLevel: p.level || 1 })) } };
    });
    const w = a.weapon;
    const core = (a.skills || []).find(s => s.skill_type === 5);
    const fin = {};
    (a.properties || []).forEach(p => { if(p.final !== "" && p.final != null) fin[p.property_id] = hoyoPct(p.final) || /\./.test(String(p.final)) ? Math.round(hoyoNum(p.final) * 100) : Math.round(hoyoNum(p.final)); });
    const plan = a.equip_plan_info || {}, rt = String(plan.equip_rating || "").replace(/^ER_/, "").replace("_Plus", "+");
    list.push({ _name: a.name_mi18n, _final: fin, _rating: rt ? { r: rt, s: plan.equip_rating_score || 0 } : null, Id: a.id, Level: a.level, PromotionLevel: Math.max(1, Math.ceil((a.level || 1) / 10)), TalentLevel: a.rank || 0,
      CoreSkillEnhancement: core ? Math.max(0, core.level - 1) : 0,
      SkillLevelList: (a.skills || []).map(s => ({ Index: s.skill_type, Level: s.level })),
      // уровень амплификатора HoYoLAB иногда отдаёт нулём — тогда берём готовые значения его характеристик
      Weapon: w ? { Id: w.id, Level: w.level, BreakLevel: hoyoPromo(w.level, 10, 10), UpgradeLevel: w.star || 1,
        _main: ((w.main_properties || [])[0] || {}).base != null ? raw(w.main_properties[0].base) : undefined,
        _sub: ((w.properties || [])[0] || {}).base != null ? raw(w.properties[0].base) : undefined } : undefined,
      EquippedList: eq });
  }));
  return { uid: g.uid, PlayerInfo: { SocialDetail: { ProfileDetail: { Uid: g.uid, Nickname: g.nick, Level: g.level } }, ShowcaseDetail: { AvatarList: list } } };
}

// описания из файла HoYoLAB — в свою базу подсказок (js/desc.js); тот же разбор делает items/hoyo_rec.py для общей базы
function hoyoDesc(game, g){
  const d = { skills:{}, cons:{}, sets:{}, weapons:{} };
  const cons = (id, list, nk, dk) => { const o = {}; (list || []).forEach(r => { if(r[dk]) o[r.pos] = { n: r[nk] || "", d: r[dk] }; }); if(Object.keys(o).length) d.cons[id] = o; };
  if(game === "hkrpg") ((g.info || {}).avatar_list || []).forEach(a => {
    cons(a.id, a.ranks, "name", "desc");
    (a.skills || []).forEach(s => {
      const st = (s.skill_stages || [])[0]; if(!st || !st.desc) return;
      let pid = String(s.point_id); if(pid.length === 8 && pid[0] === "1") pid = pid.slice(1);
      d.skills[pid] = { n: st.name || "", d: st.desc };
    });
  });
  if(game === "hk4e") (g.details || []).forEach(x => (x.list || []).forEach(c => {
    const id = (c.base || {}).id;
    cons(id, c.constellations, "name", "effect");
    (c.skills || []).forEach(s => { if(s.desc) d.skills[s.skill_id] = { n: s.name || "", d: s.desc }; });
    (c.relics || []).forEach(r => {
      const st = r.set || {}; if(!st.name) return;
      const e = {}; (st.affixes || []).forEach(f => { if(f.effect) e[String(f.activation_number)] = f.effect; });
      if(Object.keys(e).length) d.sets[st.name] = Object.assign({ n: st.name }, e);
    });
  }));
  if(game === "nap") (g.info || []).forEach(x => (x.avatar_list || []).forEach(a => {
    cons(a.id, a.ranks, "name", "desc");
    (a.skills || []).forEach(s => {
      const items = (s.items || []).filter(it => it.text);
      if(items.length) d.skills[a.id + ":" + s.skill_type] = { n: ZZZ_SKILL[s.skill_type] || "", d: items.map(it => (it.title ? it.title + "\n" : "") + it.text).join("\n\n") };
    });
    (a.equip || []).forEach(e => { const su = e.equip_suit || {}; if(su.suit_id && (su.desc1 || su.desc2)) d.sets[su.suit_id] = { n: su.name || "", "2": su.desc1 || "", "4": su.desc2 || "" }; });
    const w = a.weapon; if(w && w.talent_content) d.weapons[w.id] = { n: w.talent_title || w.name || "", d: w.talent_content };
  }));
  return d;
}

// загрузка файла HoYoLAB: все игры из файла сразу; справочники нужных игр подгружаются по очереди
async function scIngestHoyo(j){
  const conv = { hkrpg: hoyoHsr, hk4e: hoyoGi, nap: hoyoZzz }, done = [];
  for(const game of Object.keys(j.games || {})){
    const g = j.games[game];
    if(!conv[game] || !g || g.error) continue;
    if(!SCB[game]) ensureBuild(game);
    for(let i = 0; i < 100 && !SCB[game]; i++) await new Promise(r => setTimeout(r, 100));
    if(!SCB[game]) continue;
    try { const r = scIngest(game, conv[game](g), g.uid); done.push(SCG[game].title + ": " + r.n); }
    catch(e){ console.error(e); }
    try { descMerge(game, hoyoDesc(game, g)); }
    catch(e){ console.error(e); }
  }
  // поле UID — на текущую игру (scIngest ставит UID каждой загруженной)
  const cur = (ui.scUidG || {})[scGame()];
  if(cur) document.getElementById("scUid").value = cur;
  return done;
}

/* окно с инструкцией «Из HoYoLAB» */
(function(){
  const ov = document.getElementById("hoyoOverlay"), note = document.getElementById("hoyoNote");
  const close = () => ov.classList.remove("on");
  document.getElementById("scHoyo").addEventListener("click", () => { note.textContent = ""; ov.classList.add("on"); });
  document.getElementById("hoyoClose").addEventListener("click", close);
  ov.addEventListener("mousedown", e => { if(e.target === ov) close(); });
  document.getElementById("hoyoPick").addEventListener("click", () => { close(); document.getElementById("scFile").click(); });
  document.getElementById("hoyoCopy").addEventListener("click", async e => {
    const btn = e.currentTarget;
    try {
      const code = await (await fetch("tools/hoyolab-export.js", { cache:"no-cache" })).text();
      await navigator.clipboard.writeText(code);
      btn.textContent = "Скопировано"; note.textContent = "Скрипт в буфере обмена — вставьте его в консоль на странице HoYoLAB.";
      setTimeout(() => { btn.textContent = "Скопировать скрипт"; }, 1800);
    } catch(err){ note.textContent = "Не получилось скопировать — откройте tools/hoyolab-export.js по ссылке выше и скопируйте вручную."; }
  });
})();
