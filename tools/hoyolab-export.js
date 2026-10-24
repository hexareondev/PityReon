/* PityReon — выгрузка всех персонажей из HoYoLAB (Star Rail, Genshin, ZZZ).
   Запускается на открытой странице HoYoLAB (act.hoyolab.com — «Боевые хроники»), где вы уже вошли в аккаунт.
   Работает от имени этой страницы: cookie подставляет сам браузер, никуда, кроме серверов HoYoLAB, скрипт не обращается.
   Итог — файл pityreon_hoyolab.json, его загружают на сайт кнопкой «Загрузить файл» в витрине. */
(async () => {
  function md5(str){
    const s = unescape(encodeURIComponent(str)), n = s.length;
    const K = [], R = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    for(let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    const words = [];
    for(let i = 0; i < n; i++) words[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
    words[n >> 2] |= 0x80 << ((n % 4) * 8);
    const total = (((n + 8) >> 6) + 1) * 16;
    for(let i = 0; i < total; i++) words[i] = words[i] | 0;
    words[total - 2] = n * 8;
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for(let j = 0; j < total; j += 16){
      let a = a0, b = b0, c = c0, d = d0;
      for(let i = 0; i < 64; i++){
        let f, g;
        if(i < 16){ f = (b & c) | (~b & d); g = i; }
        else if(i < 32){ f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if(i < 48){ f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const t = d; d = c; c = b;
        const x = (a + f + K[i] + words[j + g]) | 0;
        b = (b + ((x << R[i]) | (x >>> (32 - R[i])))) | 0;
        a = t;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    return [a0, b0, c0, d0].map(v => { let h = ""; for(let i = 0; i < 4; i++) h += ((v >>> (i * 8)) & 255).toString(16).padStart(2, "0"); return h; }).join("");
  }

  const SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";          // подпись запросов HoYoLAB (overseas)
  const ds = () => {
    const t = Math.floor(Date.now() / 1000), abc = "abcdefghijklmnopqrstuvwxyz0123456789";
    let r = ""; for(let i = 0; i < 6; i++) r += abc[Math.floor(Math.random() * abc.length)];
    return t + "," + r + "," + md5("salt=" + SALT + "&t=" + t + "&r=" + r);
  };
  const H = () => ({ "DS": ds(), "x-rpc-app_version": "1.5.0", "x-rpc-client_type": "5", "x-rpc-language": "ru-ru" });
  const log = (...a) => console.log("%c[PityReon]", "color:#f0c264;font-weight:bold", ...a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function api(url, body){
    const opt = { credentials: "include", headers: H() };
    if(body){ opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    const j = await r.json();
    if(j.retcode !== 0) throw new Error("retcode " + j.retcode + ": " + j.message);
    return j.data;
  }
  const qs = o => Object.keys(o).map(k => [].concat(o[k]).map(v => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&")).join("&");
  const REC = "https://bbs-api-os.hoyolab.com/game_record/";
  const ZZZ = "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/";
  const out = { source: "hoyolab", version: 1, at: new Date().toISOString(), games: {} };

  for(const [game, biz] of [["hkrpg", "hkrpg_global"], ["hk4e", "hk4e_global"], ["nap", "nap_global"]]){
    let roles = [];
    try { roles = (await api("https://api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken?game_biz=" + biz)).list || []; }
    catch(e){ log(game, "— не удалось получить аккаунты:", e.message); continue; }
    if(!roles.length){ log(game, "— аккаунта нет"); continue; }
    // если аккаунтов несколько — берём с самым высоким уровнем
    const role = roles.sort((a, b) => (b.level || 0) - (a.level || 0))[0];
    const base = { role_id: role.game_uid, server: role.region };
    const g = out.games[game] = { uid: role.game_uid, nick: role.nickname, level: role.level, region: role.region };
    try {
      if(game === "hkrpg"){
        g.info = await api(REC + "hkrpg/api/avatar/info?" + qs({ ...base, need_wiki: "true" }));
        log("Star Rail: персонажей", (g.info.avatar_list || []).length);
      } else if(game === "hk4e"){
        const ids = ((await api(REC + "genshin/api/character/list", base)).list || []).map(c => c.id);
        g.details = [];
        for(let i = 0; i < ids.length; i += 8){ g.details.push(await api(REC + "genshin/api/character/detail", { ...base, character_ids: ids.slice(i, i + 8) })); await sleep(300); }
        log("Genshin: персонажей", ids.length);
      } else {
        const ids = ((await api(ZZZ + "avatar/basic?" + qs(base))).avatar_list || []).map(a => a.id);
        g.info = [];
        for(const id of ids){ g.info.push(await api(ZZZ + "avatar/info?" + qs({ ...base, "id_list[]": id, need_wiki: "true" }))); await sleep(300); }
        log("ZZZ: агентов", ids.length);
      }
    } catch(e){ g.error = e.message; log(game, "— ошибка:", e.message); }
  }
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "pityreon_hoyolab.json";
  document.body.appendChild(a); a.click(); a.remove();
  log("Готово — файл pityreon_hoyolab.json скачан. Загрузите его в витрине PityReon кнопкой «Загрузить файл».");
})();
