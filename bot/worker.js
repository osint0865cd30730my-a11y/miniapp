/**
 * @lexa_praktyka_bot — пошук правових позицій ВС у чаті та inline-режим.
 * Cloudflare Worker (модульний синтаксис).
 *
 * Змінні оточення (Settings → Variables):
 *   BOT_TOKEN       секрет: токен від BotFather (єдине обов'язкове)
 *   WEBHOOK_SECRET  необов'язково; без нього секрет вебхука виводиться з токена
 *   DATA_URL        необов'язково; за замовчуванням bot.json поряд із застосунком
 *
 * Маршрути:
 *   POST /webhook          оновлення від Telegram (перевіряється секретний заголовок)
 *   GET  /setup            підключає вебхук до цього воркера й задає команди
 *   GET  /                 перевірка, що воркер живий
 */

const APP_BASE = "https://osint0865cd30730my-a11y.github.io/miniapp/";
const APP_VERSION = "2"; // збільшувати після великих оновлень, щоб Telegram не показував стару копію
const APP_URL = APP_BASE + "?v=" + APP_VERSION;
const APP_LINK = "https://t.me/lexa_praktyka_bot/praktyka";
const COVER_URL = APP_BASE + "cover.png";
const THUMB_URL = APP_BASE + "thumb.png"; // знак «L.» у списку inline-результатів
const DEFAULT_DATA_URL = APP_BASE + "bot.json";
const EDRSR = "https://reyestr.court.gov.ua/Review/";
const CHAT_PAGE = 5;
const INLINE_PAGE = 20;

/* ---------- дані ---------- */

let DATA = null;          // { e, p: [...] } з підготовленими полями
let DATA_AT = 0;
const DATA_TTL = 60 * 60 * 1000;

async function loadData(env) {
  if (DATA && Date.now() - DATA_AT < DATA_TTL) return DATA;
  const url = env.DATA_URL || DEFAULT_DATA_URL;
  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) {
    if (DATA) return DATA; // лишаємо старі дані, якщо Pages тимчасово недоступні
    throw new Error("bot.json: HTTP " + res.status);
  }
  const raw = await res.json();
  for (const p of raw.p) prepare(p);
  DATA = raw;
  DATA_AT = Date.now();
  return DATA;
}

const norm = s => String(s || "")
  .toLowerCase()
  .replace(/[’ʼ`']/g, "'")
  .replace(/ё/g, "е")
  .replace(/\s+/g, " ");

function prepare(p) {
  const cases = p.d.map(d => d[2]).concat(p.k || []).filter(Boolean);
  p._head = norm(p.h + " " + p.t);
  p._text = norm(p.h + " " + p.t + " " + p.x); // без тегів: для текстових згадок статей
  p._all = norm(p.h + " " + p.t + " " + p.x + " " + p.r.join(" ") + " " + cases.join(" "));
  p._cases = cases.map(caseKey);
  // статті-теги: "ст. 111-1 КК" → {n:"111-1", code:"кк"}
  p._arts = p.r.map(a => {
    const m = a.match(/ст\.\s*([\d]+(?:-\d+)?)\s*(КК|КПК)/i);
    return m ? { n: m[1], code: m[2].toLowerCase() } : null;
  }).filter(Boolean);
  const d0 = p.d[0] || [];
  p._date = d0[1] || p.a || "";
}

const caseKey = c => String(c).toLowerCase().replace(/\s+/g, "").replace(/-к$/, "");

/* ---------- розбір запиту ---------- */

const STOP = new Set(["ст", "ст.", "стаття", "статті", "статтю", "статтею", "ч", "ч.", "частина",
  "частини", "частиною", "п", "п.", "пункт", "кк", "кпк", "україни", "і", "й", "та", "в", "у",
  "на", "до", "з", "із", "за", "про", "що", "щодо", "як", "чи", "або", "не", "для", "від", "по"]);

function parseQuery(q) {
  const text = norm(q).trim();
  const out = { text, cases: [], ids: [], arts: [], code: null, words: [] };
  // \b у JavaScript не бачить меж кириличних слів, тому межі задаємо явно
  if (/(?:^|[^а-яіїєґa-z])кпк(?![а-яіїєґa-z])/.test(text)) out.code = "кпк";
  else if (/(?:^|[^а-яіїєґa-z])кк(?![а-яіїєґa-z])/.test(text)) out.code = "кк";

  let rest = text;
  // номери справ: 757/29843/19-к
  rest = rest.replace(/\d{1,4}\/\d{1,6}\/\d{2}(?:-к)?/g, m => { out.cases.push(caseKey(m)); return " "; });
  // "ч. 2 ст. 111" і "ст. 111 ч. 2" / "111 ч.2" / "ст 438"
  rest = rest.replace(/(?:ч\.?|частин\S*)\s*(\d+)\s*(?:ст\.?|статт\S*)\s*(\d{1,3}(?:-\d+)?)/g,
    (_, part, n) => { out.arts.push({ n, part }); return " "; });
  // «ПП 15734» — номер позиції в базі правових позицій ВС
  rest = rest.replace(/(?:^|[\s,;(])пп\.?\s*(\d{3,6})(?!\d)/g, (_, id) => { out.ids.push(+id); return " "; });
  // «п. 4» — пункт: окремо не шукаємо, щоб «4» не стало статтею
  rest = rest.replace(/(?:^|[\s,;(])(?:п\.|пункт\S*)\s*\d+/g, " ");
  const CODE = "(?:\\s*(?:кк|кпк)(?![а-яіїєґ]))?";
  const PART = "(?:\\s*(?:ч\\.?|частин\\S*)\\s*(\\d+))?";
  // «ст. 111-1 КК ч. 5», «статті 290 КПК»
  rest = rest.replace(new RegExp("(?:ст\\.?|статт\\S*)\\s*(\\d{1,3}(?:-\\d+)?)(?![\\d/])" + CODE + PART, "g"),
    (_, n, part) => { out.arts.push({ n, part: part || null }); return " "; });
  // «ч. 5» окремо від статті — частина до вже названої статті
  const orphan = [];
  rest = rest.replace(/(?:ч\.?|частин\S*)\s*(\d+)/g, (_, part) => { orphan.push(part); return " "; });
  // голе число з 1–3 цифр («438 командир», «111-1») — теж стаття
  rest = rest.replace(new RegExp("(?<![\\d/])(\\d{1,3}(?:-\\d+)?)(?![\\d/])" + CODE, "g"),
    (_, n) => { out.arts.push({ n, part: null }); return " "; });
  for (const part of orphan) {
    const a = out.arts.find(x => !x.part);
    if (a) a.part = part;
  }
  out.words = rest.split(/[\s,.;:!?()«»"]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP.has(w));
  return out;
}

// корінь слова для пошуку з відмінками: «командира» знаходить «командир»
const stem = w => (w.length > 6 ? w.slice(0, w.length - 2) : w.length > 4 ? w.slice(0, w.length - 1) : w);

// синоніми: як практики питають → як написано в позиціях
const SYN = [
  [/^заочн/, ["заочн", "in absentia", "спеціальн судов", "спеціальне судове", "спеціального судового"]],
  [/^держзрад/, ["держзрад", "державн зрад", "державна зрада", "державної зради"]],
  [/^колаборант|^колаборац/, ["колабора", "111-1"]],
  [/^нсрд$/, ["нсрд", "негласн"]],
  [/^мгп$/, ["мгп", "міжнародного гуманітарного"]],
];
function variants(word) {
  const s = stem(word);
  for (const [re, alts] of SYN) if (re.test(word)) return { word, alts };
  return { word, alts: [s] };
}
const has = (hay, v) => v.alts.some(a => hay.includes(a));

function artTextRe(n, code) {
  // «ст. 111», «ст.111», «статті 111», «111 КК» — але не «111-1» і не «1111»;
  // якщо в запиті названо кодекс, згадку з іншим кодексом («ст. 438 КПК» при запиті КК) не рахуємо
  const e = n.replace("-", "\\-");
  const other = code === "кк" ? "(?!\\s*кпк)" : code === "кпк" ? "(?!\\s*кк(?![а-яіїєґ]))" : "";
  const codes = code ? code : "(?:кк|кпк)";
  return new RegExp("(?:ст\\.?\\s*|статт\\S*\\s+)" + e + "(?![\\d-])" + other + "|(?<![\\d-])" + e + "(?![\\d-])\\s*" + codes, "i");
}
function partTextRe(n, part) {
  const e = n.replace("-", "\\-");
  return new RegExp("ч\\.?\\s*" + part + "\\s*ст\\.?\\s*" + e + "(?![\\d-])|ст\\.?\\s*" + e + "(?![\\d-])\\s*ч\\.?\\s*" + part + "(?!\\d)", "i");
}

/* ---------- пошук ---------- */

function search(data, q) {
  const pq = parseQuery(q);
  if (pq.ids.length) {
    return { pq, list: data.p.filter(p => pq.ids.includes(p.i)) };
  }
  if (!pq.cases.length && !pq.arts.length && !pq.words.length) return { pq, list: [] };

  const artRes = pq.arts.map(a => ({ ...a, re: artTextRe(a.n, pq.code), pre: a.part ? partTextRe(a.n, a.part) : null }));
  const phrase = pq.words.length > 1 ? pq.words.join(" ") : null;
  let stems = pq.words.map(variants);
  const missing = [];

  const score = (p, strictWords) => {
    let s = 0;
    if (pq.cases.length) {
      if (!pq.cases.some(c => p._cases.includes(c))) return 0;
      s += 50;
    }
    for (const a of artRes) {
      const tagged = p._arts.some(t => t.n === a.n && (!pq.code || t.code === pq.code));
      const inText = a.re.test(p._text);
      if (!tagged && !inText) return 0;
      s += tagged ? 12 : 6;
      if (a.pre) s += a.pre.test(p._text) ? 6 : 0;
    }
    let hits = 0;
    for (const v of stems) {
      if (has(p._head, v)) { s += 4; hits++; }
      else if (has(p._all, v)) { s += 2; hits++; }
    }
    if (stems.length && strictWords && hits < stems.length) return 0;
    if (stems.length && !hits) return 0;
    if (phrase) s += p._head.includes(phrase) ? 6 : p._all.includes(phrase) ? 3 : 0;
    if (p.c === "ВП") s += 1;
    return s;
  };

  let list = rank(data.p, p => score(p, true));
  let relaxed = false;
  if (!list.length && stems.length > 1) {
    // Пробуємо без слів, яких у базі немає взагалі, — але лише якщо решта слів не надто загальні.
    const df = v => data.p.reduce((n, p) => n + (has(p._all, v) ? 1 : 0), 0);
    const known = [];
    for (const v of stems) (df(v) ? known : missing).push(v);
    const common = data.p.length * 0.2;
    if (missing.length && known.length && known.some(v => df(v) <= common)) {
      stems = known;
      list = rank(data.p, p => score(p, true));
      relaxed = list.length > 0;
    }
  }
  return { pq, list, relaxed, missing: missing.map(v => v.word) };
}

function rank(items, fn) {
  const out = [];
  for (const p of items) { const s = fn(p); if (s > 0) out.push([s, p]); }
  out.sort((a, b) => b[0] - a[0] || (b[1]._date > a[1]._date ? 1 : b[1]._date < a[1]._date ? -1 : 0));
  return out.map(x => x[1]);
}

/* ---------- оформлення ---------- */

const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fd = iso => (iso ? iso.split("-").reverse().join(".") : "");
const court = p => (p.c === "ВП" ? "Велика Палата ВС" : "ККС ВС");
function cut(t, n) {
  t = String(t || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const sp = t.lastIndexOf(" ", n);
  return t.slice(0, sp > n * 0.6 ? sp : n) + "…";
}
function meta(p) {
  const d = p.d[0] || [];
  return [court(p), d[1] && fd(d[1]), d[2] && "справа № " + d[2]].filter(Boolean).join(" · ");
}
const mark = p => (p.m === "indented" ? "З відступом від попередньої практики. " : p.m === "modified" ? "Позицію згодом змінено. " : "");
const edrsr = p => { const d = (p.d[0] || [])[3]; return d ? EDRSR + d : null; };
const appUrlFor = p => APP_URL + "#pos-" + p.i;           // для кнопки web_app у чаті з ботом
const appLinkFor = p => APP_LINK + "?startapp=pos-" + p.i; // для посилань в інших чатах

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
}

function chatAnswer(q, res, offset) {
  const { list, relaxed, missing = [] } = res;
  const missNote = missing.length
    ? (missing.length === 1 ? "Слова «" + esc(missing[0]) + "» в базі немає." : "Слів «" + esc(missing.join("», «")) + "» в базі немає.")
    : "";
  if (!list.length) {
    return {
      text: (missNote ? missNote + " " : "") + "За запитом «" + esc(q) + "» позицій у базі немає. Це не означає, що їх немає в практиці ВС: " +
        "перевірте в ЄДРСР або змініть запит.\n\nПриклади: <code>ст. 111-1 ч. 5</code>, <code>обшук без ухвали</code>, " +
        "<code>757/29843/19-к</code>.",
      markup: { inline_keyboard: [[{ text: "Відкрити застосунок", web_app: { url: APP_URL } }]] },
    };
  }
  const page = list.slice(offset, offset + CHAT_PAGE);
  const n = list.length;
  let head = "<b>" + n + " " + plural(n, "позиція", "позиції", "позицій") + "</b> за запитом «" + esc(q) + "»";
  if (relaxed) head += "\n<i>" + missNote + " Показано позиції за рештою запиту.</i>";
  if (offset) head += "\n<i>" + (offset + 1) + "–" + (offset + page.length) + "</i>";
  const items = page.map((p, k) =>
    "<b>" + (offset + k + 1) + ".</b> " + esc(cut(p.h || p.t, 420)) + "\n<i>" + esc(mark(p) + meta(p)) + "</i>");
  let text = head + "\n\n" + items.join("\n\n");
  if (text.length > 4000) text = text.slice(0, 3990) + "…";

  const kb = [];
  const links = page.map((p, k) => edrsr(p) && { text: (offset + k + 1) + " · ЄДРСР ↗", url: edrsr(p) }).filter(Boolean);
  for (let i = 0; i < links.length; i += 3) kb.push(links.slice(i, i + 3));
  const nav = [];
  if (offset + CHAT_PAGE < n) {
    const cb = "more:" + (offset + CHAT_PAGE) + ":" + q;
    if (new TextEncoder().encode(cb).length <= 64) nav.push({ text: "Наступні " + Math.min(CHAT_PAGE, n - offset - CHAT_PAGE) + " ›", callback_data: cb });
  }
  nav.push({ text: "Відкрити в застосунку", web_app: { url: page.length === 1 ? appUrlFor(page[0]) : APP_URL } });
  kb.push(nav);
  return { text, markup: { inline_keyboard: kb } };
}

function inlineCard(p) {
  const url = edrsr(p);
  const body =
    "<b>Позиція " + esc(court(p)) + "</b>\n" +
    esc(cut(p.h || p.t, 700)) + "\n\n" +
    "<blockquote expandable>" + esc(cut(p.x, 2400)) + "</blockquote>\n" +
    "<i>" + esc(mark(p) + meta(p)) + "</i>" +
    (url ? "\n<a href=\"" + url + "\">Рішення в ЄДРСР</a>" : "");
  const buttons = [];
  if (url) buttons.push({ text: "ЄДРСР ↗", url });
  buttons.push({ text: "LEX_A", url: appLinkFor(p) });
  return {
    type: "article",
    id: String(p.i),
    title: cut(p.h || p.t, 120),
    description: meta(p),
    thumbnail_url: THUMB_URL,
    thumbnail_width: 160,
    thumbnail_height: 160,
    input_message_content: { message_text: body, parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [buttons] },
  };
}

const WELCOME =
  "<b>LEX_A · Практика Верховного Суду</b>\n\n" +
  "Правові позиції ККС і Великої Палати ВС з короткими тезами, практика покарань за статтями й областями, " +
  "питання досудового розслідування.\n\n" +
  "<b>Шукайте прямо тут</b> — напишіть статтю, слова або номер справи:\n" +
  "<code>ст. 111-1 ч. 5</code> · <code>обшук без ухвали</code> · <code>757/29843/19-к</code>\n\n" +
  "<b>Надсилайте колегам</b> — в будь-якому чаті наберіть <code>@lexa_praktyka_bot</code> і запит.\n\n" +
  "Повна база — у застосунку.";

const HELP =
  "<b>Як шукати</b>\n\n" +
  "<b>Стаття і частина:</b> <code>ст. 111 ч. 2</code>, <code>ч. 5 ст. 111-1</code>, <code>ст. 290 КПК</code>\n" +
  "<b>Слова:</b> <code>обшук без ухвали</code>, <code>заочне провадження</code>, <code>438 командир</code>\n" +
  "<b>Номер справи:</b> <code>757/29843/19-к</code>\n" +
  "<b>Номер позиції:</b> <code>ПП 15734</code>\n\n" +
  "Якщо назвати КК чи КПК, бот не плутатиме однакові номери статей.\n\n" +
  "<b>В іншому чаті:</b> <code>@lexa_praktyka_bot</code> + запит → оберіть позицію, і вона вставиться карткою з посиланням на ЄДРСР.";

const NON_TEXT =
  "Я шукаю позиції Верховного Суду за текстом. Напишіть статтю, слова або номер справи, наприклад <code>ст. 111-1 ч. 5</code>.";

const startKeyboard = () => ({
  inline_keyboard: [
    [{ text: "Відкрити LEX_A", web_app: { url: APP_URL } }],
    [{ text: "Як шукати", callback_data: "help" },
     { text: "Надіслати колезі", switch_inline_query: "" }],
  ],
});

/* ---------- Telegram ---------- */

async function tg(env, method, body) {
  const res = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) console.log("tg " + method + " failed: " + JSON.stringify(j).slice(0, 300));
  return j;
}

// Секрет вебхука: окремий WEBHOOK_SECRET, якщо задано, інакше виводиться з токена (SHA-256).
async function hookSecret(env) {
  if (env.WEBHOOK_SECRET) return env.WEBHOOK_SECRET;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lexa-webhook:" + env.BOT_TOKEN));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

async function sendWelcome(env, chatId) {
  const r = await tg(env, "sendPhoto", {
    chat_id: chatId, photo: COVER_URL, caption: WELCOME, parse_mode: "HTML", reply_markup: startKeyboard(),
  });
  if (r.ok) return r;
  // якщо обкладинку не вдалося надіслати — те саме текстом
  return tg(env, "sendMessage", { chat_id: chatId, text: WELCOME, parse_mode: "HTML", reply_markup: startKeyboard() });
}

const sendHelp = (env, chatId) => tg(env, "sendMessage", {
  chat_id: chatId, text: HELP, parse_mode: "HTML",
  reply_markup: { inline_keyboard: [[{ text: "Спробувати: ст. 111-1", switch_inline_query_current_chat: "ст. 111-1" }],
    [{ text: "Відкрити LEX_A", web_app: { url: APP_URL } }]] },
});

async function onMessage(env, msg) {
  if (msg.chat.type !== "private") return; // у групах працює лише inline-режим
  if (!msg.text) {
    return tg(env, "sendMessage", { chat_id: msg.chat.id, text: NON_TEXT, parse_mode: "HTML" });
  }
  const text = msg.text.trim();
  if (/^\/start\b/.test(text)) return sendWelcome(env, msg.chat.id);
  if (/^\/help\b/.test(text)) return sendHelp(env, msg.chat.id);
  if (text.startsWith("/")) return sendHelp(env, msg.chat.id);
  await tg(env, "sendChatAction", { chat_id: msg.chat.id, action: "typing" });
  const data = await loadData(env);
  const q = text.slice(0, 120);
  const a = chatAnswer(q, search(data, q), 0);
  return tg(env, "sendMessage", {
    chat_id: msg.chat.id, text: a.text, parse_mode: "HTML",
    link_preview_options: { is_disabled: true }, reply_markup: a.markup,
  });
}

async function onCallback(env, cq) {
  if (cq.data === "help" && cq.message) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
    return sendHelp(env, cq.message.chat.id);
  }
  const m = /^more:(\d+):(.*)$/s.exec(cq.data || "");
  if (!m || !cq.message) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  const data = await loadData(env);
  const offset = +m[1], q = m[2];
  const a = chatAnswer(q, search(data, q), offset);
  await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  return tg(env, "sendMessage", {
    chat_id: cq.message.chat.id, text: a.text, parse_mode: "HTML",
    link_preview_options: { is_disabled: true }, reply_markup: a.markup,
  });
}

async function onInline(env, iq) {
  const data = await loadData(env);
  const q = (iq.query || "").trim().slice(0, 120);
  const offset = parseInt(iq.offset || "0", 10) || 0;
  let list;
  if (!q) {
    list = data.p.slice().sort((a, b) => (b.a || "").localeCompare(a.a || "")); // нещодавно додані
  } else {
    list = search(data, q).list;
  }
  const page = list.slice(offset, offset + INLINE_PAGE).map(inlineCard);
  const body = {
    inline_query_id: iq.id,
    results: page,
    cache_time: 300,
    is_personal: false,
    next_offset: offset + INLINE_PAGE < list.length ? String(offset + INLINE_PAGE) : "",
  };
  if (q && !list.length) {
    body.button = { text: "Нічого не знайдено — відкрити LEX_A", web_app: { url: APP_URL } };
  }
  return tg(env, "answerInlineQuery", body);
}

/* ---------- вхід ---------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!env.BOT_TOKEN) return new Response("BOT_TOKEN не задано: додайте його в Settings → Variables and Secrets", { status: 500 });

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await hookSecret(env)) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      try {
        if (update.message) await onMessage(env, update.message);
        else if (update.inline_query) await onInline(env, update.inline_query);
        else if (update.callback_query) await onCallback(env, update.callback_query);
      } catch (e) {
        console.log("update failed: " + (e && e.stack || e));
      }
      return new Response("ok");
    }

    if (url.pathname === "/setup") {
      // Лише підключає вебхук до цього ж воркера й задає команди; повторний виклик нічого не ламає.
      const hook = await tg(env, "setWebhook", {
        url: url.origin + "/webhook",
        secret_token: await hookSecret(env),
        allowed_updates: ["message", "inline_query", "callback_query"],
      });
      const cmds = await tg(env, "setMyCommands", {
        commands: [
          { command: "start", description: "Про LEX_A" },
          { command: "help", description: "Як шукати позиції ВС" },
        ],
      });
      let dataInfo;
      try { const d = await loadData(env); dataInfo = d.p.length + " позицій, зріз " + d.e; }
      catch (e) { dataInfo = "дані не завантажено: " + e.message; }
      return Response.json({ webhook: hook.ok, commands: cmds.ok, data: dataInfo, error: hook.ok ? undefined : hook.description });
    }

    return new Response("LEX_A bot is running");
  },
};
