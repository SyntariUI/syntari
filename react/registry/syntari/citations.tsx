'use client';

import { useId } from 'react';
import { button, cx, surface, SyntariIcon, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type CitationsSource = {
  number: number;
  title: string;
  /** The passage the claim rests on. */
  excerpt?: string;
  linkLabel?: string;
};

export type CitationsProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for citations. */
  title?: string;
  /** Count or scope, such as "2 references". */
  meta?: string;
  /** The claim the sources support. */
  text?: string;
  icon?: string;
  sources: readonly CitationsSource[];
};

/**
 * Discloses the sources behind an answer, next to the answer. Opening a source sends a request
 * with the source's `index`; the host decides where it leads.
 */
export function Citations({ title = 'Sources', meta, text, icon, sources, id, className, onActionRequest }: CitationsProps) {
  const [ref, request] = useActionRequest<HTMLElement>('citations', id, onActionRequest);
  const uid = useId();

  return (
    <section ref={ref} aria-labelledby={`${uid}-title`} data-syntari-component="citations" data-syntari-id={id} className={cx(surface, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <SyntariIcon name={icon} fallback="link" className="text-muted-foreground" />
        <strong id={`${uid}-title`} className="min-w-0 flex-1 font-medium">{title}</strong>
        {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {text ? <p className="mt-3 text-foreground">{text}</p> : null}
      <ol className="mt-3">
        {sources.map((source, index) => (
          <li key={`${source.number}-${index}`} className="border-t border-border py-1 first:border-t-0">
            <details className="group">
              <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-md py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-xs font-medium tabular-nums text-primary-foreground" aria-hidden="true">{source.number}</span>
                <span className="min-w-0 flex-1 break-words"><span className="sr-only">Source {source.number}: </span>{source.title}</span>
                <SyntariIcon name="down" fallback="down" className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-3 pl-8">
                {source.excerpt ? <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{source.excerpt}</blockquote> : null}
                <button type="button" aria-label={`${source.linkLabel ?? 'Open source'}: ${source.title}`} className={cx(button('outline'), 'mt-3')} onClick={() => request('open', { index })}>
                  <SyntariIcon name="external-link" fallback="external-link" />
                  {source.linkLabel ?? 'Open source'}
                </button>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
