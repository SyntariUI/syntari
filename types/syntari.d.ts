/** Types for syntari-ui/runtime/syntari.js, the browser runtime that mounts components. */
import type { ActionRequest, Diagnostic } from '../agent.js';

export interface CatalogComponent {
  name: string;
  slug: string;
  category: string;
  description: string;
  [key: string]: unknown;
}

export interface MountOptions {
  /** Configure one instance through the component's contract. Invalid props reject with a TypeError that carries `diagnostics`. */
  props?: Record<string, unknown>;
  /** Called when a person acts on a declared action, with or without props. A request is never permission. */
  onActionRequest?(request: ActionRequest): void;
  configure?(element: HTMLElement): void;
  onInput?(event: Event, element: HTMLElement): void;
  onChange?(event: Event, element: HTMLElement): void;
  onAction?(event: Event, element: HTMLElement): void;
}

export interface MountedComponent {
  readonly element: HTMLElement;
  /** Warnings raised while applying props, such as an unknown prop that was ignored. */
  readonly diagnostics: Diagnostic[];
  reset(): Promise<void>;
  destroy(): void;
}

export function initialize(): Promise<unknown[]>;
export function getComponents(): Promise<CatalogComponent[]>;
/** Enhance copied component HTML. Call once for each newly inserted subtree. */
export function prepare(root: Element): Promise<Element>;
export function mount(slug: string, target: string | Element, options?: MountOptions): Promise<MountedComponent>;
export function setTheme(theme: 'light' | 'dark'): void;
export function slugify(name: string): string;
