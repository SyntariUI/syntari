'use client';

import { cx, SyntariIcon, tones, type SyntariHostProps } from '@/registry/syntari/lib/syntari';

export type BannerProps = Omit<SyntariHostProps, 'onActionRequest'> & {
  /* The contract: the same props Screen IR validates for banner. */
  /** The outcome, in one line. */
  message: string;
  /** Optional supporting context. */
  detail?: string;
  /** Sentiment colour. The text still carries the meaning. */
  tone?: 'success' | 'info';
  icon?: string;
};

/** Reports an outcome or a needed action inside the current context. It declares no actions. */
export function Banner({ message, detail, tone = 'success', icon, id, className }: BannerProps) {
  return (
    <div role="status" data-syntari-component="banner" data-syntari-id={id} data-tone={tone} className={cx('flex w-full min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone].soft, className)}>
      <SyntariIcon name={icon} fallback="circlecheck" className={cx('mt-0.5', tones[tone].text)} />
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">{message}</span>
        {detail ? <span className="mt-0.5 block break-words">{detail}</span> : null}
      </span>
    </div>
  );
}
