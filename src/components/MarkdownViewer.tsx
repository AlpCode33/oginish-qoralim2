import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { triggerFileDownload } from '../utils/zipBuilder';

interface MarkdownViewerProps {
  title: string;
  filename: string;
  content: string;
  subtitle?: string;
}

function renderInlineText(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} style={{ color: 'var(--color-text-strong)' }}>
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="px-1.5 py-0.5 rounded-md text-[13px]"
          style={{
            fontFamily: 'var(--font-mono)',
            background: 'var(--color-surface)',
            color: 'var(--color-link)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  title,
  filename,
  content,
  subtitle,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    triggerFileDownload(blob, filename);
  };

  // Safe React block parser (no dangerouslySetInnerHTML)
  const blocks: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`code-${i}`}
          dir="ltr"
          className="neu-well p-4 overflow-x-auto text-[13px] leading-relaxed my-3 text-left"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-strong)' }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Markdown table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);

      blocks.push(
        <div key={`table-${i}`} className="neu-well overflow-x-auto my-4 p-1">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="text-start py-2.5 px-3 font-bold"
                    style={{ color: 'var(--color-text-strong)' }}
                  >
                    {renderInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom:
                      rIdx < rows.length - 1 ? '1px solid rgba(159, 179, 224, 0.35)' : 'none',
                  }}
                >
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3 align-top" style={{ color: 'var(--color-text)' }}>
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="text-[24px] font-bold mt-2 mb-3"
          style={{ color: 'var(--color-text-strong)' }}
        >
          {renderInlineText(line.slice(2))}
        </h2>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="text-[20px] font-bold mt-6 mb-2 pt-4"
          style={{
            color: 'var(--color-text-strong)',
            borderTop: '1px solid rgba(159, 179, 224, 0.4)',
          }}
        >
          {renderInlineText(line.slice(3))}
        </h3>
      );
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="text-[17px] font-bold mt-4 mb-1.5"
          style={{ color: 'var(--color-link)' }}
        >
          {renderInlineText(line.slice(4))}
        </h4>
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      blocks.push(
        <hr
          key={`hr-${i}`}
          className="my-5 border-0 h-px"
          style={{ background: 'rgba(159, 179, 224, 0.5)' }}
        />
      );
      i += 1;
      continue;
    }

    // Unordered or ordered list
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const listItems: string[] = [];
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i += 1;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${i}`}
          className={`${isOrdered ? 'list-decimal' : 'list-disc'} pr-5 my-2.5 flex flex-col gap-1.5 text-[15px]`}
          style={{ color: 'var(--color-text)' }}
        >
          {listItems.map((item, liIdx) => (
            <li key={liIdx}>{renderInlineText(item)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push(
        <div key={`quote-${i}`} className="neu-well px-4 py-3 my-3 text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
          {renderInlineText(line.slice(2))}
        </div>
      );
      i += 1;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={`p-${i}`} className="my-2 text-[15px] leading-[1.85]" style={{ color: 'var(--color-text)' }}>
        {renderInlineText(line)}
      </p>
    );
    i += 1;
  }

  return (
    <section className="neu-card p-6 md:p-8 flex flex-col gap-5 animate-neu-enter">
      <div
        className="flex flex-wrap items-center justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid rgba(159, 179, 224, 0.5)' }}
      >
        <div>
          <h2 className="m-0 text-[22px] font-bold" style={{ color: 'var(--color-text-strong)' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="m-0 mt-1 text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="neu-btn-secondary h-10 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'كۆچۈرۈلدى' : 'تولۇق كۆچۈرۈش'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="neu-btn-secondary h-10 px-4 text-[14px] inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>
              <bdi>{filename}</bdi> چۈشۈرۈش
            </span>
          </button>
        </div>
      </div>

      <article className="max-w-none">{blocks}</article>
    </section>
  );
};
