#!/usr/bin/env python3
"""Збирання застосунку LEX_K з репозиторію — єдиного джерела коду.

Код застосунку живе лише тут:
    src/app.js           — скрипт застосунку (усі екрани, логіка, версія для комп'ютера)
    src/shell.html       — розмітка й стилі; місця для даних і скрипту позначено
                           <!--LEXK:DATA--> та <!--LEXK:APP-->
    src/pages-head.html  — шапка сторінки для GitHub Pages (Telegram Web App SDK)
Дані — окремо:
    data.json            — усе, що вбудовується в <script id="data"> (дає конвеєр бази знань)
    data/referrals.json  — передачі кримінальних справ на ОП ККС / ВП ВС; ведеться в репозиторії,
                           при збиранні додається до даних як поле ref

Команди (запускати з кореня репозиторію):
    python3 tools/build.py
        зібрати index.html (GitHub Pages / Telegram), dist/lexk-artifact.html
        (для публікації артефакту LEX_K) і bot.json (дані бота).

    python3 tools/build.py --data-from ЗІБРАНИЙ.html
        узяти з будь-якої зібраної копії застосунку (наприклад, після build_lexa.py
        у базі знань) ЛИШЕ дані, а код лишити з src/. Якщо код у тій копії
        відрізняється від src/, скрипт пише різницю в dist/code-diff.txt і
        зупиняється: перенесіть потрібні зміни коду в src/ і запустіть ще раз
        (або додайте --force, щоб свідомо відкинути код тієї копії).

    python3 tools/build.py --check
        перевірити, що index.html у репозиторії зібрано з поточних src/ і data.json
        (код виходу 1, якщо ні).
"""
import argparse
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
DATA_RE = re.compile(r'<script id="data" type="application/json">(.*?)</script>', re.S)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


ART_RE = re.compile(r"[Сс]т\.\s*(\d+(?:-\d+)?)")
CODE_RE = re.compile(r"\b(КК|КПК|ЦК)\b|Закону|Конституції")


def ref_articles(issue: str, extra: list) -> list:
    """Статті питання у вигляді «96-1 КК»: з тексту (ст. N ... КК/КПК у межах 40 знаків) і з поля art."""
    out = []
    for m in ART_RE.finditer(issue):
        c = CODE_RE.search(issue, m.end(), m.end() + 40)
        if c and c.group(1):
            out.append(m.group(1) + " " + c.group(1))
    out += [re.sub(r"^ст\.\s*", "", a) for a in extra]
    return sorted(set(out))


def with_extras(data: str) -> str:
    """Додає до даних те, що ведеться в репозиторії: передачі на ОП/ВП (data/referrals.json → ref)."""
    ref = ROOT / "data" / "referrals.json"
    if not ref.exists():
        return data
    d = json.loads(data)
    r = json.loads(read(ref))
    items = []
    for it in r["items"]:
        it = dict(it)
        it["a"] = ref_articles(it.get("issue", ""), it.pop("art", []))
        items.append(it)
    d["ref"], d["refUpdated"] = items, r.get("updated", "")
    return json.dumps(d, ensure_ascii=False, separators=(",", ":"))


def assemble(data: str) -> tuple[str, str]:
    """Повертає (index.html для Pages, фрагмент для артефакту)."""
    data = with_extras(data)
    shell, app = read(SRC / "shell.html"), read(SRC / "app.js")
    for mark in ("<!--LEXK:DATA-->", "<!--LEXK:APP-->"):
        if shell.count(mark) != 1:
            raise SystemExit(f"src/shell.html: позначка {mark} має бути рівно один раз")
    if "</script" in app:
        raise SystemExit("src/app.js: у коді не може бути рядка </script")
    body = shell.replace("<!--LEXK:DATA-->", data).replace("<!--LEXK:APP-->", app)
    pages = read(SRC / "pages-head.html").rstrip("\n") + "\n" + body.rstrip("\n") + "\n</body></html>\n"
    return pages, body


def split_html(html: str) -> tuple[str, str, str]:
    """Розкладає зібрану копію на (дані, код скрипту, розмітку без даних і скрипту)."""
    m = DATA_RE.search(html)
    if not m:
        raise SystemExit("у файлі немає блоку <script id=\"data\">")
    data = m.group(1)
    rest = html[m.end():]
    s0, s1 = rest.find("<script>"), rest.rfind("</script>")
    app = rest[s0 + len("<script>"):s1] if s0 >= 0 and s1 > s0 else ""
    # розмітка — від <title> (без обгортки публікації артефакту) до блоку даних
    pre = html[:m.start()]
    t = pre.find("<title>")
    return data, app, pre[t:] if t >= 0 else pre


def check_data(data: str) -> dict:
    try:
        d = json.loads(data)
    except json.JSONDecodeError as e:
        raise SystemExit(f"дані не є коректним JSON: {e}")
    if not isinstance(d, dict) or "p" not in d:
        raise SystemExit("у даних немає позицій (ключ \"p\") — це не дані LEX_K")
    return d


def write_outputs(data: str) -> None:
    d = check_data(data)
    pages, body = assemble(data)
    (ROOT / "index.html").write_text(pages, encoding="utf-8")
    DIST.mkdir(exist_ok=True)
    (DIST / "lexk-artifact.html").write_text(body, encoding="utf-8")
    sys.path.insert(0, str(ROOT / "bot"))
    from export_bot_json import export  # noqa: E402
    bot = export(ROOT / "index.html", ROOT / "bot.json")
    sys.path.insert(0, str(ROOT / "tools"))
    from cards import update as update_cards  # noqa: E402
    cards_note = update_cards(bot)
    print(f"index.html: {len(pages) // 1024} КБ · dist/lexk-artifact.html · {bot.name}: {bot.stat().st_size // 1024} КБ · позицій: {len(d['p'])}")
    print(cards_note)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-from", metavar="HTML", help="узяти дані з цієї зібраної копії, код лишити з src/")
    ap.add_argument("--force", action="store_true", help="з --data-from: відкинути код тієї копії, навіть якщо він відрізняється")
    ap.add_argument("--check", action="store_true", help="перевірити, що index.html зібрано з src/ і data.json")
    a = ap.parse_args()

    if a.check:
        pages, _ = assemble(read(ROOT / "data.json"))
        ok = read(ROOT / "index.html") == pages
        print("index.html зібрано з src/ і data.json" if ok else "index.html НЕ відповідає src/ і data.json: запустіть python3 tools/build.py")
        return 0 if ok else 1

    if a.data_from:
        html = read(Path(a.data_from))
        data, app, markup = split_html(html)
        check_data(data)
        cur_app = read(SRC / "app.js")
        cur_markup = read(SRC / "shell.html").split('<script id="data"')[0]
        diffs = []
        if app.strip() != cur_app.strip():
            diffs += list(difflib.unified_diff(cur_app.splitlines(), app.splitlines(), "src/app.js", a.data_from + " (скрипт)", lineterm="", n=1))
        if markup.strip() != cur_markup.strip():
            diffs += list(difflib.unified_diff(cur_markup.splitlines(), markup.splitlines(), "src/shell.html", a.data_from + " (розмітка)", lineterm="", n=1))
        if diffs:
            DIST.mkdir(exist_ok=True)
            (DIST / "code-diff.txt").write_text("\n".join(diffs) + "\n", encoding="utf-8")
            only_there = sum(1 for l in diffs if l.startswith("+") and not l.startswith("+++"))
            only_repo = sum(1 for l in diffs if l.startswith("-") and not l.startswith("---"))
            print(f"Код у {a.data_from} відрізняється від src/: рядків лише там — {only_there}, лише в репозиторії — {only_repo}. Різниця: dist/code-diff.txt")
            if not a.force:
                print("Нічого не змінено. Перенесіть потрібні зміни коду в src/ і запустіть ще раз, або додайте --force, щоб узяти лише дані.")
                return 2
            print("--force: беру лише дані, код лишаю з src/.")
        (ROOT / "data.json").write_text(data, encoding="utf-8")

    write_outputs(read(ROOT / "data.json"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
