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


def export(index_path, out_path=None) -> Path:
    index_path = Path(index_path)
    out_path = Path(out_path) if out_path else index_path.with_name("bot.json")
    data = load_data(index_path)
    # o — карта бази «справа → позиції, пов'язані з відступом від висновку в ній» (для перевірки посилань у боті)
    payload = {"v": 1, "e": data.get("e"), "p": [compact(p) for p in data["p"]], "o": data.get("o") or {}}
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    out = export(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(f"{out}: {out.stat().st_size // 1024} КБ")
