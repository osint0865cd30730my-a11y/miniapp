#!/usr/bin/env python3
"""Картинки «Цифри дня» для каналу LEX_K.

Для кожної заготовки з поля f у bot.json малює картку 1080×1080 (шаблон tools/card.html)
у cards/<назва>.jpg і дописує до заготовки поле img («cards/...jpg?v=<хеш>»), за яким бот
бере картинку з GitHub Pages. Варіанти чергуються за порядком заготовок: парні — «стовпчики» (a),
непарні — «плитки» (c); канал публікує їх по черзі, тож і картки в стрічці чергуються.

Перемальовуються лише картки, дані яких змінилися (хеш у назві параметра v), застарілі файли
видаляються. Потрібен Playwright з Chromium; якщо його немає, лишаються наявні картки з
незміненими даними, а решта заготовок іде в канал без картинки (бот надішле текст).

Запуск: викликається з tools/build.py; окремо — python3 tools/cards.py
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "tools" / "card.html"
OUT = ROOT / "cards"
FIELDS = ("k", "a", "p", "n", "top", "za", "s75", "ug", "s69", "apk", "apu", "apc", "from", "cut", "sample")


def slug(fid: str) -> str:
    s = fid.replace("ч. ", "p").replace("|", "-")
    return re.sub(r"[^0-9A-Za-z.-]+", "_", s).strip("_")


def card_hash(f: dict, variant: str, tpl: str) -> str:
    raw = json.dumps([variant, {k: f.get(k) for k in FIELDS}, tpl], ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]


def update(bot_json: Path = ROOT / "bot.json") -> str:
    bot = json.loads(bot_json.read_text(encoding="utf-8"))
    facts = bot.get("f") or []
    tpl = TEMPLATE.read_text(encoding="utf-8")
    OUT.mkdir(exist_ok=True)
    plan = []
    for i, f in enumerate(facts):
        variant = "a" if i % 2 == 0 else "c"
        name = slug(f["id"]) + ".jpg"
        h = card_hash(f, variant, tpl)
        plan.append((f, variant, name, h))
    # що вже намальовано: cards/index.json — назва файлу → хеш
    idx_path = OUT / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {}
    todo = [p for p in plan if idx.get(p[2]) != p[3] or not (OUT / p[2]).exists()]
    drawn, note = 0, ""
    if todo:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            sync_playwright = None
            note = "Playwright не встановлено"
        if sync_playwright:
            with sync_playwright() as pw:
                br = pw.chromium.launch()
                page = br.new_page(viewport={"width": 1080, "height": 1080})
                page.goto(TEMPLATE.as_uri())
                for f, variant, name, h in todo:
                    page.evaluate("([f, v]) => window.render(f, v)", [f, variant])
                    page.locator("#card").screenshot(path=str(OUT / name), type="jpeg", quality=86)
                    idx[name] = h
                    drawn += 1
                br.close()
    ready = 0
    for f, variant, name, h in plan:
        if idx.get(name) == h and (OUT / name).exists():
            f["img"] = f"cards/{name}?v={h}"
            ready += 1
        else:
            f.pop("img", None)
    keep = {p[2] for p in plan}
    for old in OUT.glob("*.jpg"):
        if old.name not in keep:
            old.unlink()
    idx = {k: v for k, v in idx.items() if k in keep}
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    bot_json.write_text(json.dumps(bot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    msg = f"картки «Цифри дня»: готово {ready} з {len(plan)}, перемальовано {drawn}"
    if ready < len(plan):
        msg += f" ({note or 'не всі намальовано'}: без картки підуть {len(plan) - ready})"
    return msg


if __name__ == "__main__":
    print(update(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "bot.json"))
