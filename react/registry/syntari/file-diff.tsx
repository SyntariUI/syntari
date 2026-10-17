'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { button, cx, surface, SyntariIcon, tones, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type FileDiffLine = {
  kind: 'add' | 'remove' | 'context';
  /** The line as shown, including its + or − marker. */
  text: string;
};
export type FileDiffStatus = 'proposed' | 'kept' | 'discarded';

export type FileDiffProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for file-diff. */
  file: string;
  /** Such as "2 additions · 2 deletions". */
  summary?: string;
  icon?: string;
  lines: readonly FileDiffLine[];
  /** Start expanded. */
  open?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
  /* Host-only. The decision as the host recorded it. */
  status?: FileDiffStatus;
};

const lineStyle: Record<FileDiffLine['kind'], [string, string]> = {
  add: ['Added: ', 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'],
  remove: ['Removed: ', 'bg-red-500/10 text-red-900 dark:text-red-200'],
  context: ['', 'text-foreground']
};
const outcomeCopy = {
  kept: ['You asked to keep this change. The app applies it after its own checks.', tones.success.soft],
  discarded: ['You asked to discard this change.', tones.neutral.soft]
} as const;

/** Shows a proposed change to one file and asks the person to keep or discard it. Keeping is a request, not a write. */
export function FileDiff({
  file, summary, icon, lines, open = true, approveLabel = 'Keep changes', rejectLabel = 'Discard',
  status = 'proposed', id, className, onActionRequest
}: FileDiffProps) {
  const [ref, request] = useActionRequest<HTMLDivElement>('file-diff', id, onActionRequest);
  const [expanded, setExpanded] = useState(open);
  const [decision, setDecision] = useState<'kept' | 'discarded' | null>(null);
  const uid = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const outcome = status !== 'proposed' ? status : decision;

  useEffect(() => setExpanded(open), [open]);
  useEffect(() => { if (decision) outcomeRef.current?.focus(); }, [decision]);

  const decide = (choice: 'kept' | 'discarded') => {
    setDecision(choice);
    request(choice === 'kept' ? 'approve' : 'reject', { consequential: choice === 'kept' });
  };

  return (
    <div ref={ref} role="group" aria-labelledby={`${uid}-file`} data-syntari-component="file-diff" data-syntari-id={id} data-status={outcome ?? 'proposed'} className={cx(surface, className)}>
      <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="group">
        <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
          <SyntariIcon name={icon} fallback="file" className="text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span id={`${uid}-file`} className="block break-all font-mono text-[13px] font-medium">{file}</span>
            {summary ? <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span> : null}
          </span>
          <SyntariIcon name="down" fallback="down" className="text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-background py-2 font-mono text-xs leading-6">
          <code>
            {lines.map((line, index) => (
              <span key={index} className={cx('block whitespace-pre px-3', lineStyle[line.kind][1])}>
                {lineStyle[line.kind][0] ? <span className="sr-only">{lineStyle[line.kind][0]}</span> : null}{line.text}
              </span>
            ))}
          </code>
        </pre>
      </details>
      <div role="status" aria-live="polite">
        {outcome ? <p ref={outcomeRef} tabIndex={-1} className={cx('mt-4 rounded-lg border px-3 py-2.5 text-xs outline-none', outcomeCopy[outcome][1])}>{outcomeCopy[outcome][0]}</p> : null}
      </div>
      {!outcome ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={button('ghost')} onClick={() => decide('discarded')}>{rejectLabel}</button>
          <button type="button" className={button('primary')} onClick={() => decide('kept')}>{approveLabel}</button>
        </div>
      ) : null}
    </div>
  );
}
