/**
 * Выбор эмодзи: панель со вкладками «Частые» (localStorage) и разделами, поиск по русским словам.
 *   openEmojiPicker(anchor, { onSelect })      — панель у кнопки; на ≤768px — нижний лист;
 *   attachEmojiPicker(composer)                — кнопка 🙂 в slots.actions поля ответа, вставка в позицию курсора
 *                                                (то же делает createChatComposer({ emoji: true }));
 *   searchEmoji(query), getRecentEmoji(), rememberEmoji(e).
 */
import { icon } from '../icons';
import { h, html } from './dom';
import { t } from './i18n';
import { storageGet, storageSet } from './storage';
import { showFloat, type FloatHandle } from './float';
import type { ChatComposerHandle } from './chat';

/** «эмодзи слова для поиска»: слова русские, регистр не важен */
const RAW: Array<[string, string, string]> = [
  ['smileys', 'Смайлы', '😀 улыбка радость|😃 улыбка рад|😄 смех счастье|😁 зубы широкая улыбка|😆 смеюсь|😅 неловко пот|🤣 ржу лол смех|😂 слёзы смех лол|🙂 улыбка|🙃 перевёрнутая|😉 подмигивание|😊 румянец довольный|😇 ангел|🥰 влюблён любовь сердечки|😍 влюблён глаза сердца|🤩 восторг звёзды|😘 поцелуй|😗 поцелуй|😋 вкусно|😛 язык|😜 подмигивает язык|🤪 безумный|😝 язык дразню|🤑 деньги|🤗 объятия|🤭 хихикаю|🤫 тише секрет|🤔 думаю вопрос|🤐 молчу|😐 нейтральный|😑 без эмоций|😶 без слов|😏 ухмылка|😒 недоволен|🙄 закатил глаза|😬 гримаса|😌 облегчение|😔 грустный|😪 сонный|🤤 слюни|😴 сплю сон|😷 маска болею|🤒 температура болезнь|🤕 повязка|🤢 тошнит|🤮 рвота|🥵 жарко|🥶 холодно|🥴 пьяный|😵 головокружение|🤯 взрыв мозга|🤠 ковбой|🥳 праздник вечеринка|😎 круто очки|🤓 умник очки|🧐 монокль|😕 озадачен|😟 тревога|🙁 грустно|😮 удивлён|😯 ого|😲 шок|😳 смущён|🥺 умоляю|😦 нахмурен|😨 страх|😰 холодный пот|😥 грусть|😢 плачу слеза|😭 рыдаю|😱 крик ужас|😖 расстроен|😣 терплю|😞 разочарован|😓 пот усталость|😩 устал|😫 измотан|🥱 зеваю|😤 пар злость|😡 злой гнев|😠 сердит|🤬 ругаюсь|😈 чертёнок|💀 череп|💩 какашка|🤡 клоун|👻 призрак|👽 пришелец|🤖 робот|🎃 тыква'],
  ['gestures', 'Люди и жесты', '👍 класс отлично лайк хорошо да|👎 дизлайк плохо нет|👌 окей хорошо|✌️ мир победа|🤞 скрестил пальцы удача|🤟 люблю тебя|🤘 рок|🤙 позвони|👈 влево|👉 вправо|👆 вверх|👇 вниз|☝️ внимание один|✋ стоп ладонь|🤚 рука|🖐️ ладонь|🖖 вулкан привет|👋 привет пока помахать|🤝 рукопожатие договорились|🙏 спасибо пожалуйста молю|💪 сила мышцы|👏 аплодисменты браво|🙌 ура руки|👐 открытые руки|🤲 ладони|✍️ пишу|💅 маникюр|🙋 вопрос рука|🙆 ок жест|🙅 нет жест|🤦 фейспалм|🤷 пожимаю плечами не знаю|🙇 поклон|🧑 человек|👨 мужчина|👩 женщина|👶 малыш ребёнок|🧑‍🍳 повар|🛵 курьер|🧑‍💻 программист|👀 глаза смотрю|🧠 мозг|👂 ухо|👁️ глаз'],
  ['hearts', 'Сердца и символы', '❤️ сердце любовь красное|🧡 оранжевое сердце|💛 жёлтое сердце|💚 зелёное сердце|💙 синее сердце|💜 фиолетовое сердце|🖤 чёрное сердце|🤍 белое сердце|💔 разбитое сердце|💕 два сердца|💖 сверкающее сердце|💗 растущее сердце|💘 стрела амур|💝 подарок сердце|🔥 огонь горячо круто|✨ искры блеск|⭐ звезда|🌟 сияющая звезда|💫 звёздочки|💥 взрыв|💯 сто баллов отлично|✅ готово выполнено галочка|☑️ галочка|❌ крест нет отмена|❗ внимание восклицание|❓ вопрос|⚠️ предупреждение|🚫 запрещено|🔔 уведомление колокольчик|💡 идея лампочка|💬 сообщение чат|💭 мысль|🔒 замок закрыто|🔑 ключ|⏰ будильник время|⌛ песочные часы жду|📌 кнопка закреплено|📎 скрепка вложение|📝 заметка запись|📞 телефон звонок|📅 календарь дата|📍 метка место|➕ плюс|➖ минус|🔄 обновить|↩️ ответить назад'],
  ['food', 'Еда и напитки', '🍕 пицца|🍔 бургер|🍟 картошка фри|🌭 хот-дог|🌮 тако|🌯 шаурма буррито|🥗 салат|🍝 паста спагетти|🍜 лапша суп|🍲 суп|🍣 суши|🍱 бенто|🥟 пельмени|🍤 креветка|🍙 онигири рис|🍚 рис|🥩 мясо стейк|🍗 курица ножка|🥓 бекон|🍳 яичница|🥞 блины|🧇 вафли|🥐 круассан|🍞 хлеб|🧀 сыр|🥚 яйцо|🍎 яблоко|🍌 банан|🍇 виноград|🍓 клубника|🍉 арбуз|🍒 вишня|🍅 помидор|🥒 огурец|🥦 брокколи|🌽 кукуруза|🍄 гриб|🧅 лук|🍰 торт пирожное|🎂 день рождения торт|🍩 пончик|🍪 печенье|🍫 шоколад|🍦 мороженое|🍭 леденец|☕ кофе|🍵 чай|🥤 напиток стакан|🍺 пиво|🍷 вино|🥂 шампанское тост|🍹 коктейль|🧃 сок|🥛 молоко|💧 вода'],
  ['things', 'Предметы и места', '🎉 праздник ура|🎊 конфетти|🎁 подарок|🏆 кубок победа|🥇 первое место золото|🎯 цель|🎮 игра|🎵 музыка нота|🎧 наушники|📷 фото камера|💻 ноутбук компьютер|📱 телефон смартфон|🖥️ монитор|⌨️ клавиатура|🖨️ принтер|💳 карта оплата|💰 деньги мешок|💵 доллары|🧾 чек|📦 посылка коробка заказ|🚚 доставка грузовик|🚗 машина|🚕 такси|🏠 дом|🏢 офис здание|🏪 магазин|🛒 корзина покупки|📈 рост график|📉 падение график|📊 статистика|📋 список документ|📁 папка|🔧 ключ гаечный инструмент|🔨 молоток|⚙️ настройки шестерёнка|🔍 поиск лупа|📣 рупор объявление|🧹 уборка|🧼 мыло|🛠️ ремонт|⏱️ секундомер|🕐 час|🌍 земля мир|☀️ солнце|🌧️ дождь|❄️ снег зима|⚡ молния|🌈 радуга|🌸 цветок сакура|🌹 роза|🌷 тюльпан|🌿 трава|🍀 клевер удача|🐶 собака|🐱 кот|🐻 медведь|🦊 лиса|🐼 панда|🦄 единорог|🐝 пчела'],
];

export interface EmojiCategory { id: string; label: string; emojis: Array<{ e: string; k: string }> }
const SPLIT = /^(\S+)\s*(.*)$/u;
export const EMOJI_CATEGORIES: EmojiCategory[] = RAW.map(([id, label, body]) => ({
  id, label,
  emojis: body.split('|').map((x) => { const m = SPLIT.exec(x.trim()); return { e: m![1], k: (m![2] ?? '').toLowerCase() }; }),
}));
const ALL = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Поиск по русским словам: каждое слово запроса — начало слова в описании эмодзи. */
export function searchEmoji(query: string): string[] {
  const parts = norm(query).split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  return ALL.filter((x) => {
    const words = norm(x.k).split(/\s+/);
    return parts.every((p) => words.some((w) => w.startsWith(p)));
  }).map((x) => x.e);
}

const KEY = 'b24-emoji-recent';
const MAX_RECENT = 24;
export function getRecentEmoji(): string[] {
  try { const v = JSON.parse(storageGet(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : []; } catch { return []; }
}
export function rememberEmoji(e: string): void {
  storageSet(KEY, JSON.stringify([e, ...getRecentEmoji().filter((x) => x !== e)].slice(0, MAX_RECENT)));
}

/** Стикер: PNG или анимированный WebP по адресу */
export interface StickerItem { id: string; src: string; label?: string }
export interface StickerPack { id: string; label: string; /** адрес значка пака (28 px) */ icon: string; /** автор / источник — мелко внизу вкладки */ credit?: string; items: StickerItem[] }
export interface StickersOptions {
  /** паки; функция — загрузка при первом открытии вкладки «Стикеры» (результат запоминается на время жизни настроек) */
  packs: StickerPack[] | (() => Promise<StickerPack[]>);
  /** выбран стикер: панель закрывается */
  onSticker: (item: StickerItem, pack: StickerPack) => void;
}
const STICKER_RECENT = 'b24-stickers:recent';
const MAX_STICKER_RECENT = 20;
const TAB_KEY = 'b24-emoji-tab';
const packsCache = new WeakMap<StickersOptions, Promise<StickerPack[]>>();
const loadPacks = (o: StickersOptions): Promise<StickerPack[]> => {
  let p = packsCache.get(o);
  if (!p) {
    p = Promise.resolve(typeof o.packs === 'function' ? o.packs() : o.packs);
    packsCache.set(o, p);
    p.catch(() => packsCache.delete(o));
  }
  return p;
};
const recentStickers = (): string[] => {
  try { const v = JSON.parse(storageGet(STICKER_RECENT) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
};
const rememberSticker = (pack: StickerPack, item: StickerItem) => {
  const key = `${pack.id}\u0000${item.id}`;
  storageSet(STICKER_RECENT, JSON.stringify([key, ...recentStickers().filter((x) => x !== key)].slice(0, MAX_STICKER_RECENT)));
};

export interface EmojiPickerOptions {
  /** вкладка «Стикеры» рядом с «Эмодзи» */
  stickers?: StickersOptions;
  onSelect: (emoji: string) => void;
  /** закрывать после выбора (по умолчанию да) */
  closeOnSelect?: boolean;
  placement?: 'top' | 'bottom';
  align?: 'start' | 'end';
  onClose?: () => void;
}

/** Панель эмодзи у кнопки. Esc и клик мимо закрывают; на ≤768px — нижний лист. */
export function openEmojiPicker(anchor: HTMLElement, options: EmojiPickerOptions): FloatHandle {
  const recent = getRecentEmoji();
  const tabs: Array<{ id: string; label: string; glyph: string; list: string[] }> = [
    ...(recent.length ? [{ id: 'recent', label: t('Частые'), glyph: '🕘', list: recent }] : []),
    ...EMOJI_CATEGORIES.map((c) => ({ id: c.id, label: t(c.label), glyph: c.emojis[0].e, list: c.emojis.map((x) => x.e) })),
  ];
  let tab = tabs[0].id;
  let setModeImpl: (id: 'emoji' | 'stickers') => void = () => {};
  const setMode = (id: 'emoji' | 'stickers') => setModeImpl(id);
  let focusMain = () => search.focus({ preventScroll: true });

  const search = h('input', { type: 'search', class: 'b24-input b24-emoji__search', placeholder: t('Поиск эмодзи'), 'aria-label': t('Поиск эмодзи'), autocomplete: 'off' }) as HTMLInputElement;
  const bar = h('div', { class: 'b24-emoji__tabs', role: 'tablist' });
  const grid = h('div', { class: 'b24-emoji__grid', role: 'listbox', 'aria-label': t('Эмодзи') });
  const title = h('div', { class: 'b24-emoji__title' });
  const emojiPane = h('div', { class: 'b24-emoji__pane' }, h('div', { class: 'b24-emoji__head' }, html(icon('search')), search), bar, title, grid);
  const panel = h('div', { class: 'b24-emoji', role: 'dialog', 'aria-label': options.stickers ? t('Эмодзи и стикеры') : t('Выбор эмодзи') }, emojiPane);

  const fillGrid = (list: string[], heading: string) => {
    title.textContent = heading;
    if (!list.length) { grid.replaceChildren(h('div', { class: 'b24-emoji__empty' }, t('Ничего не нашлось'))); return; }
    grid.replaceChildren(...list.map((e) => h('button', { type: 'button', class: 'b24-emoji__btn', role: 'option', 'aria-label': e, 'data-emoji': e, tabindex: '-1' }, e)));
    (grid.firstElementChild as HTMLElement).tabIndex = 0;
  };
  const showTab = () => {
    const cur = tabs.find((x) => x.id === tab)!;
    bar.querySelectorAll<HTMLElement>('.b24-emoji__tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
    fillGrid(cur.list, cur.label);
    grid.scrollTop = 0;
  };
  bar.append(...tabs.map((x) => {
    const b = h('button', { type: 'button', class: 'b24-emoji__tab', role: 'tab', 'data-tab': x.id, title: x.label, 'aria-label': x.label }, x.glyph);
    b.addEventListener('click', () => { search.value = ''; tab = x.id; showTab(); });
    return b;
  }));
  search.addEventListener('input', () => {
    const q = search.value.trim();
    if (!q) return showTab();
    bar.querySelectorAll('.b24-emoji__tab').forEach((b) => b.classList.remove('is-active'));
    fillGrid(searchEmoji(q), t('Результаты'));
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); (grid.querySelector('.b24-emoji__btn') as HTMLElement | null)?.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); (grid.querySelector('.b24-emoji__btn') as HTMLElement | null)?.click(); }
  });
  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.b24-emoji__btn');
    if (!b) return;
    const em = b.dataset.emoji!;
    rememberEmoji(em);
    options.onSelect(em);
    if (options.closeOnSelect !== false) float.close();
  });
  grid.addEventListener('keydown', (e) => {
    const btns = Array.from(grid.querySelectorAll<HTMLElement>('.b24-emoji__btn'));
    const i = btns.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.floor(grid.clientWidth / (btns[0].offsetWidth || 36)));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = i + step;
    if (n < 0) { search.focus(); return; }
    if (n >= btns.length) return;
    btns.forEach((b) => { b.tabIndex = -1; });
    btns[n].tabIndex = 0;
    btns[n].focus();
  });

  /* ── стикеры ── */
  const st = options.stickers;
  let mode: 'emoji' | 'stickers' = 'emoji';
  if (st) {
    const stPane = h('div', { class: 'b24-emoji__pane b24-emoji__pane--stickers', hidden: true });
    const sSearch = h('input', { type: 'search', class: 'b24-input b24-emoji__search', placeholder: t('Поиск стикеров'), 'aria-label': t('Поиск стикеров'), autocomplete: 'off' }) as HTMLInputElement;
    const sBar = h('div', { class: 'b24-emoji__tabs b24-emoji__packs', role: 'tablist' });
    const sGrid = h('div', { class: 'b24-emoji__grid b24-emoji__grid--stickers', role: 'listbox', 'aria-label': t('Стикеры') });
    const credit = h('div', { class: 'b24-emoji__credit' });
    stPane.append(h('div', { class: 'b24-emoji__head' }, html(icon('search')), sSearch), sBar, sGrid, credit);
    const modes = h('div', { class: 'b24-emoji__modes', role: 'tablist' });
    const modeBtn = (id: 'emoji' | 'stickers', label: string) => {
      const b = h('button', { type: 'button', class: 'b24-emoji__mode', role: 'tab', 'data-mode': id }, label);
      b.addEventListener('click', () => setMode(id));
      return b;
    };
    modes.append(modeBtn('emoji', t('Эмодзи')), modeBtn('stickers', t('Стикеры')));
    panel.prepend(modes);
    panel.append(stPane);

    let packs: StickerPack[] | null = null;
    let cur = '';
    const stickerTab = (id: string, label: string, content: Node) => {
      const b = h('button', { type: 'button', class: 'b24-emoji__tab b24-emoji__packbtn', role: 'tab', 'data-pack': id, title: label, 'aria-label': label }, content);
      b.addEventListener('click', () => { sSearch.value = ''; cur = id; showPack(); });
      return b;
    };
    const stickerBtn = (item: StickerItem, pack: StickerPack) => {
      const img = h('img', { src: item.src, alt: item.label ?? '', loading: 'lazy', draggable: 'false' });
      const b = h('button', { type: 'button', class: 'b24-emoji__sticker', role: 'option', tabindex: '-1', title: item.label || undefined, 'aria-label': item.label || t('Стикер'), 'data-pack': pack.id, 'data-sticker': item.id }, img);
      return b;
    };
    const fillStickers = (list: Array<{ item: StickerItem; pack: StickerPack }>, emptyText: string) => {
      if (!list.length) { sGrid.replaceChildren(h('div', { class: 'b24-emoji__empty' }, emptyText)); return; }
      sGrid.replaceChildren(...list.map((x) => stickerBtn(x.item, x.pack)));
      (sGrid.firstElementChild as HTMLElement).tabIndex = 0;
    };
    const recentList = () => {
      if (!packs) return [];
      const out: Array<{ item: StickerItem; pack: StickerPack }> = [];
      for (const k of recentStickers()) {
        const [pid, iid] = k.split('\u0000');
        const pack = packs.find((q) => q.id === pid);
        const item = pack?.items.find((q) => q.id === iid);
        if (pack && item) out.push({ item, pack });
      }
      return out;
    };
    function showPack() {
      if (!packs) return;
      sBar.querySelectorAll<HTMLElement>('.b24-emoji__packbtn').forEach((b) => { const on = b.dataset.pack === cur; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
      if (cur === '@recent') { fillStickers(recentList(), t('Пока пусто')); credit.textContent = ''; }
      else {
        const pack = packs.find((q) => q.id === cur) ?? packs[0];
        fillStickers((pack?.items ?? []).map((item) => ({ item, pack })), t('Пока пусто'));
        credit.textContent = pack?.credit ?? '';
      }
      sGrid.scrollTop = 0;
    }
    const build = () => {
      const recent = recentList();
      sBar.replaceChildren(
        ...(recent.length ? [stickerTab('@recent', t('Недавние'), html(icon('clock', { size: 16 })))] : []),
        ...packs!.map((p) => stickerTab(p.id, p.label, h('img', { src: p.icon, alt: '', loading: 'lazy', draggable: 'false' }))),
      );
      if (!packs!.some((p) => p.id === cur) && !(cur === '@recent' && recent.length)) cur = recent.length ? '@recent' : packs![0]?.id ?? '';
      showPack();
    };
    let loading = false;
    const ensure = () => {
      if (packs || loading) return;
      loading = true;
      sGrid.replaceChildren(h('div', { class: 'b24-emoji__empty' }, t('Загрузка…')));
      loadPacks(st).then((p) => { packs = p; loading = false; build(); }, () => {
        loading = false;
        const retry = h('button', { type: 'button', class: 'b24-btn b24-btn--sm b24-btn--secondary' }, t('Повторить'));
        retry.addEventListener('click', ensure);
        sGrid.replaceChildren(h('div', { class: 'b24-emoji__empty' }, t('Не удалось загрузить'), h('div', {}, retry)));
      });
    };
    sSearch.addEventListener('input', () => {
      const q = norm(sSearch.value);
      if (!packs) return;
      if (!q) { showPack(); return; }
      sBar.querySelectorAll('.b24-emoji__tab').forEach((b) => b.classList.remove('is-active'));
      credit.textContent = '';
      fillStickers(packs.flatMap((pack) => pack.items.filter((i) => norm(i.label ?? '').includes(q)).map((item) => ({ item, pack }))), t('Ничего не нашлось'));
    });
    sSearch.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); (sGrid.querySelector('.b24-emoji__sticker') as HTMLElement | null)?.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); (sGrid.querySelector('.b24-emoji__sticker') as HTMLElement | null)?.click(); }
    });
    sGrid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.b24-emoji__sticker');
      if (!b || !packs) return;
      const pack = packs.find((q) => q.id === b.dataset.pack);
      const item = pack?.items.find((q) => q.id === b.dataset.sticker);
      if (!pack || !item) return;
      rememberSticker(pack, item);
      st.onSticker(item, pack);
      float.close();
    });
    sGrid.addEventListener('keydown', (e) => {
      const btns = Array.from(sGrid.querySelectorAll<HTMLElement>('.b24-emoji__sticker'));
      const i = btns.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      const cols = Math.max(1, Math.round(sGrid.clientWidth / (btns[0].offsetWidth || 72)));
      const step = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols } as Record<string, number>)[e.key];
      if (!step) return;
      e.preventDefault();
      const n = i + step;
      if (n < 0) { sSearch.focus(); return; }
      if (n >= btns.length) return;
      btns.forEach((b) => { b.tabIndex = -1; });
      btns[n].tabIndex = 0;
      btns[n].focus();
    });
    setModeImpl = (id) => {
      mode = id;
      modes.querySelectorAll<HTMLElement>('.b24-emoji__mode').forEach((b) => { const on = b.dataset.mode === id; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
      emojiPane.hidden = id !== 'emoji';
      stPane.hidden = id !== 'stickers';
      try { storageSet(TAB_KEY, id); } catch { /* без хранилища — не запоминаем */ }
      if (id === 'stickers') ensure();
      focusMain = () => (id === 'stickers' ? sSearch : search).focus({ preventScroll: true });
    };
    const saved = storageGet(TAB_KEY);
    if (saved === 'stickers') setMode('stickers'); else setMode('emoji');
  }
  void mode;

  showTab();
  const float = showFloat(anchor, panel, { placement: options.placement, align: options.align, onClose: options.onClose });
  // высота панели известна только после вставки
  float.reposition();
  if (!window.matchMedia('(max-width: 768px)').matches) focusMain();
  return float;
}

export interface EmojiAttachHandle { button: HTMLButtonElement; close(): void; destroy(): void }

/** Кнопка 🙂 в slots.actions поля ответа: панель, вставка выбранного в позицию курсора. */
export function attachEmojiPicker(composer: ChatComposerHandle, options: Partial<Pick<EmojiPickerOptions, 'closeOnSelect' | 'placement' | 'stickers'>> = {}): EmojiAttachHandle {
  const button = h('button', { type: 'button', class: 'b24-btn b24-btn--plain b24-btn--icon b24-chat-composer__emoji', 'aria-label': t('Эмодзи'), title: t('Эмодзи'), 'aria-haspopup': 'dialog' }, html(icon('smile'))) as HTMLButtonElement;
  composer.slots.actions.append(button);
  let open: FloatHandle | null = null;
  const toggle = () => {
    if (open) { open.close(); return; }
    button.setAttribute('aria-expanded', 'true');
    open = openEmojiPicker(button, {
      ...options,
      placement: options.placement ?? 'top',
      onSelect: (e) => composer.insert(e),
      onClose: () => { open = null; button.setAttribute('aria-expanded', 'false'); },
    });
  };
  button.addEventListener('click', toggle);
  return { button, close: () => open?.close(), destroy() { open?.close(); button.remove(); } };
}
