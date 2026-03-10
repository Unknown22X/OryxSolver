import { Component, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type RichTextProps = {
  content: string;
  className?: string;
};

/* ── Error Boundary ────────────────────────────────── */

type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { hasError: boolean };

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

/* ── Inner Markdown renderer ───────────────────────── */

function MarkdownRenderer({ text, className }: { text: string; className: string }) {
  return (
    <div className={`rich-text text-sm leading-6 text-slate-800 dark:text-slate-100 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-50">{children}</strong>,
          em: ({ children }) => <em className="text-slate-800 dark:text-slate-200">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-indigo-200 pl-3 text-slate-700 dark:border-indigo-500/50 dark:text-slate-200">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children }) => {
            const language = codeClassName ?? '';
            const isBlock = language.includes('language-');
            if (!isBlock) {
              return (
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto rounded-xl bg-slate-950/95 p-3 text-[12px] leading-5 text-slate-100">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ── Public component ──────────────────────────────── */

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
