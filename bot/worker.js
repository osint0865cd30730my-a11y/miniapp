/**
 * @lexa_praktyka_bot — пошук правових позицій ВС у чаті та inline-режим.
 * Cloudflare Worker (модульний синтаксис).
 *
 * Змінні оточення (Settings → Variables):
 *   BOT_TOKEN       секрет: токен від BotFather
 *   WEBHOOK_SECRET  секрет: будь-який довгий випадковий рядок (A–Z, a–z, 0–9, _ і -)
 *   DATA_URL        необов'язково; за замовчуванням bot.json поряд із застосунком
 *
 * Маршрути:
 *   POST /webhook          оновлення від Telegram (перевіряється секретний заголовок)
 *   GET  /setup?key=...    реєструє вебхук і команди; key = WEBHOOK_SECRET
 *   GET  /                 перевірка, що воркер живий
 */

const APP_URL = "https://osint0865cd30730my-a11y.github.io/miniapp/";
const APP_LINK = "https://t.me/lexa_praktyka_bot/praktyka";
const DEFAULT_DATA_URL = APP_URL + "bot.json";
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
    input_message_content: { message_text: body, parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [buttons] },
  };
}

const HELP =
  "<b>LEX_A</b> шукає правові позиції Верховного Суду.\n\n" +
  "Напишіть статтю, слова або номер справи:\n" +
  "• <code>ст. 111-1 ч. 5</code>\n" +
  "• <code>обшук без ухвали</code>\n" +
  "• <code>ст. 290 КПК відкриття матеріалів</code>\n" +
  "• <code>757/29843/19-к</code>\n\n" +
  "В іншому чаті наберіть <code>@lexa_praktyka_bot</code> і запит, щоб надіслати позицію співрозмовнику.\n\n" +
  "Повна база, практика покарань і досудове розслідування — у застосунку: кнопка «Практика» зліва від поля вводу.";

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

async function onMessage(env, msg) {
  if (!msg.text || msg.chat.type !== "private") return;
  const text = msg.text.trim();
  if (/^\/(start|help)\b/.test(text)) {
    return tg(env, "sendMessage", {
      chat_id: msg.chat.id, text: HELP, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "Відкрити застосунок", web_app: { url: APP_URL } }],
        [{ text: "Спробувати inline", switch_inline_query_current_chat: "ст. 111-1" }]] },
    });
  }
  if (text.startsWith("/")) return;
  const data = await loadData(env);
  const q = text.slice(0, 120);
  const a = chatAnswer(q, search(data, q), 0);
  return tg(env, "sendMessage", {
    chat_id: msg.chat.id, text: a.text, parse_mode: "HTML",
    link_preview_options: { is_disabled: true }, reply_markup: a.markup,
  });
}

async function onCallback(env, cq) {
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

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
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
      if (!env.WEBHOOK_SECRET || url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const hook = await tg(env, "setWebhook", {
        url: url.origin + "/webhook",
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "inline_query", "callback_query"],
        drop_pending_updates: true,
      });
      const cmds = await tg(env, "setMyCommands", {
        commands: [
          { command: "start", description: "Як шукати позиції ВС" },
          { command: "help", description: "Приклади запитів" },
        ],
      });
      let dataInfo;
      try { const d = await loadData(env); dataInfo = d.p.length + " позицій, зріз " + d.e; }
      catch (e) { dataInfo = "дані не завантажено: " + e.message; }
      return Response.json({ webhook: hook.ok, commands: cmds.ok, data: dataInfo, hook });
    }

    return new Response("LEX_A bot is running");
  },
};
