import React, { useState } from 'react';
import { Bell, Copy, Check, Download, FileJson, X } from 'lucide-react';
import { ExtensionSimulator } from './components/ExtensionSimulator';
import { MarkdownViewer } from './components/MarkdownViewer';
import { CodeInspector } from './components/CodeInspector';
import {
  AI_PROMPT_TEMPLATE,
  DOC_FILES,
  EXTENSION_FILES,
  SAMPLE_IMPORT_JSON_STRING,
} from './data/extensionAssets';
import { buildZipBlob, triggerFileDownload } from './utils/zipBuilder';

type ActiveTab = 'simulator' | 'prd' | 'spec' | 'style' | 'code';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [startupTriggerCount, setStartupTriggerCount] = useState(0);
  const [simNotification, setSimNotification] = useState<{
    title: string;
    question: string;
  } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);

  const handleDownloadZip = () => {
    try {
      const zipBlob = buildZipBlob([
        { path: 'oginish-qoralim/manifest.json', content: EXTENSION_FILES.manifest },
        { path: 'oginish-qoralim/popup.html', content: EXTENSION_FILES.popupHtml },
        { path: 'oginish-qoralim/popup.js', content: EXTENSION_FILES.popupJs },
        { path: 'docs/PRD.md', content: DOC_FILES.prd },
        { path: 'docs/SPEC.md', content: DOC_FILES.spec },
        { path: 'design/style.md', content: DOC_FILES.style },
        { path: 'sample-book.json', content: SAMPLE_IMPORT_JSON_STRING },
      ]);
      triggerFileDownload(zipBlob, 'oginish-qoralim-extension.zip');
      setZipStatus('ZIP ھۆججىتى چۈشۈرۈلدى');
      window.setTimeout(() => setZipStatus(null), 2600);
    } catch {
      setZipStatus('ZIP ھاسىللاشتا خاتالىق كۆرۈلدى');
      window.setTimeout(() => setZipStatus(null), 2600);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadSampleJson = () => {
    const blob = new Blob([SAMPLE_IMPORT_JSON_STRING], {
      type: 'application/json;charset=utf-8',
    });
    triggerFileDownload(blob, 'sample-book.json');
  };

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'simulator', label: 'سىناق كۆرۈنۈشى' },
    { id: 'prd', label: 'PRD ھۆججىتى' },
    { id: 'spec', label: 'SPEC ھۆججىتى' },
    { id: 'style', label: 'ئۇسلۇب كۆرسەتمىسى' },
    { id: 'code', label: 'ئەسلى كودلار' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar: Strict 3-zone contract */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: 'rgba(232, 238, 251, 0.88)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.75)',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('simulator');
            }}
            className="text-[22px] font-bold whitespace-nowrap shrink-0 no-underline"
            style={{ color: 'var(--color-text-strong)' }}
          >
            ئۆگىنىش قورالىم
          </a>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="ئاساسىي يۆنىلىش"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className="bg-transparent border-0 py-1 text-[15px] cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  style={{
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? 'var(--color-link)' : 'var(--color-text-muted)',
                    borderBottom: isActive
                      ? '2px solid var(--color-primary)'
                      : '2px solid transparent',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              className="neu-btn-primary h-[44px] px-5 text-[15px] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{zipStatus || 'ZIP چۈشۈرۈش'}</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-4 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="bg-transparent border-0 py-1 text-[14px] cursor-pointer whitespace-nowrap shrink-0"
                style={{
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--color-link)' : 'var(--color-text-muted)',
                  borderBottom: isActive
                    ? '2px solid var(--color-primary)'
                    : '2px solid transparent',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Simulated Browser Startup Notification Toast (appears when user tests startup reminder) */}
      {simNotification && (
        <div
          role="status"
          className="fixed bottom-6 left-6 z-40 w-[360px] max-w-[calc(100vw-32px)] neu-card p-4 animate-neu-enter"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
              <div className="min-w-0">
                <div
                  className="text-[13px] font-bold"
                  style={{ color: 'var(--color-link)' }}
                >
                  Chrome سىستېما ئۇقتۇرۇشى · {simNotification.title}
                </div>
                <p
                  className="m-0 mt-1 text-[14px] leading-snug"
                  style={{ color: 'var(--color-text-strong)' }}
                >
                  {simNotification.question}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSimNotification(null)}
              aria-label="ئۇقتۇرۇشنى تاقاش"
              className="bg-transparent border-0 p-1 cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="top" className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8">
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 items-start">
            {/* Interactive Chrome Extension Simulator Column */}
            <div className="flex flex-col gap-4 items-center">
              <div className="w-full max-w-[420px] flex items-center justify-between px-1">
                <span className="text-[14px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                  قىستۇرما نەق مەيدان سىنىقى
                </span>
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  <bdi>420px · Manifest V3</bdi>
                </span>
              </div>

              <ExtensionSimulator
                externalStartupTrigger={startupTriggerCount}
                onSimulatedNotification={(title, question) => {
                  setSimNotification({ title, question });
                  window.setTimeout(() => setSimNotification(null), 6500);
                }}
              />

              <button
                type="button"
                onClick={() => setStartupTriggerCount((c) => c + 1)}
                className="neu-btn-secondary w-full max-w-[420px] h-[46px] px-5 text-[14px] inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Bell className="w-4 h-4" />
                <span>تور كۆرگۈچ ئېچىلغاندا چىقىدىغان ئەسكەرتمىنى سىناش</span>
              </button>
            </div>

            {/* Enterprise Workbench & Installation Column */}
            <div className="flex flex-col gap-6 min-w-0">
              {/* Overview & Workflow Card */}
              <section className="neu-card p-6 md:p-7 flex flex-col gap-4 animate-neu-enter">
                <div>
                  <h1
                    className="m-0 text-[28px] font-bold leading-snug"
                    style={{ color: 'var(--color-text-strong)', textWrap: 'balance' }}
                  >
                    ئۆگىنىش قورالىم — نۆل ئىز قوغلايدىغان Chrome ئۆگىنىش قىستۇرمىسى
                  </h1>
                  <div
                    className="mt-2 text-[14px]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span>
                      <bdi>Chrome Manifest V3</bdi>
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>دەل 3 ھۆججەت</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      <bdi>100%</bdi> يەرلىك ساقلاش
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      <bdi>PRD</bdi> ۋە <bdi>SPEC</bdi> بىلەن
                    </span>
                  </div>
                </div>

                <p className="m-0 text-[15px] leading-[1.85]" style={{ color: 'var(--color-text)' }}>
                  ئوڭ تەرەپتىكى قىستۇرمىنى ھازىرلا بىۋاسىتە سىناپ بېقىڭ: كىتابنى بېسىپ سوئال-جاۋابلارنى
                  تەكرارلاڭ، «ئەسكەرتمە» رامكىسىنى ئېچىپ-ئۆچۈرۈڭ ياكى «كىتاب قوشۇش» ئارقىلىق تۆۋەندىكى
                  ئۈلگە JSON نى يۈكلەپ كۆرۈڭ. تەييار قىستۇرمىنى يۇقىرىدىكى <strong>ZIP چۈشۈرۈش</strong>{' '}
                  كۇنۇپكىسى بىلەن چۈشۈرۈپ دەرھال Chrome غا قاچىلىيالايسىز.
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadSampleJson}
                    className="neu-btn-secondary h-11 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>ئۈلگە JSON ھۆججىتى چۈشۈرۈش</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('code')}
                    className="neu-btn-secondary h-11 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>3 ھۆججەت كودىنى كۆرۈش</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('prd')}
                    className="neu-btn-secondary h-11 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>PRD ۋە SPEC نى ئوقۇش</span>
                  </button>
                </div>
              </section>

              {/* Chrome Load Unpacked Steps */}
              <section className="neu-card p-6 md:p-7 flex flex-col gap-4">
                <h2 className="m-0 text-[20px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                  Chrome غا قاچىلاش قەدەملىرى (Load unpacked)
                </h2>
                <ol className="m-0 pr-5 flex flex-col gap-2.5 text-[15px]" style={{ color: 'var(--color-text)' }}>
                  <li>
                    يۇقىرىدىكى <strong>ZIP چۈشۈرۈش</strong> كۇنۇپكىسىنى بېسىپ{' '}
                    <bdi className="font-mono text-[13px]">oginish-qoralim-extension.zip</bdi>{' '}
                    ھۆججىتىنى يېشىڭ.
                  </li>
                  <li>
                    Google Chrome دا{' '}
                    <bdi className="font-mono text-[13px]" style={{ color: 'var(--color-link)' }}>
                      chrome://extensions
                    </bdi>{' '}
                    ئادرېسىنى ئېچىڭ ۋە ئۈستى بۇلۇڭدىكى <strong>Developer mode</strong> نى ئېچىڭ.
                  </li>
                  <li>
                    <strong>Load unpacked</strong> كۇنۇپكىسىنى بېسىپ، يېشىلگەن قىسقۇچ ئىچىدىكى{' '}
                    <bdi className="font-mono text-[13px]">oginish-qoralim</bdi> قىسقۇچىنى تاللاڭ
                    (ئىچىدە دەل <bdi className="font-mono text-[13px]">manifest.json</bdi>،{' '}
                    <bdi className="font-mono text-[13px]">popup.html</bdi> ۋە{' '}
                    <bdi className="font-mono text-[13px]">popup.js</bdi> بار).
                  </li>
                  <li>
                    قىستۇرما دەرھال خاتالىقسىز قاچىلىنىدۇ؛ ئىشلىتىشكە قولايلىق بولۇشى ئۈچۈن قىستۇرما
                    بەلگىسىنى قورال بالدىقىغا مىخلاپ (Pin) قويۇڭ.
                  </li>
                </ol>
              </section>

              {/* AI Prompt Preview Card */}
              <section className="neu-card p-6 md:p-7 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-[20px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                      30 سوئال-جاۋاب ئۈچۈن سۈنئىي ئەقىل پرومپىتى
                    </h2>
                    <p className="m-0 mt-0.5 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                      خالىغان سۈنئىي ئەقىل مودېلىغا كىتاب مەزمۇنى بىلەن بىللە بەرسىڭىز تەييار JSON چىقىرىپ بېرىدۇ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="neu-btn-secondary h-10 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    {promptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{promptCopied ? 'كۆچۈرۈلدى' : 'پرومپىتنى كۆچۈرۈش'}</span>
                  </button>
                </div>

                <pre
                  className="neu-well m-0 p-4 text-[13px] leading-[1.75] max-h-[210px] overflow-y-auto whitespace-pre-wrap"
                  style={{
                    fontFamily: 'var(--font-family)',
                    color: 'var(--color-text)',
                  }}
                >
                  {AI_PROMPT_TEMPLATE}
                </pre>
              </section>

              {/* Security & Privacy Verification Table */}
              <section className="neu-card p-6 md:p-7 flex flex-col gap-3">
                <h2 className="m-0 text-[20px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
                  بىخەتەرلىك ۋە مەخپىيەتلىك قاتتىق ئۆلچىمى
                </h2>
                <div className="neu-well p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
                  <div>
                    <strong className="block" style={{ color: 'var(--color-text-strong)' }}>
                      نۆل ئىز قوغلاش (<bdi>connect-src 'none'</bdi>)
                    </strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      تور كۆرگۈچ CSP قاتلىمىدا ھەر قانداق سىرتقى تور ئۇلىنىشى توسۇلغان.
                    </span>
                  </div>
                  <div>
                    <strong className="block" style={{ color: 'var(--color-text-strong)' }}>
                      %100 يەرلىك ساقلاش
                    </strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      بارلىق كىتابلار پەقەت <bdi>chrome.storage.local</bdi> دا مەڭگۈلۈك ساقلىنىدۇ.
                    </span>
                  </div>
                  <div>
                    <strong className="block" style={{ color: 'var(--color-text-strong)' }}>
                      ئەڭ ئاز ئىجازەت (<bdi>Least Privilege</bdi>)
                    </strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      پەقەت <bdi>storage, notifications, alarms</bdi> — خەتەرلىك رۇخسەتلەر يوق.
                    </span>
                  </div>
                  <div>
                    <strong className="block" style={{ color: 'var(--color-text-strong)' }}>
                      XSS دىن تولۇق مۇداپىئە
                    </strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      بارلىق JSON تېكىستلىرى پەقەت <bdi>textContent</bdi> بىلەن سىزىلىدۇ.
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'prd' && (
          <MarkdownViewer
            title="مەھسۇلات تەلەپ ھۆججىتى (PRD)"
            subtitle="docs/PRD.md · ئېنتېرپرايس سەۋىيەلىك فۇنكسىيەلىك ۋە مەخپىيەتلىك تەلەپلىرى"
            filename="PRD.md"
            content={DOC_FILES.prd}
          />
        )}

        {activeTab === 'spec' && (
          <MarkdownViewer
            title="تېخنىكىلىق ئۆلچەم ۋە قۇرۇلما ھۆججىتى (SPEC)"
            subtitle="docs/SPEC.md · Manifest V3 قوش مۇھىتلىق ئارخىتېكتور، JSON سىخېمىسى ۋە بىخەتەرلىك مودېلى"
            filename="SPEC.md"
            content={DOC_FILES.spec}
          />
        )}

        {activeTab === 'style' && (
          <MarkdownViewer
            title="ئۇسلۇب كۆرسەتمىسى (Design System)"
            subtitle="design/style.md · يورۇق يۇمشاق نېئومورفىزم، RTL ۋە ئۇيغۇرچە خەت ئۆلچىمى"
            filename="style.md"
            content={DOC_FILES.style}
          />
        )}

        {activeTab === 'code' && <CodeInspector />}
      </main>

      {/* Quiet Footer */}
      <footer
        className="mt-10 py-6 px-6 text-center text-[13px]"
        style={{
          color: 'var(--color-text-muted)',
          borderTop: '1px solid rgba(159, 179, 224, 0.35)',
        }}
      >
        ئۆگىنىش قورالىم · Chrome Manifest V3 · تولۇق يەرلىك ساقلاش ۋە نۆل ئىز قوغلاش
      </footer>
    </div>
  );
}
