// Short, step-by-step "learn to play" walkthroughs for the more complex games.
// Plain rule explanations (original wording) paired with the existing demo() visual.
const T = {
  chess: {
    en: [
      'Goal: trap the opponent\'s king. Each piece moves its own way — pawns step forward, rooks slide in straight lines, bishops on diagonals, the knight jumps in an L.',
      'Tap one of your pieces to light up where it can go: green marks an empty square you can move to, red marks a piece you can capture.',
      'When the enemy king is attacked and has no safe move left, that\'s checkmate — you win.',
    ],
    ar: [
      'الهدف: حصار ملك الخصم. لكل قطعة حركتها — البيدق يتقدم للأمام، الرخ في خطوط مستقيمة، الفيل على الأقطار، والحصان يقفز بشكل حرف L.',
      'انقر إحدى قطعك لإظهار وجهاتها: الأخضر خانة فارغة يمكنك الانتقال إليها، والأحمر قطعة يمكنك أسرها.',
      'عندما يُهاجَم الملك ولا تبقى له حركة آمنة، فذلك كش مات — وتفوز.',
    ],
  },
  reversi: {
    en: [
      'Place a disc so it flanks a straight line of the opponent\'s discs between your new disc and another of yours.',
      'Every disc you trapped flips to your colour. Legal squares show a faint dot.',
      'When the board fills (or nobody can move), whoever owns more discs wins — corners are the most valuable.',
    ],
    ar: [
      'ضع قرصًا بحيث يحصر صفًا مستقيمًا من أقراص الخصم بينه وبين قرص آخر لك.',
      'كل قرص حاصرته ينقلب إلى لونك. الخانات المتاحة تظهر بنقطة خافتة.',
      'عند امتلاء اللوح (أو تعذّر أي حركة) يفوز صاحب الأقراص الأكثر — والأركان هي الأثمن.',
    ],
  },
  go: {
    en: [
      'Take turns placing a stone on the line intersections. Stones don\'t move once placed.',
      'A group with no empty adjacent point ("liberty") is captured and removed.',
      'Surround empty points to make territory. Most territory plus captures wins; two passes end the game.',
    ],
    ar: [
      'تناوبوا وضع حجر على تقاطعات الخطوط. الحجر لا يتحرك بعد وضعه.',
      'المجموعة التي لا يجاورها أي نقطة فارغة ("نَفَس") تُؤسَر وتُزال.',
      'حاصر النقاط الفارغة لتصنع أرضًا. الأكثر أرضًا وأسرى يفوز؛ وتمريران ينهيان اللعبة.',
    ],
  },
  backgammon: {
    en: [
      'Roll two dice and move your checkers toward your home board, one die per move (a double lets you move four times).',
      'A point with a single enemy checker can be hit — it goes to the bar and must re-enter first.',
      'Once all your checkers are home, start bearing them off. First to bear all fifteen off wins.',
    ],
    ar: [
      'ارمِ نردين وحرّك أحجارك نحو بيتك، حركة لكل نرد (والمزدوج يمنحك أربع حركات).',
      'النقطة التي عليها حجر عدو واحد يمكن ضربها — فيذهب إلى الحاجز ويعيد الدخول أولًا.',
      'حين تصل كل أحجارك إلى البيت، ابدأ بإخراجها. أول من يُخرج الخمسة عشر يفوز.',
    ],
  },
};

export function hasTutorial(id) { return !!T[id]; }
export function getTutorial(id, lang) { const t = T[id]; if (!t) return null; return t[lang] || t.en; }
