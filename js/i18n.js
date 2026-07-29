// Tiny i18n — EN/AR with RTL. t(key, params) + applyLang(). Persists arcade:lang.

const DICT = {
  en: {
    tagline: '2 players · peer-to-peer · no sign-up',
    pick_game: 'Pick a game',
    create_room: 'Create a Room', join_room: 'Join Room', or: 'OR',
    enter_code: 'ENTER ROOM CODE', room_code: 'Room code', copy_link: 'Copy invite link',
    back_games: '← Back to games', leave_room: '← Leave room', quit: 'Quit',
    game_settings: 'Game Settings', start_game: 'Start Game',
    waiting_opp: 'Waiting for opponent…', waiting_host: 'Waiting for host to start…',
    your_turn: 'Your turn', opp_turn: "Opponent's turn", name_turn: "{name}'s turn",
    tossing: 'Tossing…', you_first: 'You go first!', opp_first: 'Opponent goes first.',
    paused: 'Paused', resume: 'Resume', leave_game: 'Leave game', reconnecting: 'Opponent disconnected — reconnecting…',
    you_win: '🏆 You win!', you_lose: '💥 You lose', draw: "🤝 It's a draw", rematch: 'Rematch',
    number_length: 'Number length', turn_timer: 'Turn timer', off: 'Off',
    first_move: 'First move', fm_toss: 'Coin toss', fm_host: 'Host first', fm_loser: 'Loser first',
    lock_in: 'Lock in', locked_wait: 'Locked. Waiting for opponent…',
    prefs: 'Settings', language: 'Language', sound: 'Sound', on: 'On',
    display_name: 'Your name', theme: 'Theme', haptics: 'Vibration', close: 'Close',
    invite_copied: 'Invite link copied', room_not_found: 'Room not found. Check the code.',
    connected: 'Connected ✓', disconnected: 'Disconnected', opp_left: 'Opponent left the game.',
    secret_hint: 'Set a {n}-digit secret. It never leaves your device.',
    you_are: 'You are {x}', red: 'Red', yellow: 'Yellow', black: 'Black', white: 'White',
    your_guesses: 'You', opponent: 'Opponent', no_guesses: 'No guesses yet', guess: 'Guess',
    exact: 'exact', partial: 'partial', timeout: '⏱ time out',
    enemy_waters: 'Enemy waters — tap to fire', your_fleet: 'Your fleet', shuffle: '🔀 Shuffle',
    place_hint: 'Your fleet is placed at random. Shuffle until you like it, then lock in.',
    pick_move: 'Pick your move…', first_to: 'First to {n}', you_score: 'You', opp_score: 'Opponent',
    score: 'Score', your_pieces: 'Your pieces', place_phase: 'Place your pieces', move_phase: 'Move a piece',
    remove_piece: 'Mill! Remove an enemy piece', pairs: 'pairs',
    // game names
    g_number_duel: 'Number Duel', g_ttt: 'Tic-Tac-Toe', g_connect4: 'Connect Four',
    g_rps: 'Rock Paper Scissors', g_battleship: 'Battleship', g_gomoku: 'Gomoku',
    g_reversi: 'Reversi', g_checkers: 'Checkers', g_dots: 'Dots & Boxes',
    g_uttt: 'Ultimate Tic-Tac-Toe', g_mancala: 'Mancala', g_memory: 'Memory Match', g_morris: "Nine Men's Morris",
  },
  ar: {
    tagline: 'لاعبان · اتصال مباشر · بدون تسجيل',
    pick_game: 'اختر لعبة',
    create_room: 'إنشاء غرفة', join_room: 'انضمام', or: 'أو',
    enter_code: 'أدخل رمز الغرفة', room_code: 'رمز الغرفة', copy_link: 'نسخ رابط الدعوة',
    back_games: '→ العودة للألعاب', leave_room: '→ مغادرة الغرفة', quit: 'خروج',
    game_settings: 'إعدادات اللعبة', start_game: 'ابدأ اللعبة',
    waiting_opp: 'بانتظار الخصم…', waiting_host: 'بانتظار بدء المضيف…',
    your_turn: 'دورك', opp_turn: 'دور الخصم', name_turn: 'دور {name}',
    tossing: 'جارٍ القرعة…', you_first: 'أنت تبدأ!', opp_first: 'الخصم يبدأ.',
    paused: 'إيقاف مؤقت', resume: 'استئناف', leave_game: 'مغادرة اللعبة', reconnecting: 'انقطع الخصم — جارٍ إعادة الاتصال…',
    you_win: '🏆 لقد فزت!', you_lose: '💥 لقد خسرت', draw: '🤝 تعادل', rematch: 'إعادة اللعب',
    number_length: 'عدد الخانات', turn_timer: 'مؤقت الدور', off: 'إيقاف',
    first_move: 'من يبدأ', fm_toss: 'قرعة', fm_host: 'المضيف أولاً', fm_loser: 'الخاسر أولاً',
    lock_in: 'تثبيت', locked_wait: 'تم التثبيت. بانتظار الخصم…',
    prefs: 'الإعدادات', language: 'اللغة', sound: 'الصوت', on: 'تشغيل',
    display_name: 'اسمك', theme: 'السمة', haptics: 'الاهتزاز', close: 'إغلاق',
    invite_copied: 'تم نسخ رابط الدعوة', room_not_found: 'الغرفة غير موجودة. تحقق من الرمز.',
    connected: 'متصل ✓', disconnected: 'انقطع الاتصال', opp_left: 'غادر الخصم اللعبة.',
    secret_hint: 'اختر رقمًا سريًا من {n} خانات. لن يغادر جهازك.',
    you_are: 'أنت {x}', red: 'أحمر', yellow: 'أصفر', black: 'أسود', white: 'أبيض',
    your_guesses: 'أنت', opponent: 'الخصم', no_guesses: 'لا تخمينات بعد', guess: 'خمّن',
    exact: 'صحيح', partial: 'بمكان خاطئ', timeout: '⏱ انتهى الوقت',
    enemy_waters: 'مياه العدو — انقر للإطلاق', your_fleet: 'أسطولك', shuffle: '🔀 خلط',
    place_hint: 'تم توزيع أسطولك عشوائيًا. اخلط حتى يعجبك ثم ثبّت.',
    pick_move: 'اختر حركتك…', first_to: 'الأول إلى {n}', you_score: 'أنت', opp_score: 'الخصم',
    score: 'النتيجة', your_pieces: 'قطعك', place_phase: 'ضع قطعك', move_phase: 'حرّك قطعة',
    remove_piece: 'طاحونة! أزل قطعة للخصم', pairs: 'أزواج',
    g_number_duel: 'مبارزة الأرقام', g_ttt: 'إكس-أو', g_connect4: 'وصل أربعة',
    g_rps: 'حجر ورقة مقص', g_battleship: 'معركة السفن', g_gomoku: 'غوموكو',
    g_reversi: 'ريفرسي', g_checkers: 'الداما', g_dots: 'النقاط والصناديق',
    g_uttt: 'إكس-أو الشامل', g_mancala: 'المنقلة', g_memory: 'الذاكرة', g_morris: 'طاحونة',
  },
};

let LANG = 'en';
const listeners = [];

export function t(key, params) {
  let s = (DICT[LANG] && DICT[LANG][key]) || (DICT.en[key]) || key;
  if (params) for (const k in params) s = s.replace(`{${k}}`, params[k]);
  return s;
}
export function getLang() { return LANG; }
export function onLangChange(cb) { listeners.push(cb); }

export function applyLang(lang) {
  LANG = DICT[lang] ? lang : 'en';
  try { localStorage.setItem('arcade:lang', LANG); } catch (e) {}
  const root = document.documentElement;
  root.lang = LANG;
  root.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  listeners.forEach((cb) => cb(LANG));
}

export function initLang() {
  let saved = 'en';
  try { saved = localStorage.getItem('arcade:lang') || 'en'; } catch (e) {}
  applyLang(saved);
}
