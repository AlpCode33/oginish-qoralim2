import manifestRaw from '../../extension/manifest.json?raw';
import popupHtmlRaw from '../../extension/popup.html?raw';
import popupJsRaw from '../../extension/popup.js?raw';
import prdRaw from '../../docs/PRD.md?raw';
import specRaw from '../../docs/SPEC.md?raw';
import styleRaw from '../../design/style.md?raw';

export const EXTENSION_FILES = {
  manifest: manifestRaw,
  popupHtml: popupHtmlRaw,
  popupJs: popupJsRaw,
};

export const DOC_FILES = {
  prd: prdRaw,
  spec: specRaw,
  style: styleRaw,
};

export const AI_PROMPT_TEMPLATE = `سەن كەسپىي ئىلمىي تەتقىقاتچى، پېداگوگ ۋە مەزمۇن ئانالىزچىسى.
مەن تۆۋەندە بېرىدىغان كىتاب ياكى دەرسلىك مەزمۇنىنى چوڭقۇر تەھلىل قىلىپ، ئۆگىنىش ئۈچۈن ئەڭ قىممەتلىك، ئېنىق ۋە تەپسىلىي بىلىملەرنى چىقىرىپ بەر.

تەلەپلەر:
1. دەل 30 دانە ئەڭ مۇھىم ۋە تەپسىلىي سوئال-جاۋاب تەييارلا. جاۋابلار قىسقا-تەختە بولماي، ئوقۇغان كىشى شۇ نۇقتىنى تولۇق چۈشىنەلەيدىغان دەرىجىدە چۈشىنىشلىك ۋە ئىلمىي بولسۇن.
2. كىتاب ياكى دەرسلىكتىكى 8–15 دانە ئەڭ مۇھىم سۆزلۈك ۋە ئاتالغۇلارنى (vocabulary) مەنىسى بىلەن چىقىرىپ بەر.
3. كىتابنىڭ يادروسىنى ئەسكەرتىپ تۇرىدىغان 5–10 دانە قىسقا، ئۆتكۈر «مۇھىم ئەسكەرتىش» (reminders) يېزىپ بەر.
4. تىل ئۆلچىمى: ساپ، راۋان ۋە ئىملالىق ئۇيغۇرچە ياز. تارىخىي ۋە جۇغراپىيەلىك ئاتالغۇلاردا مىللىي ئۆلچەمگە قەتئىي رىئايە قىل؛ شەرقىي تۈركىستان ۋە خىتاي ئاتالغۇلىرىنى توغرا ئىشلەت، ئەخلاقىي ۋە ئىلمىي ئۇسلۇبنى ساقلا.
5. چىقىرىش شەكلى: پەقەت ساپ، توغرا JSON فورماتىدا جاۋاب قايتۇر. JSON سىرتىدا ھېچقانداق چۈشەندۈرۈش ياكى قوشۇمچە گەپ يازما.

تۆۋەندىكى JSON قۇرۇلمىسىغا قەتئىي ئەمەل قىل:
{
  "bookTitle": "كىتاب ياكى دەرسلىكنىڭ ئېنىق نامى",
  "category": "تۈرى (مەسىلەن: تارىخ، ئەخلاق، تېخنىكا، تىل)",
  "questions": [
    {
      "id": 1,
      "question": "1-سوئال تېكىستى...",
      "answer": "1-سوئالنىڭ تەپسىلىي، ئېنىق ۋە چۈشىنىشلىك جاۋابى...",
      "importance": "ئىنتايىن مۇھىم"
    }
  ],
  "vocabulary": [
    {
      "term": "مۇھىم سۆزلۈك ياكى ئاتالغۇ",
      "meaning": "ئېنىق مەنىسى ۋە قوللىنىلىشى"
    }
  ],
  "reminders": [
    "ئوقۇغۇچى دائىم ئېسىدە تۇتۇشى كېرەك بولغان مۇھىم ئەسكەرتىش..."
  ]
}

كىتاب ياكى دەرسلىك مەزمۇنىنى تۆۋەنگە چاپلايمەن:
[بۇ يەرگە كىتاب ياكى دەرسلىك مەزمۇنىنى چاپلاڭ]`;

export interface StudyQuestion {
  id: string;
  question: string;
  answer: string;
  importance: string;
  mastered: boolean;
  reviewCount: number;
}

export interface StudyVocab {
  id: string;
  term: string;
  meaning: string;
}

export interface StudyReminderNote {
  id: string;
  text: string;
}

export interface StudyBook {
  id: string;
  title: string;
  category: string;
  reminderEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  questions: StudyQuestion[];
  vocabulary: StudyVocab[];
  reminders: StudyReminderNote[];
}

export interface PendingReminder {
  bookId: string;
  bookTitle: string;
  questionId: string;
  question: string;
  answer: string;
  reminderNote: string;
  createdAt: number;
}

export interface ExtensionState {
  version: number;
  settings: {
    globalReminderEnabled: boolean;
    reminderIntervalMinutes: number;
  };
  pendingStartupReminder: PendingReminder | null;
  books: StudyBook[];
}

export const SAMPLE_BOOKS: StudyBook[] = [
  {
    id: 'sample_book_ethics',
    title: 'ئىسلام ئەخلاقى ۋە ئىلىم ئەدەبى',
    category: 'ئەخلاق ۋە تەربىيە',
    reminderEnabled: true,
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    questions: [
      {
        id: 'eq_1',
        question: 'ئىلىم تەلەپ قىلىشتا نىيەتنىڭ ساپ بولۇشى نېمە ئۈچۈن بىرىنچى شەرت ھېسابلىنىدۇ؟',
        answer:
          'ئەھلى سۈننەت ئالىملىرىنىڭ ئىتتىپاقىچە، ئەمەللەر نىيەتكە باغلىق بولىدۇ. ئىلىمنى ئاللاھنىڭ رازىلىقى، ئۆزىنى ۋە جەمئىيەتنى نادانلىقتىن قۇتقۇزۇش ئۈچۈن ئۆگەنگەندە ئۇ ئىلىمگە بەرىكەت قونىدۇ؛ شۆھرەتپەرەسلىك ياكى رىيا ئۈچۈن ئۆگىنىلگەن ئىلىم ئىگىسىگە پايدا بەرمەيدۇ.',
        importance: 'ئىنتايىن مۇھىم',
        mastered: true,
        reviewCount: 2,
      },
      {
        id: 'eq_2',
        question: 'ئۆگەنگەن بىلىمگە ئەمەل قىلىشنىڭ ئۆگىنىش سۈپىتىگە قانداق تەسىرى بار؟',
        answer:
          'بىلىم ئەمەل بىلەن چاقىرىلىدۇ؛ ئەمەل قىلىنغان بىلىم ئەستە چوڭقۇر ئورنايدۇ ۋە يېڭى بىلىملەرنىڭ ئىشىكىنى ئاچىدۇ. ئەمەلسىز بىلىم قۇرۇق يۈك بولۇپ قالىدۇ.',
        importance: 'ئىنتايىن مۇھىم',
        mastered: false,
        reviewCount: 1,
      },
      {
        id: 'eq_3',
        question: 'ئاز بولسىمۇ ئىزچىل داۋاملاشتۇرۇشنىڭ كىتاب ئوقۇش ۋە تەكرارلاشتىكى ئەھمىيىتى نېمە؟',
        answer:
          'ھەر كۈنى مۇقىم ۋاقىت ئاجرىتىپ 3–5 سوئال-جاۋابنى تەكرارلاش بىر قېتىمدىلا كۆپ ئوقۇپ كېيىن تاشلاپ قويۇشتىن نەچچە ھەسسە ئۈنۈملۈك بولۇپ، ئۇزۇن مۇددەتلىك ئەستە تۇتۇشنى مۇستەھكەملەيدۇ.',
        importance: 'مۇھىم',
        mastered: false,
        reviewCount: 0,
      },
    ],
    vocabulary: [
      {
        id: 'ev_1',
        term: 'ئىخلاس',
        meaning: 'بارلىق سۆز، ئەمەل ۋە ئىلىم تەلەپ قىلىش جەريانىدا نىيەتنى پەقەت ئاللاھنىڭ رازىلىقى ئۈچۈن ساپ تۇتۇش.',
      },
      {
        id: 'ev_2',
        term: 'ئىزچىللىق (مۇداۋەمەت)',
        meaning: 'ئاز بولسىمۇ ئۈزۈپ قويماي، ھەر كۈنى تەرتىپلىك داۋاملاشتۇرۇش ئادىتى.',
      },
    ],
    reminders: [
      {
        id: 'er_1',
        text: 'ھەر بىر يېڭى بىلىمنى ئۆگەنگەندە «بۇنى كۈندىلىك تۇرمۇشۇمدا قانداق ئەمەلىيلەشتۈرىمەن؟» دەپ سوراڭ.',
      },
      {
        id: 'er_2',
        text: 'ئاز-ئازدىن، ئەمما ھەر كۈنى تەكرارلاش بىلىمنىڭ مۇستەھكەملىنىشىنىڭ ئەڭ توغرا يولىدۇر.',
      },
    ],
  },
  {
    id: 'sample_book_history',
    title: 'شەرقىي تۈركىستان مەدەنىيەت تارىخى',
    category: 'تارىخ ۋە مەدەنىيەت',
    reminderEnabled: true,
    createdAt: 1732000100000,
    updatedAt: 1732000100000,
    questions: [
      {
        id: 'hq_1',
        question: 'مەھمۇد قەشقەرىنىڭ «دىۋانۇ لۇغەتىت تۈرك» ئەسىرى قايسى جەھەتلەردىن دۇنياۋى ئەھمىيەتكە ئىگە؟',
        answer:
          '11-ئەسىردە قەشقەردىن يېتىشىپ چىققان ئۇلۇغ ئالىم مەھمۇد قەشقەرى يازغان بۇ ئەسەر تۈركىي تىللارنىڭ تۇنجى سېلىشتۇرما لۇغىتى بولۇپلا قالماي، شەرقىي تۈركىستان ۋە تۈرك دۇنياسىنىڭ تىلى، جۇغراپىيەسى، خەرىتىسى ۋە مەدەنىيىتىنىڭ ئەڭ مۇھىم يازما مەنبەسىدۇر.',
        importance: 'ئىنتايىن مۇھىم',
        mastered: false,
        reviewCount: 0,
      },
      {
        id: 'hq_2',
        question: 'يۈسۈپ خاس ھاجىپنىڭ «قۇتادغۇ بىلىگ» داستانىدىكى تۆت ئاساسىي قىممەت قايسىلار؟',
        answer:
          'ئەسەردە دۆلەت ۋە جەمئىيەت تۈزۈمى تۆت تۈۋرۈك ئۈستىگە قۇرۇلىدۇ: كۈنتۇغدى (ئادالەت ۋە قانۇن)، ئايتولدى (دۆلەت ۋە بەخت)، ئۆگدۈلمىش (ئەقىل ۋە بىلىم) ۋە ئودغۇرمىش (قانائەت ۋە ئاقىۋەت).',
        importance: 'ئىنتايىن مۇھىم',
        mastered: false,
        reviewCount: 0,
      },
    ],
    vocabulary: [
      {
        id: 'hv_1',
        term: 'قۇتادغۇ بىلىگ',
        meaning: '«بەختكە ئېرىشتۈرگۈچى بىلىم» مەنىسىدە بولۇپ، 1069–1070-يىللىرى يۈسۈپ خاس ھاجىپ تەرىپىدىن يېزىلغان پەلسەپىۋى-ئەخلاقىي داستان.',
      },
    ],
    reminders: [
      {
        id: 'hr_1',
        text: 'تارىخىي ئاتالغۇلارنى ۋە ئەجدادلارنىڭ ئىلمىي مىراسلىرىنى توغرا ئىسىم-شەرىپى بىلەن ئۆگىنىش مىللىي ئاڭنىڭ ئاساسىدۇر.',
      },
    ],
  },
];

export const SAMPLE_IMPORT_JSON_STRING = JSON.stringify(
  {
    bookTitle: 'بىخەتەر يۇمشاق دېتال قۇرۇلۇشى ئاساسلىرى',
    category: 'تېخنىكا ۋە بىخەتەرلىك',
    questions: [
      {
        id: 1,
        question: 'Chrome Manifest V3 دا نېمە ئۈچۈن ئەڭ ئاز ئىجازەت پرىنسىپى (Least Privilege) مۇھىم؟',
        answer:
          'پەقەت زۆرۈر بولغان ئىجازەتلەرنىلا تەلەپ قىلىش ئارقىلىق قىستۇرمىنىڭ ھۇجۇم يۈزى كىچىكلىتىلىدۇ ۋە ئىشلەتكۈچىنىڭ شەخسىي مەخپىيەتلىكى تولۇق قوغدىلىدۇ.',
        importance: 'ئىنتايىن مۇھىم',
      },
      {
        id: 2,
        question: 'نۆل ئىز قوغلاش (Zero Telemetry) قانداق تېخنىكىلىق ۋاسىتە بىلەن كاپالەتلەندۈرۈلىدۇ؟',
        answer:
          'قاتتىق CSP قائىدىسىدە connect-src none بەلگىلەش، بارلىق كود ۋە ئۇسلۇبلارنى يەرلىكتە ساقلاش ھەمدە سانلىق مەلۇماتنى پەقەت chrome.storage.local دا ساقلاش ئارقىلىق كاپالەتلەندۈرۈلىدۇ.',
        importance: 'ئىنتايىن مۇھىم',
      },
      {
        id: 3,
        question: 'DOM سىزىشتا innerHTML ئورنىغا textContent ئىشلىتىش قايسى خەتەرنى توسىدۇ؟',
        answer:
          'سىرتتىن يۈكلەنگەن JSON تېكىستى ئىچىدە زىيانلىق HTML ياكى JavaScript بولسىمۇ ئىجرا قىلىنماي ساپ تېكىست سۈپىتىدە كۆرسىتىلىدۇ، نەتىجىدە XSS ھۇجۇمىنىڭ ئالدى تولۇق ئېلىنىدۇ.',
        importance: 'مۇھىم',
      },
    ],
    vocabulary: [
      {
        term: 'CSP (مەزمۇن بىخەتەرلىك سىياسىتى)',
        meaning: 'تور كۆرگۈچنىڭ قايسى كود، ئۇسلۇب ۋە تور ئۇلىنىشىغا رۇخسەت قىلىدىغانلىقىنى چەكلەيدىغان بىخەتەرلىك قاتلىمى.',
      },
      {
        term: 'chrome.storage.local',
        meaning: 'قىستۇرمىنىڭ سانلىق مەلۇماتلىرىنى پەقەت ئىشلەتكۈچىنىڭ ئۆز كومپيۇتېرىدا مەڭگۈلۈك ساقلايدىغان يەرلىك ئامبار.',
      },
    ],
    reminders: [
      'ئىشەنچلىك قىستۇرما ھەرگىز ئارتۇقچە رۇخسەت تەلەپ قىلمايدۇ ۋە ئىشلەتكۈچى سانلىق مەلۇماتىنى سىرتقا يوللىمايدۇ.',
    ],
  },
  null,
  2
);
