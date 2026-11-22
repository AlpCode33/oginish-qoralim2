import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { EXTENSION_FILES } from '../data/extensionAssets';
import { triggerFileDownload } from '../utils/zipBuilder';

type ExtensionFileKey = 'manifest' | 'popupHtml' | 'popupJs';

const FILE_META: Record<
  ExtensionFileKey,
  { name: string; label: string; description: string; mime: string }
> = {
  manifest: {
    name: 'manifest.json',
    label: 'manifest.json',
    description: 'Chrome Manifest V3، قاتتىق CSP (connect-src none) ۋە ئەڭ ئاز ئىجازەت ئۆلچىمى',
    mime: 'application/json;charset=utf-8',
  },
  popupHtml: {
    name: 'popup.html',
    label: 'popup.html',
    description: 'تولۇق RTL يۇمشاق نېئومورفىزم كۆرۈنمە يۈزى ۋە يەرلىك CSS ئۇسلۇبلىرى',
    mime: 'text/html;charset=utf-8',
  },
  popupJs: {
    name: 'popup.js',
    label: 'popup.js',
    description: 'قوش مۇھىتلىق ئارقا سۇپا ئەسكەرتمە + Popup ئۆگىنىش ماتورى، %100 try/catch بىلەن قوغدالغان',
    mime: 'application/javascript;charset=utf-8',
  },
};

export const CodeInspector: React.FC = () => {
  const [selected, setSelected] = useState<ExtensionFileKey>('manifest');
  const [copiedKey, setCopiedKey] = useState<ExtensionFileKey | null>(null);

  const meta = FILE_META[selected];
  const code = EXTENSION_FILES[selected];
  const lineCount = code.split('\n').length;
  const byteSize = new TextEncoder().encode(code).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedKey(selected);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([code], { type: meta.mime });
    triggerFileDownload(blob, meta.name);
  };

  return (
    <section className="neu-card p-6 md:p-8 flex flex-col gap-5 animate-neu-enter">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="m-0 text-[22px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
            قىستۇرمىنىڭ دەل 3 يادرولۇق ھۆججىتى
          </h2>
          <p className="m-0 mt-1 text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
            بارلىق كودلار تولۇق، كېسىلمىگەن ۋە چالا قالدۇرۇلمىغان؛ بىۋاسىتە Chrome غا يۈكلەشكە تەييار.
          </p>
        </div>

        {/* File selector segmented control */}
        <div className="neu-well p-1 inline-flex items-center gap-1" role="tablist">
          {(['manifest', 'popupHtml', 'popupJs'] as ExtensionFileKey[]).map((key) => {
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(key)}
                className="h-10 px-4 rounded-xl text-[14px] font-bold border-0 cursor-pointer whitespace-nowrap transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: active ? 'var(--color-bg)' : 'transparent',
                  color: active ? 'var(--color-link)' : 'var(--color-text-muted)',
                  boxShadow: active ? 'var(--shadow-soft)' : 'none',
                }}
              >
                <bdi>{FILE_META[key].label}</bdi>
              </button>
            );
          })}
        </div>
      </div>

      {/* File info & actions row */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 pt-3 pb-1"
        style={{ borderTop: '1px solid rgba(159, 179, 224, 0.45)' }}
      >
        <div className="text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-text-strong)' }}>
            <bdi>{meta.name}</bdi>
          </strong>
          <span aria-hidden="true"> · </span>
          <span>{meta.description}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">
            <bdi>{lineCount}</bdi> قۇر
          </span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">
            <bdi>{(byteSize / 1024).toFixed(1)} KB</bdi>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="neu-btn-secondary h-10 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
          >
            {copiedKey === selected ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey === selected ? 'كۆچۈرۈلدى' : 'كودنى كۆچۈرۈش'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSingle}
            className="neu-btn-secondary h-10 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>چۈشۈرۈش</span>
          </button>
        </div>
      </div>

      {/* Code Display */}
      <div className="neu-well p-4 overflow-x-auto max-h-[620px] overflow-y-auto" dir="ltr">
        <pre
          className="m-0 text-[13px] leading-[1.65] text-left"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-strong)',
          }}
        >
          <code>{code}</code>
        </pre>
      </div>
    </section>
  );
};
