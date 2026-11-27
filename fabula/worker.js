// Fabula — бот каналу @fabula_crime (Cloudflare Worker).
// Щодня за розкладом надсилає власникові чернетку поста з черги queue.json;
// у канал пост іде лише після «✅ Опублікувати».
//
// Змінні воркера (Settings → Variables and Secrets):
//   BOT_TOKEN  — секрет, токен бота з BotFather (у репозиторій НЕ класти)
//   CHANNEL    — @fabula_crime
//   OWNER_ID   — ваш id (бот покаже його на /id)
//   QUEUE_URL  — адреса queue.json на GitHub Pages
// Прив'язка KV: STATE (сховище fabula-state).
// Тригер Cron: 0 17 * * *  (19:00 за Києвом узимку; з 29 березня — 0 16 * * *).

const KYIV = 'Europe/Kyiv';

const tg = (env, method, body) =>
  fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function webhookSecret(token) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fabula:' + token));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

function kyivDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KYIV, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function loadQueue(env) {
  const r = await fetch(env.QUEUE_URL + '?t=' + Date.now(), { cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error('queue.json: HTTP ' + r.status);
  return (await r.json()).posts || [];
}

const getState = (env, id) => env.STATE.get('p:' + id); // null | draft | sent | skip
const setState = (env, id, v) => env.STATE.put('p:' + id, v);
const postText = async (env, post) => (await env.STATE.get('t:' + post.id)) || post.text;

function withPreview(env, post, text) {
  const body = { text, parse_mode: 'HTML' };
  if (post.card) {
    // Картка над текстом як велике прев'ю: так текст може бути до 4096 знаків.
    body.link_preview_options = { url: new URL(post.card, env.QUEUE_URL).href, prefer_large_media: true, show_above_text: true };
  } else {
    body.link_preview_options = { is_disabled: true };
  }
  return body;
}

const urlRows = (post) => (post.buttons || []).map((b) => [{ text: b.text, url: b.url }]);
const actionRow = (id) => [
  { text: '✅ Опублікувати', callback_data: 'pub:' + id },
  { text: '🔁 Інший', callback_data: 'alt:' + id },
  { text: '✖ Пропустити', callback_data: 'skip:' + id },
];

async function sendDraft(env, post, note = '') {
  const head = `🗂 <b>Чернетка Fabula</b> · ${esc(post.rubric || '')} · ${post.date || 'резерв'}${note ? '\n' + esc(note) : ''}`;
  const text = await postText(env, post);
  const full = head + '\n\n' + text;
  if (full.length > 4096) await tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: head, parse_mode: 'HTML' });
  const body = withPreview(env, post, full.length > 4096 ? text : full);
  body.chat_id = env.OWNER_ID;
  body.reply_markup = { inline_keyboard: [actionRow(post.id), ...urlRows(post)] };
  const r = await tg(env, 'sendMessage', body);
  if (r.ok) {
    await env.STATE.put('d:' + r.result.message_id, post.id, { expirationTtl: 60 * 60 * 24 * 21 });
    await setState(env, post.id, 'draft');
  }
  if (post.poll) {
    await tg(env, 'sendMessage', {
      chat_id: env.OWNER_ID,
      parse_mode: 'HTML',
      text: `📊 <b>Після поста піде опитування:</b> ${esc(post.poll.q)}\n` + post.poll.options.map((o, i) => `${i + 1}. ${esc(o)}`).join('\n'),
    });
  }
  return r;
}

async function publish(env, post) {
  const body = withPreview(env, post, await postText(env, post));
  body.chat_id = env.CHANNEL;
  const rows = urlRows(post);
  if (rows.length) body.reply_markup = { inline_keyboard: rows };
  const r = await tg(env, 'sendMessage', body);
  if (!r.ok) return r;
  if (post.poll) {
    await tg(env, 'sendPoll', {
      chat_id: env.CHANNEL,
      question: post.poll.q,
      options: post.poll.options.map((text) => ({ text })),
      is_anonymous: true,
    });
  }
  if (post.pin) await tg(env, 'pinChatMessage', { chat_id: env.CHANNEL, message_id: r.result.message_id, disable_notification: true });
  await setState(env, post.id, 'sent');
  return r;
}

async function nextReserve(env, posts, exceptId) {
  for (const p of posts) {
    if (p.date || p.id === exceptId || p.pin) continue;
    if (!(await getState(env, p.id))) return p;
  }
  return null;
}

// Telegram entities → HTML (для заміни тексту чернетки відповіддю).
function entitiesToHtml(text, entities = []) {
  const open = {}, close = {};
  const tag = (e) => {
    switch (e.type) {
      case 'bold': return ['<b>', '</b>'];
      case 'italic': return ['<i>', '</i>'];
      case 'underline': return ['<u>', '</u>'];
      case 'strikethrough': return ['<s>', '</s>'];
      case 'code': return ['<code>', '</code>'];
      case 'blockquote': return ['<blockquote>', '</blockquote>'];
      case 'expandable_blockquote': return ['<blockquote expandable>', '</blockquote>'];
      case 'text_link': return [`<a href="${esc(e.url)}">`, '</a>'];
      default: return null;
    }
  };
  for (const e of entities) {
    const t = tag(e);
    if (!t) continue;
    (open[e.offset] ||= []).push(t[0]);
    (close[e.offset + e.length] ||= []).unshift(t[1]);
  }
  let out = '';
  for (let i = 0; i <= text.length; i++) {
    if (close[i]) out += close[i].join('');
    if (open[i]) out += open[i].join('');
    if (i < text.length) out += esc(text[i]);
  }
  return out;
}

async function onCallback(env, cq) {
  const [act, id] = String(cq.data || '').split(':');
  const msg = cq.message;
  if (String(cq.from.id) !== String(env.OWNER_ID)) return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  const posts = await loadQueue(env);
  const post = posts.find((p) => p.id === id);
  if (!post) return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Поста немає в черзі', show_alert: true });
  const done = (label) => tg(env, 'editMessageReplyMarkup', {
    chat_id: msg.chat.id, message_id: msg.message_id,
    reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'noop' }]] },
  });
  if (act === 'pub') {
    if ((await getState(env, id)) === 'sent') return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Уже опубліковано' });
    const r = await publish(env, post);
    if (!r.ok) return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Помилка: ' + (r.description || ''), show_alert: true });
    await done('✅ Опубліковано');
    return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Опубліковано' });
  }
  if (act === 'skip') {
    await setState(env, id, 'skip');
    await done('✖ Пропущено');
    return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  }
  if (act === 'alt') {
    await setState(env, id, 'skip');
    await done('🔁 Замінено');
    const alt = await nextReserve(env, posts, id);
    await tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
    if (!alt) return tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: 'У резерві черги поки немає постів.' });
    return sendDraft(env, alt, 'Замість «' + (post.rubric || id) + '»');
  }
  return tg(env, 'answerCallbackQuery', { callback_query_id: cq.id });
}

async function onMessage(env, m) {
  const isOwner = String(m.from && m.from.id) === String(env.OWNER_ID);
  const text = (m.text || '').trim();
  if (text === '/id') return tg(env, 'sendMessage', { chat_id: m.chat.id, text: String(m.from.id) });
  if (!isOwner) {
    return tg(env, 'sendMessage', {
      chat_id: m.chat.id,
      text: 'Це службовий бот каналу Fabula. Справжні кримінальні справи — у каналі.',
      reply_markup: { inline_keyboard: [[{ text: 'Відкрити Fabula', url: 'https://t.me/' + String(env.CHANNEL).replace('@', '') }]] },
    });
  }
  // Відповідь на чернетку новим текстом — замінити текст поста.
  if (m.reply_to_message && m.text) {
    const id = await env.STATE.get('d:' + m.reply_to_message.message_id);
    if (id) {
      const html = entitiesToHtml(m.text, m.entities);
      await env.STATE.put('t:' + id, html);
      const posts = await loadQueue(env);
      const post = posts.find((p) => p.id === id);
      if (post) await sendDraft(env, post, 'Оновлений текст');
      return;
    }
  }
  const posts = await loadQueue(env);
  if (text === '/zaraz') {
    const today = posts.filter((p) => p.date === kyivDate());
    if (!today.length) return tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'На сьогодні в черзі поста немає. /rezerv — пост із резерву.' });
    for (const p of today) await sendDraft(env, p);
    return;
  }
  if (text === '/rezerv') {
    const p = await nextReserve(env, posts);
    return p ? sendDraft(env, p) : tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Резерв порожній.' });
  }
  if (text === '/pin') {
    const p = posts.find((x) => x.pin);
    return p ? sendDraft(env, p, 'Закріплений пост') : tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'У черзі немає поста для закріплення.' });
  }
  // /fabula і все інше — стан черги.
  const today = kyivDate();
  const ahead = posts.filter((p) => p.date && p.date >= today);
  let reserve = 0;
  for (const p of posts) if (!p.date && !p.pin && !(await getState(env, p.id))) reserve++;
  const lines = [];
  for (const p of ahead.slice(0, 7)) lines.push(`${p.date} · ${esc(p.rubric || '')} · ${(await getState(env, p.id)) || 'у черзі'}`);
  return tg(env, 'sendMessage', {
    chat_id: m.chat.id,
    parse_mode: 'HTML',
    text: `<b>Fabula</b> · канал ${esc(env.CHANNEL)}\nПостів попереду: ${ahead.length} · у резерві: ${reserve}\n\n${lines.join('\n') || 'Черга порожня'}\n\n/zaraz — чернетка на сьогодні\n/rezerv — пост із резерву\n/pin — закріплений пост`,
  });
}

async function daily(env) {
  const posts = await loadQueue(env);
  const today = kyivDate();
  const due = [];
  for (const p of posts) if (p.date === today && !(await getState(env, p.id))) due.push(p);
  for (const p of due) await sendDraft(env, p);
  const ahead = posts.filter((p) => p.date && p.date > today).length;
  if (!due.length) await tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: 'Fabula: на сьогодні в черзі поста немає. /rezerv — взяти з резерву.' });
  if (ahead < 3) await tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: `Fabula: у черзі лишилося постів на ${ahead} дн. Час поповнити.` });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/setup') {
      const secret = await webhookSecret(env.BOT_TOKEN);
      const wh = await tg(env, 'setWebhook', { url: url.origin + '/hook', secret_token: secret, allowed_updates: ['message', 'callback_query'] });
      const cmd = await tg(env, 'setMyCommands', {
        commands: [
          { command: 'fabula', description: 'Стан черги' },
          { command: 'zaraz', description: 'Чернетка на сьогодні' },
          { command: 'rezerv', description: 'Пост із резерву' },
          { command: 'pin', description: 'Закріплений пост' },
        ],
        scope: { type: 'chat', chat_id: Number(env.OWNER_ID) || 0 },
      });
      let queue = null;
      try { queue = (await loadQueue(env)).length; } catch (e) { queue = String(e.message); }
      return Response.json({ webhook: wh.ok, commands: cmd.ok, channel: env.CHANNEL || null, owner: !!env.OWNER_ID, kv: !!env.STATE, queue });
    }
    if (url.pathname === '/hook' && request.method === 'POST') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== (await webhookSecret(env.BOT_TOKEN))) return new Response('forbidden', { status: 403 });
      const u = await request.json();
      try {
        if (u.callback_query) await onCallback(env, u.callback_query);
        else if (u.message && u.message.chat.type === 'private') await onMessage(env, u.message);
      } catch (e) {
        if (env.OWNER_ID) await tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: 'Fabula: помилка — ' + e.message });
      }
      return new Response('ok');
    }
    return new Response('Fabula bot');
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(daily(env).catch((e) => tg(env, 'sendMessage', { chat_id: env.OWNER_ID, text: 'Fabula: помилка розкладу — ' + e.message })));
  },
};
