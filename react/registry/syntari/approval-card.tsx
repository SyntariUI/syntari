'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { button, cx, inset, surface, SyntariIcon, tones, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type ApprovalCardStatus = 'pending' | 'approved' | 'declined';

export type ApprovalCardProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for approval-card. */
  title: string;
  /** What was produced. */
  summary: string;
  /** Where the change lands. */
  detail: string;
  /** Small print under the request. */
  hint?: string;
  icon?: string;
  approveLabel?: string;
  rejectLabel?: string;
  /* Host-only. The decision as the host recorded it, for example after a reload. */
  status?: ApprovalCardStatus;
};

const outcomeCopy = {
  approved: ['You approved this result. The app decides what happens next.', tones.success.soft],
  declined: ['You declined this result.', tones.neutral.soft]
} as const;

/** Summarizes a finished piece of work and asks for a decision on it. Approval is a request; the host decides what it allows. */
export function ApprovalCard({
  title, summary, detail, hint = '', icon, approveLabel = 'Approve', rejectLabel = 'Decline',
  status = 'pending', id, className, onActionRequest
}: ApprovalCardProps) {
  const [ref, request] = useActionRequest<HTMLDivElement>('approval-card', id, onActionRequest);
  const [decision, setDecision] = useState<'approved' | 'declined' | null>(null);
  const uid = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const outcome = status !== 'pending' ? status : decision;

  useEffect(() => { if (decision) outcomeRef.current?.focus(); }, [decision]);

  const decide = (choice: 'approved' | 'declined') => {
    setDecision(choice);
    request(choice === 'approved' ? 'approve' : 'reject', { consequential: choice === 'approved' });
  };

  return (
    <div ref={ref} role="group" aria-labelledby={`${uid}-title`} data-syntari-component="approval-card" data-syntari-id={id} data-status={outcome ?? 'pending'} className={cx(surface, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <SyntariIcon name={icon} fallback="circlecheck" className="text-muted-foreground" />
        <strong id={`${uid}-title`} className="min-w-0 flex-1 font-medium">{title}</strong>
      </div>
      <p className="mt-3 text-muted-foreground">{summary}</p>
      <div className={cx(inset, 'mt-3')}>
        <SyntariIcon name="file" fallback="file" className="text-foreground/70" />
        <span className="min-w-0 break-words">{detail}</span>
      </div>
      {hint ? <p className="mt-3 text-xs text-muted-foreground">{hint}</p> : null}
      <div role="status" aria-live="polite">
        {outcome ? <p ref={outcomeRef} tabIndex={-1} className={cx('mt-4 rounded-lg border px-3 py-2.5 text-xs outline-none', outcomeCopy[outcome][1])}>{outcomeCopy[outcome][0]}</p> : null}
      </div>
      {!outcome ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={button('ghost')} onClick={() => decide('declined')}>{rejectLabel}</button>
          <button type="button" className={button('primary')} onClick={() => decide('approved')}>{approveLabel}</button>
        </div>
      ) : null}
    </div>
  );
}
