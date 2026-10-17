'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { badge, button, cx, inset, surface, SyntariIcon, tones, useActionRequest, type SyntariHostProps, type SyntariTone } from '@/registry/syntari/lib/syntari';

export type ToolApprovalRisk = 'moderate' | 'high' | 'critical';
export type ToolApprovalReversibility = 'reversible' | 'partially-reversible' | 'irreversible';
export type ToolApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'blocked';

export type ToolApprovalProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for tool-approval. */
  title: string;
  /** What the agent intends to do. */
  question: string;
  /** What the action touches. */
  scope: string;
  /** Small print under the request. */
  hint?: string;
  icon?: string;
  approveLabel?: string;
  rejectLabel?: string;
  /*
   * Host-only props. Take them from your own tool registry, never from model output:
   * an agent must not be able to call its own request low risk.
   */
  risk?: ToolApprovalRisk;
  /** `irreversible` asks the person to confirm a second time before the request is sent. */
  reversibility?: ToolApprovalReversibility;
  /** The outcome as the host knows it. `expired` and `blocked` remove the actions. */
  status?: ToolApprovalStatus;
};

const riskCopy: Record<ToolApprovalRisk, [string, SyntariTone]> = {
  moderate: ['Moderate risk', 'warning'],
  high: ['High risk', 'danger'],
  critical: ['Critical risk', 'danger']
};
const reversibilityCopy: Record<ToolApprovalReversibility, string> = {
  reversible: 'Can be undone',
  'partially-reversible': 'Partly reversible',
  irreversible: "Can't be undone"
};
const outcomeCopy: Record<Exclude<ToolApprovalStatus, 'pending'>, [string, SyntariTone]> = {
  approved: ['You approved this request. Nothing runs until the app confirms it is allowed.', 'success'],
  rejected: ['You declined. Nothing will run.', 'neutral'],
  expired: ['This request expired. Ask the agent again if it is still needed.', 'neutral'],
  blocked: ['Blocked by policy. This action is not allowed here.', 'danger']
};

/**
 * Asks for consent before an agent runs a consequential or external operation.
 * Approving sends a consequential request; the host still checks scope and policy before running anything.
 */
export function ToolApproval({
  title, question, scope, hint = '', icon, approveLabel = 'Approve', rejectLabel = 'Decline',
  risk, reversibility, status = 'pending', id, className, onActionRequest
}: ToolApprovalProps) {
  const [ref, request] = useActionRequest<HTMLElement>('tool-approval', id, onActionRequest);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const uid = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);

  const outcome = status !== 'pending' ? status : decision;
  const message = outcome ? outcomeCopy[outcome] : null;

  useEffect(() => { if (decision) outcomeRef.current?.focus(); }, [decision]);
  useEffect(() => { if (confirming) confirmRef.current?.focus(); }, [confirming]);

  const decide = (choice: 'approved' | 'rejected') => {
    setConfirming(false);
    setDecision(choice);
    request(choice === 'approved' ? 'approve' : 'reject', { consequential: choice === 'approved' });
  };
  const approve = () => (reversibility === 'irreversible' && !confirming ? setConfirming(true) : decide('approved'));
  const back = () => { setConfirming(false); requestAnimationFrame(() => approveRef.current?.focus()); };
  const onKeyDown = (event: KeyboardEvent) => { if (confirming && event.key === 'Escape') { event.preventDefault(); back(); } };

  return (
    <section ref={ref} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-question`} data-syntari-component="tool-approval" data-syntari-id={id} data-status={outcome ?? 'pending'} onKeyDown={onKeyDown} className={cx(surface, className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <SyntariIcon name={icon} fallback="terminal" className="text-muted-foreground" />
        <strong id={`${uid}-title`} className="min-w-0 flex-1 font-medium">{title}</strong>
        {risk ? <span className={badge(riskCopy[risk][1])}>{riskCopy[risk][0]}</span> : null}
      </div>
      <p id={`${uid}-question`} className="mt-3 text-muted-foreground">{question}</p>
      <div className={cx(inset, 'mt-3')}>
        <SyntariIcon name="folder" fallback="folder" className="text-foreground/70" />
        <span className="min-w-0 break-words"><span className="sr-only">Scope: </span>{scope}</span>
      </div>
      {reversibility ? (
        <p className={cx('mt-3 flex items-center gap-2 text-xs font-medium', reversibility === 'irreversible' ? tones.danger.text : 'text-muted-foreground')}>
          <SyntariIcon name={reversibility === 'irreversible' ? 'lock' : 'rotate-ccw'} fallback="info" className="size-3.5" />
          {reversibilityCopy[reversibility]}
        </p>
      ) : null}
      {hint ? <p className="mt-3 text-xs text-muted-foreground">{hint}</p> : null}
      <div role="status" aria-live="polite">
        {message ? <p ref={outcomeRef} tabIndex={-1} className={cx('mt-4 rounded-lg border px-3 py-2.5 text-xs outline-none', tones[message[1]].soft)}>{message[0]}</p> : null}
      </div>
      {!outcome && confirming ? (
        <div ref={confirmRef} tabIndex={-1} role="group" aria-labelledby={`${uid}-confirm`} className={cx('mt-4 rounded-lg border p-3 outline-none', tones.danger.soft)}>
          <p id={`${uid}-confirm`} className="text-xs font-medium">This can't be undone. Approve anyway?</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className={button('outline')} onClick={back}>Go back</button>
            <button type="button" className={button('danger')} onClick={() => decide('approved')}>Approve anyway</button>
          </div>
        </div>
      ) : null}
      {!outcome && !confirming ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={button('ghost')} onClick={() => decide('rejected')}>{rejectLabel}</button>
          <button ref={approveRef} type="button" className={button('primary')} onClick={approve}>{approveLabel}</button>
        </div>
      ) : null}
    </section>
  );
}
