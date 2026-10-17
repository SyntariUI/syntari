'use client';

import { useId, useState, type FormEvent } from 'react';
import { button, cx, surface, useActionRequest, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type AgentQuestionsOption = {
  value: string;
  selected?: boolean;
};

export type AgentQuestionsProps = SyntariHostProps & {
  /* The contract: the same props Screen IR validates for agent-questions. */
  question: string;
  options: readonly AgentQuestionsOption[];
  noteLabel?: string;
  notePlaceholder?: string;
  /** Status line under the form. The host fills it after an answer. */
  status?: string;
  submitLabel?: string;
};

/**
 * Asks one focused question with a small set of answers and an optional note.
 * Submitting sends `values.choice` and `values.notes`; the agent decides how to continue.
 */
export function AgentQuestions({
  question, options, noteLabel = 'Anything to preserve?', notePlaceholder = 'Optional details', status = '',
  submitLabel = 'Send answer', id, className, onActionRequest
}: AgentQuestionsProps) {
  const [ref, request] = useActionRequest<HTMLFormElement>('agent-questions', id, onActionRequest);
  const [sent, setSent] = useState('');
  const uid = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const choice = String(data.get('choice') ?? '');
    request('submit', { values: { choice, notes: String(data.get('notes') ?? '') } });
    setSent(`Answer sent: ${choice}.`);
  };

  return (
    <form ref={ref} aria-labelledby={`${uid}-question`} data-syntari-component="agent-questions" data-syntari-id={id} onSubmit={submit} className={cx(surface, className)}>
      <fieldset className="min-w-0">
        <legend id={`${uid}-question`} className="font-medium">{question}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option, index) => (
            <label key={`${option.value}-${index}`} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background">
              <input type="radio" name="choice" value={option.value} defaultChecked={option.selected} required className="size-4 accent-primary outline-none" />
              {option.value}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${uid}-notes`} className="mt-4 block text-sm font-medium">{noteLabel}</label>
      <textarea id={`${uid}-notes`} name="notes" rows={2} placeholder={notePlaceholder} maxLength={500} className="mt-2 block w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <p role="status" aria-live="polite" className="mr-auto min-w-0 text-xs text-muted-foreground">{status || sent}</p>
        <button type="submit" className={button('primary')}>{submitLabel}</button>
      </div>
    </form>
  );
}
