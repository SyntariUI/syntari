/** Types for syntari-ui/runtime/ir.js, the Screen IR validator and renderer for the browser. */
import type { ActionRequest, ApplyOperationsOptions, ApplyOperationsResult, DataFieldRole, DataFieldType, DataFormat, Diagnostic, Screen, ScreenChange, ScreenChild, DataTable, ScreenDataBlock, ScreenDifference, Severity, ValidationResult } from '../agent.js';

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
  /** Show the demonstration-data label under the title. On by default; a host that labels the data itself turns it off. */
  dataNote?: boolean;
}

export interface RenderedScreen {
  readonly element: HTMLElement;
  diagnostics: Diagnostic[];
  destroy(): void;
}

/** A screen's data block, checked and computed: every measure and group holds its value, so bound props read the same numbers. */
export interface DataModel {
  readonly data: ScreenDataBlock;
  readonly mode: 'demo' | 'provided' | undefined;
  readonly label: string | undefined;
  readonly currency: string | null;
  readonly locale: string;
  readonly tables: ReadonlyMap<string, { name: string; spec: DataTable; label: string; fields: Record<string, unknown>; rows: Record<string, unknown>[] }>;
  readonly measures: ReadonlyMap<string, { spec: unknown; value: number | null; format: DataFormat }>;
  readonly groups: ReadonlyMap<string, { spec: unknown; rows: Record<string, unknown>[] }>;
  readonly sources: ReadonlyMap<string, { id: string; label: string }>;
}
/** Where a prop took its value from the screen data. */
export interface DataBindingRecord { path: string; ref: string; kind: 'measures' | 'groups' | 'tables'; name: string; id: string | null; node: string; entry: unknown }

export function validate(spec: Spec | unknown, options?: { limits?: Limits; sandbox?: boolean; assets?: Record<string, string>; semantics?: boolean }): Promise<ValidationResult & { screen: Screen | null; data: DataModel | null; bindings: DataBindingRecord[] }>;
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
export function dataNote(meta: Screen['meta'], data?: ScreenDataBlock): HTMLElement | null;

export const DATA_LIMITS: { readonly maxTables: number; readonly maxFields: number; readonly maxRows: number; readonly maxMeasures: number; readonly maxGroups: number; readonly maxBuckets: number; readonly maxSources: number; readonly maxText: number };
export const FIELD_TYPES: readonly DataFieldType[];
export const FIELD_ROLES: readonly DataFieldRole[];
export const DATA_FORMATS: readonly DataFormat[];
/** Check a data block and compute its measures and groups. Problems go to report; the model holds what could be computed. */
export function buildDataModel(data: ScreenDataBlock | unknown, report?: (severity: Severity, code: string, path: string, message: string) => void, base?: string): DataModel | null;
/** Write a number in a data format and locale. Percent values are written as given: 12.5 is 12.5%. */
export function formatData(value: number | null, format?: DataFormat, options?: { locale?: string; currency?: string; digits?: number }): string;
/** Read a written figure, such as "38,5 %" or "€1.2M". Null when the text is not one figure. */
export function parseFigure(text: string | number): { value: number; unit: 'percent' | 'currency' | 'days' | null } | null;
/** The index of the bucket a value falls in, or -1: each bucket's max is inclusive, and a bucket without one takes the rest. */
export function bucketOf(buckets: { max?: number }[], value: number): number;
/** The day range a label names, such as "D0–D30" or "0-30 días", as [first, last]; the last can be Infinity. */
export function dayRange(label: string): [number, number] | null;
/** Tables read from table components' cells, for a screen without a data block. */
export function inferTables(screen: Screen): { id: string | undefined; path: string; columns: string[]; kinds: ('days' | 'percent' | 'currency' | 'text')[]; rows: unknown[][] }[];
export function isBinding(value: unknown): value is { $data: string };
export function hasBindings(value: unknown): boolean;
