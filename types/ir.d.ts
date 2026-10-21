/** Types for syntari-ui/runtime/ir.js, the Screen IR validator and renderer for the browser. */
import type { ActionRequest, ApplyOperationsOptions, ApplyOperationsResult, Diagnostic, Screen, ScreenChange, ScreenChild, ScreenDifference, ValidationResult } from '../agent.js';

export const IR_LAYOUTS: readonly ['stack', 'row', 'grid', 'two-column'];
export const IR_LIMITS: { readonly maxDepth: number; readonly maxNodes: number; readonly maxChildren: number; readonly maxListItems: number };

type Limits = Partial<typeof IR_LIMITS>;
export const SANDBOX_LIMITS: { readonly maxHtml: number; readonly minHeight: number; readonly maxHeight: number; readonly defaultHeight: number };
export const FORMULA_NAMES: readonly string[];
type Spec = Screen | ScreenChild;

export interface RenderOptions {
  /** Called when a person acts on a declared action. A request is never permission. */
  onActionRequest?(request: ActionRequest): void;
  onDiagnostics?(diagnostics: Diagnostic[]): void;
  limits?: Limits;
  /** Allow unverified blocks. Off by default: a screen that holds one is rejected. */
  sandbox?: boolean;
  /** Images the host provides, by id. A media card names an id; anything else falls back to its icon. */
  assets?: Record<string, string>;
}

export interface RenderedScreen {
  readonly element: HTMLElement;
  diagnostics: Diagnostic[];
  destroy(): void;
}

export function validate(spec: Spec | unknown, options?: { limits?: Limits; sandbox?: boolean; assets?: Record<string, string> }): Promise<ValidationResult & { screen: Screen | null }>;
/** Validate, then paint every valid node. Errors become labelled fallbacks; warnings are repaired. */
export function render(spec: Spec | unknown, target: string | Element, options?: RenderOptions): Promise<RenderedScreen>;
export function validateProps(slug: string, props?: Record<string, unknown>): Promise<ValidationResult & { props: Record<string, unknown> }>;
export function renderableSlugs(): Promise<string[]>;
/** Parse an arithmetic formula: numbers, names, + - * / ^, parentheses, and the functions in FORMULA_NAMES. Throws a SyntaxError. */
export function parseFormula(source: string): { tree: unknown; names: string[] };
/** Evaluate a parsed formula. Returns null when the result is not a finite number. */
export function evaluateFormula(tree: unknown, scope: Record<string, number>): number | null;
export function formatValue(value: number | null, format?: 'number' | 'integer' | 'currency' | 'percent', currency?: string): string;

export const OPS_VERSION: 'syntari-ops-1';
export const OPS_LIMITS: { readonly maxOperations: number };
/** A short fingerprint of a screen. A change names the one it was written against. */
export function versionOf(spec: Screen): string;
/** Give every node a stable id; existing ids stay. */
export function assignIds<T extends Screen>(spec: T): T;
export function findNode(spec: Screen, id: string): { node: ScreenChild; path: string; parentId: string; index: number } | null;
export function diffScreens(before: Screen, after: Screen): ScreenDifference[];
/** Apply a model's change to one version of a screen: scoped by node id, data-protected, and validated whole. */
export function applyOperations(spec: Screen, change: ScreenChange | unknown, options?: ApplyOperationsOptions & { limits?: Limits }): Promise<ApplyOperationsResult>;
/** The label a screen with demonstration data shows under its title, or null. */
export function dataNote(meta: Screen['meta']): HTMLElement | null;
