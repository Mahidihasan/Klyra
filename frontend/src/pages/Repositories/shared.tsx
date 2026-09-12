import React from 'react';
import { Copy, Check, GitBranch } from 'lucide-react';

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export const Avatar: React.FC<{ name?: string | null; color?: string; size?: number }> = ({ name, color = '#8b5cf6', size = 24 }) => (
  <span className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.45 }}>
    {(name || '?').charAt(0).toUpperCase()}
  </span>
);

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toLowerCase();
  const cls = ['success', 'deployed', 'published', 'passed', 'merged'].includes(s) ? 'success'
    : ['failure', 'failed', 'closed'].includes(s) ? 'failure'
    : ['running', 'pending', 'deploying', 'in_review'].includes(s) ? 'running'
    : ['open', 'approved', 'active'].includes(s) ? 'accent' : 'neutral';
  return <span className={`status-pill ${cls}`}>{status.replace(/_/g, ' ')}</span>;
};

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="kr-loading"><span className="kr-spin" />{label}</div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div>
    <div className="kr-error">{message}</div>
    {onRetry && <button className="kr-btn" onClick={onRetry}>Retry</button>}
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string; children?: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="kr-empty">
    <h3>{title}</h3>
    {hint && <div>{hint}</div>}
    {children && <div className="mt16">{children}</div>}
  </div>
);

export const CloneBox: React.FC<{ url: string }> = ({ url }) => {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="clone-box">
      <GitBranch size={14} />
      <span>{url}</span>
      <span className="copy" onClick={() => {
        navigator.clipboard?.writeText(`git clone ${url}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </span>
    </div>
  );
};

// ---------- lightweight syntax highlighting (no external deps) ----------
const KEYWORDS = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'default', 'class', 'extends', 'new', 'await', 'async', 'try', 'catch', 'finally', 'throw', 'typeof', 'interface', 'type', 'public', 'private', 'static', 'def', 'lambda', 'pass', 'elif', 'in', 'of', 'not', 'and', 'or', 'None', 'True', 'False', 'null', 'undefined', 'true', 'false', 'this', 'super', 'switch', 'case', 'break', 'continue', 'package', 'func', 'struct', 'map', 'nil', 'end', 'do', 'require', 'module']);

function tokenizeLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0, key = 0;
  while (i < line.length) {
    if (line.startsWith('//', i) || line.startsWith('#', i) || line.startsWith('--', i)) {
      parts.push(<span key={key++} className="tok-com">{line.slice(i)}</span>); break;
    }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
      parts.push(<span key={key++} className="tok-str">{line.slice(i, j + 1)}</span>);
      i = j + 1; continue;
    }
    if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(line[i - 1] || ' ')) {
      let j = i;
      while (j < line.length && /[0-9._xXa-fA-F]/.test(line[j])) j++;
      parts.push(<span key={key++} className="tok-num">{line.slice(i, j)}</span>);
      i = j; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const nextCh = line[j];
      if (KEYWORDS.has(word)) parts.push(<span key={key++} className="tok-kw">{word}</span>);
      else if (nextCh === '(') parts.push(<span key={key++} className="tok-fn">{word}</span>);
      else if (/^[A-Z]/.test(word)) parts.push(<span key={key++} className="tok-type">{word}</span>);
      else parts.push(<span key={key++}>{word}</span>);
      i = j; continue;
    }
    parts.push(<span key={key++}>{ch}</span>);
    i++;
  }
  return parts;
}

export const HighlightedCode: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="file-viewer">
      {lines.map((line, i) => (
        <div className="code-line" key={i}>
          <span className="ln">{i + 1}</span>
          <span className="lc">{line.length ? tokenizeLine(line) : ' '}</span>
        </div>
      ))}
    </div>
  );
};

// ---------- diff renderer ----------
export const DiffView: React.FC<{ patch: string }> = ({ patch }) => {
  if (!patch?.trim()) return <EmptyState title="No differences" hint="These refs point to identical trees." />;
  const lines = patch.split('\n');
  return (
    <div className="diff-box">
      {lines.map((line, i) => {
        const cls = line.startsWith('+++') || line.startsWith('---') ? 'meta'
          : line.startsWith('@@') ? 'hunk'
          : line.startsWith('+') ? 'add'
          : line.startsWith('-') ? 'del' : '';
        return <div key={i} className={`diff-line ${cls}`}><span>{line || ' '}</span></div>;
      })}
    </div>
  );
};

// ---------- GFM markdown renderer for README / docs (marked + DOMPurify, LaTeX math via KaTeX) ----------
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

// Extract math segments BEFORE marked parses, so $..$, \(..\), $$..$$, \[..\]
// are never mangled by the markdown parser, then restore them as KaTeX HTML.
const MATH_TOKEN = 'KLvraMATH';
function extractMath(src: string): { text: string; segments: { tex: string; display: boolean }[] } {
  const segments: { tex: string; display: boolean }[] = [];
  const stash = (tex: string, display: boolean) => {
    segments.push({ tex, display });
    return `${MATH_TOKEN}${segments.length - 1}END`;
  };
  let text = src
    // fenced/inline code must be left alone
    .replace(/(`+)([\s\S]*?)\1/g, (m) => m.replace(/\$/g, '\u0001DOLLAR\u0001'))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => stash(tex, true))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(tex, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => stash(tex, false))
    .replace(/(?<![\\$\w])\$(?!\s)((?:[^$\n\\]|\\.)+?(?<!\\))\$(?!\d)/g, (_, tex) => stash(tex, false));
  text = text.replace(/\u0001DOLLAR\u0001/g, '$');
  return { text, segments };
}

function renderMathHtml(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return `<code>${tex.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`;
  }
}

export const MiniMarkdown: React.FC<{ source: string }> = ({ source }) => {
  const { text, segments } = extractMath(source || '');
  let html = marked.parse(text, { async: false }) as string;
  html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  // Restore math (KaTeX output is trusted, generated locally)
  html = html.replace(new RegExp(`${MATH_TOKEN}(\\d+)END`, 'g'), (_, idx) =>
    renderMathHtml(segments[Number(idx)]?.tex ?? '', segments[Number(idx)]?.display ?? false));
  const html1 = html;
  return <div className="readme-body gfm" dangerouslySetInnerHTML={{ __html: html1 }} />;
};

const nl = () => String.fromCharCode(10);

// ---------- modal ----------
export const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }> = ({ title, subtitle, onClose, children }) => (
  <div className="kr-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="kr-modal">
      <h3>{title}</h3>
      {subtitle && <div className="sub">{subtitle}</div>}
      {children}
    </div>
  </div>
);
