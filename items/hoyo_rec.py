#!/usr/bin/env python3
"""Рекомендуемые характеристики из HoYoLAB («Рекомендуемые атрибуты») — для витрины.

Нужен аккаунт HoYoLAB: cookie берутся из переменных окружения LTUID, LTOKEN, LTMID
(в GitHub — секреты репозитория с теми же именами). Без них скрипт ничего не делает.

  Star Rail — HoYoLAB отдаёт рекомендации сразу для всех персонажей игры;
  Genshin   — только для персонажей, которые есть на аккаунте (накапливаются от запуска к запуску);
  ZZZ       — тоже только для агентов с аккаунта, по одному запросу на агента.

Берутся рекомендации по умолчанию — одинаковые у всех игроков, а не свои настройки владельца аккаунта.
Результат — items/data/rec_hoyo.json в формате витрины: { "hkrpg:1310": ["BreakDamageAddedRatio", ...], ... }
и items/data/rec_main.json — рекомендуемые главные характеристики артефактов Genshin: { "hk4e:10000047": {"sands": [...], ...} }.
Заодно копится база описаний для подсказок в карточках — items/data/desc_<игра>.json:
навыки, созвездия/эйдолоны/кинограммы, бонусы комплектов, эффекты амплификаторов (по персонажам аккаунта).
Если cookie заданы, но HoYoLAB не ответил (истекли cookie и т.п.), скрипт завершается с ошибкой — workflow откроет issue.
В лог пишутся только количества — без UID и прочих данных аккаунта.
Нужен genshin.py: pip install genshin
"""
import asyncio, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "rec_hoyo.json")
OUT_MAIN = os.path.join(HERE, "data", "rec_main.json")

# номера характеристик HoYoLAB → ключи витрины (только то, что бывает в дополнительных; простые числа не нужны)
HSR = {32: "MaxHP%", 33: "Attack%", 34: "Defence%", 51: "Speed", 52: "CriticalChance", 53: "CriticalDamage",
       59: "BreakDamageAddedRatio", 56: "StatusProbability", 57: "StatusResistance"}
GI = {20: "FIGHT_PROP_CRITICAL", 22: "FIGHT_PROP_CRITICAL_HURT", 6: "FIGHT_PROP_ATTACK_PERCENT", 3: "FIGHT_PROP_HP_PERCENT",
      9: "FIGHT_PROP_DEFENSE_PERCENT", 28: "FIGHT_PROP_ELEMENT_MASTERY", 23: "FIGHT_PROP_CHARGE_EFFICIENCY"}
# ZZZ: номера характеристик HoYoLAB совпадают с номерами игры (и витрины)
ZZZ = ["20103", "21103", "12102", "11102", "13102", "31203", "23203"]
# главные характеристики артефактов Genshin: номер HoYoLAB → FIGHT_PROP_*
GI_MAIN = {6: "ATTACK_PERCENT", 3: "HP_PERCENT", 9: "DEFENSE_PERCENT", 28: "ELEMENT_MASTERY", 23: "CHARGE_EFFICIENCY", 20: "CRITICAL",
           22: "CRITICAL_HURT", 26: "HEAL_ADD", 40: "FIRE_ADD_HURT", 41: "ELEC_ADD_HURT", 42: "WATER_ADD_HURT", 43: "GRASS_ADD_HURT",
           44: "WIND_ADD_HURT", 45: "ROCK_ADD_HURT", 46: "ICE_ADD_HURT", 30: "PHYSICAL_ADD_HURT"}
ZZZ_SKILL = {0: "Обычная атака", 1: "Особая атака", 2: "Уклонение", 3: "Цепная атака", 5: "Базовый навык", 6: "Поддержка"}


def new_desc():
    return {"skills": {}, "cons": {}, "sets": {}, "weapons": {}}


def add_cons(d, cid, items, nk, dk):
    o = {str(r["pos"]): {"n": r.get(nk) or "", "d": r[dk]} for r in (items or []) if r.get(dk)}
    if o:
        d["cons"][str(cid)] = o


ORDER = {"hkrpg": list(HSR.values()), "hk4e": list(GI.values()), "nap": ZZZ}


def norm(game, keys):
    return [k for k in ORDER[game] if k in keys]


async def fetch(env):
    import genshin
    cookies = {"ltuid_v2": env["LTUID"], "ltoken_v2": env["LTOKEN"]}
    if env.get("LTMID"):
        cookies["ltmid_v2"] = env["LTMID"]
    client = genshin.Client(cookies, lang="ru-ru")

    errors = []

    async def call(endpoint, game, **kw):
        try:
            return await client.request_game_record(endpoint, lang="ru-ru", region=genshin.Region.OVERSEAS, game=game, **kw)
        except Exception as e:
            print("  ! %s %s: %s" % (game.name, endpoint, type(e).__name__), file=sys.stderr)
            errors.append(type(e).__name__)
            return None

    res, mains = {}, {}
    desc = {"hkrpg": new_desc(), "hk4e": new_desc(), "nap": new_desc()}
    for acc in await client.get_game_accounts():
        g, base = acc.game, {"role_id": acc.uid, "server": acc.server}
        if g == genshin.Game.STARRAIL:
            d = await call("avatar/info", g, params={**base, "need_wiki": "true"}) or {}
            for a in d.get("avatar_list", []):
                add_cons(desc["hkrpg"], a["id"], a.get("ranks"), "name", "desc")
                for sk in a.get("skills", []):
                    st = (sk.get("skill_stages") or [None])[0]
                    if st and st.get("desc"):
                        pid = str(sk.get("point_id"))
                        if len(pid) == 8 and pid[0] == "1":
                            pid = pid[1:]
                        desc["hkrpg"]["skills"][pid] = {"n": st.get("name") or "", "d": st["desc"]}
            for aid, v in (d.get("recommend_property") or {}).items():
                keys = [HSR[p] for p in (v.get("recommend_relic_properties") or []) if p in HSR]
                if keys:
                    res["hkrpg:" + str(aid)] = norm("hkrpg", keys)
        elif g == genshin.Game.GENSHIN:
            lst = await call("character/list", g, method="POST", data=base) or {}
            ids = [c["id"] for c in lst.get("list", [])]
            for i in range(0, len(ids), 8):
                det = await call("character/detail", g, method="POST", data={**base, "character_ids": ids[i:i + 8]}) or {}
                for c in det.get("list", []):
                    cid = c["base"]["id"]
                    add_cons(desc["hk4e"], cid, c.get("constellations"), "name", "effect")
                    for sk in c.get("skills", []):
                        if sk.get("desc"):
                            desc["hk4e"]["skills"][str(sk["skill_id"])] = {"n": sk.get("name") or "", "d": sk["desc"]}
                    for rl in c.get("relics", []):
                        st = rl.get("set") or {}
                        eff = {str(f["activation_number"]): f["effect"] for f in st.get("affixes", []) if f.get("effect")}
                        if st.get("name") and eff:
                            desc["hk4e"]["sets"][st["name"]] = {"n": st["name"], **eff}
                    r = (c.get("recommend_relic_property") or {}).get("recommend_properties") or {}
                    keys = [GI[p] for p in (r.get("sub_property_list") or []) if p in GI]
                    if keys:
                        res["hk4e:" + str(c["base"]["id"])] = norm("hk4e", keys)
                    m = {}
                    for slot, field in (("sands", "sand_main_property_list"), ("goblet", "goblet_main_property_list"), ("circlet", "circlet_main_property_list")):
                        ks = ["FIGHT_PROP_" + GI_MAIN[p] for p in (r.get(field) or []) if p in GI_MAIN]
                        if ks:
                            m[slot] = ks
                    if m:
                        mains["hk4e:" + str(c["base"]["id"])] = m
        elif g == genshin.Game.ZZZ:
            basic = await call("avatar/basic", g, params=base) or {}
            for a in basic.get("avatar_list", []):
                # список номеров HoYoLAB для ZZZ не принимает — только по одному агенту
                d = await call("avatar/info", g, params={**base, "id_list[]": a["id"], "need_wiki": "true"}) or {}
                for av in d.get("avatar_list", []):
                    add_cons(desc["nap"], av["id"], av.get("ranks"), "name", "desc")
                    for sk in av.get("skills", []):
                        items = [it for it in sk.get("items", []) if it.get("text")]
                        if items:
                            desc["nap"]["skills"]["%s:%s" % (av["id"], sk["skill_type"])] = {
                                "n": ZZZ_SKILL.get(sk["skill_type"], ""),
                                "d": "\n\n".join(((it.get("title") + "\n") if it.get("title") else "") + it["text"] for it in items)}
                    for e in av.get("equip", []):
                        su = e.get("equip_suit") or {}
                        if su.get("suit_id") and (su.get("desc1") or su.get("desc2")):
                            desc["nap"]["sets"][str(su["suit_id"])] = {"n": su.get("name") or "", "2": su.get("desc1") or "", "4": su.get("desc2") or ""}
                    w = av.get("weapon") or {}
                    if w.get("talent_content"):
                        desc["nap"]["weapons"][str(w["id"])] = {"n": w.get("talent_title") or w.get("name") or "", "d": w["talent_content"]}
                    plan = (av.get("equip_plan_info") or {}).get("game_default") or {}
                    keys = [str(p.get("id")) for p in (plan.get("property_list") or []) if str(p.get("id")) in ZZZ]
                    if keys:
                        res["nap:" + str(av["id"])] = norm("nap", keys)
                await asyncio.sleep(0.3)
    return res, mains, errors, desc


def main():
    env = {k: os.environ.get(k, "").strip() for k in ("LTUID", "LTOKEN", "LTMID")}
    if not env["LTUID"] or not env["LTOKEN"]:
        print("HoYoLAB: cookie не заданы (LTUID, LTOKEN) — пропускаю")
        return
    def load(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}
    out, out_main = load(OUT), load(OUT_MAIN)
    try:
        new, new_main, errors, new_desc_all = asyncio.run(fetch(env))
    except Exception as e:          # например, cookie истекли — не пускает уже на списке аккаунтов
        print("HoYoLAB не ответил: %s" % type(e).__name__)
        sys.exit(1)
    changed = sum(1 for k, v in new.items() if out.get(k) != v)
    out.update(new)   # прежние записи остаются: Genshin отдаёт только персонажей с аккаунта
    body = dict(sorted(out.items(), key=lambda kv: (kv[0].split(":")[0], int(kv[0].split(":")[1]))))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, indent=1)
        f.write("\n")
    # база описаний: новое дополняет и обновляет прежнее
    for game, nd in new_desc_all.items():
        path = os.path.join(HERE, "data", "desc_%s.json" % game)
        cur = load(path)
        for kind, items in nd.items():
            cur.setdefault(kind, {}).update(items)
        if any(cur.get(k) for k in cur):
            with open(path, "w", encoding="utf-8") as f:
                json.dump({k: dict(sorted(v.items())) for k, v in sorted(cur.items())}, f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
            print("Описания %s: навыков %d, созвездий %d, комплектов %d, амплификаторов %d" % (game, len(cur.get("skills", {})), len(cur.get("cons", {})), len(cur.get("sets", {})), len(cur.get("weapons", {}))))
    out_main.update(new_main)
    with open(OUT_MAIN, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(out_main.items(), key=lambda kv: int(kv[0].split(":")[1]))), f, ensure_ascii=False, indent=1)
        f.write("\n")
    by = {}
    for k in new:
        by[k.split(":")[0]] = by.get(k.split(":")[0], 0) + 1
    print("HoYoLAB: получено %s, изменилось %d, всего в списке %d" % (by or "ничего", changed, len(body)))
    if errors or not new:
        print("HoYoLAB: были ошибки (%s) — проверьте cookie в секретах" % (", ".join(sorted(set(errors))) or "пустой ответ"))
        sys.exit(1)


if __name__ == "__main__":
    main()
