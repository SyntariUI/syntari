'use client';

import { useEffect, useId, useState } from 'react';
import { badge, button, cx, surface, SyntariIcon, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type ToolResultField = {
  label: string;
  value: string;
};

export type ToolResultProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for tool-result. */
  title: string;
  /** One line under the title. */
  summary?: string;
  statusLabel?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  icon?: string;
  fields?: readonly ToolResultField[];
  /** Small print under the values. */
  note?: string;
  /** Start expanded. */
  open?: boolean;
  rerunLabel?: string;
};

/**
 * Reports what a tool run produced, with its outcome and key figures. Running again is a
 * consequential request: treat it like any tool call and check scope and consent first.
 */
export function ToolResult({
  title, summary, statusLabel = 'Complete', tone = 'success', icon, fields = [], note = '', open = false,
  rerunLabel = 'Run again', id, className, onActionRequest
}: ToolResultProps) {
  const [ref, request] = useActionRequest<HTMLDivElement>('tool-result', id, onActionRequest);
  const [expanded, setExpanded] = useState(open);
  const uid = useId();

  useEffect(() => setExpanded(open), [open]);

  return (
    <div ref={ref} role="group" aria-labelledby={`${uid}-title`} data-syntari-component="tool-result" data-syntari-id={id} data-tone={tone} className={cx(surface, className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <SyntariIcon name={icon} fallback="terminal" className="mt-0.5 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <strong id={`${uid}-title`} className="block font-medium">{title}</strong>
          {summary ? <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span> : null}
        </span>
        <span className={badge(tone)}>{statusLabel}</span>
      </div>
      {fields.length || note ? (
        <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="group mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
            Details
            <SyntariIcon name="down" fallback="down" className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          {fields.length ? (
            <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2">
              {fields.map((field, index) => (
                <div key={`${field.label}-${index}`} className="min-w-0 rounded-lg bg-muted px-3 py-2">
                  <dt className="text-xs text-foreground/80">{field.label}</dt>
                  <dd className="mt-0.5 break-words font-medium tabular-nums">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
        </details>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" className={button('outline')} onClick={() => request('rerun', { consequential: true })}>
          <SyntariIcon name="rotate-ccw" fallback="rotate-ccw" />
          {rerunLabel}
        </button>
      </div>
    </div>
  );
}
