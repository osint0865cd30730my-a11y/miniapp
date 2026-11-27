# Картки Fabula 1080×1080 з tools/cards.json → cards/*.jpg
# Потрібен Playwright з Chromium: python3 tools/cards.py
import json, pathlib, html, asyncio, base64
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / 'tools/fonts'
E = html.escape

def face():
    out = []
    for sub, rng in (('cyrillic', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'), ('latin', 'U+0000-00FF,U+2000-206F,U+20AC,U+2212')):
        for w in (500, 700, 800):
            out.append(f"@font-face{{font-family:Manrope;font-weight:{w};src:url(data:font/woff2;base64,{base64.b64encode((FONTS / f'manrope-{sub}-{w}-normal.woff2').read_bytes()).decode()}) format('woff2');unicode-range:{rng}}}")
    return ''.join(out)

MARK = ('<svg viewBox="0 0 100 100" width="{s}" height="{s}"><defs><linearGradient id="g{s}" gradientUnits="userSpaceOnUse" x1="40" y1="14" x2="66" y2="86">'
        '<stop offset="0" stop-color="#FF5A4E"/><stop offset="1" stop-color="#F2E3C6"/></linearGradient></defs>'
        '<path d="M18 28 L32 14 L68 14 L76 22 L76 36 L44 36 L44 50 L64 50 L64 66 L44 66 L44 86 L18 86 Z" fill="url(#g{s})"/>'
        '<rect x="72" y="76" width="14" height="10" rx="2" fill="url(#g{s})"/></svg>')

def page(c):
    head = f'<div class="head">{E(c["head"])}</div>' if c.get('head') else ''
    hero = f'<div class="hero" style="font-size:{c.get("heroSize", 170)}px">{E(c["hero"])}</div>' if c.get('hero') else ''
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{face()}
*{{box-sizing:border-box;margin:0}}
body{{width:1080px;height:1080px;font-family:Manrope,sans-serif;color:#F4F6F4;
background:radial-gradient(ellipse 870px 640px at 0% 0%,rgba(255,90,78,.34),rgba(255,90,78,0) 70%),
radial-gradient(ellipse 760px 580px at 100% 100%,rgba(242,227,198,.15),rgba(242,227,198,0) 70%),#060706;
padding:76px;display:flex;flex-direction:column;justify-content:space-between}}
.top{{display:flex;align-items:center;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:22px;font-size:40px;font-weight:800;letter-spacing:-.01em}}
.rub{{font-size:28px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#FF8A80;background:rgba(255,90,78,.15);border:2px solid rgba(255,90,78,.38);padding:12px 26px;border-radius:999px}}
.mid{{display:flex;flex-direction:column;gap:26px}}
.label{{font-size:34px;font-weight:700;color:#A7AEA7}}
.head{{font-size:76px;font-weight:800;letter-spacing:-.02em;line-height:1.1}}
.hero{{font-weight:800;letter-spacing:-.03em;line-height:1;background:linear-gradient(180deg,#FF5A4E,#F2E3C6);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:6px}}
.sub{{font-size:40px;font-weight:600;color:#C9CFC9;line-height:1.35}}
.foot{{display:flex;justify-content:space-between;gap:24px;border-top:2px solid rgba(255,255,255,.1);padding-top:36px;font-size:32px;font-weight:700}}
.foot .l{{color:#F2E3C6}} .foot .r{{color:#A1A8A1;text-align:right;flex:none}}
</style></head><body>
<div class="top"><div class="brand">{MARK.format(s=58)}Fabula</div><div class="rub">{E(c["rub"])}</div></div>
<div class="mid"><div class="label">{E(c.get("label", ""))}</div>{head}{hero}<div class="sub">{E(c.get("sub", ""))}</div></div>
<div class="foot"><span class="l">{E(c.get("footL", ""))}</span><span class="r">{E(c.get("footR", ""))}</span></div>
</body></html>'''

async def main():
    cards = json.load(open(ROOT / 'tools/cards.json'))
    (ROOT / 'cards').mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome') if pathlib.Path('/usr/bin/google-chrome').exists() else await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1080})
        for name, c in cards.items():
            await pg.set_content(page(c))
            await pg.evaluate('document.fonts.ready')
            await pg.screenshot(path=str(ROOT / 'cards' / name), type='jpeg', quality=90)
            print('card', name)
        await b.close()

asyncio.run(main())
