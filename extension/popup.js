"use strict";

/**
 * ئۆگىنىش قورالىم — Chrome Manifest V3 قىستۇرمىسى
 * قوش مۇھىتلىق ئىجرا قۇرۇلمىسى:
 * 1) Service Worker مۇھىتى: تور كۆرگۈچ ئېچىلغاندا ۋە قەرەللىك ئەسكەرتىش چىقىرىش.
 * 2) Popup كۆزنەك مۇھىتى: بارلىق ئۆگىنىش، JSON يۈكلەش، سۆزلۈك ۋە پرومپىت كۆچۈرۈش ئىقتىدارلىرى.
 * نۆل ئىز قوغلاش، %100 يەرلىك ساقلاش (chrome.storage.local).
 */

const STORAGE_KEY = "oginish_qoralim_state_v1";
const ALARM_NAME = "oginish_qoralim_periodic_reminder";
const NOTIFICATION_ID_PREFIX = "oginish_qoralim_notif_";
const MAX_QUESTIONS_PER_BOOK = 500;
const MAX_TEXT_LENGTH = 10000;

const NOTIFICATION_ICON_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAlElEQVR4nO3Z0QnAIAxFUSfpah2+g9gFSgm+4EvkBvKp3POrYwTnup+5c6NdZYLTQO5QCeKOkxDuKBnhDpIA7hgZ4Q4B4A6RAO4IGeEOAOAOALB6MHssgCgy4y4AAAAAAAAAAAAAAAAASAVkznZAlQXg3v6Azu+jZ7xOA6gA6Ig465eyG+IzvgviN74yJBxeBRTtegGvcOBl/ps3eAAAAABJRU5ErkJggg==";

const AI_PROMPT_TEMPLATE = `سەن كەسپىي ئىلمىي تەتقىقاتچى، پېداگوگ ۋە مەزمۇن ئانالىزچىسى.
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

function createDefaultState() {
  return {
    version: 1,
    settings: {
      globalReminderEnabled: true,
      reminderIntervalMinutes: 0
    },
    pendingStartupReminder: null,
    books: []
  };
}

function safeString(value, maxLen) {
  if (typeof value !== "string") {
    if (value === null || value === undefined) return "";
    value = String(value);
  }
  const trimmed = value.trim();
  const limit = typeof maxLen === "number" ? maxLen : MAX_TEXT_LENGTH;
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix + "_" + Date.now().toString(36) + "_" + rand;
}

function normalizeState(raw) {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  const intervalRaw = Number(settings.reminderIntervalMinutes);
  const validInterval = intervalRaw === 60 || intervalRaw === 180 ? intervalRaw : 0;

  const books = Array.isArray(raw.books)
    ? raw.books
        .filter(function (b) {
          return b && typeof b === "object";
        })
        .map(function (b, idx) {
          const questions = Array.isArray(b.questions)
            ? b.questions
                .filter(function (q) {
                  return q && typeof q === "object" && safeString(q.question, MAX_TEXT_LENGTH).length > 0;
                })
                .slice(0, MAX_QUESTIONS_PER_BOOK)
                .map(function (q, qIdx) {
                  return {
                    id: safeString(q.id, 64) || "q_" + (qIdx + 1),
                    question: safeString(q.question, MAX_TEXT_LENGTH),
                    answer: safeString(q.answer, MAX_TEXT_LENGTH) || "جاۋاب كىرگۈزۈلمىگەن.",
                    importance: safeString(q.importance, 64) || "مۇھىم",
                    mastered: Boolean(q.mastered),
                    reviewCount: Number.isFinite(Number(q.reviewCount)) ? Number(q.reviewCount) : 0
                  };
                })
            : [];

          const vocabulary = Array.isArray(b.vocabulary)
            ? b.vocabulary
                .filter(function (v) {
                  return v && typeof v === "object" && safeString(v.term, 200).length > 0;
                })
                .map(function (v, vIdx) {
                  return {
                    id: safeString(v.id, 64) || "v_" + (vIdx + 1),
                    term: safeString(v.term, 200),
                    meaning: safeString(v.meaning, 2000)
                  };
                })
            : [];

          const reminders = Array.isArray(b.reminders)
            ? b.reminders
                .map(function (r, rIdx) {
                  if (typeof r === "string") {
                    const txt = safeString(r, 1000);
                    return txt ? { id: "r_" + (rIdx + 1), text: txt } : null;
                  }
                  if (r && typeof r === "object") {
                    const txt = safeString(r.text, 1000);
                    return txt ? { id: safeString(r.id, 64) || "r_" + (rIdx + 1), text: txt } : null;
                  }
                  return null;
                })
                .filter(Boolean)
            : [];

          return {
            id: safeString(b.id, 64) || generateId("book_" + idx),
            title: safeString(b.title, 200) || (idx + 1) + "-كىتاب",
            category: safeString(b.category, 100) || "ئومۇمىي بىلىم",
            reminderEnabled: b.reminderEnabled !== false,
            createdAt: Number.isFinite(Number(b.createdAt)) ? Number(b.createdAt) : Date.now(),
            updatedAt: Number.isFinite(Number(b.updatedAt)) ? Number(b.updatedAt) : Date.now(),
            questions: questions,
            vocabulary: vocabulary,
            reminders: reminders
          };
        })
    : [];

  let pending = null;
  if (raw.pendingStartupReminder && typeof raw.pendingStartupReminder === "object") {
    const p = raw.pendingStartupReminder;
    if (safeString(p.question, MAX_TEXT_LENGTH).length > 0) {
      pending = {
        bookId: safeString(p.bookId, 64),
        bookTitle: safeString(p.bookTitle, 200) || "ئۆگىنىش قورالىم",
        questionId: safeString(p.questionId, 64),
        question: safeString(p.question, MAX_TEXT_LENGTH),
        answer: safeString(p.answer, MAX_TEXT_LENGTH),
        reminderNote: safeString(p.reminderNote, 1000),
        createdAt: Number.isFinite(Number(p.createdAt)) ? Number(p.createdAt) : Date.now()
      };
    }
  }

  return {
    version: 1,
    settings: {
      globalReminderEnabled: settings.globalReminderEnabled !== false,
      reminderIntervalMinutes: validInterval
    },
    pendingStartupReminder: pending,
    books: books
  };
}

function readStorageState() {
  return new Promise(function (resolve) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(createDefaultState());
            return;
          }
          resolve(normalizeState(result ? result[STORAGE_KEY] : null));
        });
        return;
      }
      if (typeof localStorage !== "undefined") {
        const rawText = localStorage.getItem(STORAGE_KEY);
        resolve(normalizeState(rawText ? JSON.parse(rawText) : null));
        return;
      }
      resolve(createDefaultState());
    } catch (_err) {
      resolve(createDefaultState());
    }
  });
}

function writeStorageState(nextState) {
  return new Promise(function (resolve, reject) {
    try {
      const normalized = normalizeState(nextState);
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const payload = {};
        payload[STORAGE_KEY] = normalized;
        chrome.storage.local.set(payload, function () {
          if (chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || "ساقلاش خاتالىقى"));
            return;
          }
          resolve(normalized);
        });
        return;
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        resolve(normalized);
        return;
      }
      resolve(normalized);
    } catch (err) {
      reject(err);
    }
  });
}

function pickReminderPayload(state) {
  const eligibleBooks = state.books.filter(function (book) {
    return book.reminderEnabled && Array.isArray(book.questions) && book.questions.length > 0;
  });

  if (eligibleBooks.length === 0) {
    return null;
  }

  const book = eligibleBooks[Math.floor(Math.random() * eligibleBooks.length)];
  const unmastered = book.questions.filter(function (q) {
    return !q.mastered;
  });
  const pool = unmastered.length > 0 ? unmastered : book.questions;
  const chosenQuestion = pool[Math.floor(Math.random() * pool.length)];
  const chosenNote =
    Array.isArray(book.reminders) && book.reminders.length > 0
      ? book.reminders[Math.floor(Math.random() * book.reminders.length)].text
      : "";

  return {
    bookId: book.id,
    bookTitle: book.title,
    questionId: chosenQuestion.id,
    question: chosenQuestion.question,
    answer: chosenQuestion.answer,
    reminderNote: chosenNote,
    createdAt: Date.now()
  };
}

function syncPeriodicAlarm(settings) {
  try {
    if (typeof chrome === "undefined" || !chrome.alarms) return;
    chrome.alarms.clear(ALARM_NAME, function () {
      if (settings.globalReminderEnabled && settings.reminderIntervalMinutes > 0) {
        chrome.alarms.create(ALARM_NAME, {
          periodInMinutes: settings.reminderIntervalMinutes
        });
      }
    });
  } catch (_err) {
    // ئارقا سۇپا ۋاقىت بەلگىلەش مۇھىتى مەۋجۇت بولمىغاندا سۈكۈتتە ئۆتۈپ كېتىدۇ
  }
}

async function triggerStudyReminder(forceTrigger) {
  try {
    const state = await readStorageState();
    if (!forceTrigger && !state.settings.globalReminderEnabled) {
      return { triggered: false, reason: "disabled" };
    }

    const payload = pickReminderPayload(state);
    if (!payload) {
      return { triggered: false, reason: "no_books" };
    }

    state.pendingStartupReminder = payload;
    await writeStorageState(state);

    if (typeof chrome !== "undefined" && chrome.action) {
      try {
        chrome.action.setBadgeBackgroundColor({ color: "#1E5FE3" });
        chrome.action.setBadgeText({ text: "1" });
      } catch (_badgeErr) {
        // بەلگە يېڭىلاش خاتالىقى ئاساسىي ئۇقتۇرۇشنى توسمايدۇ
      }
    }

    if (typeof chrome !== "undefined" && chrome.notifications) {
      try {
        chrome.notifications.create(NOTIFICATION_ID_PREFIX + Date.now(), {
          type: "basic",
          iconUrl: NOTIFICATION_ICON_DATA_URI,
          title: "ئۆگىنىش قورالىم — " + payload.bookTitle,
          message: payload.question,
          priority: 1
        });
      } catch (_notifErr) {
        // ئۇقتۇرۇش رۇخسىتى چەكلەنگەن بولسىمۇ Popup ئىچىدە ئەسكەرتمە كۆرۈنىدۇ
      }
    }

    return { triggered: true, payload: payload };
  } catch (_err) {
    return { triggered: false, reason: "error" };
  }
}

/* ============================================================================
 * 1-بۆلەك: Service Worker ئارقا سۇپا مۇھىتى
 * ============================================================================ */
if (typeof window === "undefined" || typeof document === "undefined") {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onInstalled.addListener(function () {
        readStorageState()
          .then(function (state) {
            return writeStorageState(state);
          })
          .then(function (saved) {
            syncPeriodicAlarm(saved.settings);
          })
          .catch(function () {});
      });

      chrome.runtime.onStartup.addListener(function () {
        readStorageState()
          .then(function (state) {
            syncPeriodicAlarm(state.settings);
            return triggerStudyReminder(false);
          })
          .catch(function () {});
      });

      if (chrome.alarms) {
        chrome.alarms.onAlarm.addListener(function (alarm) {
          if (alarm && alarm.name === ALARM_NAME) {
            triggerStudyReminder(false).catch(function () {});
          }
        });
      }

      if (chrome.notifications) {
        chrome.notifications.onClicked.addListener(function (notifId) {
          try {
            chrome.notifications.clear(notifId);
            if (chrome.action && typeof chrome.action.openPopup === "function") {
              chrome.action.openPopup().catch(function () {});
            }
          } catch (_err) {}
        });
      }

      chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
        if (!message || typeof message !== "object") return false;
        if (message.type === "TRIGGER_TEST_REMINDER") {
          triggerStudyReminder(true)
            .then(function (res) {
              sendResponse(res);
            })
            .catch(function () {
              sendResponse({ triggered: false, reason: "error" });
            });
          return true;
        }
        if (message.type === "SYNC_ALARM") {
          readStorageState()
            .then(function (state) {
              syncPeriodicAlarm(state.settings);
              sendResponse({ ok: true });
            })
            .catch(function () {
              sendResponse({ ok: false });
            });
          return true;
        }
        return false;
      });
    }
  } catch (_swErr) {
    // Service Worker باشلىنىش خاتالىقى تۇتۇلدى
  }
}

/* ============================================================================
 * 2-بۆلەك: Popup كۆرۈنمە يۈز كونتروللىغۇچىسى
 * ============================================================================ */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function initPopupApp() {
    let appState = createDefaultState();
    let currentView = "home";
    let activeBookId = null;
    let studyFilter = "all";
    let studyIndex = 0;
    let answerRevealed = false;
    let deleteConfirmPending = false;
    let toastTimer = null;

    const el = {
      btnBack: document.getElementById("btnBack"),
      headerTitle: document.getElementById("headerTitle"),
      toast: document.getElementById("toast"),

      views: {
        home: document.getElementById("viewHome"),
        study: document.getElementById("viewStudy"),
        vocabulary: document.getElementById("viewVocab"),
        reminders: document.getElementById("viewReminders"),
        add: document.getElementById("viewAdd")
      },

      startupBanner: document.getElementById("startupBanner"),
      startupBookTitle: document.getElementById("startupBookTitle"),
      startupQuestion: document.getElementById("startupQuestion"),
      startupAnswer: document.getElementById("startupAnswer"),
      btnStartupReveal: document.getElementById("btnStartupReveal"),
      btnStartupDismiss: document.getElementById("btnStartupDismiss"),

      bookList: document.getElementById("bookList"),
      booksEmpty: document.getElementById("booksEmpty"),
      vocabCountMeta: document.getElementById("vocabCountMeta"),
      reminderStatusMeta: document.getElementById("reminderStatusMeta"),
      btnOpenVocab: document.getElementById("btnOpenVocab"),
      btnOpenReminders: document.getElementById("btnOpenReminders"),
      btnOpenAdd: document.getElementById("btnOpenAdd"),
      btnCopyPrompt: document.getElementById("btnCopyPrompt"),

      segButtons: Array.prototype.slice.call(document.querySelectorAll(".seg-btn")),
      studyCard: document.getElementById("studyCard"),
      studyEmptyFilter: document.getElementById("studyEmptyFilter"),
      studyCounter: document.getElementById("studyCounter"),
      studyImportance: document.getElementById("studyImportance"),
      studyQuestion: document.getElementById("studyQuestion"),
      btnToggleAnswer: document.getElementById("btnToggleAnswer"),
      btnToggleAnswerText: document.getElementById("btnToggleAnswerText"),
      studyAnswerBox: document.getElementById("studyAnswerBox"),
      btnMarkMastered: document.getElementById("btnMarkMastered"),
      btnMarkReview: document.getElementById("btnMarkReview"),
      btnPrevQ: document.getElementById("btnPrevQ"),
      btnNextQ: document.getElementById("btnNextQ"),
      btnExportBook: document.getElementById("btnExportBook"),
      btnDeleteBook: document.getElementById("btnDeleteBook"),

      vocabBookFilter: document.getElementById("vocabBookFilter"),
      vocabSearch: document.getElementById("vocabSearch"),
      vocabList: document.getElementById("vocabList"),
      vocabEmpty: document.getElementById("vocabEmpty"),
      newVocabTerm: document.getElementById("newVocabTerm"),
      newVocabMeaning: document.getElementById("newVocabMeaning"),
      btnAddVocab: document.getElementById("btnAddVocab"),

      chkGlobalReminder: document.getElementById("chkGlobalReminder"),
      selectInterval: document.getElementById("selectInterval"),
      btnTestNotification: document.getElementById("btnTestNotification"),
      remindersList: document.getElementById("remindersList"),
      remindersEmpty: document.getElementById("remindersEmpty"),
      newReminderText: document.getElementById("newReminderText"),
      btnAddReminderNote: document.getElementById("btnAddReminderNote"),

      inputBookTitle: document.getElementById("inputBookTitle"),
      inputJsonFile: document.getElementById("inputJsonFile"),
      fileDropText: document.getElementById("fileDropText"),
      inputJsonText: document.getElementById("inputJsonText"),
      chkNewBookReminder: document.getElementById("chkNewBookReminder"),
      addErrorBox: document.getElementById("addErrorBox"),
      addErrorText: document.getElementById("addErrorText"),
      btnSaveBook: document.getElementById("btnSaveBook")
    };

    function showToast(message, type) {
      try {
        el.toast.textContent = message;
        el.toast.className = "toast visible " + (type === "error" ? "error" : "success");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          el.toast.classList.remove("visible");
        }, 2600);
      } catch (_err) {}
    }

    function clearElement(node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }

    function createCheckSvg() {
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const poly = document.createElementNS(svgNS, "polyline");
      poly.setAttribute("points", "20 6 9 17 4 12");
      svg.appendChild(poly);
      return svg;
    }

    async function persistState() {
      try {
        appState = await writeStorageState(appState);
        return true;
      } catch (_err) {
        showToast("ساقلاشتا خاتالىق كۆرۈلدى. ساقلاش بوشلۇقىنى تەكشۈرۈڭ.", "error");
        return false;
      }
    }

    function clearBadge() {
      try {
        if (typeof chrome !== "undefined" && chrome.action) {
          chrome.action.setBadgeText({ text: "" });
        }
      } catch (_err) {}
    }

    function navigateTo(viewName, titleText) {
      currentView = viewName;
      deleteConfirmPending = false;
      el.btnDeleteBook.textContent = "كىتابنى ئۆچۈرۈش";

      Object.keys(el.views).forEach(function (key) {
        el.views[key].classList.toggle("active", key === viewName);
      });

      el.btnBack.hidden = viewName === "home";
      el.headerTitle.textContent = titleText || "ئۆگىنىش قورالىم";

      if (viewName === "home") {
        renderHome();
      } else if (viewName === "study") {
        renderStudy();
      } else if (viewName === "vocabulary") {
        renderVocabulary();
      } else if (viewName === "reminders") {
        renderReminders();
      } else if (viewName === "add") {
        hideAddError();
      }
    }

    /* ---------------- باش بەت سىزىش ---------------- */
    function renderHome() {
      renderStartupBanner();
      clearElement(el.bookList);

      if (appState.books.length === 0) {
        el.booksEmpty.hidden = false;
      } else {
        el.booksEmpty.hidden = true;
        appState.books.forEach(function (book, index) {
          const li = document.createElement("li");
          li.className = "book-row";

          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.className = "book-open-btn";

          const nameLine = document.createElement("span");
          nameLine.className = "book-name-line";
          nameLine.textContent = (index + 1) + ". " + book.title;

          const masteredCount = book.questions.filter(function (q) {
            return q.mastered;
          }).length;
          const metaLine = document.createElement("span");
          metaLine.className = "book-meta-line";
          metaLine.textContent =
            book.questions.length + " سوئال · ئىگىلىگىنى " + masteredCount;

          openBtn.appendChild(nameLine);
          openBtn.appendChild(metaLine);
          openBtn.addEventListener("click", function () {
            activeBookId = book.id;
            studyFilter = "all";
            studyIndex = 0;
            answerRevealed = false;
            navigateTo("study", book.title);
          });

          const toggleLabel = document.createElement("label");
          toggleLabel.className = "reminder-toggle";
          toggleLabel.title = "بۇ كىتابنىڭ ئەسكەرتمىسىنى ئېچىش ياكى ئۆچۈرۈش";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(book.reminderEnabled);
          checkbox.setAttribute("aria-label", book.title + " ئەسكەرتمە");
          checkbox.addEventListener("change", async function () {
            book.reminderEnabled = checkbox.checked;
            book.updatedAt = Date.now();
            const ok = await persistState();
            if (ok) {
              showToast(
                book.reminderEnabled
                  ? "«" + book.title + "» ئەسكەرتمىسى ئېچىلدى"
                  : "«" + book.title + "» ئەسكەرتمىسى ئۆچۈرۈلدى",
                "success"
              );
            }
          });

          const checkVisual = document.createElement("span");
          checkVisual.className = "check-box";
          checkVisual.appendChild(createCheckSvg());

          const toggleText = document.createElement("span");
          toggleText.textContent = "ئەسكەرتمە";

          toggleLabel.appendChild(checkbox);
          toggleLabel.appendChild(checkVisual);
          toggleLabel.appendChild(toggleText);

          li.appendChild(openBtn);
          li.appendChild(toggleLabel);
          el.bookList.appendChild(li);
        });
      }

      const totalVocab = appState.books.reduce(function (acc, b) {
        return acc + (Array.isArray(b.vocabulary) ? b.vocabulary.length : 0);
      }, 0);
      el.vocabCountMeta.textContent = String(totalVocab) + " سۆزلۈك";

      const enabledBooksCount = appState.books.filter(function (b) {
        return b.reminderEnabled;
      }).length;
      el.reminderStatusMeta.textContent = appState.settings.globalReminderEnabled
        ? "ئوچۇق (" + enabledBooksCount + ")"
        : "ئۆچۈك";
    }

    function renderStartupBanner() {
      const pending = appState.pendingStartupReminder;
      if (!pending) {
        el.startupBanner.classList.remove("visible");
        return;
      }
      el.startupBanner.classList.add("visible");
      el.startupBookTitle.textContent = "ئەسكەرتمە: " + pending.bookTitle;
      el.startupQuestion.textContent = pending.question;
      el.startupAnswer.textContent = pending.answer;
      el.startupAnswer.classList.remove("visible");
      el.btnStartupReveal.textContent = "جاۋابنى كۆرۈش";
    }

    /* ---------------- كىتاب ئۆگىنىش سىزىش ---------------- */
    function getActiveBook() {
      return (
        appState.books.find(function (b) {
          return b.id === activeBookId;
        }) || null
      );
    }

    function getFilteredQuestions(book) {
      if (!book) return [];
      if (studyFilter === "mastered") {
        return book.questions.filter(function (q) {
          return q.mastered;
        });
      }
      if (studyFilter === "unmastered") {
        return book.questions.filter(function (q) {
          return !q.mastered;
        });
      }
      return book.questions;
    }

    function renderStudy() {
      const book = getActiveBook();
      if (!book) {
        navigateTo("home", "ئۆگىنىش قورالىم");
        return;
      }

      el.segButtons.forEach(function (btn) {
        const isActive = btn.getAttribute("data-filter") === studyFilter;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      const list = getFilteredQuestions(book);
      if (list.length === 0) {
        el.studyCard.hidden = true;
        el.studyEmptyFilter.hidden = false;
        el.btnPrevQ.disabled = true;
        el.btnNextQ.disabled = true;
        return;
      }

      el.studyCard.hidden = false;
      el.studyEmptyFilter.hidden = true;
      el.btnPrevQ.disabled = list.length <= 1;
      el.btnNextQ.disabled = list.length <= 1;

      if (studyIndex >= list.length) studyIndex = 0;
      if (studyIndex < 0) studyIndex = list.length - 1;

      const currentQ = list[studyIndex];
      el.studyCounter.textContent = (studyIndex + 1) + " / " + list.length;
      el.studyImportance.textContent =
        (currentQ.mastered ? "ئىگىلەنگەن · " : "") + (currentQ.importance || "مۇھىم");
      el.studyQuestion.textContent = currentQ.question;
      el.studyAnswerBox.textContent = currentQ.answer;
      el.studyAnswerBox.classList.toggle("visible", answerRevealed);
      el.btnToggleAnswerText.textContent = answerRevealed ? "جاۋابنى يوشۇرۇش" : "جاۋابنى كۆرۈش";
      el.btnMarkMastered.textContent = currentQ.mastered ? "ئىگىلەندى ✓" : "ئۆگەندىم ✓";
    }

    /* ---------------- مۇھىم سۆزلۈكلەر سىزىش ---------------- */
    function renderVocabulary() {
      const prevSelected = el.vocabBookFilter.value || "all";
      clearElement(el.vocabBookFilter);

      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "بارلىق كىتابلار";
      el.vocabBookFilter.appendChild(allOpt);

      appState.books.forEach(function (book) {
        const opt = document.createElement("option");
        opt.value = book.id;
        opt.textContent = book.title;
        el.vocabBookFilter.appendChild(opt);
      });

      if (
        prevSelected === "all" ||
        appState.books.some(function (b) {
          return b.id === prevSelected;
        })
      ) {
        el.vocabBookFilter.value = prevSelected;
      }

      const selectedBookId = el.vocabBookFilter.value;
      const query = safeString(el.vocabSearch.value, 100).toLowerCase();

      const items = [];
      appState.books.forEach(function (book) {
        if (selectedBookId !== "all" && book.id !== selectedBookId) return;
        book.vocabulary.forEach(function (v) {
          if (
            query &&
            v.term.toLowerCase().indexOf(query) === -1 &&
            v.meaning.toLowerCase().indexOf(query) === -1
          ) {
            return;
          }
          items.push({ bookTitle: book.title, term: v.term, meaning: v.meaning });
        });
      });

      clearElement(el.vocabList);
      if (items.length === 0) {
        el.vocabEmpty.hidden = false;
        return;
      }

      el.vocabEmpty.hidden = true;
      items.forEach(function (item) {
        const box = document.createElement("div");
        box.className = "list-item-well";

        const head = document.createElement("div");
        head.className = "item-head";

        const termEl = document.createElement("span");
        termEl.className = "item-title";
        termEl.textContent = item.term;

        const bookEl = document.createElement("span");
        bookEl.className = "item-sub";
        bookEl.textContent = item.bookTitle;

        const meaningEl = document.createElement("p");
        meaningEl.className = "item-body";
        meaningEl.textContent = item.meaning;

        head.appendChild(termEl);
        head.appendChild(bookEl);
        box.appendChild(head);
        box.appendChild(meaningEl);
        el.vocabList.appendChild(box);
      });
    }

    /* ---------------- مۇھىم ئەسكەرتىش سىزىش ---------------- */
    function renderReminders() {
      el.chkGlobalReminder.checked = Boolean(appState.settings.globalReminderEnabled);
      el.selectInterval.value = String(appState.settings.reminderIntervalMinutes || 0);

      const notes = [];
      appState.books.forEach(function (book) {
        book.reminders.forEach(function (r) {
          notes.push({ bookTitle: book.title, text: r.text });
        });
      });

      clearElement(el.remindersList);
      if (notes.length === 0) {
        el.remindersEmpty.hidden = false;
        return;
      }

      el.remindersEmpty.hidden = true;
      notes.forEach(function (note, idx) {
        const box = document.createElement("div");
        box.className = "list-item-well";

        const head = document.createElement("div");
        head.className = "item-head";

        const numEl = document.createElement("span");
        numEl.className = "item-title";
        numEl.textContent = (idx + 1) + ". مۇھىم ئەسكەرتىش";

        const bookEl = document.createElement("span");
        bookEl.className = "item-sub";
        bookEl.textContent = note.bookTitle;

        const bodyEl = document.createElement("p");
        bodyEl.className = "item-body";
        bodyEl.textContent = note.text;

        head.appendChild(numEl);
        head.appendChild(bookEl);
        box.appendChild(head);
        box.appendChild(bodyEl);
        el.remindersList.appendChild(box);
      });
    }

    /* ---------------- JSON تەھلىل قىلىش ---------------- */
    function stripCodeFences(rawText) {
      let cleaned = rawText.replace(/^\uFEFF/, "").trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
      }
      return cleaned;
    }

    function parseIncomingBookJson(rawText, manualTitle) {
      const cleaned = stripCodeFences(rawText);
      if (!cleaned) {
        throw new Error("JSON مەزمۇنى بوش. ھۆججەت يۈكلەڭ ياكى JSON تېكىستىنى چاپلاڭ.");
      }

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (_parseErr) {
        throw new Error("JSON فورماتى توغرا ئەمەس. تىرناق ۋە پەشلەرنى تەكشۈرۈپ قايتا سىناڭ.");
      }

      let rawQuestions = [];
      let rawVocab = [];
      let rawReminders = [];
      let detectedTitle = "";
      let detectedCategory = "ئومۇمىي بىلىم";

      if (Array.isArray(parsed)) {
        rawQuestions = parsed;
      } else if (parsed && typeof parsed === "object") {
        detectedTitle = safeString(
          parsed.bookTitle || parsed.title || parsed.name || parsed.bookName || "",
          200
        );
        detectedCategory = safeString(parsed.category || "ئومۇمىي بىلىم", 100);
        rawQuestions =
          parsed.questions || parsed.qa || parsed.items || parsed.cards || [];
        rawVocab =
          parsed.vocabulary || parsed.terms || parsed.words || parsed.glossary || [];
        rawReminders =
          parsed.reminders || parsed.notes || parsed.keyPoints || parsed.takeaways || [];
      } else {
        throw new Error("JSON مەزمۇنى ئوبيېكت ياكى سوئاللار تىزىملىكى بولۇشى كېرەك.");
      }

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error("JSON ئىچىدە سوئال-جاۋاب تىزىملىكى (questions) تېپىلمىدى.");
      }

      const questions = rawQuestions
        .slice(0, MAX_QUESTIONS_PER_BOOK)
        .map(function (item, idx) {
          if (!item || typeof item !== "object") return null;
          const qText = safeString(item.question || item.q || item.prompt || "", MAX_TEXT_LENGTH);
          const aText = safeString(item.answer || item.a || item.response || "", MAX_TEXT_LENGTH);
          if (!qText || !aText) return null;
          return {
            id: "q_" + (idx + 1) + "_" + Date.now().toString(36),
            question: qText,
            answer: aText,
            importance: safeString(item.importance || item.level || "مۇھىم", 64),
            mastered: false,
            reviewCount: 0
          };
        })
        .filter(Boolean);

      if (questions.length === 0) {
        throw new Error("ئىناۋەتلىك «question» ۋە «answer» جۈپى تېپىلمىدى.");
      }

      const vocabulary = Array.isArray(rawVocab)
        ? rawVocab
            .map(function (v, idx) {
              if (!v || typeof v !== "object") return null;
              const term = safeString(v.term || v.word || v.key || "", 200);
              const meaning = safeString(v.meaning || v.definition || v.value || "", 2000);
              if (!term) return null;
              return { id: "v_" + (idx + 1), term: term, meaning: meaning || "ئىزاھات يوق" };
            })
            .filter(Boolean)
        : [];

      const reminders = Array.isArray(rawReminders)
        ? rawReminders
            .map(function (r, idx) {
              const txt =
                typeof r === "string"
                  ? safeString(r, 1000)
                  : r && typeof r === "object"
                    ? safeString(r.text || r.note || r.content || "", 1000)
                    : "";
              return txt ? { id: "r_" + (idx + 1), text: txt } : null;
            })
            .filter(Boolean)
        : [];

      const finalTitle = safeString(manualTitle, 200) || detectedTitle;
      if (!finalTitle) {
        throw new Error("كىتاب ياكى بىلىم ئىسمىنى يېزىڭ.");
      }

      return {
        id: generateId("book"),
        title: finalTitle,
        category: detectedCategory,
        reminderEnabled: Boolean(el.chkNewBookReminder.checked),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        questions: questions,
        vocabulary: vocabulary,
        reminders: reminders
      };
    }

    function showAddError(msg) {
      el.addErrorText.textContent = msg;
      el.addErrorBox.classList.add("visible");
      el.inputJsonText.setAttribute("aria-invalid", "true");
      el.inputJsonText.classList.remove("shake");
      void el.inputJsonText.offsetWidth;
      el.inputJsonText.classList.add("shake");
    }

    function hideAddError() {
      el.addErrorBox.classList.remove("visible");
      el.inputJsonText.removeAttribute("aria-invalid");
      el.inputBookTitle.removeAttribute("aria-invalid");
    }

    /* ---------------- كۆچۈرۈش فۇنكسىيەسى ---------------- */
    async function copyTextToClipboard(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_clipErr) {
        // ئىككىنچى ئۇسۇلغا ئۆتىدۇ
      }
      try {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(helper);
        return copied;
      } catch (_fallbackErr) {
        return false;
      }
    }

    /* ---------------- ۋەقەلەرنى باغلاش ---------------- */
    el.btnBack.addEventListener("click", function () {
      navigateTo("home", "ئۆگىنىش قورالىم");
    });

    el.btnOpenVocab.addEventListener("click", function () {
      navigateTo("vocabulary", "مۇھىم سۆزلۈكلەر");
    });

    el.btnOpenReminders.addEventListener("click", function () {
      navigateTo("reminders", "مۇھىم ئەسكەرتىش");
    });

    el.btnOpenAdd.addEventListener("click", function () {
      el.inputBookTitle.value = "";
      el.inputJsonText.value = "";
      el.inputJsonFile.value = "";
      el.fileDropText.textContent = "كومپيۇتېردىن .json ھۆججەت تاللاش";
      el.chkNewBookReminder.checked = true;
      navigateTo("add", "كىتاب قوشۇش");
    });

    el.btnCopyPrompt.addEventListener("click", async function () {
      try {
        const copied = await copyTextToClipboard(AI_PROMPT_TEMPLATE);
        if (copied) {
          showToast("30 سوئال-جاۋاب ئۈچۈن JSON پرومپىتى كۆچۈرۈلدى!", "success");
        } else {
          showToast("كۆچۈرۈش مەغلۇپ بولدى. قايتا سىناڭ.", "error");
        }
      } catch (_err) {
        showToast("پرومپىت كۆچۈرۈشتە خاتالىق كۆرۈلدى.", "error");
      }
    });

    el.btnStartupReveal.addEventListener("click", function () {
      const visible = el.startupAnswer.classList.toggle("visible");
      el.btnStartupReveal.textContent = visible ? "جاۋابنى يوشۇرۇش" : "جاۋابنى كۆرۈش";
    });

    el.btnStartupDismiss.addEventListener("click", async function () {
      appState.pendingStartupReminder = null;
      await persistState();
      clearBadge();
      renderStartupBanner();
      showToast("ئەسكەرتمە تاماملاندى", "success");
    });

    /* ئۆگىنىش كۆرۈنۈشى ۋەقەلىرى */
    el.segButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        studyFilter = btn.getAttribute("data-filter") || "all";
        studyIndex = 0;
        answerRevealed = false;
        renderStudy();
      });
    });

    el.btnToggleAnswer.addEventListener("click", function () {
      answerRevealed = !answerRevealed;
      renderStudy();
    });

    el.btnMarkMastered.addEventListener("click", async function () {
      const book = getActiveBook();
      const list = getFilteredQuestions(book);
      if (!book || list.length === 0) return;
      const q = list[studyIndex];
      q.mastered = true;
      q.reviewCount += 1;
      book.updatedAt = Date.now();
      await persistState();
      showToast("بۇ سوئال «ئىگىلەندى» دەپ ساقلاندى", "success");
      answerRevealed = false;
      if (studyFilter === "unmastered") {
        studyIndex = Math.min(studyIndex, Math.max(0, getFilteredQuestions(book).length - 1));
      } else if (studyIndex < list.length - 1) {
        studyIndex += 1;
      }
      renderStudy();
    });

    el.btnMarkReview.addEventListener("click", async function () {
      const book = getActiveBook();
      const list = getFilteredQuestions(book);
      if (!book || list.length === 0) return;
      const q = list[studyIndex];
      q.mastered = false;
      q.reviewCount += 1;
      book.updatedAt = Date.now();
      await persistState();
      showToast("قايتا تەكرارلاش تىزىمىدا ساقلاندى", "success");
      answerRevealed = false;
      if (studyIndex < list.length - 1) {
        studyIndex += 1;
      }
      renderStudy();
    });

    el.btnPrevQ.addEventListener("click", function () {
      const book = getActiveBook();
      const list = getFilteredQuestions(book);
      if (list.length <= 1) return;
      studyIndex = (studyIndex - 1 + list.length) % list.length;
      answerRevealed = false;
      renderStudy();
    });

    el.btnNextQ.addEventListener("click", function () {
      const book = getActiveBook();
      const list = getFilteredQuestions(book);
      if (list.length <= 1) return;
      studyIndex = (studyIndex + 1) % list.length;
      answerRevealed = false;
      renderStudy();
    });

    el.btnExportBook.addEventListener("click", function () {
      try {
        const book = getActiveBook();
        if (!book) return;
        const exportObj = {
          bookTitle: book.title,
          category: book.category,
          questions: book.questions.map(function (q, i) {
            return {
              id: i + 1,
              question: q.question,
              answer: q.answer,
              importance: q.importance
            };
          }),
          vocabulary: book.vocabulary.map(function (v) {
            return { term: v.term, meaning: v.meaning };
          }),
          reminders: book.reminders.map(function (r) {
            return r.text;
          })
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
          type: "application/json;charset=utf-8"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kitab-zapas-" + Date.now() + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
        showToast("كىتاب زاپاس JSON قىلىپ چۈشۈرۈلدى", "success");
      } catch (_err) {
        showToast("زاپاس چۈشۈرۈشتە خاتالىق كۆرۈلدى.", "error");
      }
    });

    el.btnDeleteBook.addEventListener("click", async function () {
      const book = getActiveBook();
      if (!book) return;
      if (!deleteConfirmPending) {
        deleteConfirmPending = true;
        el.btnDeleteBook.textContent = "ئۆچۈرۈشنى جەزملەڭ";
        return;
      }
      appState.books = appState.books.filter(function (b) {
        return b.id !== book.id;
      });
      if (appState.pendingStartupReminder && appState.pendingStartupReminder.bookId === book.id) {
        appState.pendingStartupReminder = null;
      }
      await persistState();
      showToast("«" + book.title + "» ئۆچۈرۈلدى", "success");
      navigateTo("home", "ئۆگىنىش قورالىم");
    });

    /* سۆزلۈكلەر ۋەقەلىرى */
    el.vocabBookFilter.addEventListener("change", renderVocabulary);
    el.vocabSearch.addEventListener("input", renderVocabulary);

    el.btnAddVocab.addEventListener("click", async function () {
      const term = safeString(el.newVocabTerm.value, 200);
      const meaning = safeString(el.newVocabMeaning.value, 2000);
      if (!term || !meaning) {
        showToast("سۆزلۈك ۋە مەنىسىنى تولۇق يېزىڭ.", "error");
        return;
      }
      if (appState.books.length === 0) {
        showToast("ئاۋۋال ئەڭ ئاز دېگەندە بىر كىتاب قوشۇڭ.", "error");
        return;
      }
      const targetId = el.vocabBookFilter.value;
      const targetBook =
        appState.books.find(function (b) {
          return b.id === targetId;
        }) || appState.books[0];

      targetBook.vocabulary.unshift({
        id: generateId("v"),
        term: term,
        meaning: meaning
      });
      targetBook.updatedAt = Date.now();
      const ok = await persistState();
      if (ok) {
        el.newVocabTerm.value = "";
        el.newVocabMeaning.value = "";
        renderVocabulary();
        showToast("يېڭى سۆزلۈك ساقلاندى", "success");
      }
    });

    /* ئەسكەرتىشلەر ۋەقەلىرى */
    el.chkGlobalReminder.addEventListener("change", async function () {
      appState.settings.globalReminderEnabled = el.chkGlobalReminder.checked;
      await persistState();
      syncPeriodicAlarm(appState.settings);
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: "SYNC_ALARM" }, function () {
            void (chrome.runtime && chrome.runtime.lastError);
          });
        } catch (_err) {}
      }
      showToast(
        appState.settings.globalReminderEnabled
          ? "تور كۆرگۈچ ئەسكەرتمىسى ئېچىلدى"
          : "تور كۆرگۈچ ئەسكەرتمىسى ئۆچۈرۈلدى",
        "success"
      );
    });

    el.selectInterval.addEventListener("change", async function () {
      const val = Number(el.selectInterval.value);
      appState.settings.reminderIntervalMinutes = val === 60 || val === 180 ? val : 0;
      await persistState();
      syncPeriodicAlarm(appState.settings);
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: "SYNC_ALARM" }, function () {
            void (chrome.runtime && chrome.runtime.lastError);
          });
        } catch (_err) {}
      }
      showToast("ئەسكەرتىش ئارىلىقى ساقلاندى", "success");
    });

    el.btnTestNotification.addEventListener("click", async function () {
      try {
        const res = await triggerStudyReminder(true);
        if (res && res.triggered) {
          appState = await readStorageState();
          showToast("ئەسكەرتمە ئۇقتۇرۇشى سىناق قىلىندى!", "success");
          navigateTo("home", "ئۆگىنىش قورالىم");
        } else {
          showToast("ئەسكەرتمە تاللانغان كىتاب تېپىلمىدى.", "error");
        }
      } catch (_err) {
        showToast("ئەسكەرتمە سىناشتا خاتالىق كۆرۈلدى.", "error");
      }
    });

    el.btnAddReminderNote.addEventListener("click", async function () {
      const text = safeString(el.newReminderText.value, 1000);
      if (!text) {
        showToast("مۇھىم ئەسكەرتىش مەزمۇنىنى يېزىڭ.", "error");
        return;
      }
      if (appState.books.length === 0) {
        showToast("ئاۋۋال ئەڭ ئاز دېگەندە بىر كىتاب قوشۇڭ.", "error");
        return;
      }
      appState.books[0].reminders.unshift({
        id: generateId("r"),
        text: text
      });
      appState.books[0].updatedAt = Date.now();
      const ok = await persistState();
      if (ok) {
        el.newReminderText.value = "";
        renderReminders();
        showToast("مۇھىم ئەسكەرتىش ساقلاندى", "success");
      }
    });

    /* كىتاب قوشۇش ۋەقەلىرى */
    el.inputJsonFile.addEventListener("change", function () {
      try {
        const file = el.inputJsonFile.files && el.inputJsonFile.files[0];
        if (!file) return;
        el.fileDropText.textContent = "تاللانغان ھۆججەت: " + file.name;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const content = typeof reader.result === "string" ? reader.result : "";
            el.inputJsonText.value = content;
            hideAddError();
            try {
              const previewObj = JSON.parse(stripCodeFences(content));
              if (
                previewObj &&
                typeof previewObj === "object" &&
                !el.inputBookTitle.value.trim()
              ) {
                const autoTitle = safeString(
                  previewObj.bookTitle || previewObj.title || previewObj.name || "",
                  200
                );
                if (autoTitle) el.inputBookTitle.value = autoTitle;
              }
            } catch (_previewErr) {}
          } catch (_readErr) {
            showAddError("ھۆججەتنى ئوقۇشتا خاتالىق كۆرۈلدى.");
          }
        };
        reader.onerror = function () {
          showAddError("ھۆججەتنى ئوقۇش مەغلۇپ بولدى.");
        };
        reader.readAsText(file, "UTF-8");
      } catch (_err) {
        showAddError("ھۆججەت تاللاشتا خاتالىق كۆرۈلدى.");
      }
    });

    el.inputJsonText.addEventListener("input", hideAddError);
    el.inputBookTitle.addEventListener("input", hideAddError);

    el.btnSaveBook.addEventListener("click", async function () {
      try {
        hideAddError();
        const newBook = parseIncomingBookJson(
          el.inputJsonText.value,
          el.inputBookTitle.value
        );
        appState.books.push(newBook);
        const ok = await persistState();
        if (ok) {
          showToast(
            "«" + newBook.title + "» (" + newBook.questions.length + " سوئال) مەڭگۈلۈك ساقلاندى!",
            "success"
          );
          navigateTo("home", "ئۆگىنىش قورالىم");
        }
      } catch (err) {
        showAddError(err && err.message ? err.message : "JSON تەھلىل قىلىشتا خاتالىق كۆرۈلدى.");
      }
    });

    /* دەسلەپكى قوزغىتىش */
    readStorageState()
      .then(function (loaded) {
        appState = loaded;
        renderHome();
      })
      .catch(function () {
        appState = createDefaultState();
        renderHome();
      });
  })();
}
