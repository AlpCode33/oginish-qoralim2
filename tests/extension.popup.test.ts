import { describe, it, expect } from 'vitest';
import { flushMicrotasks, loadPopupDomEnv } from './helpers/chromeMock';

const SAMPLE_STORAGE = {
  oginish_qoralim_state_v1: {
    version: 1,
    settings: {
      globalReminderEnabled: true,
      reminderIntervalMinutes: 0,
    },
    pendingStartupReminder: {
      bookId: 'book_1',
      bookTitle: 'بىرىنچى كىتاب',
      questionId: 'q1',
      question: 'ئىلىمنىڭ ئاساسى نېمە؟',
      answer: 'ساپ نىيەت ۋە ئەمەل.',
      reminderNote: 'ھەر كۈنى تەكرارلاڭ',
      createdAt: 1732000000000,
    },
    books: [
      {
        id: 'book_1',
        title: 'بىرىنچى كىتاب',
        category: 'ئەخلاق',
        reminderEnabled: true,
        createdAt: 1732000000000,
        updatedAt: 1732000000000,
        questions: [
          {
            id: 'q1',
            question: 'ئىلىمنىڭ ئاساسى نېمە؟',
            answer: 'ساپ نىيەت ۋە ئەمەل.',
            importance: 'ئىنتايىن مۇھىم',
            mastered: false,
            reviewCount: 0,
          },
          {
            id: 'q2',
            question: 'ئىزچىللىق دېگەن نېمە؟',
            answer: 'ئاز بولسىمۇ ئۈزۈپ قويماسلىق.',
            importance: 'مۇھىم',
            mastered: true,
            reviewCount: 1,
          },
        ],
        vocabulary: [
          { id: 'v1', term: 'ئىخلاس', meaning: 'نىيەتنى ساپ تۇتۇش' },
        ],
        reminders: [{ id: 'r1', text: 'ھەر كۈنى تەكرارلاڭ' }],
      },
    ],
  },
};

describe('Popup كۆرۈنمە يۈزى (JSDOM) بارلىق فۇنكسىيەلەر تېستى', () => {
  it('باش بەت بوش ھالەتنى ۋە كىتاب تىزىملىكىنى توغرا سىزىدۇ', async () => {
    const emptyEnv = await loadPopupDomEnv();
    expect(emptyEnv.document.getElementById('booksEmpty')?.hidden).toBe(false);
    expect(emptyEnv.document.getElementById('bookList')?.children.length).toBe(0);

    const env = await loadPopupDomEnv({ initialStorage: SAMPLE_STORAGE });
    const doc = env.document;
    expect(doc.getElementById('booksEmpty')?.hidden).toBe(true);
    expect(doc.getElementById('bookList')?.children.length).toBe(1);
    expect(doc.getElementById('vocabCountMeta')?.textContent).toBe('1 سۆزلۈك');
    expect(doc.getElementById('reminderStatusMeta')?.textContent).toBe('ئوچۇق (1)');

    // Startup ئەسكەرتمە تاختىسى كۆرۈنۈشى ۋە جاۋاب ئېچىش/تاقاش
    const banner = doc.getElementById('startupBanner')!;
    expect(banner.classList.contains('visible')).toBe(true);
    expect(doc.getElementById('startupQuestion')?.textContent).toBe('ئىلىمنىڭ ئاساسى نېمە؟');

    const revealBtn = doc.getElementById('btnStartupReveal') as HTMLButtonElement;
    revealBtn.click();
    expect(doc.getElementById('startupAnswer')?.classList.contains('visible')).toBe(true);
    expect(revealBtn.textContent).toBe('جاۋابنى يوشۇرۇش');

    const dismissBtn = doc.getElementById('btnStartupDismiss') as HTMLButtonElement;
    dismissBtn.click();
    await flushMicrotasks();
    expect(banner.classList.contains('visible')).toBe(false);
    expect(env.mock.badgeTextHistory).toContain('');
  });

  it('كىتابنىڭ ئەسكەرتمە رامكىسىنى ئېچىپ-ئۆچۈرۈش ساقلاشتا دەرھال ئەكس ئېتىدۇ', async () => {
    const env = await loadPopupDomEnv({ initialStorage: SAMPLE_STORAGE });
    const checkbox = env.document.querySelector(
      '#bookList input[type="checkbox"]'
    ) as HTMLInputElement;

    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new env.window.Event('change'));
    await flushMicrotasks();

    const stored = env.mock.storageData.oginish_qoralim_state_v1 as {
      books: Array<{ reminderEnabled: boolean }>;
    };
    expect(stored.books[0].reminderEnabled).toBe(false);
  });

  it('جىسون ئۈچۈن پرومپىت كۆچۈرۈش كۇنۇپكىسى ھەم clipboard API ھەم زاپاس ئۇسۇل بىلەن ئىشلەيدۇ', async () => {
    const env1 = await loadPopupDomEnv();
    (env1.document.getElementById('btnCopyPrompt') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(env1.copiedTexts).toHaveLength(1);
    expect(env1.copiedTexts[0]).toContain('دەل 30 دانە');
    expect(env1.copiedTexts[0]).toContain('شەرقىي تۈركىستان');

    // clipboard.writeText مەغلۇپ بولغاندا execCommand زاپاس ئۇسۇلى ئىشلەيدۇ
    const env2 = await loadPopupDomEnv({ clipboardShouldFail: true, execCommandResult: true });
    (env2.document.getElementById('btnCopyPrompt') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(env2.copiedTexts).toHaveLength(1);

    // ئىككىلىسى مەغلۇپ بولغاندا خاتالىق toast چىقىدۇ
    const env3 = await loadPopupDomEnv({ clipboardShouldFail: true, execCommandResult: false });
    (env3.document.getElementById('btnCopyPrompt') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(env3.document.getElementById('toast')?.classList.contains('error')).toBe(true);
  });

  it('كىتاب قوشۇش: JSON تەھلىل قىلىش، خاتالىق تۇتۇش، Markdown تازىلاش، ھۆججەت يۈكلەش ۋە XSS مۇداپىئەسى', async () => {
    const env = await loadPopupDomEnv();
    const doc = env.document;

    (doc.getElementById('btnOpenAdd') as HTMLButtonElement).click();
    expect(doc.getElementById('viewAdd')?.classList.contains('active')).toBe(true);

    const saveBtn = doc.getElementById('btnSaveBook') as HTMLButtonElement;
    const titleInput = doc.getElementById('inputBookTitle') as HTMLInputElement;
    const jsonInput = doc.getElementById('inputJsonText') as HTMLTextAreaElement;
    const errBox = doc.getElementById('addErrorBox')!;
    const errText = doc.getElementById('addErrorText')!;

    // 1) بوش كىرگۈزۈش خاتالىقى
    saveBtn.click();
    expect(errBox.classList.contains('visible')).toBe(true);
    expect(errText.textContent).toContain('بوش');

    // 2) خاتا JSON خاتالىقى
    jsonInput.value = '{broken}';
    saveBtn.click();
    expect(errBox.classList.contains('visible')).toBe(true);
    expect(errText.textContent).toContain('فورماتى توغرا ئەمەس');

    // 3) questions يوق JSON
    jsonInput.value = '{"bookTitle":"بىر كىتاب"}';
    saveBtn.click();
    expect(errText.textContent).toContain('questions');

    // 4) كىتاب ئىسمى يوق تىزىملىك JSON
    jsonInput.value = '[{"question":"س1","answer":"ج1"}]';
    saveBtn.click();
    expect(errText.textContent).toContain('كىتاب ياكى بىلىم ئىسمىنى يېزىڭ');

    // 5) Markdown ```json + BOM + زىيانلىق XSS <script> تېگى بار JSON نى ساقلاش
    jsonInput.value =
      '\uFEFF```json\n' +
      JSON.stringify({
        bookTitle: 'بىخەتەر كىتاب <script>window.__xss=1</script>',
        questions: [
          { question: '<b>سوئال 1</b>', answer: '<img src=x onerror=alert(1)> جاۋاب 1' },
        ],
        vocabulary: [{ term: 'CSP', meaning: 'مەزمۇن بىخەتەرلىك سىياسىتى' }],
        reminders: ['سىرتقا ئۇلىنىش يوق'],
      }) +
      '\n```';
    titleInput.value = '';
    saveBtn.click();
    await flushMicrotasks();

    // باش بەتكە قايتىپ ساقلانغان بولۇشى كېرەك
    expect(doc.getElementById('viewHome')?.classList.contains('active')).toBe(true);
    expect(doc.getElementById('bookList')?.children.length).toBe(1);
    // XSS تېگى ئىجرا قىلىنماي ساپ تېكىست سۈپىتىدە چىققان
    expect(doc.querySelectorAll('#bookList script')).toHaveLength(0);
    expect(doc.querySelector('.book-name-line')?.textContent).toContain('<script>');
  });

  it('كىتاب قوشۇش: FileReader ئارقىلىق .json ھۆججىتىنى يۈكلەپ كىتاب نامىنى ئاپتوماتىك تولدۇرىدۇ', async () => {
    const env = await loadPopupDomEnv();
    const doc = env.document;
    (doc.getElementById('btnOpenAdd') as HTMLButtonElement).click();

    const fileInput = doc.getElementById('inputJsonFile') as HTMLInputElement;
    const jsonFile = new env.window.File(
      [JSON.stringify({ bookTitle: 'ھۆججەت كىتابى', questions: [{ q: 'س', a: 'ج' }] })],
      'test-book.json',
      { type: 'application/json' }
    );

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [jsonFile],
    });
    fileInput.dispatchEvent(new env.window.Event('change'));

    // FileReader ئاسىنخرون ئوقۇشىنى كۈتىمىز
    await new Promise((r) => setTimeout(r, 40));
    expect(doc.getElementById('fileDropText')?.textContent).toContain('test-book.json');
    expect((doc.getElementById('inputBookTitle') as HTMLInputElement).value).toBe('ھۆججەت كىتابى');
    expect((doc.getElementById('inputJsonText') as HTMLTextAreaElement).value).toContain('ھۆججەت كىتابى');
  });

  it('ئۆگىنىش كۆرۈنۈشى: سۈزگۈچ، جاۋاب ئېچىش، ئىگىلەش، ئالدىنقى/كېيىنكى سوئال، زاپاس چۈشۈرۈش ۋە 2 باسقۇچلۇق ئۆچۈرۈش', async () => {
    const env = await loadPopupDomEnv({ initialStorage: SAMPLE_STORAGE });
    const doc = env.document;

    // كىتابنى ئېچىش
    (doc.querySelector('.book-open-btn') as HTMLButtonElement).click();
    expect(doc.getElementById('viewStudy')?.classList.contains('active')).toBe(true);
    expect(doc.getElementById('headerTitle')?.textContent).toBe('بىرىنچى كىتاب');
    expect(doc.getElementById('studyCounter')?.textContent).toBe('1 / 2');

    // جاۋابنى كۆرۈش/يوشۇرۇش
    const toggleAnsBtn = doc.getElementById('btnToggleAnswer') as HTMLButtonElement;
    toggleAnsBtn.click();
    expect(doc.getElementById('studyAnswerBox')?.classList.contains('visible')).toBe(true);
    toggleAnsBtn.click();
    expect(doc.getElementById('studyAnswerBox')?.classList.contains('visible')).toBe(false);

    // كېيىنكى/ئالدىنقى سوئالغا ئۆتۈش
    (doc.getElementById('btnNextQ') as HTMLButtonElement).click();
    expect(doc.getElementById('studyCounter')?.textContent).toBe('2 / 2');
    (doc.getElementById('btnPrevQ') as HTMLButtonElement).click();
    expect(doc.getElementById('studyCounter')?.textContent).toBe('1 / 2');

    // سۈزگۈچلەر: ئۆگىنىلمىگەن (1 دانە بار)
    const unmasteredTab = doc.querySelector('.seg-btn[data-filter="unmastered"]') as HTMLButtonElement;
    unmasteredTab.click();
    expect(doc.getElementById('studyCounter')?.textContent).toBe('1 / 1');

    // ئۆگەندىم بەلگىسى قويۇش -> ئۆگىنىلمىگەن تىزىملىكى بوشىشى كېرەك
    (doc.getElementById('btnMarkMastered') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(doc.getElementById('studyEmptyFilter')?.hidden).toBe(false);

    // ھەممىسىگە قايتىپ قايتا كۆرىمەن بەلگىسى قويۇش
    (doc.querySelector('.seg-btn[data-filter="all"]') as HTMLButtonElement).click();
    (doc.getElementById('btnMarkReview') as HTMLButtonElement).click();
    await flushMicrotasks();

    // زاپاس JSON چۈشۈرۈش
    (doc.getElementById('btnExportBook') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(env.downloadedBlobs).toHaveLength(1);
    expect(env.downloadedBlobs[0].filename).toMatch(/^kitab-zapas-.*\.json$/);
    expect(env.downloadedBlobs[0].text).toContain('بىرىنچى كىتاب');

    // 2 باسقۇچلۇق ئۆچۈرۈش
    const delBtn = doc.getElementById('btnDeleteBook') as HTMLButtonElement;
    delBtn.click();
    expect(delBtn.textContent).toBe('ئۆچۈرۈشنى جەزملەڭ');
    delBtn.click();
    await flushMicrotasks();

    expect(doc.getElementById('viewHome')?.classList.contains('active')).toBe(true);
    expect(doc.getElementById('booksEmpty')?.hidden).toBe(false);
  });

  it('مۇھىم سۆزلۈكلەر كۆرۈنۈشى: سۈزۈش، ئىزدەش ۋە يېڭى سۆزلۈك قوشۇش', async () => {
    const env = await loadPopupDomEnv({ initialStorage: SAMPLE_STORAGE });
    const doc = env.document;

    (doc.getElementById('btnOpenVocab') as HTMLButtonElement).click();
    expect(doc.getElementById('viewVocab')?.classList.contains('active')).toBe(true);
    expect(doc.getElementById('vocabList')?.children.length).toBe(1);

    // ئىزدەش بىلەن تېپىلمايدىغان ھالەت
    const search = doc.getElementById('vocabSearch') as HTMLInputElement;
    search.value = 'تېپىلمايدىغان';
    search.dispatchEvent(new env.window.Event('input'));
    expect(doc.getElementById('vocabEmpty')?.hidden).toBe(false);

    search.value = '';
    search.dispatchEvent(new env.window.Event('input'));

    // بوش قوشۇش خاتالىقى
    (doc.getElementById('btnAddVocab') as HTMLButtonElement).click();
    expect(doc.getElementById('toast')?.classList.contains('error')).toBe(true);

    // توغرا يېڭى سۆزلۈك قوشۇش
    (doc.getElementById('newVocabTerm') as HTMLInputElement).value = 'مۇداۋەمەت';
    (doc.getElementById('newVocabMeaning') as HTMLInputElement).value = 'ئىزچىل داۋاملاشتۇرۇش';
    (doc.getElementById('btnAddVocab') as HTMLButtonElement).click();
    await flushMicrotasks();

    expect(doc.getElementById('vocabList')?.children.length).toBe(2);
  });

  it('مۇھىم ئەسكەرتىش كۆرۈنۈشى: ئومۇمىي تەڭشەك، ئارىلىق، سىناق ئۇقتۇرۇشى ۋە يېڭى ئەسكەرتىش قوشۇش', async () => {
    const env = await loadPopupDomEnv({ initialStorage: SAMPLE_STORAGE });
    const doc = env.document;

    (doc.getElementById('btnOpenReminders') as HTMLButtonElement).click();
    expect(doc.getElementById('viewReminders')?.classList.contains('active')).toBe(true);
    expect(doc.getElementById('remindersList')?.children.length).toBe(1);

    // ئومۇمىي ئەسكەرتمىنى ئۆچۈرۈش
    const globalChk = doc.getElementById('chkGlobalReminder') as HTMLInputElement;
    globalChk.checked = false;
    globalChk.dispatchEvent(new env.window.Event('change'));
    await flushMicrotasks();
    expect(env.mock.sentMessages).toContainEqual({ type: 'SYNC_ALARM' });

    // ئارىلىقنى 180 مىنۇت قىلىش
    const intervalSel = doc.getElementById('selectInterval') as HTMLSelectElement;
    intervalSel.value = '180';
    intervalSel.dispatchEvent(new env.window.Event('change'));
    await flushMicrotasks();

    // يېڭى ئەسكەرتىش قوشۇش
    (doc.getElementById('newReminderText') as HTMLInputElement).value = 'ئىلىم ئەمەل بىلەن گۈزەلدۇر';
    (doc.getElementById('btnAddReminderNote') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(doc.getElementById('remindersList')?.children.length).toBe(2);

    // سىناق ئۇقتۇرۇشىنى چېكىش -> باش بەتكە قايتىپ ئەسكەرتمە تاختىسىنى چىقىرىدۇ
    (doc.getElementById('btnTestNotification') as HTMLButtonElement).click();
    await flushMicrotasks(12);
    expect(doc.getElementById('viewHome')?.classList.contains('active')).toBe(true);
    expect(env.mock.createdNotifications.length).toBeGreaterThanOrEqual(1);

    // باش بەتكە قايتىش كۇنۇپكىسىنى سىناش
    (doc.getElementById('btnOpenVocab') as HTMLButtonElement).click();
    (doc.getElementById('btnBack') as HTMLButtonElement).click();
    expect(doc.getElementById('viewHome')?.classList.contains('active')).toBe(true);
  });
});
