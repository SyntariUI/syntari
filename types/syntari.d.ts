/** Types for syntari-ui/runtime/syntari.js, the browser runtime that mounts components. */
import type { ActionRequest, Diagnostic } from '../agent.js';

export interface CatalogComponent {
  name: string;
  /** The component's id. It stays fixed when the display name changes, so look components up by it, not by name. */
  slug: string;
  /** Other names people search by: earlier names and the names other design systems use. */
  aliases?: string[];
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
/** Turns a name into URL form. A renamed component keeps its old id, so this is not a component's slug; use `slug`. */
export function slugify(name: string): string;
export interface Searchable { name?: string; id?: string; slug?: string; aliases?: string[]; category?: string; description?: string }
/** How well an item matches a query: 100 for its name or an alias exactly, down to 30 for a match in its description, 0 for none. */
export function matchScore(item: Searchable, query: string): number;
/** The items that match a query, best first; items that match equally keep their order. */
export function searchItems<T extends Searchable>(items: T[], query: string): T[];
