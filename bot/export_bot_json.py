#!/usr/bin/env python3
"""Експорт даних для бота @lexa_praktyka_bot.

Бере позиції ВС із уже зібраного index.html (вбудований <script id="data">)
і пише поряд компактний bot.json, який бот завантажує з GitHub Pages.

Запуск після build_lexa.py:
    python3 export_bot_json.py path/to/index.html            # bot.json поряд з index.html
    python3 export_bot_json.py path/to/index.html out.json   # або у вказаний файл

Щоб робити це автоматично, наприкінці build_lexa.py досить викликати
export(index_path) з цього модуля.
"""
import json
import re
import sys
from pathlib import Path


def load_data(index_path: Path) -> dict:
    html = index_path.read_text(encoding="utf-8")
    m = re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        raise SystemExit(f"{index_path}: не знайдено блок <script id=\"data\">")
    return json.loads(m.group(1))


def compact(p: dict) -> dict:
    """Лише поля, потрібні боту для пошуку й картки."""
    return {
        "i": p["i"],                      # номер позиції в базі правових позицій ВС
        "t": p.get("t") or "",           # офіційний заголовок
        "h": p.get("h") or "",           # теза бази LEX_A
        "x": p.get("x") or "",           # текст позиції ВС
        "c": p.get("c") or "ККС",        # ККС / ВП
        "m": p.get("m"),                 # modified / indented / None
        "a": p.get("a"),                 # дата додавання до бази
        "d": [d[:4] for d in (p.get("d") or [])],  # [вид, дата, справа, id ЄДРСР]
        "r": p.get("r") or [],           # статті-теги
        "k": p.get("k") or [],           # інші номери справ
    }


# Розділи «Покарання» для рубрики каналу «Цифра дня»: ключ у даних застосунку → чиї це вироки
FACT_KINDS = {"g": "sbu", "gv": "nabu", "gd": "dbr", "gb": "beb", "gn": "police"}
FACT_MIN = 15  # частини статей з меншою кількістю вироків у «Цифру дня» не беремо
# тут у базі не всі вироки, а вибірка останніх: у пості це сказано прямо
FACT_SAMPLE = {("gn", None), ("gd", "402"), ("gd", "407")}


def facts(data: dict) -> list:
    """Заготовки для «Цифри дня»: по одній на частину статті — скільки обвинувальних вироків першої інстанції,
    найчастіші покарання, частка заочних, ст. 75, угод, ст. 69 і результат апеляції. Лише підрахунок наявних даних."""
    out = []
    for key, kind in FACT_KINDS.items():
        G = data.get(key)
        if not G or not G.get("arts"):
            continue
        V, AP = G["V"], G.get("ap") or {}
        for art, A in G["arts"].items():
            for part, P in (A.get("parts") or {}).items():
                rows = P.get("r") or []
                if len(rows) < FACT_MIN or part == "без частини":
                    continue
                vids = list(dict.fromkeys(r[0] for r in rows))
                cnt = {}
                for r in rows:
                    lab = P["labels"][r[1]]
                    cnt[lab] = cnt.get(lab, 0) + 1
                top = sorted(((l, c) for l, c in cnt.items() if l != "строк не розпізнано"), key=lambda x: -x[1])[:3]
                fl = lambda bit: sum(1 for v in vids if V[v][4] & bit)
                ap = [AP[str(v)][0] for v in vids if str(v) in AP]
                known = [c for c in ap if c <= 6]
                out.append({
                    "id": f"{key}|{art}|{part}", "k": kind, "a": art, "p": part, "n": len(vids),
                    "top": [[l, c] for l, c in top],
                    "za": fl(1), "s75": fl(2), "ug": fl(4), "s69": fl(8),
                    "apk": len(known), "apu": known.count(0), "apc": known.count(1),
                    "from": G.get("from"), "cut": G.get("cut"),
                    "sample": (key, None) in FACT_SAMPLE or (key, art) in FACT_SAMPLE,
                })
    # чергуємо органи, у межах органу — від найбільших вибірок: щоб канал не тиждень поспіль писав про одну статтю
    by = {}
    for f in sorted(out, key=lambda f: -f["n"]):
        by.setdefault(f["k"], []).append(f)
    mixed, i = [], 0
    while any(by.values()):
        for k in list(by):
            if by[k]:
                mixed.append(by[k].pop(0))
    return mixed


def export(index_path, out_path=None) -> Path:
    index_path = Path(index_path)
    out_path = Path(out_path) if out_path else index_path.with_name("bot.json")
    data = load_data(index_path)
    # o — карта бази «справа → позиції, пов'язані з відступом від висновку в ній» (для перевірки посилань у боті)
    payload = {"v": 1, "e": data.get("e"), "p": [compact(p) for p in data["p"]], "o": data.get("o") or {},
               # ref — передачі на ОП ККС / ВП ВС (для попереджень у перевірці посилань)
               "ref": data.get("ref") or [],
               # f — заготовки «Цифри дня» для каналу (підрахунок з розділів «Покарання»)
               "f": facts(data)}
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    out = export(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(f"{out}: {out.stat().st_size // 1024} КБ")
