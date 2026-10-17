'use client';

import { useId } from 'react';
import { cx, surface, SyntariIcon, tones, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type AgentActivityEvent = {
  title: string;
  detail?: string;
  /** Relative or absolute time, as written. */
  time?: string;
  icon?: string;
};

export type AgentActivityProps = Omit<SyntariHostProps, 'onActionRequest'> & {
  /* The contract: the same props Screen IR validates for agent-activity. */
  title?: string;
  /** Scope, such as "This run". */
  meta?: string;
  icon?: string;
  events: readonly AgentActivityEvent[];
};

/** Keeps a chronological record of what an agent did, separate from its plan. It declares no actions. */
export function AgentActivity({ title = 'Recent activity', meta, icon, events, id, className }: AgentActivityProps) {
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-title`} data-syntari-component="agent-activity" data-syntari-id={id} className={cx(surface, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <SyntariIcon name={icon} fallback="list" className="text-muted-foreground" />
        <strong id={`${uid}-title`} className="min-w-0 flex-1 font-medium">{title}</strong>
        {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {events.length ? (
        <ol className="mt-3 max-h-72 overflow-auto">
          {events.map((event, index) => (
            <li key={`${event.title}-${index}`} className="relative flex min-w-0 items-start gap-3 py-2.5">
              <SyntariIcon name={event.icon} fallback="circlecheck" className={cx('mt-0.5', tones.success.text)} />
              <span className="min-w-0 flex-1">
                <span className="block break-words">{event.title}</span>
                {event.detail ? <span className="block break-words text-xs text-muted-foreground">{event.detail}</span> : null}
              </span>
              {event.time ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.time}</span> : null}
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-muted-foreground">No activity yet.</p>}
    </section>
  );
}
