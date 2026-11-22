import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Upload, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import {
  AI_PROMPT_TEMPLATE,
  ExtensionState,
  SAMPLE_BOOKS,
  StudyBook,
} from '../data/extensionAssets';
import { triggerFileDownload } from '../utils/zipBuilder';

const SIM_STORAGE_KEY = 'oginish_qoralim_sim_state_v1';

type SimView = 'home' | 'study' | 'vocabulary' | 'reminders' | 'add';
type StudyFilter = 'all' | 'unmastered' | 'mastered';

interface ExtensionSimulatorProps {
  externalStartupTrigger: number;
  onSimulatedNotification?: (title: string, question: string) => void;
}

function stripCodeFences(raw: string): string {
  let cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

function loadInitialState(): ExtensionState {
  try {
    const saved = localStorage.getItem(SIM_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ExtensionState;
      if (parsed && Array.isArray(parsed.books)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to initial sample books
  }
  return {
    version: 1,
    settings: {
      globalReminderEnabled: true,
      reminderIntervalMinutes: 0,
    },
    pendingStartupReminder: null,
    books: SAMPLE_BOOKS,
  };
}

export const ExtensionSimulator: React.FC<ExtensionSimulatorProps> = ({
  externalStartupTrigger,
  onSimulatedNotification,
}) => {
  const [state, setState] = useState<ExtensionState>(loadInitialState);
  const [view, setView] = useState<SimView>('home');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [studyFilter, setStudyFilter] = useState<StudyFilter>('all');
  const [studyIndex, setStudyIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [startupReveal, setStartupReveal] = useState(false);

  // Vocabulary state
  const [vocabBookFilter, setVocabBookFilter] = useState('all');
  const [vocabSearch, setVocabSearch] = useState('');
  const [newVocabTerm, setNewVocabTerm] = useState('');
  const [newVocabMeaning, setNewVocabMeaning] = useState('');

  // Reminders state
  const [newReminderText, setNewReminderText] = useState('');

  // Add Book state
  const [bookTitleInput, setBookTitleInput] = useState('');
  const [jsonTextInput, setJsonTextInput] = useState('');
  const [fileLabel, setFileLabel] = useState('كومپيۇتېردىن .json ھۆججەت تاللاش');
  const [newBookReminder, setNewBookReminder] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(externalStartupTrigger);

  useEffect(() => {
    try {
      localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota fallback
    }
  }, [state]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  const triggerSimulatedReminder = (force = false) => {
    if (!force && !state.settings.globalReminderEnabled) {
      showToast('ئومۇمىي ئەسكەرتمە ئۆچۈرۈلگەن.', 'error');
      return;
    }
    const eligible = state.books.filter((b) => b.reminderEnabled && b.questions.length > 0);
    if (eligible.length === 0) {
      showToast('ئەسكەرتمە تاللانغان كىتاب تېپىلمىدى.', 'error');
      return;
    }
    const chosenBook = eligible[Math.floor(Math.random() * eligible.length)];
    const unmastered = chosenBook.questions.filter((q) => !q.mastered);
    const pool = unmastered.length > 0 ? unmastered : chosenBook.questions;
    const chosenQ = pool[Math.floor(Math.random() * pool.length)];

    setState((prev) => ({
      ...prev,
      pendingStartupReminder: {
        bookId: chosenBook.id,
        bookTitle: chosenBook.title,
        questionId: chosenQ.id,
        question: chosenQ.question,
        answer: chosenQ.answer,
        reminderNote: chosenBook.reminders[0]?.text || '',
        createdAt: Date.now(),
      },
    }));
    setStartupReveal(false);
    setView('home');
    onSimulatedNotification?.(chosenBook.title, chosenQ.question);
  };

  useEffect(() => {
    if (externalStartupTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = externalStartupTrigger;
      triggerSimulatedReminder(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalStartupTrigger]);

  const activeBook = useMemo(
    () => state.books.find((b) => b.id === activeBookId) || null,
    [state.books, activeBookId]
  );

  const filteredQuestions = useMemo(() => {
    if (!activeBook) return [];
    if (studyFilter === 'mastered') return activeBook.questions.filter((q) => q.mastered);
    if (studyFilter === 'unmastered') return activeBook.questions.filter((q) => !q.mastered);
    return activeBook.questions;
  }, [activeBook, studyFilter]);

  const safeStudyIndex =
    filteredQuestions.length > 0 ? Math.min(studyIndex, filteredQuestions.length - 1) : 0;
  const currentQuestion = filteredQuestions[safeStudyIndex] || null;

  const totalVocabCount = useMemo(
    () => state.books.reduce((acc, b) => acc + b.vocabulary.length, 0),
    [state.books]
  );

  const enabledReminderBooksCount = useMemo(
    () => state.books.filter((b) => b.reminderEnabled).length,
    [state.books]
  );

  const headerTitle = useMemo(() => {
    if (view === 'study' && activeBook) return activeBook.title;
    if (view === 'vocabulary') return 'مۇھىم سۆزلۈكلەر';
    if (view === 'reminders') return 'مۇھىم ئەسكەرتىش';
    if (view === 'add') return 'كىتاب قوشۇش';
    return 'ئۆگىنىش قورالىم';
  }, [view, activeBook]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      showToast('30 سوئال-جاۋاب ئۈچۈن JSON پرومپىتى كۆچۈرۈلدى!', 'success');
    } catch {
      showToast('كۆچۈرۈشتە خاتالىق كۆرۈلدى.', 'error');
    }
  };

  const handleToggleBookReminder = (bookId: string) => {
    setState((prev) => ({
      ...prev,
      books: prev.books.map((b) =>
        b.id === bookId ? { ...b, reminderEnabled: !b.reminderEnabled, updatedAt: Date.now() } : b
      ),
    }));
  };

  const handleMarkQuestion = (mastered: boolean) => {
    if (!activeBook || !currentQuestion) return;
    setState((prev) => ({
      ...prev,
      books: prev.books.map((b) =>
        b.id !== activeBook.id
          ? b
          : {
              ...b,
              updatedAt: Date.now(),
              questions: b.questions.map((q) =>
                q.id === currentQuestion.id
                  ? { ...q, mastered, reviewCount: q.reviewCount + 1 }
                  : q
              ),
            }
      ),
    }));
    setAnswerRevealed(false);
    showToast(mastered ? 'بۇ سوئال «ئىگىلەندى» دەپ ساقلاندى' : 'قايتا تەكرارلاشقا بەلگىلەندى');
    if (studyFilter !== 'unmastered' && safeStudyIndex < filteredQuestions.length - 1) {
      setStudyIndex((i) => i + 1);
    }
  };

  const handleExportBook = () => {
    if (!activeBook) return;
    const payload = {
      bookTitle: activeBook.title,
      category: activeBook.category,
      questions: activeBook.questions.map((q, i) => ({
        id: i + 1,
        question: q.question,
        answer: q.answer,
        importance: q.importance,
      })),
      vocabulary: activeBook.vocabulary.map((v) => ({ term: v.term, meaning: v.meaning })),
      reminders: activeBook.reminders.map((r) => r.text),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    triggerFileDownload(blob, `kitab-zapas-${Date.now()}.json`);
    showToast('كىتاب زاپاس JSON قىلىپ چۈشۈرۈلدى');
  };

  const handleDeleteBook = () => {
    if (!activeBook) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setState((prev) => ({
      ...prev,
      pendingStartupReminder:
        prev.pendingStartupReminder?.bookId === activeBook.id ? null : prev.pendingStartupReminder,
      books: prev.books.filter((b) => b.id !== activeBook.id),
    }));
    setDeleteConfirm(false);
    setActiveBookId(null);
    setView('home');
    showToast(`«${activeBook.title}» ئۆچۈرۈلدى`);
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLabel(`تاللانغان ھۆججەت: ${file.name}`);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setJsonTextInput(text);
      setAddError(null);
      try {
        const parsed = JSON.parse(stripCodeFences(text)) as Record<string, unknown>;
        if (!bookTitleInput.trim() && parsed && typeof parsed === 'object') {
          const detected = String(parsed.bookTitle || parsed.title || parsed.name || '').trim();
          if (detected) setBookTitleInput(detected);
        }
      } catch {
        // Handled cleanly on save
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSaveNewBook = () => {
    const triggerError = (msg: string) => {
      setAddError(msg);
      setShakeError(false);
      window.setTimeout(() => setShakeError(true), 10);
    };

    try {
      const cleaned = stripCodeFences(jsonTextInput);
      if (!cleaned) {
        triggerError('JSON مەزمۇنى بوش. ھۆججەت تاللاڭ ياكى JSON چاپلاڭ.');
        return;
      }
      const parsed = JSON.parse(cleaned);
      let rawQuestions: unknown[] = [];
      let rawVocab: unknown[] = [];
      let rawReminders: unknown[] = [];
      let detectedTitle = '';
      let detectedCategory = 'ئومۇمىي بىلىم';

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (parsed && typeof parsed === 'object') {
        detectedTitle = String(
          parsed.bookTitle || parsed.title || parsed.name || parsed.bookName || ''
        ).trim();
        detectedCategory = String(parsed.category || 'ئومۇمىي بىلىم').trim();
        rawQuestions = parsed.questions || parsed.qa || parsed.items || parsed.cards || [];
        rawVocab = parsed.vocabulary || parsed.terms || parsed.words || parsed.glossary || [];
        rawReminders = parsed.reminders || parsed.notes || parsed.keyPoints || [];
      } else {
        triggerError('JSON مەزمۇنى ئوبيېكت ياكى سوئاللار تىزىملىكى بولۇشى كېرەك.');
        return;
      }

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        triggerError('JSON ئىچىدە سوئال-جاۋاب تىزىملىكى (questions) تېپىلمىدى.');
        return;
      }

      const questions = rawQuestions
        .map((item, idx) => {
          if (!item || typeof item !== 'object') return null;
          const rec = item as Record<string, unknown>;
          const q = String(rec.question || rec.q || '').trim();
          const a = String(rec.answer || rec.a || '').trim();
          if (!q || !a) return null;
          return {
            id: `q_${idx + 1}_${Date.now()}`,
            question: q,
            answer: a,
            importance: String(rec.importance || 'مۇھىم').trim(),
            mastered: false,
            reviewCount: 0,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (questions.length === 0) {
        triggerError('ئىناۋەتلىك «question» ۋە «answer» جۈپى تېپىلمىدى.');
        return;
      }

      const finalTitle = bookTitleInput.trim() || detectedTitle;
      if (!finalTitle) {
        triggerError('كىتاب ياكى بىلىم ئىسمىنى يېزىڭ.');
        return;
      }

      const vocabulary = Array.isArray(rawVocab)
        ? rawVocab
            .map((v, i) => {
              if (!v || typeof v !== 'object') return null;
              const rec = v as Record<string, unknown>;
              const term = String(rec.term || rec.word || '').trim();
              const meaning = String(rec.meaning || rec.definition || '').trim();
              return term ? { id: `v_${i}_${Date.now()}`, term, meaning } : null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
        : [];

      const reminders = Array.isArray(rawReminders)
        ? rawReminders
            .map((r, i) => {
              const text =
                typeof r === 'string'
                  ? r.trim()
                  : r && typeof r === 'object'
                    ? String((r as Record<string, unknown>).text || '').trim()
                    : '';
              return text ? { id: `r_${i}_${Date.now()}`, text } : null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
        : [];

      const newBook: StudyBook = {
        id: `book_${Date.now()}`,
        title: finalTitle,
        category: detectedCategory,
        reminderEnabled: newBookReminder,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions,
        vocabulary,
        reminders,
      };

      setState((prev) => ({
        ...prev,
        books: [...prev.books, newBook],
      }));
      setBookTitleInput('');
      setJsonTextInput('');
      setFileLabel('كومپيۇتېردىن .json ھۆججەت تاللاش');
      setAddError(null);
      setView('home');
      showToast(`«${newBook.title}» (${newBook.questions.length} سوئال) مەڭگۈلۈك ساقلاندى!`);
    } catch {
      triggerError('JSON فورماتى توغرا ئەمەس. تىرناق ۋە پەشلەرنى تەكشۈرۈڭ.');
    }
  };

  const filteredVocab = useMemo(() => {
    const q = vocabSearch.trim().toLowerCase();
    const out: Array<{ bookTitle: string; term: string; meaning: string; id: string }> = [];
    state.books.forEach((book) => {
      if (vocabBookFilter !== 'all' && book.id !== vocabBookFilter) return;
      book.vocabulary.forEach((v) => {
        if (q && !v.term.toLowerCase().includes(q) && !v.meaning.toLowerCase().includes(q)) return;
        out.push({ id: `${book.id}_${v.id}`, bookTitle: book.title, term: v.term, meaning: v.meaning });
      });
    });
    return out;
  }, [state.books, vocabBookFilter, vocabSearch]);

  const allReminders = useMemo(() => {
    const out: Array<{ id: string; bookTitle: string; text: string }> = [];
    state.books.forEach((book) => {
      book.reminders.forEach((r) => {
        out.push({ id: `${book.id}_${r.id}`, bookTitle: book.title, text: r.text });
      });
    });
    return out;
  }, [state.books]);

  return (
    <div
      className="relative w-full max-w-[420px] mx-auto rounded-[28px] p-4 flex flex-col gap-4 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--color-bg-top), var(--color-bg-bottom))',
        boxShadow: 'var(--shadow-raised)',
        border: 'var(--border-highlight)',
        minHeight: '600px',
      }}
    >
      {/* Subtle decorative neumorphic corner circles matching design/style.md */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 w-48 h-48 rounded-full opacity-45"
        style={{
          background:
            'radial-gradient(circle, var(--color-secondary) 0%, var(--color-secondary-soft) 65%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-20 w-52 h-52 rounded-full opacity-45"
        style={{
          background:
            'radial-gradient(circle, var(--color-secondary) 0%, var(--color-secondary-soft) 65%, transparent 100%)',
        }}
      />

      {/* Top Header Bar (قورال ئىسمى) */}
      <header className="relative z-10 neu-card min-h-[56px] px-4 py-2 flex items-center justify-center">
        {view !== 'home' && (
          <button
            type="button"
            onClick={() => {
              setDeleteConfirm(false);
              setView('home');
            }}
            className="neu-btn-secondary absolute right-2 h-10 px-3 text-sm inline-flex items-center gap-1 whitespace-nowrap"
          >
            <ArrowRight className="w-4 h-4" />
            <span>قايتىش</span>
          </button>
        )}
        <h2
          className="m-0 text-[20px] font-bold truncate max-w-[230px]"
          style={{ color: 'var(--color-text-strong)' }}
        >
          {headerTitle}
        </h2>
      </header>

      {/* VIEW: HOME (Wireframe 1:1 Fidelity) */}
      {view === 'home' && (
        <div className="relative z-10 flex flex-col gap-4 flex-1 animate-neu-enter">
          {/* Active Startup Reminder Banner */}
          {state.pendingStartupReminder && (
            <div
              className="neu-well p-4 flex flex-col gap-2"
              style={{ borderColor: 'rgba(30, 95, 227, 0.28)' }}
            >
              <div className="flex items-center justify-between text-[13px] font-bold" style={{ color: 'var(--color-link)' }}>
                <span>ئەسكەرتمە: {state.pendingStartupReminder.bookTitle}</span>
                <span>تەكرارلاش ۋاقتى</span>
              </div>
              <p className="m-0 text-[15px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                {state.pendingStartupReminder.question}
              </p>
              {startupReveal && (
                <p
                  className="m-0 pt-2 text-[14px]"
                  style={{
                    color: 'var(--color-text)',
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  {state.pendingStartupReminder.answer}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStartupReveal((v) => !v)}
                  className="neu-btn-secondary flex-1 h-10 text-sm whitespace-nowrap"
                >
                  {startupReveal ? 'جاۋابنى يوشۇرۇش' : 'جاۋابنى كۆرۈش'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => ({ ...prev, pendingStartupReminder: null }));
                    showToast('ئەسكەرتمە تاماملاندى');
                  }}
                  className="neu-btn-secondary flex-1 h-10 text-sm whitespace-nowrap"
                >
                  چۈشەندىم ✓
                </button>
              </div>
            </div>
          )}

          {/* Books Card */}
          <div className="neu-card p-4 flex flex-col gap-2.5 min-h-[188px]">
            <div
              className="flex items-center justify-between pb-2 text-[13px]"
              style={{
                color: 'var(--color-text-muted)',
                borderBottom: '1px solid rgba(159, 179, 224, 0.45)',
              }}
            >
              <span>ساقلانغان كىتابلار</span>
              <span>ئەسكەرتمە</span>
            </div>

            {state.books.length === 0 ? (
              <div className="neu-well p-5 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <strong className="block mb-1" style={{ color: 'var(--color-text-strong)' }}>
                  تېخى كىتاب قوشۇلمىدى
                </strong>
                پرومپىتنى كۆچۈرۈپ سۈنئىي ئەقىلدىن JSON ئېلىپ، «كىتاب قوشۇش» ئارقىلىق يۈكلەڭ.
              </div>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
                {state.books.map((book, idx) => {
                  const mastered = book.questions.filter((q) => q.mastered).length;
                  return (
                    <li
                      key={book.id}
                      className="neu-surface px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBookId(book.id);
                          setStudyFilter('all');
                          setStudyIndex(0);
                          setAnswerRevealed(false);
                          setView('study');
                        }}
                        className="flex-1 min-w-0 text-start bg-transparent border-0 p-0 cursor-pointer"
                      >
                        <div
                          className="font-bold text-[15px] truncate"
                          style={{ color: 'var(--color-text-strong)' }}
                        >
                          <bdi>{idx + 1}.</bdi> {book.title}
                        </div>
                        <div
                          className="text-[13px] tabular-nums"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          <bdi>{book.questions.length}</bdi> سوئال · ئىگىلىگىنى{' '}
                          <bdi>{mastered}</bdi>
                        </div>
                      </button>

                      <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 text-[13px] select-none" style={{ color: 'var(--color-text-muted)' }}>
                        <input
                          type="checkbox"
                          checked={book.reminderEnabled}
                          onChange={() => handleToggleBookReminder(book.id)}
                          className="sr-only"
                        />
                        <span className={`neu-check-box ${book.reminderEnabled ? 'checked' : ''}`}>
                          {book.reminderEnabled && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </span>
                        <span>ئەسكەرتمە</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Important Vocabulary Row */}
          <button
            type="button"
            onClick={() => setView('vocabulary')}
            className="neu-card w-full min-h-[52px] px-4 py-2 flex items-center justify-between font-bold text-[16px] cursor-pointer"
            style={{ color: 'var(--color-text-strong)' }}
          >
            <span>مۇھىم سۆزلۈكلەر</span>
            <span className="text-[14px] font-normal inline-flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <bdi>{totalVocabCount}</bdi> سۆزلۈك
              <ArrowLeft className="w-4 h-4" />
            </span>
          </button>

          {/* Important Reminders Row */}
          <button
            type="button"
            onClick={() => setView('reminders')}
            className="neu-card w-full min-h-[52px] px-4 py-2 flex items-center justify-between font-bold text-[16px] cursor-pointer"
            style={{ color: 'var(--color-text-strong)' }}
          >
            <span>مۇھىم ئەسكەرتىش</span>
            <span className="text-[14px] font-normal inline-flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              {state.settings.globalReminderEnabled
                ? `ئوچۇق (${enabledReminderBooksCount})`
                : 'ئۆچۈك'}
              <ArrowLeft className="w-4 h-4" />
            </span>
          </button>

          {/* Centered Add Book Secondary Button */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => {
                setAddError(null);
                setView('add');
              }}
              className="neu-btn-secondary min-h-[46px] px-6 text-[15px] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>كىتاب قوشۇش</span>
            </button>
          </div>

          <div className="flex-1" />

          {/* Bottom Primary CTA: Copy Prompt for JSON */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="neu-btn-primary w-full h-[52px] px-6 text-[17px] inline-flex items-center justify-center whitespace-nowrap"
          >
            <span>جىسون ئۈچۈن پرومپىت كۆچۈرۈش</span>
            <span
              className="absolute left-2.5 w-8 h-8 rounded-full inline-flex items-center justify-center"
              style={{ background: 'rgba(255, 255, 255, 0.18)' }}
              aria-hidden="true"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </span>
          </button>
        </div>
      )}

      {/* VIEW: STUDY */}
      {view === 'study' && activeBook && (
        <div className="relative z-10 flex flex-col gap-4 flex-1 animate-neu-enter">
          <div className="neu-well p-1 grid grid-cols-3 gap-1.5" role="tablist">
            {(
              [
                ['all', 'ھەممىسى'],
                ['unmastered', 'ئۆگىنىلمىگەن'],
                ['mastered', 'ئىگىلىگەن'],
              ] as Array<[StudyFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={studyFilter === key}
                onClick={() => {
                  setStudyFilter(key);
                  setStudyIndex(0);
                  setAnswerRevealed(false);
                }}
                className="h-9 rounded-xl text-[13px] font-bold border-0 cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: studyFilter === key ? 'var(--color-bg)' : 'transparent',
                  color: studyFilter === key ? 'var(--color-link)' : 'var(--color-text-muted)',
                  boxShadow: studyFilter === key ? 'var(--shadow-soft)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {currentQuestion ? (
            <div className="neu-card p-5 flex flex-col gap-3">
              <div
                className="flex items-center justify-between text-[13px] tabular-nums"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span>
                  <bdi>
                    {safeStudyIndex + 1} / {filteredQuestions.length}
                  </bdi>
                </span>
                <span>
                  {currentQuestion.mastered ? 'ئىگىلەنگەن · ' : ''}
                  {currentQuestion.importance}
                </span>
              </div>

              <h3
                className="m-0 text-[18px] font-bold leading-relaxed"
                style={{ color: 'var(--color-text-strong)' }}
              >
                {currentQuestion.question}
              </h3>

              <button
                type="button"
                onClick={() => setAnswerRevealed((v) => !v)}
                className="neu-btn-primary w-full h-[48px] px-5 text-[16px] inline-flex items-center justify-center whitespace-nowrap"
              >
                <span>{answerRevealed ? 'جاۋابنى يوشۇرۇش' : 'جاۋابنى كۆرۈش'}</span>
                <span
                  className="absolute left-2.5 w-7 h-7 rounded-full inline-flex items-center justify-center"
                  style={{ background: 'rgba(255, 255, 255, 0.18)' }}
                  aria-hidden="true"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                </span>
              </button>

              {answerRevealed && (
                <div
                  className="neu-well p-4 text-[15px] leading-relaxed whitespace-pre-wrap animate-neu-enter"
                  style={{ color: 'var(--color-text)' }}
                >
                  {currentQuestion.answer}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleMarkQuestion(true)}
                  className="neu-btn-secondary h-10 text-sm whitespace-nowrap"
                >
                  {currentQuestion.mastered ? 'ئىگىلەندى ✓' : 'ئۆگەندىم ✓'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkQuestion(false)}
                  className="neu-btn-secondary h-10 text-sm whitespace-nowrap"
                >
                  قايتا كۆرىمەن
                </button>
              </div>
            </div>
          ) : (
            <div className="neu-well p-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              بۇ سۈزگۈچتە سوئال يوق. باشقا تۈرنى تاللاڭ.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={filteredQuestions.length <= 1}
              onClick={() => {
                setStudyIndex((i) => (i - 1 + filteredQuestions.length) % filteredQuestions.length);
                setAnswerRevealed(false);
              }}
              className="neu-btn-secondary flex-1 h-10 text-sm disabled:opacity-50 whitespace-nowrap"
            >
              → ئالدىنقى سوئال
            </button>
            <button
              type="button"
              disabled={filteredQuestions.length <= 1}
              onClick={() => {
                setStudyIndex((i) => (i + 1) % filteredQuestions.length);
                setAnswerRevealed(false);
              }}
              className="neu-btn-secondary flex-1 h-10 text-sm disabled:opacity-50 whitespace-nowrap"
            >
              كېيىنكى سوئال ←
            </button>
          </div>

          <div className="flex-1" />

          <div
            className="flex items-center justify-between pt-3 gap-2"
            style={{ borderTop: '1px solid rgba(159, 179, 224, 0.45)' }}
          >
            <button
              type="button"
              onClick={handleExportBook}
              className="neu-btn-secondary h-10 px-3 text-sm whitespace-nowrap"
            >
              زاپاس چۈشۈرۈش
            </button>
            <button
              type="button"
              onClick={handleDeleteBook}
              className="neu-btn-secondary h-10 px-3 text-sm whitespace-nowrap"
              style={{ color: 'var(--color-error)' }}
            >
              {deleteConfirm ? 'ئۆچۈرۈشنى جەزملەڭ' : 'كىتابنى ئۆچۈرۈش'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW: VOCABULARY */}
      {view === 'vocabulary' && (
        <div className="relative z-10 flex flex-col gap-3 flex-1 animate-neu-enter">
          <select
            value={vocabBookFilter}
            onChange={(e) => setVocabBookFilter(e.target.value)}
            className="neu-input h-12 px-4 text-[15px]"
          >
            <option value="all">بارلىق كىتابلار</option>
            {state.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={vocabSearch}
            onChange={(e) => setVocabSearch(e.target.value)}
            placeholder="سۆزلۈك ياكى مەنىسىنى ئىزدەڭ..."
            className="neu-input h-12 px-4 text-[15px]"
          />

          <div className="flex flex-col gap-2.5 max-h-[210px] overflow-y-auto pl-1">
            {filteredVocab.length === 0 ? (
              <div className="neu-well p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                ماس كېلىدىغان سۆزلۈك تېپىلمىدى.
              </div>
            ) : (
              filteredVocab.map((item) => (
                <div key={item.id} className="neu-surface p-3.5 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[15px]" style={{ color: 'var(--color-text-strong)' }}>
                      {item.term}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {item.bookTitle}
                    </span>
                  </div>
                  <p className="m-0 text-[14px]" style={{ color: 'var(--color-text)' }}>
                    {item.meaning}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="neu-card p-4 flex flex-col gap-2.5 mt-auto">
            <span className="text-[14px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
              يېڭى سۆزلۈك قوشۇش
            </span>
            <input
              type="text"
              value={newVocabTerm}
              onChange={(e) => setNewVocabTerm(e.target.value)}
              placeholder="سۆزلۈك ياكى ئاتالغۇ"
              className="neu-input h-11 px-3 text-[14px]"
            />
            <input
              type="text"
              value={newVocabMeaning}
              onChange={(e) => setNewVocabMeaning(e.target.value)}
              placeholder="ئېنىق مەنىسى"
              className="neu-input h-11 px-3 text-[14px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newVocabTerm.trim() || !newVocabMeaning.trim()) {
                  showToast('سۆزلۈك ۋە مەنىسىنى تولۇق يېزىڭ.', 'error');
                  return;
                }
                if (state.books.length === 0) {
                  showToast('ئاۋۋال كىتاب قوشۇڭ.', 'error');
                  return;
                }
                const targetId = vocabBookFilter === 'all' ? state.books[0].id : vocabBookFilter;
                setState((prev) => ({
                  ...prev,
                  books: prev.books.map((b) =>
                    b.id !== targetId
                      ? b
                      : {
                          ...b,
                          vocabulary: [
                            { id: `v_${Date.now()}`, term: newVocabTerm.trim(), meaning: newVocabMeaning.trim() },
                            ...b.vocabulary,
                          ],
                        }
                  ),
                }));
                setNewVocabTerm('');
                setNewVocabMeaning('');
                showToast('يېڭى سۆزلۈك ساقلاندى');
              }}
              className="neu-btn-primary h-11 text-[15px] inline-flex items-center justify-center whitespace-nowrap"
            >
              سۆزلۈكنى ساقلاش
            </button>
          </div>
        </div>
      )}

      {/* VIEW: REMINDERS */}
      {view === 'reminders' && (
        <div className="relative z-10 flex flex-col gap-3 flex-1 animate-neu-enter">
          <div className="neu-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[14px]" style={{ color: 'var(--color-text-strong)' }}>
                  تور كۆرگۈچ ئېچىلغاندا ئەسكەرتىش
                </div>
                <div className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                  Chrome ئېچىلغاندا تاللانغان كىتابتىن ئەسكەرتمە چىقىدۇ
                </div>
              </div>
              <label className="cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.settings.globalReminderEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, globalReminderEnabled: checked },
                    }));
                    showToast(checked ? 'ئەسكەرتمە ئېچىلدى' : 'ئەسكەرتمە ئۆچۈرۈلدى');
                  }}
                  className="sr-only"
                />
                <span className={`neu-check-box ${state.settings.globalReminderEnabled ? 'checked' : ''}`}>
                  {state.settings.globalReminderEnabled && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                  )}
                </span>
              </label>
            </div>

            <select
              value={state.settings.reminderIntervalMinutes}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, reminderIntervalMinutes: val },
                }));
                showToast('ئەسكەرتىش ئارىلىقى ساقلاندى');
              }}
              className="neu-input h-11 px-3 text-[14px]"
            >
              <option value={0}>پەقەت تور كۆرگۈچ ئېچىلغاندا</option>
              <option value={60}>ھەر 1 سائەتتە بىر قېتىم</option>
              <option value={180}>ھەر 3 سائەتتە بىر قېتىم</option>
            </select>

            <button
              type="button"
              onClick={() => triggerSimulatedReminder(true)}
              className="neu-btn-secondary h-10 text-sm whitespace-nowrap"
            >
              ئەسكەرتىش ئۇقتۇرۇشىنى سىناپ كۆرۈش
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[175px] overflow-y-auto pl-1">
            {allReminders.length === 0 ? (
              <div className="neu-well p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                تېخى مۇھىم ئەسكەرتىش خاتىرىسى يوق.
              </div>
            ) : (
              allReminders.map((note, idx) => (
                <div key={note.id} className="neu-surface p-3.5 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[14px]" style={{ color: 'var(--color-text-strong)' }}>
                      <bdi>{idx + 1}.</bdi> مۇھىم ئەسكەرتىش
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {note.bookTitle}
                    </span>
                  </div>
                  <p className="m-0 text-[14px]" style={{ color: 'var(--color-text)' }}>
                    {note.text}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="neu-card p-4 flex flex-col gap-2.5 mt-auto">
            <input
              type="text"
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              placeholder="يېڭى مۇھىم ئەسكەرتىش يېزىڭ..."
              className="neu-input h-11 px-3 text-[14px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newReminderText.trim()) {
                  showToast('ئەسكەرتىش مەزمۇنىنى يېزىڭ.', 'error');
                  return;
                }
                if (state.books.length === 0) {
                  showToast('ئاۋۋال كىتاب قوشۇڭ.', 'error');
                  return;
                }
                setState((prev) => ({
                  ...prev,
                  books: prev.books.map((b, i) =>
                    i !== 0
                      ? b
                      : {
                          ...b,
                          reminders: [
                            { id: `r_${Date.now()}`, text: newReminderText.trim() },
                            ...b.reminders,
                          ],
                        }
                  ),
                }));
                setNewReminderText('');
                showToast('مۇھىم ئەسكەرتىش ساقلاندى');
              }}
              className="neu-btn-primary h-11 text-[15px] inline-flex items-center justify-center whitespace-nowrap"
            >
              ئەسكەرتىشنى ساقلاش
            </button>
          </div>
        </div>
      )}

      {/* VIEW: ADD BOOK */}
      {view === 'add' && (
        <div className="relative z-10 flex flex-col gap-3 flex-1 animate-neu-enter">
          <div className="neu-card p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                كىتاب ياكى بىلىم ئىسمى
              </label>
              <input
                type="text"
                value={bookTitleInput}
                onChange={(e) => {
                  setBookTitleInput(e.target.value);
                  setAddError(null);
                }}
                placeholder="مەسىلەن: ئىسلام ئەخلاقى ئاساسلىرى"
                className="neu-input h-12 px-4 text-[15px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[14px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                JSON ھۆججىتى يۈكلەش
              </span>
              <label
                className="neu-surface min-h-[48px] px-4 py-2 flex items-center justify-center gap-2 cursor-pointer text-[14px] font-bold"
                style={{
                  color: 'var(--color-link)',
                  border: '1.5px dashed var(--color-divider)',
                }}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{fileLabel}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleJsonFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                ياكى JSON مەزمۇنىنى بىۋاسىتە چاپلاڭ
              </label>
              <textarea
                value={jsonTextInput}
                onChange={(e) => {
                  setJsonTextInput(e.target.value);
                  setAddError(null);
                }}
                dir="ltr"
                placeholder='{"bookTitle":"...","questions":[{"question":"...","answer":"..."}]}'
                className={`neu-input min-h-[120px] p-3 text-[13px] font-mono ${
                  shakeError ? 'animate-neu-shake' : ''
                }`}
                style={{
                  borderColor: addError ? 'var(--color-error)' : undefined,
                }}
              />
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer text-[14px] select-none" style={{ color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={newBookReminder}
                onChange={(e) => setNewBookReminder(e.target.checked)}
                className="sr-only"
              />
              <span className={`neu-check-box ${newBookReminder ? 'checked' : ''}`}>
                {newBookReminder && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </span>
              <span>بۇ كىتاب ئۈچۈن تور كۆرگۈچ ئېچىلغاندا ئەسكەرتمە چىقسۇن</span>
            </label>

            {addError && (
              <div
                role="alert"
                className="p-3 rounded-2xl flex items-start gap-2 text-[13px] font-bold"
                style={{
                  background: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1px solid rgba(200, 30, 58, 0.25)',
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveNewBook}
              className="neu-btn-primary w-full h-[52px] text-[17px] inline-flex items-center justify-center whitespace-nowrap"
            >
              <span>كىتابنى ساقلاش</span>
              <span
                className="absolute left-2.5 w-8 h-8 rounded-full inline-flex items-center justify-center"
                style={{ background: 'rgba(255, 255, 255, 0.18)' }}
                aria-hidden="true"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-4 inset-x-4 z-30 py-3 px-4 rounded-2xl text-center text-[13px] font-bold animate-neu-enter"
          style={{
            background: toast.type === 'error' ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
            color: toast.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
            border:
              toast.type === 'error'
                ? '1px solid rgba(200, 30, 58, 0.3)'
                : '1px solid rgba(10, 115, 70, 0.3)',
            boxShadow: 'var(--shadow-raised)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};
