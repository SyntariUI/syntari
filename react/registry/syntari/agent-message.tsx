'use client';

import { useEffect, useId, useState } from 'react';
import { button, cx, surface, SyntariIcon, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type AgentMessageProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for agent-message. */
  author: string;
  /** The settled response. */
  text: string;
  /** Relative or absolute time, as written. */
  time?: string;
  icon?: string;
  /** Whether the person already marked the response as helpful. */
  helpful?: boolean;
};

/** One settled agent response with its author and the follow-ups a person can ask for. */
export function AgentMessage({ author, text, time, icon, helpful = false, id, className, onActionRequest }: AgentMessageProps) {
  const [ref, request] = useActionRequest<HTMLElement>('agent-message', id, onActionRequest);
  const [pressed, setPressed] = useState(helpful);
  const uid = useId();

  useEffect(() => setPressed(helpful), [helpful]);

  const toggle = () => {
    setPressed(!pressed);
    request('helpful', { values: { pressed: !pressed } });
  };

  return (
    <article ref={ref} aria-labelledby={`${uid}-author`} data-syntari-component="agent-message" data-syntari-id={id} className={cx(surface, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <SyntariIcon name={icon} fallback="bot" className="text-muted-foreground" />
        <strong id={`${uid}-author`} className="min-w-0 flex-1 font-medium">{author}</strong>
        {time ? <span className="shrink-0 text-xs text-muted-foreground">{time}</span> : null}
      </div>
      <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-7 text-foreground">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={pressed} className={cx(button('ghost'), 'aria-pressed:bg-accent aria-pressed:text-accent-foreground')} onClick={toggle}>
          <SyntariIcon name="thumbs-up" fallback="thumbs-up" />
          Helpful
        </button>
        <button type="button" className={button('ghost')} onClick={() => request('regenerate')}>
          <SyntariIcon name="rotate-ccw" fallback="rotate-ccw" />
          Regenerate
        </button>
      </div>
    </article>
  );
}
