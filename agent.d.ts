/** Types for the syntari-ui Node API. The registry JSON stays the source of truth; these types describe its shape. */

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface Provenance {
  component?: string;
  source?: string;
  reason?: string;
  rulesApplied?: string[];
}

/** A component node. Components do not take children; group them in a section or a region. */
export interface ScreenNode {
  /** Unique within the screen. Action requests carry it so the host can match them to its own state. */
  id?: string;
  /** Registry id in the form `syntari.<slug>`. */
  component: `syntari.${string}`;
  props?: Record<string, unknown>;
  provenance?: Provenance;
}

export interface ScreenRegion {
  /** Unique within the screen. Operations name nodes by id; assignIds() gives every node one. */
  id?: string;
  type: 'region';
  label: string;
  open?: boolean;
  children: ScreenChild[];
  provenance?: Provenance;
}

/** A heading over a group of nodes that keeps its own layout. It never collapses. */
export interface ScreenSection {
  /** Unique within the screen. Operations name nodes by id; assignIds() gives every node one. */
  id?: string;
  type: 'section';
  heading: string;
  layout?: 'stack' | 'row' | 'grid' | 'two-column';
  children: ScreenChild[];
  provenance?: Provenance;
}

/**
 * Unverified static HTML. Rejected unless the host allows unverified blocks; when allowed it renders in an
 * isolated frame with no scripts, no network, no forms, and no actions, and is labelled as unverified.
 */
export interface ScreenSandbox {
  /** Unique within the screen. Operations name nodes by id; assignIds() gives every node one. */
  id?: string;
  type: 'sandbox';
  label: string;
  html: string;
  /** Pixels, 80 to 1200. Defaults to 320. */
  height?: number;
  provenance?: Provenance;
}

export type ScreenChild = ScreenNode | ScreenRegion | ScreenSection | ScreenSandbox;

export interface Screen {
  version?: 'syntari-ir-1';
  type: 'screen';
  layout?: 'stack' | 'row' | 'grid' | 'two-column';
  title?: string;
  children: ScreenChild[];
  meta?: Record<string, unknown>;
}

/** What a person asked for in a rendered component. It is a request, never permission. */
export interface ActionRequest {
  component: string;
  action: string;
  id?: string;
  path?: string;
  index?: number;
  /** Form actions send what the person entered; files arrive as File objects in the browser.
   * Local and change actions send the control's new state: value, checked, or pressed. */
  values?: Record<string, unknown>;
  /** True when acting on it changes something outside the screen. The host must authorise it. */
  consequential: boolean;
}

export interface PropContract {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';
  required?: boolean;
  description?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  values?: unknown[];
  default?: unknown;
  maxItems?: number;
  items?: PropContract;
  fields?: Record<string, PropContract>;
}

export interface ActionContract {
  selector: string;
  /** submit sends a form's named values; change sends a checkbox's checked or a field's value. */
  event?: 'click' | 'submit' | 'change';
  description?: string;
  consequential?: boolean;
  /** Boolean prop that marks one instance's requests consequential, such as a Delete button. */
  consequentialProp?: string;
  /** The control updates itself, as a view control does, and the request reports its new state. */
  local?: boolean;
}

export interface ComponentEntry {
  id: string;
  name: string;
  category: string;
  version: string;
  description: string;
  status: 'authored' | 'generated';
  /** True when the component has a render contract: Screen IR and mount({ props }) can use it. */
  renderable: boolean;
  manifest: string;
  source: string;
  preview: string;
  dependencies: string[];
  tokens: string[];
  files: string[];
  examples: { good: string[]; bad: string[]; boundary: string[] };
}

export interface ComponentManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  status: 'authored' | 'generated';
  purpose: string;
  description?: string;
  intents: string[];
  rules: string[];
  avoidWhen?: string[];
  accessibility: Record<string, unknown>;
  props?: Record<string, PropContract>;
  ir?: Record<string, unknown>;
  actions?: Record<string, ActionContract>;
  sample?: { props: Record<string, unknown> };
  [key: string]: unknown;
}

export interface ComponentDetails extends ComponentManifest {
  renderable: boolean;
  /** The CLI command that copies this component into a project. */
  install: string;
  preview: string;
  /** Present when the component has icon props: every icon name the runtime ships. */
  icons?: string[];
}

export interface Pattern {
  id: string;
  name: string;
  type: 'layout' | 'interaction' | 'composition';
  description: string;
  status?: string;
  dependencies: string[];
  tokens: string[];
  files: string[];
  examples: string[];
  installable: boolean;
  preview?: string;
  keywords?: string[];
  screenMode?: string;
  /** Present for compositions: a complete Screen IR example that validates. */
  screen?: Screen;
}

export interface SearchResult {
  kind: 'component' | 'pattern';
  id: string;
  name: string;
  category: string;
  description: string;
  renderable?: boolean;
}

export interface AgentPolicy {
  version: string;
  screenIR: {
    schema: string;
    componentIndex: string;
    patternIndex: string;
    requiresValidation: boolean;
    onError: 'reject';
    onWarning: string;
    allowedComponentStatus: string;
    /** Model-written HTML is rejected unless the host opts in, and is then isolated and labelled. */
    unverifiedBlocks: {
      default: 'reject';
      enabledBy: 'host-render-option';
      isolation: string;
      canRequestActions: false;
      label: 'always-shown';
    };
  };
  actions: {
    authorizationOwner: 'host-application';
    default: 'deny';
    modelAuthoredApprovalIsAuthorization: false;
    requiresTrustedScopeCheck: boolean;
  };
}

export function listComponents(): Promise<ComponentEntry[]>;
export function listPatterns(): Promise<Pattern[]>;
export function getAgentPolicy(): Promise<AgentPolicy>;
export function getPattern(id: string): Promise<Pattern | null>;
export function getComponent(id: string): Promise<ComponentDetails | null>;
export function searchRegistry(query: string): Promise<SearchResult[]>;
/** Pass `{ sandbox: true }` only to validate for a host that allows unverified blocks. */
export function validateScreen(spec: Screen | ScreenChild | unknown, options?: { sandbox?: boolean }): Promise<ValidationResult>;

/** Where a screen's figures come from. Demonstration data is labelled on the rendered screen. */
export interface ScreenData {
  mode: 'demo' | 'provided';
  label?: string;
}

/** One operation a model proposes. It names its scope by node id; the runtime applies it and nothing else. */
export type ScreenOperation =
  | { op: 'insert'; parent?: string; after?: string; before?: string; node: ScreenChild; reason?: string }
  | { op: 'replace'; target: string; set: Record<string, unknown>; reason?: string }
  | { op: 'replace'; target: string; node: ScreenChild; reason?: string }
  | { op: 'remove'; target: string; reason?: string };

/** A model's proposed change to one version of a screen. base is versionOf() of that version. */
export interface ScreenChange {
  version: 'syntari-ops-1';
  base: string;
  summary?: string;
  operations?: ScreenOperation[];
  /** Instead of operations: the request needs the person to decide, such as whether it asks for a new screen. */
  clarify?: { kind: 'new-screen' | 'question'; message: string };
  /** Instead of operations: data the change needs and does not have. */
  needs?: { data: string; reason?: string }[];
}

export interface OperationDiagnostic extends Diagnostic {
  /** The operation that raised it, by index. */
  operation?: number;
  /** The node it concerns. */
  id?: string;
}

export interface ScreenDifference {
  change: 'added' | 'removed' | 'changed' | 'moved';
  /** A node id, or "screen" for the title and layout. */
  id: string;
  kind: 'screen' | 'component' | 'section' | 'region' | 'sandbox';
  path: string;
  parent?: string;
  /** For a changed node: the fields that differ, such as "props.caption". */
  fields?: string[];
}

export interface OperationEffect {
  index: number;
  op: 'insert' | 'replace' | 'remove';
  id: string;
  /** For replace with set: the fields it changed. null when the whole node was replaced. */
  fields?: string[] | null;
  /** Every node id inside the operation's scope. */
  ids: string[];
  parent?: string;
  /** New figures without a source, accepted only because the screen holds demonstration data. */
  demo?: boolean;
  reason: string;
}

export interface ApplyOperationsOptions {
  sandbox?: boolean;
  /** "strict" (default) refuses a figure that is neither on the screen nor in sources; "demo" reports it. */
  data?: 'strict' | 'demo';
  /** Data the host provides: any JSON. Its figures count as sourced. */
  sources?: unknown;
  /** Set only after a person confirmed the data changes listed in a previous result's authorization. */
  allowDataChanges?: boolean;
}

export interface ApplyOperationsResult {
  ok: boolean;
  /** The new screen, or null when anything was refused: keep the last valid screen. */
  spec: Screen | null;
  base: string;
  version: string | null;
  summary: string;
  diagnostics: OperationDiagnostic[];
  effects: OperationEffect[];
  changes: ScreenDifference[];
  /** Existing data the change would alter. Ask the person, then apply again with allowDataChanges. */
  authorization: { operation: number; id: string; fields: string[]; before: unknown[]; after: unknown[] }[];
  validation: (ValidationResult & { screen: Screen | null }) | null;
  clarify: ScreenChange['clarify'] | null;
  needs: ScreenChange['needs'] | null;
}

export const OPS_VERSION: 'syntari-ops-1';
/** A short fingerprint of a screen. A change names the one it was written against. */
export function versionOf(spec: Screen): string;
/** Give every node a stable id; existing ids stay. */
export function assignIds<T extends Screen>(spec: T): T;
export function findNode(spec: Screen, id: string): { node: ScreenChild; path: string; parentId: string; index: number } | null;
export function diffScreens(before: Screen, after: Screen): ScreenDifference[];
/** Apply a model's change to one version of a screen, as a host would: scoped, data-protected, and validated whole. */
export function applyScreenOperations(spec: Screen, change: ScreenChange | unknown, options?: ApplyOperationsOptions): Promise<ApplyOperationsResult>;
