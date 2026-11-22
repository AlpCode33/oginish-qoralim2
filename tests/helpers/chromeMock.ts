import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const ROOT_DIR = path.resolve(process.cwd());
export const MANIFEST_PATH = path.join(ROOT_DIR, 'extension', 'manifest.json');
export const POPUP_HTML_PATH = path.join(ROOT_DIR, 'extension', 'popup.html');
export const POPUP_JS_PATH = path.join(ROOT_DIR, 'extension', 'popup.js');

export interface ChromeMockHandle {
  chrome: Record<string, unknown>;
  storageData: Record<string, unknown>;
  createdAlarms: Array<{ name: string; info: Record<string, unknown> }>;
  clearedAlarms: string[];
  createdNotifications: Array<{ id: string; options: Record<string, unknown> }>;
  clearedNotifications: string[];
  badgeTextHistory: string[];
  badgeColorHistory: string[];
  sentMessages: unknown[];
  openPopupCalls: number;
  setLastError: (msg: string | null) => void;
  emitInstalled: () => void;
  emitStartup: () => void;
  emitAlarm: (name: string) => void;
  emitNotificationClicked: (notifId: string) => void;
  emitMessage: (message: unknown) => Promise<unknown>;
}

export function createChromeMock(initialStorage: Record<string, unknown> = {}): ChromeMockHandle {
  const storageData: Record<string, unknown> = { ...initialStorage };
  const createdAlarms: Array<{ name: string; info: Record<string, unknown> }> = [];
  const clearedAlarms: string[] = [];
  const createdNotifications: Array<{ id: string; options: Record<string, unknown> }> = [];
  const clearedNotifications: string[] = [];
  const badgeTextHistory: string[] = [];
  const badgeColorHistory: string[] = [];
  const sentMessages: unknown[] = [];
  let openPopupCalls = 0;
  let currentLastError: { message: string } | undefined = undefined;

  const installedListeners: Array<() => void> = [];
  const startupListeners: Array<() => void> = [];
  const alarmListeners: Array<(alarm: { name: string }) => void> = [];
  const notificationClickListeners: Array<(notifId: string) => void> = [];
  const messageListeners: Array<
    (msg: unknown, sender: unknown, sendResponse: (res?: unknown) => void) => boolean | void
  > = [];

  const chromeObj = {
    storage: {
      local: {
        get(keys: string[], callback: (result: Record<string, unknown>) => void) {
          const res: Record<string, unknown> = {};
          for (const k of keys) {
            if (Object.prototype.hasOwnProperty.call(storageData, k)) {
              res[k] = JSON.parse(JSON.stringify(storageData[k]));
            }
          }
          callback(res);
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          if (!currentLastError) {
            for (const [k, v] of Object.entries(items)) {
              storageData[k] = JSON.parse(JSON.stringify(v));
            }
          }
          callback?.();
        },
      },
    },
    runtime: {
      get lastError() {
        return currentLastError;
      },
      onInstalled: {
        addListener(fn: () => void) {
          installedListeners.push(fn);
        },
      },
      onStartup: {
        addListener(fn: () => void) {
          startupListeners.push(fn);
        },
      },
      onMessage: {
        addListener(
          fn: (msg: unknown, sender: unknown, sendResponse: (res?: unknown) => void) => boolean | void
        ) {
          messageListeners.push(fn);
        },
      },
      sendMessage(message: unknown, callback?: (res?: unknown) => void) {
        sentMessages.push(message);
        callback?.({ ok: true });
      },
    },
    alarms: {
      clear(name: string, callback?: (wasCleared: boolean) => void) {
        clearedAlarms.push(name);
        callback?.(true);
      },
      create(name: string, info: Record<string, unknown>) {
        createdAlarms.push({ name, info });
      },
      onAlarm: {
        addListener(fn: (alarm: { name: string }) => void) {
          alarmListeners.push(fn);
        },
      },
    },
    notifications: {
      create(id: string, options: Record<string, unknown>) {
        createdNotifications.push({ id, options });
      },
      clear(id: string) {
        clearedNotifications.push(id);
      },
      onClicked: {
        addListener(fn: (notifId: string) => void) {
          notificationClickListeners.push(fn);
        },
      },
    },
    action: {
      setBadgeBackgroundColor(details: { color: string }) {
        badgeColorHistory.push(details.color);
      },
      setBadgeText(details: { text: string }) {
        badgeTextHistory.push(details.text);
      },
      openPopup() {
        openPopupCalls += 1;
        return Promise.resolve();
      },
    },
  };

  return {
    chrome: chromeObj,
    storageData,
    createdAlarms,
    clearedAlarms,
    createdNotifications,
    clearedNotifications,
    badgeTextHistory,
    badgeColorHistory,
    sentMessages,
    get openPopupCalls() {
      return openPopupCalls;
    },
    setLastError(msg: string | null) {
      currentLastError = msg ? { message: msg } : undefined;
    },
    emitInstalled() {
      installedListeners.forEach((fn) => fn());
    },
    emitStartup() {
      startupListeners.forEach((fn) => fn());
    },
    emitAlarm(name: string) {
      alarmListeners.forEach((fn) => fn({ name }));
    },
    emitNotificationClicked(notifId: string) {
      notificationClickListeners.forEach((fn) => fn(notifId));
    },
    emitMessage(message: unknown) {
      return new Promise((resolve) => {
        if (messageListeners.length === 0) {
          resolve(undefined);
          return;
        }
        let handled = false;
        for (const fn of messageListeners) {
          const isAsync = fn(message, {}, (res) => resolve(res));
          if (isAsync) handled = true;
        }
        if (!handled) resolve(undefined);
      });
    },
  };
}

export interface ServiceWorkerExports {
  STORAGE_KEY: string;
  ALARM_NAME: string;
  NOTIFICATION_ID_PREFIX: string;
  MAX_QUESTIONS_PER_BOOK: number;
  MAX_TEXT_LENGTH: number;
  NOTIFICATION_ICON_DATA_URI: string;
  AI_PROMPT_TEMPLATE: string;
  createDefaultState: () => Record<string, unknown>;
  safeString: (value: unknown, maxLen?: number) => string;
  generateId: (prefix: string) => string;
  normalizeState: (raw: unknown) => Record<string, unknown>;
  readStorageState: () => Promise<Record<string, unknown>>;
  writeStorageState: (nextState: unknown) => Promise<Record<string, unknown>>;
  pickReminderPayload: (state: unknown) => Record<string, unknown> | null;
  syncPeriodicAlarm: (settings: { globalReminderEnabled: boolean; reminderIntervalMinutes: number }) => void;
  triggerStudyReminder: (forceTrigger: boolean) => Promise<{ triggered: boolean; reason?: string; payload?: Record<string, unknown> }>;
}

export function loadServiceWorkerEnv(options?: {
  chromeMock?: ChromeMockHandle;
  localStorageMap?: Map<string, string>;
  disableChrome?: boolean;
}): { exports: ServiceWorkerExports; mock: ChromeMockHandle; localStorageMap: Map<string, string> } {
  const mock = options?.chromeMock ?? createChromeMock();
  const localStorageMap = options?.localStorageMap ?? new Map<string, string>();
  const code = fs.readFileSync(POPUP_JS_PATH, 'utf8');

  const localStorageObj = {
    getItem(key: string) {
      return localStorageMap.has(key) ? localStorageMap.get(key)! : null;
    },
    setItem(key: string, val: string) {
      localStorageMap.set(key, String(val));
    },
  };

  const sandbox: Record<string, unknown> = {
    console,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    localStorage: localStorageObj,
  };

  if (!options?.disableChrome) {
    sandbox.chrome = mock.chrome;
  }

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: 'popup.js' });

  const exports = vm.runInContext(
    `({
      STORAGE_KEY,
      ALARM_NAME,
      NOTIFICATION_ID_PREFIX,
      MAX_QUESTIONS_PER_BOOK,
      MAX_TEXT_LENGTH,
      NOTIFICATION_ICON_DATA_URI,
      AI_PROMPT_TEMPLATE,
      createDefaultState,
      safeString,
      generateId,
      normalizeState,
      readStorageState,
      writeStorageState,
      pickReminderPayload,
      syncPeriodicAlarm,
      triggerStudyReminder
    })`,
    context
  ) as ServiceWorkerExports;

  return { exports, mock, localStorageMap };
}

export async function flushMicrotasks(ticks = 6): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

export interface PopupDomEnv {
  dom: JSDOM;
  document: Document;
  window: Window & typeof globalThis;
  mock: ChromeMockHandle;
  copiedTexts: string[];
  downloadedBlobs: Array<{ filename: string; text: string }>;
}

export async function loadPopupDomEnv(options?: {
  initialStorage?: Record<string, unknown>;
  clipboardShouldFail?: boolean;
  execCommandResult?: boolean;
}): Promise<PopupDomEnv> {
  const html = fs.readFileSync(POPUP_HTML_PATH, 'utf8');
  const js = fs.readFileSync(POPUP_JS_PATH, 'utf8');
  const mock = createChromeMock(options?.initialStorage ?? {});

  const dom = new JSDOM(html, {
    url: 'https://extension.local/popup.html',
    runScripts: 'dangerously',
  });

  const win = dom.window as unknown as Window &
    typeof globalThis & {
      chrome: Record<string, unknown>;
      eval: (code: string) => unknown;
      FileReader: typeof FileReader;
    };

  const copiedTexts: string[] = [];
  const downloadedBlobs: Array<{ filename: string; text: string }> = [];
  const blobUrlMap = new Map<string, Blob>();
  let urlCounter = 0;

  win.chrome = mock.chrome;

  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (txt: string) => {
        if (options?.clipboardShouldFail) {
          throw new Error('Clipboard permission denied');
        }
        copiedTexts.push(txt);
      },
    },
  });

  (win.document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = (
    cmd: string
  ) => {
    if (cmd === 'copy' && options?.execCommandResult !== false) {
      const active = win.document.querySelector('textarea:last-of-type') as HTMLTextAreaElement | null;
      if (active) copiedTexts.push(active.value);
      return true;
    }
    return false;
  };

  win.URL.createObjectURL = (blob: Blob) => {
    urlCounter += 1;
    const url = `blob:test-${urlCounter}`;
    blobUrlMap.set(url, blob);
    return url;
  };
  win.URL.revokeObjectURL = () => {};

  const origClick = win.HTMLAnchorElement.prototype.click;
  win.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const blob = blobUrlMap.get(this.href);
    if (blob) {
      blob.text().then((text) => {
        downloadedBlobs.push({ filename: this.download, text });
      });
    }
    if (!this.download) {
      try {
        origClick.call(this);
      } catch {
        // JSDOM navigation warning ignored
      }
    }
  };

  // Evaluate popup.js inside the JSDOM window
  win.eval(js);
  await flushMicrotasks(10);

  return {
    dom,
    document: win.document,
    window: win,
    mock,
    copiedTexts,
    downloadedBlobs,
  };
}
