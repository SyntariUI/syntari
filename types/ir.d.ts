/** Types for syntari-ui/runtime/ir.js, the Screen IR validator and renderer for the browser. */
import type { ActionRequest, Diagnostic, Screen, ScreenNode, ScreenRegion, ValidationResult } from '../agent.js';

export const IR_LAYOUTS: readonly ['stack', 'row', 'grid', 'two-column'];
export const IR_LIMITS: { readonly maxDepth: number; readonly maxNodes: number; readonly maxChildren: number; readonly maxListItems: number };

type Limits = Partial<typeof IR_LIMITS>;
type Spec = Screen | ScreenNode | ScreenRegion;

export interface RenderOptions {
  /** Called when a person acts on a declared action. A request is never permission. */
  onActionRequest?(request: ActionRequest): void;
  onDiagnostics?(diagnostics: Diagnostic[]): void;
  limits?: Limits;
}

export interface RenderedScreen {
  readonly element: HTMLElement;
  diagnostics: Diagnostic[];
  destroy(): void;
}

export function validate(spec: Spec | unknown, options?: { limits?: Limits }): Promise<ValidationResult & { screen: Screen | null }>;
/** Validate, then paint every valid node. Errors become labelled fallbacks; warnings are repaired. */
export function render(spec: Spec | unknown, target: string | Element, options?: RenderOptions): Promise<RenderedScreen>;
export function validateProps(slug: string, props?: Record<string, unknown>): Promise<ValidationResult & { props: Record<string, unknown> }>;
export function renderableSlugs(): Promise<string[]>;
