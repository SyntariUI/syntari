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

/** A component node. Components do not take children; group them in a region. */
export interface ScreenNode {
  /** Unique within the screen. Action requests carry it so the host can match them to its own state. */
  id?: string;
  /** Registry id in the form `syntari.<slug>`. */
  component: `syntari.${string}`;
  props?: Record<string, unknown>;
  provenance?: Provenance;
}

export interface ScreenRegion {
  type: 'region';
  label: string;
  open?: boolean;
  children: Array<ScreenNode | ScreenRegion>;
  provenance?: Provenance;
}

export interface Screen {
  version?: 'syntari-ir-1';
  type: 'screen';
  layout?: 'stack' | 'row' | 'grid' | 'two-column';
  title?: string;
  children: Array<ScreenNode | ScreenRegion>;
  meta?: Record<string, unknown>;
}

/** What a person asked for in a rendered component. It is a request, never permission. */
export interface ActionRequest {
  component: string;
  action: string;
  id?: string;
  path?: string;
  index?: number;
  /** Form actions send what the person entered. Files arrive as File objects in the browser. */
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
  event?: 'click' | 'submit';
  description?: string;
  consequential?: boolean;
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
export function validateScreen(spec: Screen | ScreenNode | ScreenRegion | unknown): Promise<ValidationResult>;
