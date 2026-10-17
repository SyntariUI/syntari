'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { button, cx, surface, SyntariIcon, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type StreamingResponseProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for streaming-response. */
  author: string;
  /** The response text. While it streams, re-render with the text that has arrived. */
  text: string;
  /** Short status shown beside the author. */
  status?: string;
  /** Label of the generate button. */
  action?: string;
  icon?: string;
  /** True while text is arriving: Stop is available and Generate is not. */
  streaming?: boolean;
};

/**
 * Shows a response as it arrives, with an explicit way to stop it. Screen readers hear when it
 * starts and finishes, not every character.
 */
export function StreamingResponse({
  author, text, status = '', action = 'Generate response', icon, streaming = false, id, className, onActionRequest
}: StreamingResponseProps) {
  const [ref, request] = useActionRequest<HTMLDivElement>('streaming-response', id, onActionRequest);
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef(streaming);
  const uid = useId();

  useEffect(() => {
    if (previous.current !== streaming) setAnnouncement(streaming ? 'Response started.' : 'Response complete.');
    previous.current = streaming;
  }, [streaming]);

  return (
    <div ref={ref} role="group" aria-labelledby={`${uid}-author`} data-syntari-component="streaming-response" data-syntari-id={id} data-streaming={streaming} className={cx(surface, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <SyntariIcon name={icon} fallback="bot" className="text-muted-foreground" />
        <strong id={`${uid}-author`} className="min-w-0 flex-1 font-medium">{author}</strong>
        {streaming ? <span className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" /> : null}
        {status ? <span className="shrink-0 text-xs text-muted-foreground">{status}</span> : null}
      </div>
      <div aria-busy={streaming} className="mt-3 min-h-16 whitespace-pre-line break-words text-[15px] leading-7 text-foreground">{text}</div>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={button('outline')} disabled={!streaming} onClick={() => request('stop')}>
          <SyntariIcon name="square" fallback="square" />
          Stop
        </button>
        <button type="button" className={button('primary')} disabled={streaming} onClick={() => request('generate')}>{action}</button>
      </div>
    </div>
  );
}
