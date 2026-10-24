#!/usr/bin/env python3
"""Рекомендуемые характеристики из HoYoLAB («Рекомендуемые атрибуты») — для витрины.

Нужен аккаунт HoYoLAB: cookie берутся из переменных окружения LTUID, LTOKEN, LTMID
(в GitHub — секреты репозитория с теми же именами). Без них скрипт ничего не делает.

  Star Rail — HoYoLAB отдаёт рекомендации сразу для всех персонажей игры;
  Genshin   — только для персонажей, которые есть на аккаунте (накапливаются от запуска к запуску).

Берутся рекомендации по умолчанию — одинаковые у всех игроков, а не свои настройки владельца аккаунта.
Результат — items/data/rec_hoyo.json в формате витрины: { "hkrpg:1310": ["BreakDamageAddedRatio", ...], ... }.
В лог пишутся только количества — без UID и прочих данных аккаунта.
Нужен genshin.py: pip install genshin
"""
import asyncio, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "rec_hoyo.json")

# номера характеристик HoYoLAB → ключи витрины (только то, что бывает в дополнительных; простые числа не нужны)
HSR = {32: "MaxHP%", 33: "Attack%", 34: "Defence%", 51: "Speed", 52: "CriticalChance", 53: "CriticalDamage",
       59: "BreakDamageAddedRatio", 56: "StatusProbability", 57: "StatusResistance"}
GI = {20: "FIGHT_PROP_CRITICAL", 22: "FIGHT_PROP_CRITICAL_HURT", 6: "FIGHT_PROP_ATTACK_PERCENT", 3: "FIGHT_PROP_HP_PERCENT",
      9: "FIGHT_PROP_DEFENSE_PERCENT", 28: "FIGHT_PROP_ELEMENT_MASTERY", 23: "FIGHT_PROP_CHARGE_EFFICIENCY"}
ORDER = {"hkrpg": list(HSR.values()), "hk4e": list(GI.values())}


def norm(game, keys):
    return [k for k in ORDER[game] if k in keys]


async def fetch(env):
    import genshin
    cookies = {"ltuid_v2": env["LTUID"], "ltoken_v2": env["LTOKEN"]}
    if env.get("LTMID"):
        cookies["ltmid_v2"] = env["LTMID"]
    client = genshin.Client(cookies, lang="ru-ru")

    async def call(endpoint, game, **kw):
        try:
            return await client.request_game_record(endpoint, lang="ru-ru", region=genshin.Region.OVERSEAS, game=game, **kw)
        except Exception as e:
            print("  ! %s %s: %s" % (game.name, endpoint, type(e).__name__), file=sys.stderr)
            return None

    res = {}
    for acc in await client.get_game_accounts():
        g, base = acc.game, {"role_id": acc.uid, "server": acc.server}
        if g == genshin.Game.STARRAIL:
            d = await call("avatar/info", g, params={**base, "need_wiki": "true"}) or {}
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
                    r = (c.get("recommend_relic_property") or {}).get("recommend_properties") or {}
                    keys = [GI[p] for p in (r.get("sub_property_list") or []) if p in GI]
                    if keys:
                        res["hk4e:" + str(c["base"]["id"])] = norm("hk4e", keys)
    return res


def main():
    env = {k: os.environ.get(k, "").strip() for k in ("LTUID", "LTOKEN", "LTMID")}
    if not env["LTUID"] or not env["LTOKEN"]:
        print("HoYoLAB: cookie не заданы (LTUID, LTOKEN) — пропускаю")
        return
    try:
        with open(OUT, encoding="utf-8") as f:
            out = json.load(f)
    except (OSError, ValueError):
        out = {}
    new = asyncio.run(fetch(env))
    changed = sum(1 for k, v in new.items() if out.get(k) != v)
    out.update(new)   # прежние записи остаются: Genshin отдаёт только персонажей с аккаунта
    body = dict(sorted(out.items(), key=lambda kv: (kv[0].split(":")[0], int(kv[0].split(":")[1]))))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, indent=1)
        f.write("\n")
    by = {}
    for k in new:
        by[k.split(":")[0]] = by.get(k.split(":")[0], 0) + 1
    print("HoYoLAB: получено %s, изменилось %d, всего в списке %d" % (by or "ничего", changed, len(body)))


if __name__ == "__main__":
    main()
