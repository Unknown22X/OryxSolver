import { Component, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type RichTextProps = {
  content: string;
  className?: string;
};

type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { hasError: boolean };

function sanitizeMarkdownHref(rawHref: string | undefined): string | null {
  const href = String(rawHref ?? '').trim();
  if (!href) return null;

  // Allow email links. Block everything else that isn't an absolute http(s) URL.
  if (href.startsWith('mailto:')) return href;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

class MarkdownErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function MarkdownRenderer({ text, className }: { text: string; className: string }) {
  return (
    <div className={`rich-text text-sm leading-7 text-slate-800 dark:text-slate-100 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="mb-4 mt-1 text-[1.45rem] font-black tracking-tight text-slate-950 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-4 mt-1 text-[1.15rem] font-black tracking-tight text-slate-950 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-3 mt-1 text-base font-black text-slate-900 dark:text-slate-50">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">{children}</h4>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 marker:text-slate-400 dark:marker:text-slate-500">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 marker:font-semibold marker:text-slate-500 dark:marker:text-slate-400">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-50">{children}</strong>,
          em: ({ children }) => <em className="text-slate-800 dark:text-slate-200">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-2xl border-l-[3px] border-indigo-300 bg-indigo-50/60 px-4 py-3 text-slate-700 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-slate-200">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            const safeHref = sanitizeMarkdownHref(href);
            if (!safeHref) return <span>{children}</span>;
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                {children}
              </a>
            );
          },
          code: ({ className: codeClassName, children }) => {
            const language = codeClassName ?? '';
            const isBlock = language.includes('language-');
            if (!isBlock) {
              return (
                <code className="rounded-lg border border-slate-200/80 bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/95 p-4 text-[12px] leading-6 text-slate-100 shadow-xl shadow-slate-950/10">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-4">{children}</pre>,
          hr: () => <hr className="my-4 border-slate-200 dark:border-white/10" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100/80 dark:bg-white/5">{children}</thead>,
          th: ({ children }) => <th className="border-b border-slate-200 px-3 py-2 text-left font-black text-slate-900 dark:border-white/10 dark:text-slate-100">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-200/80 px-3 py-2 align-top text-slate-700 dark:border-white/10 dark:text-slate-200">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function RichText({ content, className = '' }: RichTextProps) {
  const text = content?.trim() ?? '';
  if (!text) return null;

  const fallback = (
    <p className={`whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100 ${className}`}>
      {text}
    </p>
  );

  return (
    <MarkdownErrorBoundary fallback={fallback}>
      <MarkdownRenderer text={text} className={className} />
    </MarkdownErrorBoundary>
  );
}
