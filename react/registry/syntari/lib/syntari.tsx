'use client';

/**
 * Syntari for React: the helpers every trust component shares.
 *
 * A component reports what a person asked for through `onActionRequest` and a bubbling
 * `syntari:action` DOM event, the same request the Syntari runtime sends. A request is never
 * permission: the host checks scope and policy before anything runs.
 */
import { createElement, useCallback, useRef, type SVGProps } from 'react';
import { SYNTARI_ICONS, type SyntariIconName } from '@/registry/syntari/lib/syntari-icons';

export type SyntariActionRequest = {
  /** The component's id in the Syntari registry, such as "tool-approval". */
  component: string;
  /** The declared action, such as "approve" or "reject". */
  action: string;
  /** The id the host gave this instance. */
  id?: string;
  /** The item's position, for an action on one item of a list. */
  index?: number;
  /** What the person entered or chose. */
  values?: Record<string, unknown>;
  /** True when the action could change something outside the screen. Check scope and consent before acting on it. */
  consequential: boolean;
};

export type SyntariActionHandler = (request: SyntariActionRequest) => void;

/** Props every component takes besides its contract. They come from the host, never from model output. */
export type SyntariHostProps = {
  /** Identifies this instance in action requests. */
  id?: string;
  /** Added to the root element's classes. Use it for layout, such as width or margin. */
  className?: string;
  /** Receives each request. Nothing runs unless the host decides it may. */
  onActionRequest?: SyntariActionHandler;
};

type RequestOptions = { consequential?: boolean; index?: number; values?: Record<string, unknown> };

export function useActionRequest<E extends HTMLElement>(component: string, id?: string, onActionRequest?: SyntariActionHandler) {
  const ref = useRef<E>(null);
  const request = useCallback((action: string, options: RequestOptions = {}) => {
    const detail: SyntariActionRequest = {
      component,
      action,
      ...(id ? { id } : {}),
      ...(options.index !== undefined ? { index: options.index } : {}),
      ...(options.values ? { values: options.values } : {}),
      consequential: Boolean(options.consequential)
    };
    ref.current?.dispatchEvent(new CustomEvent('syntari:action', { bubbles: true, detail }));
    onActionRequest?.(detail);
    return detail;
  }, [component, id, onActionRequest]);
  return [ref, request] as const;
}

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/* Theme tokens are the host's shadcn variables, so the components take on the project's look. */
export const surface = 'w-full min-w-0 rounded-xl border border-border bg-card p-5 text-left text-sm leading-relaxed text-card-foreground shadow-sm';
export const inset = 'flex min-w-0 items-center gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-foreground';

const buttonBase = 'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';
const buttonVariants = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  outline: 'border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
  ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
  danger: 'bg-red-700 text-white shadow-sm hover:bg-red-700/90'
} as const;
export const button = (variant: keyof typeof buttonVariants = 'outline') => cx(buttonBase, buttonVariants[variant]);

/* Status colours sit on top of the theme. The words always carry the meaning; colour only repeats it. */
export const tones = {
  success: { text: 'text-emerald-700 dark:text-emerald-400', soft: 'border-emerald-600/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  warning: { text: 'text-amber-700 dark:text-amber-400', soft: 'border-amber-600/25 bg-amber-500/10 text-amber-900 dark:text-amber-200' },
  danger: { text: 'text-red-700 dark:text-red-400', soft: 'border-red-600/25 bg-red-500/10 text-red-900 dark:text-red-200' },
  info: { text: 'text-sky-700 dark:text-sky-400', soft: 'border-sky-600/25 bg-sky-500/10 text-sky-900 dark:text-sky-200' },
  neutral: { text: 'text-muted-foreground', soft: 'border-border bg-muted text-foreground' }
} as const;
export type SyntariTone = keyof typeof tones;

export const badge = (tone: SyntariTone) => cx('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone].soft);

export const isIconName = (name: unknown): name is SyntariIconName => typeof name === 'string' && Object.prototype.hasOwnProperty.call(SYNTARI_ICONS, name);

/**
 * Draws an icon from the Syntari vocabulary. A name outside it draws `fallback` instead,
 * so a model-authored name selects an icon and can never become markup.
 */
export function SyntariIcon({ name, fallback, className, ...props }: { name?: string; fallback: SyntariIconName } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const nodes = SYNTARI_ICONS[isIconName(name) ? name : fallback];
  return createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
    className: cx('size-4 shrink-0', className), ...props
  }, nodes.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes })));
}
