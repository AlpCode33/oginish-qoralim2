import { describe, it, expect } from 'vitest';
import {
  createChromeMock,
  flushMicrotasks,
  loadServiceWorkerEnv,
} from './helpers/chromeMock';

describe('popup.js يادرولۇق فۇنكسىيەلەر ۋە Service Worker ئارقا سۇپا تېستلىرى', () => {
  it('createDefaultState دەسلەپكى توغرا ھالەت ئوبيېكتىنى قايتۇرىدۇ', () => {
    const { exports } = loadServiceWorkerEnv();
    const state = exports.createDefaultState();

    expect(state).toEqual({
      version: 1,
      settings: {
        globalReminderEnabled: true,
        reminderIntervalMinutes: 0,
      },
      pendingStartupReminder: null,
      books: [],
    });
  });

  it('safeString بوشلۇقلارنى تازىلايدۇ، null/undefined نى بىر تەرەپ قىلىدۇ ۋە ئۇزۇنلۇقنى چەكلەيدۇ', () => {
    const { exports } = loadServiceWorkerEnv();

    expect(exports.safeString(null)).toBe('');
    expect(exports.safeString(undefined)).toBe('');
    expect(exports.safeString(12345)).toBe('12345');
    expect(exports.safeString('   ئۆگىنىش قورالىم   ')).toBe('ئۆگىنىش قورالىم');
    expect(exports.safeString('abcdef', 3)).toBe('abc');
  });

  it('generateId بېرىلگەن ئالدى قوشۇلغۇچى بىلەن بىردىنبىر ID ھاسىل قىلىدۇ', () => {
    const { exports } = loadServiceWorkerEnv();
    const id1 = exports.generateId('book');
    const id2 = exports.generateId('book');

    expect(id1.startsWith('book_')).toBe(true);
    expect(id2.startsWith('book_')).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('normalizeState بۇزۇق ياكى تولۇق ئەمەس سانلىق مەلۇماتلارنى بىخەتەر نورماللاشتۇرىدۇ', () => {
    const { exports } = loadServiceWorkerEnv();

    expect(exports.normalizeState(null)).toEqual(exports.createDefaultState());
    expect(exports.normalizeState('invalid')).toEqual(exports.createDefaultState());

    const normalized = exports.normalizeState({
      settings: {
        globalReminderEnabled: false,
        reminderIntervalMinutes: 999, // ئىناۋەتسىز ئارىلىق -> 0 غا قايتىدۇ
      },
      pendingStartupReminder: {
        bookId: 'b1',
        question: '', // بوش سوئال بولسا null قىلىنىدۇ
      },
      books: [
        null,
        {
          id: 'b1',
          title: '  تارىخ دەرسى  ',
          reminderEnabled: false,
          questions: [
            { question: '', answer: 'بوش سوئال چىقىرىۋېتىلىدۇ' },
            { question: '1-سوئال', answer: '', mastered: 1, reviewCount: '3' },
          ],
          vocabulary: [
            { term: '', meaning: 'بوش ئاتالغۇ چىقىرىۋېتىلىدۇ' },
            { term: 'ئىخلاس', meaning: 'ساپ نىيەت' },
          ],
          reminders: ['ئەسكەرتىش 1', { text: 'ئەسكەرتىش 2' }, { text: '' }],
        },
      ],
    }) as {
      settings: { globalReminderEnabled: boolean; reminderIntervalMinutes: number };
      pendingStartupReminder: unknown;
      books: Array<{
        id: string;
        title: string;
        reminderEnabled: boolean;
        questions: Array<{ id: string; question: string; answer: string; mastered: boolean; reviewCount: number }>;
        vocabulary: Array<{ term: string; meaning: string }>;
        reminders: Array<{ id: string; text: string }>;
      }>;
    };

    expect(normalized.settings.globalReminderEnabled).toBe(false);
    expect(normalized.settings.reminderIntervalMinutes).toBe(0);
    expect(normalized.pendingStartupReminder).toBeNull();
    expect(normalized.books).toHaveLength(1);
    expect(normalized.books[0].title).toBe('تارىخ دەرسى');
    expect(normalized.books[0].reminderEnabled).toBe(false);
    expect(normalized.books[0].questions).toHaveLength(1);
    expect(normalized.books[0].questions[0]).toMatchObject({
      question: '1-سوئال',
      answer: 'جاۋاب كىرگۈزۈلمىگەن.',
      mastered: true,
      reviewCount: 3,
    });
    expect(normalized.books[0].vocabulary).toHaveLength(1);
    expect(normalized.books[0].reminders).toHaveLength(2);
  });

  it('normalizeState ئىناۋەتلىك 60 ۋە 180 مىنۇت ئارىلىقى ھەمدە pendingStartupReminder نى ساقلاپ قالىدۇ', () => {
    const { exports } = loadServiceWorkerEnv();
    const res60 = exports.normalizeState({
      settings: { reminderIntervalMinutes: 60 },
      pendingStartupReminder: {
        bookId: 'b1',
        bookTitle: 'كىتاب',
        questionId: 'q1',
        question: 'سوئال بارمۇ؟',
        answer: 'ھەئە',
      },
    }) as {
      settings: { reminderIntervalMinutes: number };
      pendingStartupReminder: { question: string; bookTitle: string } | null;
    };

    expect(res60.settings.reminderIntervalMinutes).toBe(60);
    expect(res60.pendingStartupReminder?.question).toBe('سوئال بارمۇ؟');

    const res180 = exports.normalizeState({ settings: { reminderIntervalMinutes: 180 } }) as {
      settings: { reminderIntervalMinutes: number };
    };
    expect(res180.settings.reminderIntervalMinutes).toBe(180);
  });

  it('readStorageState ۋە writeStorageState Chrome يەرلىك ساقلاشتا توغرا ئىشلەيدۇ ۋە خاتالىقنى بىخەتەر تۇتىدۇ', async () => {
    const { exports, mock } = loadServiceWorkerEnv();

    const initial = await exports.readStorageState();
    expect(initial.books).toEqual([]);

    await exports.writeStorageState({
      version: 1,
      books: [
        {
          id: 'book_1',
          title: 'سىناق كىتاب',
          questions: [{ id: 'q1', question: 'س1', answer: 'ج1' }],
        },
      ],
    });

    const loaded = (await exports.readStorageState()) as { books: Array<{ title: string }> };
    expect(loaded.books).toHaveLength(1);
    expect(loaded.books[0].title).toBe('سىناق كىتاب');

    // chrome.runtime.lastError تەقلىدى
    mock.setLastError('Quota exceeded');
    await expect(exports.writeStorageState(loaded)).rejects.toThrow('Quota exceeded');
    const fallbackRead = await exports.readStorageState();
    expect(fallbackRead).toEqual(exports.createDefaultState());
    mock.setLastError(null);
  });

  it('chrome API بولمىغاندا readStorageState ۋە writeStorageState localStorage ئارقىلىق ئىشلەيدۇ', async () => {
    const localStorageMap = new Map<string, string>();
    const { exports } = loadServiceWorkerEnv({ disableChrome: true, localStorageMap });

    await exports.writeStorageState({
      books: [{ id: 'ls1', title: 'يەرلىك كىتاب', questions: [{ question: 'س', answer: 'ج' }] }],
    });

    expect(localStorageMap.has(exports.STORAGE_KEY)).toBe(true);
    const readBack = (await exports.readStorageState()) as { books: Array<{ title: string }> };
    expect(readBack.books[0].title).toBe('يەرلىك كىتاب');

    // بۇزۇلغان JSON بولسا defaultState قايتىدۇ
    localStorageMap.set(exports.STORAGE_KEY, '{broken_json');
    expect(await exports.readStorageState()).toEqual(exports.createDefaultState());
  });

  it('pickReminderPayload ئىگىلەنمىگەن سوئاللارنى ئالدىن تاللايدۇ ۋە ئۆچۈك كىتابلاردىن ئاتلايدۇ', () => {
    const { exports } = loadServiceWorkerEnv();

    expect(exports.pickReminderPayload({ books: [] })).toBeNull();
    expect(
      exports.pickReminderPayload({
        books: [{ id: 'b1', title: 'ئۆچۈك', reminderEnabled: false, questions: [{ question: 'س', answer: 'ج' }] }],
      })
    ).toBeNull();

    const payload = exports.pickReminderPayload({
      books: [
        {
          id: 'b1',
          title: 'ئىگىلەش سىنىقى',
          reminderEnabled: true,
          questions: [
            { id: 'q_done', question: 'ئىگىلەنگەن', answer: 'ج1', mastered: true },
            { id: 'q_todo', question: 'ئۆگىنىلمىگەن', answer: 'ج2', mastered: false },
          ],
          reminders: [{ id: 'r1', text: 'مۇھىم نۇقتا' }],
        },
      ],
    }) as { questionId: string; reminderNote: string; bookTitle: string };

    expect(payload).not.toBeNull();
    expect(payload.bookTitle).toBe('ئىگىلەش سىنىقى');
    expect(payload.questionId).toBe('q_todo');
    expect(payload.reminderNote).toBe('مۇھىم نۇقتا');

    // ھەممىسى ئىگىلىنىپ بولغان بولسا قايتا تەكرارلاش ئۈچۈن بارلىق سوئاللاردىن تاللايدۇ
    const allMasteredPayload = exports.pickReminderPayload({
      books: [
        {
          id: 'b2',
          title: 'تولۇق ئىگىلەنگەن',
          reminderEnabled: true,
          questions: [{ id: 'q_only', question: 'س1', answer: 'ج1', mastered: true }],
          reminders: [],
        },
      ],
    }) as { questionId: string; reminderNote: string };
    expect(allMasteredPayload.questionId).toBe('q_only');
    expect(allMasteredPayload.reminderNote).toBe('');
  });

  it('syncPeriodicAlarm ئارىلىق ۋە ئومۇمىي ئەسكەرتمە ھالىتىگە قاراپ alarm قۇرىدۇ ياكى ئۆچۈرىدۇ', () => {
    const { exports, mock } = loadServiceWorkerEnv();

    exports.syncPeriodicAlarm({ globalReminderEnabled: true, reminderIntervalMinutes: 0 });
    expect(mock.clearedAlarms).toContain(exports.ALARM_NAME);
    expect(mock.createdAlarms).toHaveLength(0);

    exports.syncPeriodicAlarm({ globalReminderEnabled: true, reminderIntervalMinutes: 60 });
    expect(mock.createdAlarms).toHaveLength(1);
    expect(mock.createdAlarms[0]).toEqual({
      name: exports.ALARM_NAME,
      info: { periodInMinutes: 60 },
    });

    exports.syncPeriodicAlarm({ globalReminderEnabled: false, reminderIntervalMinutes: 180 });
    expect(mock.createdAlarms).toHaveLength(1);
  });

  it('triggerStudyReminder ساقلاش، ئۇقتۇرۇش چىقىرىش ۋە قىستۇرما بەلگىسىنى يېڭىلايدۇ', async () => {
    const mock = createChromeMock();
    const { exports } = loadServiceWorkerEnv({ chromeMock: mock });

    // كىتاب يوق چاغدا
    const noBooksRes = await exports.triggerStudyReminder(false);
    expect(noBooksRes).toEqual({ triggered: false, reason: 'no_books' });

    // ئومۇمىي ئەسكەرتمە ئۆچۈك چاغدا
    await exports.writeStorageState({
      settings: { globalReminderEnabled: false, reminderIntervalMinutes: 0 },
      books: [
        {
          id: 'b1',
          title: 'ئەخلاق كىتابى',
          reminderEnabled: true,
          questions: [{ id: 'q1', question: 'نېمە ئۈچۈن ئىخلاس مۇھىم؟', answer: 'چۈنكى نىيەت ئاساس' }],
        },
      ],
    });
    expect(await exports.triggerStudyReminder(false)).toEqual({
      triggered: false,
      reason: 'disabled',
    });

    // forceTrigger = true بولغاندا چوقۇم چىقىدۇ
    const forced = await exports.triggerStudyReminder(true);
    expect(forced.triggered).toBe(true);
    expect(forced.payload?.bookTitle).toBe('ئەخلاق كىتابى');
    expect(mock.badgeTextHistory).toContain('1');
    expect(mock.badgeColorHistory).toContain('#1E5FE3');
    expect(mock.createdNotifications).toHaveLength(1);
    expect(mock.createdNotifications[0].options.title).toContain('ئەخلاق كىتابى');
    expect(String(mock.createdNotifications[0].options.iconUrl)).toMatch(/^data:image\/png;base64,/);
  });

  it('Service Worker ۋەقە تىڭشىغۇچلىرى (onInstalled, onStartup, onAlarm, onClicked, onMessage) تولۇق ئىشلەيدۇ', async () => {
    const mock = createChromeMock({
      oginish_qoralim_state_v1: {
        version: 1,
        settings: { globalReminderEnabled: true, reminderIntervalMinutes: 60 },
        pendingStartupReminder: null,
        books: [
          {
            id: 'b_sw',
            title: 'تارىخ',
            reminderEnabled: true,
            questions: [{ id: 'q1', question: 'تارىخىي سوئال؟', answer: 'تارىخىي جاۋاب' }],
          },
        ],
      },
    });
    const { exports } = loadServiceWorkerEnv({ chromeMock: mock });

    mock.emitInstalled();
    await flushMicrotasks();
    expect(mock.createdAlarms.some((a) => a.info.periodInMinutes === 60)).toBe(true);

    mock.emitStartup();
    await flushMicrotasks(12);
    expect(mock.createdNotifications.length).toBeGreaterThanOrEqual(1);

    mock.emitAlarm(exports.ALARM_NAME);
    await flushMicrotasks(12);
    expect(mock.createdNotifications.length).toBeGreaterThanOrEqual(2);

    mock.emitNotificationClicked('notif_123');
    expect(mock.clearedNotifications).toContain('notif_123');
    expect(mock.openPopupCalls).toBe(1);

    const msgRes = (await mock.emitMessage({ type: 'TRIGGER_TEST_REMINDER' })) as {
      triggered: boolean;
    };
    expect(msgRes.triggered).toBe(true);

    const syncRes = (await mock.emitMessage({ type: 'SYNC_ALARM' })) as { ok: boolean };
    expect(syncRes.ok).toBe(true);

    const unknownRes = await mock.emitMessage({ type: 'UNKNOWN_EVENT' });
    expect(unknownRes).toBeUndefined();
  });
});
