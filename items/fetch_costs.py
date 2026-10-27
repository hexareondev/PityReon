#!/usr/bin/env python3
"""Стоимость прокачки для планировщика — Star Rail и ZZZ.

Источники (без cookie, публичные):
  • Hakushin (static.nanoka.cc) — возвышения, следы/навыки, ядро, оружие, предметы с иконками;
    в манифесте отмечены и новые персонажи версии (часто ещё до выхода);
  • открытые данные игры HSR (github.com/DimbreathBot/TurnBasedGameData) — таблицы опыта и книги опыта.

Результат — items/data/cost_hkrpg.json и items/data/cost_nap.json. Стоимость — списки [номер_предмета, количество].
Названия предметов — английские (у Hakushin нет русского); перевод — отдельной таблицей на сайте.
"""
import json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
NANO = "https://static.nanoka.cc"
TBGD = "https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/main/ExcelOutput/"


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PityReon-costs"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(1.5)


ICONS = os.path.join(HERE, "icons")
ENKA = "https://enka.network"


def icon_urls(game, iid, base):
    """Где искать картинку предмета: Hakushin, затем запасные источники."""
    if game == "hkrpg":
        return [f"{NANO}/assets/hsr/itemfigures/{iid}.webp", f"{NANO}/hsr/UI/itemfigures/{iid}.webp",
                f"https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/item/{iid}.png",
                f"{ENKA}/ui/hsr/SpriteOutput/ItemIcon/{iid}.png"]
    if not base:
        return []
    return [f"{NANO}/assets/zzz/{base}.webp", f"{NANO}/zzz/UI/{base}.webp", f"{ENKA}/ui/zzz/{base}.png", f"{ENKA}/ui/{base}.png"]


def _grid(img):
    """Сетка спрайт-листа: (столбцов, строк). Граница кадров — почти прозрачная линия; берём самое мелкое деление,
    при котором все границы пустые (деление посередине предмета не пройдёт — там картинка)."""
    a = img.getchannel("A")
    w, h = img.size
    px = a.load()

    def empty_col(x):
        return sum(px[x, y] for y in range(0, h, 2)) / (255 * ((h + 1) // 2)) < 0.03

    def empty_row(y):
        return sum(px[x, y] for x in range(0, w, 2)) / (255 * ((w + 1) // 2)) < 0.03

    def best(size, empty):
        res = 1
        for n in range(2, 33):
            if size % n or size // n < 24:
                continue
            step = size // n
            if all(empty(min(size - 1, i * step)) and empty(i * step - 1) for i in range(1, n)):
                res = n
        return res
    return best(w, empty_col), best(h, empty_row)


def animate_sheet(path):
    """Иконки боссов ZZZ приходят спрайт-листом (кадры вращения сеткой). Склеиваем кадры в анимированный WEBP.
    Возвращает новый путь или None, если это обычная картинка."""
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        img = Image.open(path)
        if getattr(img, "is_animated", False):
            return None
        img = img.convert("RGBA")
    except Exception:
        return None
    cols, rows = _grid(img)
    if cols * rows < 4:
        return None
    fw, fh = img.width // cols, img.height // rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            f = img.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
            if f.getchannel("A").getbbox() is None:      # пустые клетки в конце листа
                continue
            if max(fw, fh) > 128:
                f = f.resize((round(fw * 128 / max(fw, fh)), round(fh * 128 / max(fw, fh))), Image.LANCZOS)
            frames.append(f)
    if len(frames) < 4:
        return None
    out = os.path.splitext(path)[0] + ".webp"
    tmp = out + ".tmp"
    frames[0].save(tmp, "WEBP", save_all=True, append_images=frames[1:], loop=0,
                   duration=max(25, round(2400 / len(frames))), quality=85, method=4)
    if os.path.abspath(path) != os.path.abspath(out):
        os.remove(path)
    os.replace(tmp, out)
    print("  анимация: %s — %d×%d, кадров %d" % (os.path.basename(out), cols, rows, len(frames)))
    return out


def save_icons(game, items, bases):
    """Скачивает иконки материалов в items/icons/<игра>/ (уже скачанные не трогает).
    В предмет записывается "loc" — путь от корня сайта; где скачать не вышло, сайт пробует ссылки сам."""
    d = os.path.join(ICONS, game)
    os.makedirs(d, exist_ok=True)
    have = {os.path.splitext(f)[0]: f for f in os.listdir(d)}
    got = new = 0
    # заглушки: если источник отдаёт одну и ту же картинку разным предметам, это «нет картинки», а не иконка
    import hashlib
    seen = {}
    for f in os.listdir(d):
        with open(os.path.join(d, f), "rb") as fh:
            seen.setdefault(hashlib.md5(fh.read()).hexdigest(), []).append(f)
    for h, fs in seen.items():
        if len(fs) >= 3:
            for f in fs:
                os.remove(os.path.join(d, f)); have.pop(os.path.splitext(f)[0], None)
            print("  ! удалено %d одинаковых картинок-заглушек" % len(fs))
    bad = {h for h, fs in seen.items() if len(fs) >= 3}
    def fetch(iid):
        """Первая настоящая картинка из источников; заглушки (одна картинка на многие предметы) пропускаются."""
        for u in icon_urls(game, iid, bases.get(iid, "")):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "PityReon-costs"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
            except Exception:
                continue
            ext = ".webp" if data[:4] == b"RIFF" and data[8:12] == b"WEBP" else ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".gif" if data[:6] in (b"GIF87a", b"GIF89a") else ""
            hd = hashlib.md5(data).hexdigest()
            if not ext or len(data) < 100 or hd in bad:
                continue
            return data, ext, hd
        return None

    # уже скачанные листы (и положенные вручную) тоже превращаем в анимацию; готовые анимации не трогаются
    for k in list(have):
        an = animate_sheet(os.path.join(d, have[k]))
        if an:
            have[k] = os.path.basename(an)
    todo = []
    for iid, it in items.items():
        if iid in have:
            it["loc"] = "items/icons/%s/%s" % (game, have[iid])
        else:
            todo.append(iid)
    # два прохода: после первого видно, какие картинки на деле заглушки, и для них пробуются другие источники
    for _ in range(2):
        got_now = {}
        for iid in todo:
            r = fetch(iid)
            if r:
                got_now[iid] = r
        counts = {}
        for iid, (_, _, hd) in got_now.items():
            counts[hd] = counts.get(hd, 0) + 1
        fresh_bad = {hd for hd, n in counts.items() if n >= 3}
        if fresh_bad:
            print("  ! найдены картинки-заглушки: %d шт." % sum(counts[h] for h in fresh_bad))
        bad |= fresh_bad
        rest = []
        for iid in todo:
            r = got_now.get(iid)
            if not r or r[2] in bad:
                rest.append(iid); continue
            fn = iid + r[1]
            with open(os.path.join(d, fn), "wb") as f:
                f.write(r[0])
            an = animate_sheet(os.path.join(d, fn))
            if an:
                fn = os.path.basename(an)
            items[iid]["loc"] = "items/icons/%s/%s" % (game, fn); new += 1
        todo = rest
        if not fresh_bad:
            break
    got = sum(1 for it in items.values() if it.get("loc"))
    print("  иконки: есть %d из %d (новых %d)" % (got, len(items), new))


def clean(name):
    """Убирает разметку игры из названий: <i>…</i>, <unbreak>, {NICKNAME}."""
    n = re.sub(r"<[^>]+>", "", str(name or ""))
    n = n.replace("{NICKNAME}", "Trailblazer")
    return re.sub(r"\{[^}]*\}", "", n).strip()


def pairs(lst):
    """[{item_id, item_num}] или {id: num} → [[id, num]]"""
    out = []
    if isinstance(lst, dict):
        for k, v in lst.items():
            if str(k).isdigit() and v:
                out.append([int(k), int(v)])
    elif isinstance(lst, list):
        for x in lst:
            if isinstance(x, dict) and x.get("item_id") is not None:
                out.append([int(x["item_id"]), int(x.get("item_num") or 0)])
    return out


def ids_in(obj, acc):
    if isinstance(obj, list):
        for x in obj:
            if isinstance(x, list) and len(x) == 2 and isinstance(x[0], int):
                acc.add(x[0])
            else:
                ids_in(x, acc)
    elif isinstance(obj, dict):
        for v in obj.values():
            ids_in(v, acc)


def rarity_num(v):
    if isinstance(v, int):
        return v
    m = re.search(r"(\d)$", str(v or ""))
    return int(m.group(1)) if m else 0


# ───────────── Star Rail ─────────────
def hsr(ver):
    print("HSR", ver)
    idx = get(f"{NANO}/hsr/{ver}/character.json")
    lc_idx = get(f"{NANO}/hsr/{ver}/lightcone.json")
    items_all = get(f"{NANO}/hsr/{ver}/en/item.json")
    # опыт: таблицы и книги (открытые данные игры)
    exp_av, exp_lc = {}, {}
    for r in get(TBGD + "ExpType.json"):
        exp_av.setdefault(str(r["TypeID"]), {})[r["Level"]] = r.get("Exp", 0)
    for r in get(TBGD + "EquipmentExpType.json"):
        exp_lc.setdefault(str(r["ExpType"]), {})[r["Level"]] = r.get("Exp", 0)
    av_books = [[r["ItemID"], r.get("Exp", 0)] for r in get(TBGD + "AvatarExpItemConfig.json")]
    lc_books = [[r["ItemID"], r.get("ExpProvide", 0), r.get("CoinCost", 0)] for r in get(TBGD + "EquipmentExpItemConfig.json")]
    av_group, lc_type = {}, {}
    try:
        for r in get(TBGD + "AvatarConfig.json"):
            av_group[str(r.get("AvatarID"))] = str(r.get("ExpGroup", 1))
    except Exception as e:
        print("  ! AvatarConfig:", e)
    try:
        for r in get(TBGD + "EquipmentConfig.json"):
            lc_type[str(r.get("EquipmentID"))] = str(r.get("ExpType", ""))
    except Exception as e:
        print("  ! EquipmentConfig:", e)

    chars, lcs, fails = {}, {}, 0
    for cid, info in idx.items():
        try:
            d = get(f"{NANO}/hsr/{ver}/en/character/{cid}.json")
        except Exception as e:
            fails += 1; print("  ! char", cid, e); continue
        # возвышения: stats[promo].cost
        asc = []
        st = d.get("stats") or {}
        for k in sorted(st, key=lambda x: int(x)) if isinstance(st, dict) else range(len(st)):
            s = st[k]
            asc.append(pairs(s.get("cost") or s.get("promotion_cost_list") or []))
        # следы: point → уровни
        skills, traces = [], {}   # traces: узел (одноуровневый след) → его стоимость
        for pk, levels in sorted((d.get("skill_trees") or {}).items()):
            if not isinstance(levels, dict):
                continue
            lv = sorted(levels, key=lambda x: int(x))
            costs = {l: pairs(levels[l].get("material_list") or []) for l in lv}
            req = {l: levels[l].get("avatar_promotion_limit") for l in lv}
            first = levels[lv[0]]
            pid = first.get("point_id") or first.get("id") or pk
            name = first.get("point_name") or first.get("name") or ""
            if len(lv) > 1:
                skills.append({"k": pk, "id": pid, "n": name, "max": int(lv[-1]), "cost": costs, "req": req})
            else:
                traces[str(pid)] = costs[lv[0]]
        chars[cid] = {"n": clean(info.get("en") or d.get("name") or ""), "r": rarity_num(d.get("rarity") or info.get("rank")),
                      "path": d.get("base_type") or info.get("baseType"), "el": d.get("damage_type") or info.get("damageType"),
                      "exp": av_group.get(cid, "1"), "asc": asc, "skills": skills, "tr": traces}
        time.sleep(0.05)
    for wid, info in lc_idx.items():
        try:
            d = get(f"{NANO}/hsr/{ver}/en/lightcone/{wid}.json")
        except Exception as e:
            fails += 1; print("  ! lc", wid, e); continue
        st = d.get("stats") or []
        st = [st[k] for k in sorted(st, key=lambda x: int(x))] if isinstance(st, dict) else st
        lcs[wid] = {"n": clean(info.get("en") or d.get("name") or ""), "r": rarity_num(d.get("rarity") or info.get("rank")),
                    "path": d.get("base_type") or info.get("baseType"), "exp": lc_type.get(wid, ""),
                    "asc": [pairs(s.get("promotion_cost_list") or []) for s in st]}
        time.sleep(0.05)
    used = set(x[0] for x in av_books) | set(x[0] for x in lc_books) | {2}
    ids_in([c["asc"] for c in chars.values()] + [list(c["tr"].values()) for c in chars.values()] + [l["asc"] for l in lcs.values()], used)
    for c in chars.values():
        for s in c["skills"]:
            ids_in(list(s["cost"].values()), used)
    items = {}
    for i in sorted(used):
        it = items_all.get(str(i)) or {}
        icon = os.path.splitext(os.path.basename(it.get("item_figure_icon_path") or ""))[0]
        items[str(i)] = {"n": clean(it.get("item_name")), "r": rarity_num({"Normal": 1, "NotNormal": 2, "Rare": 3, "VeryRare": 4, "SuperRare": 5}.get(it.get("rarity"), 0)),
                         "t": it.get("item_sub_type") or "", "icon": (NANO + "/assets/hsr/itemfigures/" + icon + ".webp") if icon else ""}
    save_icons("hkrpg", items, {})
    exp = {"avatar": {g: [t.get(l, 0) for l in range(1, max(t) + 1)] for g, t in exp_av.items()},
           "lc": {g: [t.get(l, 0) for l in range(1, max(t) + 1)] for g, t in exp_lc.items()},
           "avatar_books": av_books, "lc_books": lc_books}
    print("  персонажей %d, конусов %d, предметов %d, ошибок %d" % (len(chars), len(lcs), len(items), fails))
    for g, t in exp["avatar"].items():
        print("  опыт персонажа, группа %s: уровней %d, первые %s, сумма 1→80 %d" % (g, len(t), t[:3], sum(t[:79])))
    for g, t in list(exp["lc"].items())[:3]:
        print("  опыт конуса, тип %s: уровней %d, первые %s, сумма 1→80 %d" % (g, len(t), t[:3], sum(t[:79])))
    print("  книги персонажа %s, конуса %s" % (av_books, lc_books))
    # самопроверка: у кого пусто — значит, формат поменялся
    print("  без возвышений: %d, без следов: %d, конусов без возвышений: %d, предметов без названия: %d" % (
        sum(1 for c in chars.values() if not any(c["asc"])), sum(1 for c in chars.values() if not c["skills"]),
        sum(1 for l in lcs.values() if not any(l["asc"])), sum(1 for i in items.values() if not i["n"])))
    any_c = next(iter(idx.values()), {})
    print("  ключи списка персонажей:", list(any_c)[:12] if isinstance(any_c, dict) else type(any_c).__name__)
    if "1310" in chars:
        c = chars["1310"]
        print("  пример 1310: %s, r%s, %s/%s, exp %s, возвышений %d, навыков %d (%s), одноуровневых следов %d" % (
            c["n"], c["r"], c["path"], c["el"], c["exp"], len(c["asc"]), len(c["skills"]), ",".join("%s:%s" % (x["k"], x["max"]) for x in c["skills"]), len(c["tr"])))
        print("  1310: пустые возвышения %s, навык point02 уровни %s (пустые %s), требования %s" % (
            [i for i, x in enumerate(c["asc"]) if not x], list(c["skills"][1]["cost"]) if len(c["skills"]) > 1 else "-",
            [k for k, v in (c["skills"][1]["cost"] if len(c["skills"]) > 1 else {}).items() if not v], c["skills"][1]["req"] if len(c["skills"]) > 1 else "-"))
    return {"ver": ver, "exp": exp, "chars": chars, "lcs": lcs, "items": items}


# ───────────── ZZZ ─────────────
# опыт журналов агента и модулей амплификатора (в данных Hakushin его нет; значения из игры)
ZZZ_BOOKS = {"agent": [[300001, 100], [300002, 600], [300003, 3000]], "weapon": [[301001, 100], [301002, 600], [301003, 3000]]}


def zzz(ver, new_ids):
    print("ZZZ", ver)
    idx = get(f"{NANO}/zzz/{ver}/character.json")
    w_idx = get(f"{NANO}/zzz/{ver}/weapon.json")
    items_all = get(f"{NANO}/zzz/{ver}/en/item.json")
    chars, weapons, fails = {}, {}, 0
    for cid, info in idx.items():
        try:
            d = get(f"{NANO}/zzz/{ver}/en/character/{cid}.json")
        except Exception as e:
            fails += 1; print("  ! agent", cid, e); continue
        lvl = d.get("level") or {}
        asc = [pairs((lvl[k] or {}).get("materials") or {}) for k in sorted(lvl, key=lambda x: int(x))]
        skills = {}
        for sk, v in (d.get("skill") or {}).items():
            mat = (v or {}).get("material") or {}
            if mat:
                skills[sk] = {l: pairs(mat[l]) for l in sorted(mat, key=lambda x: int(x))}
        core = (d.get("passive") or {}).get("materials") or {}
        chars[cid] = {"n": clean(info.get("EN") or info.get("en") or info.get("name") or d.get("name")), "r": rarity_num(d.get("rarity") or info.get("rank")),
                      "type": info.get("type"), "el": info.get("element"), "exp": d.get("level_exp") or [], "asc": asc, "skills": skills,
                      "core": {l: pairs(core[l]) for l in sorted(core, key=lambda x: int(x))}, "new": int(cid) in new_ids}
        time.sleep(0.05)
    for wid, info in w_idx.items():
        try:
            d = get(f"{NANO}/zzz/{ver}/en/weapon/{wid}.json")
        except Exception as e:
            fails += 1; print("  ! w-engine", wid, e); continue
        asc = []
        for part in str(d.get("materials") or "").split("|"):
            p = [[int(a), int(b)] for a, b in (x.split(":") for x in part.split(",") if ":" in x)]
            if p:
                asc.append(p)
        lvl = d.get("level") or {}
        weapons[wid] = {"n": clean(info.get("EN") or info.get("en") or d.get("name")), "r": rarity_num(d.get("rarity") or info.get("rank")),
                        "type": info.get("type"), "exp": [(lvl[k] or {}).get("exp", 0) for k in sorted(lvl, key=lambda x: int(x))], "asc": asc}
        time.sleep(0.05)
    used = {10} | {b[0] for v in ZZZ_BOOKS.values() for b in v}
    ids_in([c["asc"] for c in chars.values()] + [w["asc"] for w in weapons.values()], used)
    for c in chars.values():
        ids_in(list(c["core"].values()), used)
        for s in c["skills"].values():
            ids_in(list(s.values()), used)
    items, bases = {}, {}
    for i in sorted(used):
        it = items_all.get(str(i)) or {}
        icon = os.path.splitext(os.path.basename(it.get("icon") or ""))[0]
        bases[str(i)] = icon
        items[str(i)] = {"n": clean(it.get("name")), "r": it.get("rank") or 0, "icon": (NANO + "/assets/zzz/" + icon + ".webp") if icon else ""}
    save_icons("nap", items, bases)
    print("  агентов %d, амплификаторов %d, предметов %d, ошибок %d" % (len(chars), len(weapons), len(items), fails))
    print("  без возвышений: %d, без навыков: %d, амплификаторов без возвышений: %d, предметов без названия: %d" % (
        sum(1 for c in chars.values() if not any(c["asc"])), sum(1 for c in chars.values() if not c["skills"]),
        sum(1 for w in weapons.values() if not w["asc"]), sum(1 for i in items.values() if not i["n"])))
    any_c = next(iter(idx.values()), {})
    print("  ключи списка агентов:", list(any_c)[:12] if isinstance(any_c, dict) else type(any_c).__name__)
    any_w = next(iter(w_idx.values()), {})
    print("  ключи списка амплификаторов:", list(any_w)[:12] if isinstance(any_w, dict) else type(any_w).__name__)
    print("  типы агентов:", sorted(set(str(c["type"]) for c in chars.values())), "типы амплификаторов:", sorted(set(str(w["type"]) for w in weapons.values())))
    if "14164" in weapons:
        e = weapons["14164"]["exp"]
        print("  опыт амплификатора 14164: уровней %d, первые %s, последние %s, сумма %d" % (len(e), e[:3], e[-3:], sum(e)))
    if "1641" in chars:
        c = chars["1641"]
        print("  пример 1641: %s, r%s, уровней опыта %d (сумма %d), возвышений %d, навыков %s, ядро %d" % (
            c["n"], c["r"], len(c["exp"]), sum(c["exp"]), len(c["asc"]), ",".join(c["skills"]), len(c["core"])))
        print("  1641: пустые возвышения %s, ключи навыка basic %s, ключи ядра %s, пустые: %s" % (
            [i for i, x in enumerate(c["asc"]) if not x], list(c["skills"].get("basic", {})), list(c["core"]),
            [k for k, v in c["core"].items() if not v]))
    return {"ver": ver, "books": ZZZ_BOOKS, "chars": chars, "weapons": weapons, "items": items}


def main():
    man = get(NANO + "/manifest.json")
    games = sys.argv[1:] or ["hkrpg", "nap"]
    for g in games:
        try:
            if g == "hkrpg":
                res = hsr(man["hsr"]["latest"])
            else:
                res = zzz(man["zzz"]["latest"], set((man["zzz"].get("new") or {}).get("character") or []))
            if g == "hkrpg":
                new = set((man["hsr"].get("new") or {}).get("character") or [])
                for cid, c in res["chars"].items():
                    c["new"] = int(cid) in new
            with open(os.path.join(DATA, "cost_%s.json" % g), "w", encoding="utf-8") as f:
                json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
        except Exception as e:
            print("  ! %s: %s" % (g, e))


if __name__ == "__main__":
    main()
