/**
 * Syntari canonical data. A screen carries its dataset once, in `data`, and every figure a part shows can be computed from
 * it by the runtime: totals, shares, bucket sums, and chart series come from the same rows, so a headline, a chart, and a
 * table cannot disagree. A component binds a prop to the data with { "$data": "measures.liquid30" } instead of a literal.
 *
 *   data: {
 *     mode: "demo" | "provided", label?, currency?, locale?, asOf?, sources?: [{ id, label }],
 *     tables:   { holdings: { label?, period?, key?, fields: { weight: { type: "percent", total: 100, role: "allocation" } }, rows: [...] } },
 *     measures: { liquid30: { label, sum: "holdings.weight", where: { liquidityDays: { max: 30 } }, format: "percent" } },
 *     groups:   { liquidity: { table: "holdings", by: "liquidityDays", value: "weight", buckets: [{ label: "D0", max: 0 }, ...] } }
 *   }
 *
 * Nothing here runs model-written code: measures are sums, averages, extremes, counts, and arithmetic formulas over other
 * measures, read with the same formula grammar calculators use.
 */
import { parseFormula, evaluateFormula } from './ir.js';

export const DATA_LIMITS = { maxTables: 8, maxFields: 16, maxRows: 200, maxMeasures: 40, maxGroups: 20, maxBuckets: 12, maxSources: 8, maxText: 80 };
export const FIELD_TYPES = ['text', 'category', 'period', 'date', 'number', 'percent', 'currency', 'days'];
export const FIELD_ROLES = ['allocation', 'exposure', 'risk-contribution', 'volatility', 'return', 'benchmark', 'value', 'liquidity', 'count', 'other'];
export const MEASURE_OPS = ['sum', 'avg', 'min', 'max', 'count', 'first', 'last'];
export const DATA_FORMATS = ['percent', 'signed-percent', 'points', 'currency', 'compact-currency', 'number', 'integer', 'days', 'text'];
const NUMERIC = new Set(['number', 'percent', 'currency', 'days']);
const DATA_KEYS = ['mode', 'label', 'currency', 'locale', 'asOf', 'sources', 'tables', 'measures', 'groups'];
const TABLE_KEYS = ['label', 'period', 'key', 'source', 'fields', 'rows'];
const FIELD_KEYS = ['type', 'label', 'currency', 'total', 'role', 'order'];
const MEASURE_KEYS = ['label', 'format', 'digits', 'period', 'role', 'where', 'weight', 'formula', 'value', 'source', 'currency', ...MEASURE_OPS];
const GROUP_KEYS = ['label', 'table', 'by', 'value', 'values', 'buckets', 'labelField', 'order', 'top', 'otherLabel', 'role', 'format'];
const BINDING_KEYS = ['$data', 'format', 'digits', 'map', 'cells', 'sort', 'limit', 'where'];
const WHERE_KEYS = ['min', 'max', 'gt', 'lt', 'eq', 'in'];
const NAME = /^[a-z][A-Za-z0-9_]{0,31}$/;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const typeOf = value => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const round = (value, digits) => { const scale = 10 ** Math.max(0, Math.min(6, digits)); return Math.round(value * scale) / scale; };
const tidy = value => Number(Number(value).toPrecision(12));

/* ---------- Formatting: one figure, written the way its type reads in the screen's locale ---------- */
function safeLocale(locale) {
  if (typeof locale !== 'string') return 'en-US';
  try { new Intl.NumberFormat(locale); return locale; } catch { return 'en-US'; }
}
/** Write a number in a data format. Percent values are written as given (12.5 means 12.5%). */
export function formatData(value, format = 'number', options = {}) {
  if (format === 'text') return value === null || value === undefined ? '' : String(value);
  if (!finite(value)) return '—';
  const locale = safeLocale(options.locale);
  const digits = Number.isInteger(options.digits) ? Math.max(0, Math.min(6, options.digits)) : undefined;
  const currency = /^[A-Z]{3}$/.test(options.currency ?? '') ? options.currency : 'USD';
  switch (format) {
    case 'percent': return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits ?? 1 }).format(value / 100);
    case 'signed-percent': return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits ?? 1, signDisplay: 'exceptZero' }).format(value / 100);
    case 'points': return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits ?? 1, signDisplay: 'exceptZero' }).format(value)} pp`;
    case 'currency': return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: digits ?? 0, minimumFractionDigits: 0 }).format(value);
    case 'compact-currency': return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: digits ?? 1 }).format(value);
    case 'integer': return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    case 'days': return new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'short', maximumFractionDigits: digits ?? 0 }).format(value);
    default: return new Intl.NumberFormat(locale, { maximumFractionDigits: digits ?? 2 }).format(value);
  }
}
const defaultFormat = type => type === 'percent' ? 'percent' : type === 'currency' ? 'currency' : type === 'days' ? 'days' : NUMERIC.has(type) ? 'number' : 'text';

/**
 * Read a figure as a person wrote it: "38%", "38,5 %", "€1.2M", "1.250.000 €", "-0,4 pp", "D30", "30 días".
 * Returns { value, unit } with unit "percent", "currency", "days", or null, or null when the text holds no single figure.
 */
export function parseFigure(input) {
  if (finite(input)) return { value: input, unit: null };
  if (typeof input !== 'string') return null;
  /* "1 250 000 €" groups thousands with spaces: one figure, not three. */
  const text = input.replace(/[  ]/g, ' ').trim().replace(/(\d) (?=\d{3}(?:\D|$))/g, '$1');
  const match = text.match(/[-−+]?\(?\s*\d[\d.,\s]*\d|[-−+]?\d/);
  if (!match) return null;
  /* More than one figure, such as "12 of 40", is a sentence, not a value. */
  if ((text.match(/\d[\d.,]*/g) ?? []).length > 1 && !/^\s*[-−+]?[\d.,\s]+(%|\s*pp)?\s*$/.test(text)) return null;
  let raw = match[0].replace(/\s+/g, '').replace(/[()]/g, '');
  const negative = /^[-−]/.test(raw) || /^\(.*\)$/.test(text.trim());
  raw = raw.replace(/^[-−+]/, '');
  const dots = (raw.match(/\./g) ?? []).length, commas = (raw.match(/,/g) ?? []).length;
  let normal = raw;
  if (dots && commas) normal = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (commas) normal = commas === 1 && !/,\d{3}$/.test(raw) ? raw.replace(',', '.') : raw.replace(/,/g, '');
  else if (dots > 1 || (dots === 1 && /\.\d{3}$/.test(raw) && raw.length > 5)) normal = raw.replace(/\./g, '');
  let value = Number(normal);
  if (!Number.isFinite(value)) return null;
  const after = text.slice(match.index + match[0].length).trim().toLowerCase();
  const before = text.slice(0, match.index).toLowerCase();
  const scale = /^(k|mil\b)/.test(after) ? 1e3 : /^(m|mm|mill|millones|million)/.test(after) ? 1e6 : /^(b|bn|billion|mil millones)/.test(after) ? 1e9 : 1;
  value *= scale;
  if (negative) value = -value;
  const unit = /%|pp\b|p\.p\./.test(text) ? 'percent' : /[€$£¥]|\b(eur|usd|gbp|chf)\b/i.test(text) ? 'currency' : /^d\s*$/.test(before.slice(-2)) || /^(d|days?|d[ií]as?)\b/.test(after) || /^t\+$/.test(before.slice(-2)) ? 'days' : null;
  return { value: tidy(value), unit };
}

/* ---------- The model: the data block checked, measures and groups computed ---------- */
function within(value, where) {
  if (!isObject(where)) return true;
  if (where.eq !== undefined && value !== where.eq) return false;
  if (Array.isArray(where.in) && !where.in.includes(value)) return false;
  if (finite(where.min) && !(finite(value) && value >= where.min)) return false;
  if (finite(where.max) && !(finite(value) && value <= where.max)) return false;
  if (finite(where.gt) && !(finite(value) && value > where.gt)) return false;
  if (finite(where.lt) && !(finite(value) && value < where.lt)) return false;
  return true;
}
const matches = (row, where) => !isObject(where) || Object.entries(where).every(([field, rule]) => within(row[field], isObject(rule) ? rule : { eq: rule }));
const bucketRange = (buckets, i) => [i === 0 ? -Infinity : buckets[i - 1].max, finite(buckets[i].max) ? buckets[i].max : Infinity];
/** The bucket a value falls in: the first whose upper bound is at or above it. Upper bounds are inclusive. */
export function bucketOf(buckets, value) {
  if (!finite(value)) return -1;
  for (const [i, bucket] of buckets.entries()) if (!finite(bucket.max) || value <= bucket.max) return i;
  return -1;
}
export const normalLabel = text => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‐-―−]/g, '-').replace(/\s*-\s*/g, '-').replace(/[^a-z0-9%<>=+.\-\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Check a data block and compute what it defines. `report(severity, code, path, message)` receives every problem.
 * Returns the model the rest of the runtime reads, or null when there is no data block.
 */
export function buildDataModel(data, report = () => {}, base = 'data') {
  if (data === undefined) return null;
  if (!isObject(data)) { report('error', 'wrong-type', base, 'The screen data is an object with tables, measures, and groups.'); return null; }
  const model = { data, mode: data.mode, label: data.label, currency: /^[A-Z]{3}$/.test(data.currency ?? '') ? data.currency : null, locale: safeLocale(data.locale), tables: new Map(), measures: new Map(), groups: new Map(), sources: new Map() };
  for (const key of Object.keys(data)) if (!DATA_KEYS.includes(key)) report('error', 'unknown-key', `${base}.${key}`, `Screen data takes ${DATA_KEYS.join(', ')}.`);
  if (data.mode === undefined) report('warning', 'data-mode-missing', `${base}.mode`, 'Say whether these figures were provided or are a demonstration: "mode": "provided" or "demo".');
  else if (!['demo', 'provided'].includes(data.mode)) report('error', 'enum-outside-values', `${base}.mode`, 'mode is "demo" or "provided".');
  if (data.currency !== undefined && !model.currency) report('error', 'invalid-currency', `${base}.currency`, 'A currency is a three-letter ISO code, such as "EUR".');
  if (data.locale !== undefined && model.locale !== data.locale) report('warning', 'invalid-locale', `${base}.locale`, `"${data.locale}" is not a locale this browser knows; figures are written in en-US.`);
  if (data.label !== undefined && (typeof data.label !== 'string' || data.label.length > 140)) report('error', 'over-length', `${base}.label`, 'The data label is text, at most 140 characters.');
  if (data.sources !== undefined) {
    if (!Array.isArray(data.sources) || data.sources.length > DATA_LIMITS.maxSources) report('error', 'wrong-type', `${base}.sources`, `Sources are a list of at most ${DATA_LIMITS.maxSources} { id, label } entries.`);
    else data.sources.forEach((source, i) => {
      if (!isObject(source) || typeof source.id !== 'string' || typeof source.label !== 'string') report('error', 'wrong-type', `${base}.sources[${i}]`, 'A source is { id, label }.');
      else model.sources.set(source.id, source);
    });
  }
  if (data.mode === 'provided' && !model.sources.size) report('warning', 'data-source-missing', `${base}.sources`, 'Provided figures should name where they come from, so a person can trust them.');

  /* Tables: typed fields, typed rows, and totals that add up. */
  const tables = data.tables ?? {};
  if (!isObject(tables)) report('error', 'wrong-type', `${base}.tables`, 'Tables are an object keyed by table name.');
  else {
    const names = Object.keys(tables);
    if (names.length > DATA_LIMITS.maxTables) report('error', 'over-item-budget', `${base}.tables`, `${names.length} tables were supplied; the limit is ${DATA_LIMITS.maxTables}.`);
    for (const name of names.slice(0, DATA_LIMITS.maxTables)) {
      const at = `${base}.tables.${name}`, table = tables[name];
      if (!NAME.test(name)) { report('error', 'invalid-name', at, 'Table names start with a lowercase letter and use letters, digits, or underscores.'); continue; }
      if (!isObject(table)) { report('error', 'wrong-type', at, 'A table is { fields, rows }.'); continue; }
      for (const key of Object.keys(table)) if (!TABLE_KEYS.includes(key)) report('error', 'unknown-key', `${at}.${key}`, `Tables take ${TABLE_KEYS.join(', ')}.`);
      const fields = isObject(table.fields) ? table.fields : {};
      if (!isObject(table.fields) || !Object.keys(fields).length) report('error', 'missing-required', `${at}.fields`, 'A table declares its fields and their types.');
      if (Object.keys(fields).length > DATA_LIMITS.maxFields) report('error', 'over-item-budget', `${at}.fields`, `The limit is ${DATA_LIMITS.maxFields} fields.`);
      for (const [field, spec] of Object.entries(fields)) {
        const fat = `${at}.fields.${field}`;
        if (!NAME.test(field)) report('error', 'invalid-name', fat, 'Field names start with a lowercase letter and use letters, digits, or underscores.');
        if (!isObject(spec)) { report('error', 'wrong-type', fat, 'A field is { type, label? }.'); continue; }
        for (const key of Object.keys(spec)) if (!FIELD_KEYS.includes(key)) report('error', 'unknown-key', `${fat}.${key}`, `Fields take ${FIELD_KEYS.join(', ')}.`);
        if (!FIELD_TYPES.includes(spec.type)) report('error', 'enum-outside-values', `${fat}.type`, `A field type is one of ${FIELD_TYPES.join(', ')}.`);
        if (spec.role !== undefined && !FIELD_ROLES.includes(spec.role)) report('error', 'enum-outside-values', `${fat}.role`, `A field role is one of ${FIELD_ROLES.join(', ')}.`);
        if (spec.total !== undefined && (!finite(spec.total) || !NUMERIC.has(spec.type))) report('error', 'wrong-type', `${fat}.total`, 'Only a numeric field has a total, and the total is a number.');
        if (spec.currency !== undefined && !/^[A-Z]{3}$/.test(spec.currency)) report('error', 'invalid-currency', `${fat}.currency`, 'A currency is a three-letter ISO code.');
        if (spec.order !== undefined && (!Array.isArray(spec.order) || spec.order.some(item => typeof item !== 'string'))) report('error', 'wrong-type', `${fat}.order`, 'order lists the categories in display order.');
      }
      const rows = Array.isArray(table.rows) ? table.rows : [];
      if (!Array.isArray(table.rows)) report('error', 'missing-required', `${at}.rows`, 'A table needs its rows, even an empty list.');
      if (rows.length > DATA_LIMITS.maxRows) report('error', 'over-item-budget', `${at}.rows`, `${rows.length} rows were supplied; the limit is ${DATA_LIMITS.maxRows}.`);
      const keys = new Set();
      rows.slice(0, DATA_LIMITS.maxRows).forEach((row, i) => {
        const rat = `${at}.rows[${i}]`;
        if (!isObject(row)) { report('error', 'wrong-type', rat, 'A row is an object keyed by field.'); return; }
        for (const [field, value] of Object.entries(row)) {
          const spec = fields[field];
          if (!spec) { report('error', 'unknown-data-field', `${rat}.${field}`, `"${field}" is not a field of ${name}.`); continue; }
          if (value === null) continue;
          if (NUMERIC.has(spec.type) && !finite(value)) report('error', 'wrong-type', `${rat}.${field}`, `${field} is ${spec.type}, so each value is a number.`);
          else if (!NUMERIC.has(spec.type) && typeof value !== 'string') report('error', 'wrong-type', `${rat}.${field}`, `${field} is ${spec.type}, so each value is text.`);
          else if (typeof value === 'string' && value.length > DATA_LIMITS.maxText) report('error', 'over-length', `${rat}.${field}`, `Data text stays under ${DATA_LIMITS.maxText} characters.`);
        }
        if (table.key !== undefined) {
          const id = row[table.key];
          if (id === undefined || id === null) report('error', 'missing-required', `${rat}.${table.key}`, `Every row of ${name} has a ${table.key}: it is the table's key.`);
          else if (keys.has(id)) report('error', 'duplicate-data-key', `${rat}.${table.key}`, `"${id}" appears twice in ${name}; the key names one row.`);
          else keys.add(id);
        }
      });
      if (table.key !== undefined && !fields[table.key]) report('error', 'unknown-data-field', `${at}.key`, `The key "${table.key}" is not a field of ${name}.`);
      /* Shares of one whole add up to it. A tolerance of half a point allows for rounding, not for a missing part. */
      for (const [field, spec] of Object.entries(fields)) {
        if (!finite(spec?.total) || !rows.length) continue;
        const sum = rows.reduce((total, row) => total + (finite(row?.[field]) ? row[field] : 0), 0);
        const tolerance = Math.max(0.5, Math.abs(spec.total) * 0.005);
        if (Math.abs(sum - spec.total) > tolerance) report('error', 'data-total', `${at}.fields.${field}`, `The ${spec.label ?? field} values in ${table.label ?? name} add up to ${tidy(round(sum, 2))}; they must add up to ${spec.total}.`);
      }
      model.tables.set(name, { name, spec: table, fields, rows: rows.filter(isObject), label: typeof table.label === 'string' ? table.label : name });
    }
  }

  const fieldRef = (ref, at, { numeric = true } = {}) => {
    if (typeof ref !== 'string' || !/^[a-z]\w*\.[a-z]\w*$/i.test(ref)) { report('error', 'unknown-data-ref', at, 'Name a table field as "table.field".'); return null; }
    const [tableName, field] = ref.split('.');
    const table = model.tables.get(tableName);
    if (!table) { report('error', 'unknown-data-ref', at, `There is no table "${tableName}".`); return null; }
    const spec = table.fields[field];
    if (!spec) { report('error', 'unknown-data-ref', at, `${tableName} has no field "${field}".`); return null; }
    if (numeric && !NUMERIC.has(spec.type)) { report('error', 'data-shape', at, `${tableName}.${field} is ${spec.type}; this needs a numeric field.`); return null; }
    return { table, field, spec };
  };
  const checkWhere = (where, table, at) => {
    if (where === undefined) return;
    if (!isObject(where)) { report('error', 'wrong-type', at, 'where maps a field to a condition, such as { "liquidityDays": { "max": 30 } }.'); return; }
    for (const [field, rule] of Object.entries(where)) {
      if (!table.fields[field]) report('error', 'unknown-data-field', `${at}.${field}`, `${table.name} has no field "${field}".`);
      if (isObject(rule)) for (const key of Object.keys(rule)) if (!WHERE_KEYS.includes(key)) report('error', 'unknown-key', `${at}.${field}.${key}`, `Conditions take ${WHERE_KEYS.join(', ')}.`);
    }
  };

  /* Measures: one figure each, computed from the rows or from other measures. */
  const measures = data.measures ?? {};
  if (!isObject(measures)) report('error', 'wrong-type', `${base}.measures`, 'Measures are an object keyed by measure name.');
  else {
    const entries = Object.entries(measures);
    if (entries.length > DATA_LIMITS.maxMeasures) report('error', 'over-item-budget', `${base}.measures`, `The limit is ${DATA_LIMITS.maxMeasures} measures.`);
    const formulas = [];
    for (const [name, spec] of entries.slice(0, DATA_LIMITS.maxMeasures)) {
      const at = `${base}.measures.${name}`;
      if (!NAME.test(name)) { report('error', 'invalid-name', at, 'Measure names start with a lowercase letter and use letters, digits, or underscores.'); continue; }
      if (!isObject(spec)) { report('error', 'wrong-type', at, 'A measure is { label, sum | avg | min | max | count | first | last | formula | value }.'); continue; }
      for (const key of Object.keys(spec)) if (!MEASURE_KEYS.includes(key)) report('error', 'unknown-key', `${at}.${key}`, `Measures take ${MEASURE_KEYS.join(', ')}.`);
      if (typeof spec.label !== 'string' || !spec.label.trim()) report('error', 'missing-required', `${at}.label`, 'A measure has a label: the words a person reads beside its value.');
      if (spec.format !== undefined && !DATA_FORMATS.includes(spec.format)) report('error', 'enum-outside-values', `${at}.format`, `A format is one of ${DATA_FORMATS.join(', ')}.`);
      const ops = MEASURE_OPS.filter(op => spec[op] !== undefined);
      const kinds = ops.length + (spec.formula !== undefined ? 1 : 0) + (spec.value !== undefined ? 1 : 0);
      if (kinds !== 1) { report('error', 'invalid-measure', at, 'A measure is computed one way: one of sum, avg, min, max, count, first, last, formula, or a stated value.'); continue; }
      const entry = { name, spec, label: spec.label ?? name, value: null, format: spec.format, role: spec.role, period: spec.period, currency: spec.currency ?? model.currency };
      model.measures.set(name, entry);
      if (spec.value !== undefined) {
        if (!finite(spec.value)) report('error', 'wrong-type', `${at}.value`, 'A stated value is a number.');
        else entry.value = spec.value;
        if (spec.source !== undefined && !model.sources.has(spec.source)) report('error', 'unknown-data-ref', `${at}.source`, `There is no source "${spec.source}".`);
        entry.format ??= 'number';
        continue;
      }
      if (spec.formula !== undefined) { formulas.push(entry); continue; }
      const op = ops[0];
      const ref = fieldRef(spec[op], `${at}.${op}`, { numeric: op !== 'count' && op !== 'first' && op !== 'last' });
      if (!ref) continue;
      checkWhere(spec.where, ref.table, `${at}.where`);
      entry.table = ref.table.name;
      entry.field = ref.field;
      entry.role ??= ref.spec.role;
      entry.currency = spec.currency ?? ref.spec.currency ?? model.currency;
      entry.format ??= op === 'count' ? 'integer' : defaultFormat(ref.spec.type);
      const rows = ref.table.rows.filter(row => matches(row, spec.where));
      const values = rows.map(row => row[ref.field]).filter(value => op === 'count' || op === 'first' || op === 'last' ? value !== undefined && value !== null : finite(value));
      if (op === 'count') entry.value = values.length;
      else if (op === 'first' || op === 'last') { const value = op === 'first' ? values[0] : values.at(-1); entry.value = finite(value) ? value : null; if (!NUMERIC.has(ref.spec.type)) entry.text = value; }
      else if (!values.length) entry.value = null;
      else if (op === 'sum') entry.value = tidy(values.reduce((a, b) => a + b, 0));
      else if (op === 'min') entry.value = Math.min(...values);
      else if (op === 'max') entry.value = Math.max(...values);
      else {
        const weight = spec.weight === undefined ? null : fieldRef(`${ref.table.name}.${spec.weight}`, `${at}.weight`);
        if (weight) {
          const pairs = rows.filter(row => finite(row[ref.field]) && finite(row[weight.field]));
          const total = pairs.reduce((a, row) => a + row[weight.field], 0);
          entry.value = total ? tidy(pairs.reduce((a, row) => a + row[ref.field] * row[weight.field], 0) / total) : null;
        } else entry.value = tidy(values.reduce((a, b) => a + b, 0) / values.length);
      }
    }
    /* Formulas read other measures; they resolve in as many passes as their dependencies need, and a cycle never does. */
    const pending = [...formulas];
    for (const entry of pending) {
      try { entry.tree = parseFormula(entry.spec.formula); }
      catch (error) { report('error', 'invalid-formula', `${base}.measures.${entry.name}.formula`, error.message); entry.broken = true; continue; }
      for (const name of entry.tree.names) if (!model.measures.has(name)) { report('error', 'unknown-name', `${base}.measures.${entry.name}.formula`, `"${name}" is not a measure.`); entry.broken = true; }
      entry.format ??= 'number';
    }
    let progress = true;
    while (progress) {
      progress = false;
      for (const entry of pending) {
        if (entry.broken || entry.done || !entry.tree.names.every(name => { const other = model.measures.get(name); return other.spec.formula === undefined || other.done; })) continue;
        const scope = Object.fromEntries(entry.tree.names.map(name => [name, model.measures.get(name).value ?? NaN]));
        entry.value = evaluateFormula(entry.tree.tree, scope);
        if (entry.value !== null) entry.value = tidy(entry.value);
        entry.done = progress = true;
      }
    }
    for (const entry of pending) if (!entry.broken && !entry.done) report('error', 'invalid-formula', `${base}.measures.${entry.name}.formula`, 'This formula depends on itself through other measures.');
  }

  /* Groups: a field's values summed by category, or by ordered buckets whose upper bounds are inclusive. */
  const groups = data.groups ?? {};
  if (!isObject(groups)) report('error', 'wrong-type', `${base}.groups`, 'Groups are an object keyed by group name.');
  else for (const [name, spec] of Object.entries(groups).slice(0, DATA_LIMITS.maxGroups)) {
    const at = `${base}.groups.${name}`;
    if (!NAME.test(name)) { report('error', 'invalid-name', at, 'Group names start with a lowercase letter and use letters, digits, or underscores.'); continue; }
    if (!isObject(spec)) { report('error', 'wrong-type', at, 'A group is { table, by, value }.'); continue; }
    for (const key of Object.keys(spec)) if (!GROUP_KEYS.includes(key)) report('error', 'unknown-key', `${at}.${key}`, `Groups take ${GROUP_KEYS.join(', ')}.`);
    const table = model.tables.get(spec.table);
    if (!table) { report('error', 'unknown-data-ref', `${at}.table`, `There is no table "${spec.table}".`); continue; }
    const by = table.fields[spec.by];
    if (!by) { report('error', 'unknown-data-ref', `${at}.by`, `${table.name} has no field "${spec.by}".`); continue; }
    const valueFields = spec.values !== undefined ? (Array.isArray(spec.values) ? spec.values : []) : spec.value !== undefined ? [spec.value] : [];
    let broken = false;
    for (const [i, field] of valueFields.entries()) {
      const fs = table.fields[field];
      if (!fs) { report('error', 'unknown-data-ref', `${at}.${spec.values !== undefined ? `values[${i}]` : 'value'}`, `${table.name} has no field "${field}".`); broken = true; }
      else if (!NUMERIC.has(fs.type)) { report('error', 'data-shape', `${at}.${spec.values !== undefined ? `values[${i}]` : 'value'}`, `${field} is ${fs.type}; a group sums numeric fields.`); broken = true; }
    }
    if (broken) continue;
    const entry = { name, spec, label: spec.label ?? name, table: table.name, by: spec.by, values: valueFields, items: [], total: 0, bucketed: false, role: spec.role ?? table.fields[valueFields[0]]?.role, format: spec.format ?? (valueFields[0] ? defaultFormat(table.fields[valueFields[0]].type) : 'integer'), currency: table.fields[valueFields[0]]?.currency ?? model.currency };
    const add = (bucket, row) => { bucket.count += 1; for (const field of valueFields) if (finite(row[field])) bucket[field] = tidy((bucket[field] ?? 0) + row[field]); };
    if (spec.buckets !== undefined) {
      entry.bucketed = true;
      const buckets = Array.isArray(spec.buckets) ? spec.buckets : [];
      if (!NUMERIC.has(by.type)) { report('error', 'data-shape', `${at}.by`, `Buckets split a numeric field; ${spec.by} is ${by.type}.`); continue; }
      if (!buckets.length || buckets.length > DATA_LIMITS.maxBuckets) { report('error', 'over-item-budget', `${at}.buckets`, `A group has 1 to ${DATA_LIMITS.maxBuckets} buckets.`); continue; }
      let ordered = true;
      buckets.forEach((bucket, i) => {
        if (!isObject(bucket) || typeof bucket.label !== 'string' || !bucket.label.trim()) { report('error', 'missing-required', `${at}.buckets[${i}].label`, 'Each bucket has a label.'); ordered = false; return; }
        if (bucket.max !== undefined && !finite(bucket.max)) { report('error', 'wrong-type', `${at}.buckets[${i}].max`, 'A bucket bound is a number.'); ordered = false; }
        if (bucket.max === undefined && i < buckets.length - 1) { report('error', 'bucket-order', `${at}.buckets[${i}].max`, 'Only the last bucket may be open-ended.'); ordered = false; }
        if (i && finite(bucket.max) && finite(buckets[i - 1].max) && bucket.max <= buckets[i - 1].max) { report('error', 'bucket-order', `${at}.buckets[${i}].max`, 'Bucket bounds rise from one bucket to the next.'); ordered = false; }
      });
      if (!ordered) continue;
      entry.buckets = buckets;
      entry.items = buckets.map((bucket, i) => ({ label: bucket.label, count: 0, range: bucketRange(buckets, i) }));
      const mismatched = [], outside = [];
      table.rows.forEach((row, r) => {
        const i = bucketOf(buckets, row[spec.by]);
        if (i < 0) { outside.push(r); return; }
        add(entry.items[i], row);
        /* A row that names its own bucket must sit in the bucket its value falls in: day 30 is "D8–D30", not "D31–D90". */
        if (spec.labelField !== undefined && row[spec.labelField] !== undefined && normalLabel(row[spec.labelField]) !== normalLabel(buckets[i].label)) mismatched.push({ r, row, expected: buckets[i].label });
      });
      if (spec.labelField !== undefined && !table.fields[spec.labelField]) report('error', 'unknown-data-ref', `${at}.labelField`, `${table.name} has no field "${spec.labelField}".`);
      for (const r of outside) report('error', 'bucket-gap', `${base}.tables.${table.name}.rows[${r}].${spec.by}`, `${spec.by} ${table.rows[r][spec.by]} falls in no bucket of ${entry.label}.`);
      for (const { r, row, expected } of mismatched.slice(0, 8)) report('error', 'bucket-mismatch', `${base}.tables.${table.name}.rows[${r}].${spec.labelField}`, `${table.spec.key ? `${row[table.spec.key]}: ` : ''}${spec.by} ${row[spec.by]} belongs in “${expected}”, but the row says “${row[spec.labelField]}”. Bucket upper bounds are inclusive.`);
    } else {
      const order = Array.isArray(spec.order) ? spec.order : Array.isArray(by.order) ? by.order : null;
      const map = new Map();
      if (order) for (const label of order) map.set(label, { label, count: 0 });
      for (const row of table.rows) {
        const key = row[spec.by];
        if (key === undefined || key === null) continue;
        if (!map.has(key)) map.set(key, { label: String(key), count: 0 });
        add(map.get(key), row);
      }
      entry.items = [...map.values()];
      const primary = valueFields[0];
      if (spec.order === 'value-desc' || spec.order === 'value-asc') entry.items.sort((a, b) => ((b[primary] ?? b.count) - (a[primary] ?? a.count)) * (spec.order === 'value-asc' ? -1 : 1));
      if (Number.isInteger(spec.top) && spec.top > 0 && entry.items.length > spec.top) {
        const sorted = [...entry.items].sort((a, b) => (b[primary] ?? b.count) - (a[primary] ?? a.count));
        const keep = new Set(sorted.slice(0, spec.top - 1));
        const other = { label: typeof spec.otherLabel === 'string' ? spec.otherLabel : 'Other', count: 0 };
        for (const item of entry.items) if (!keep.has(item)) { other.count += item.count; for (const field of valueFields) other[field] = tidy((other[field] ?? 0) + (item[field] ?? 0)); }
        entry.items = [...entry.items.filter(item => keep.has(item)), other];
      }
    }
    const primary = valueFields[0];
    entry.total = tidy(entry.items.reduce((sum, item) => sum + (primary ? item[primary] ?? 0 : item.count), 0));
    for (const item of entry.items) {
      item.value = primary ? item[primary] ?? 0 : item.count;
      item.share = entry.total ? tidy(round(item.value / entry.total * 100, 4)) : 0;
    }
    model.groups.set(name, entry);
  }
  return model;
}

/** Every figure the data holds or computes, as numbers: what a new literal may quote without inventing it. */
export function dataFigures(model) {
  const out = [];
  if (!model) return out;
  for (const table of model.tables.values()) for (const row of table.rows) for (const value of Object.values(row)) if (finite(value)) out.push(value);
  for (const measure of model.measures.values()) if (finite(measure.value)) out.push(measure.value, round(measure.value, 0), round(measure.value, 1), round(measure.value, 2));
  for (const group of model.groups.values()) for (const item of group.items) for (const value of [item.value, item.share, ...group.values.map(field => item[field])]) if (finite(value)) out.push(value, round(value, 0), round(value, 1));
  return out;
}

/* ---------- Bindings: { "$data": ref } resolved into the value the prop's contract expects ---------- */
export const isBinding = value => isObject(value) && typeof value.$data === 'string';
export function hasBindings(value, depth = 0) {
  if (depth > 48) return false;
  if (isBinding(value)) return true;
  if (Array.isArray(value)) return value.some(item => hasBindings(item, depth + 1));
  if (isObject(value)) return Object.values(value).some(item => hasBindings(item, depth + 1));
  return false;
}
/** Parse a reference: "measures.x", "groups.x", or "tables.x". */
export function parseRef(ref) {
  const match = /^(measures|groups|tables)\.([a-z]\w*)$/i.exec(String(ref ?? ''));
  return match ? { kind: match[1], name: match[2] } : null;
}
function fieldValue(model, kind, entry, source, item, descriptor, binding, at, report) {
  const spec = typeof source === 'string' ? { field: source } : isObject(source) ? source : null;
  if (!spec || typeof spec.field !== 'string') { report('error', 'data-binding', at, 'Each mapped field names a data field, as "weight" or { "field": "weight", "format": "percent" }.'); return undefined; }
  const field = spec.field;
  let value, type;
  if (kind === 'groups') {
    if (!['label', 'value', 'share', 'count', ...entry.values].includes(field)) { report('error', 'unknown-data-field', at, `${entry.name} items have label, value, share, count${entry.values.length ? `, ${entry.values.join(', ')}` : ''}; not "${field}".`); return undefined; }
    value = item[field];
    type = field === 'label' ? 'text' : field === 'share' ? 'percent' : field === 'count' ? 'number' : model.tables.get(entry.table).fields[field === 'value' ? entry.values[0] : field]?.type ?? 'number';
  } else {
    const fs = entry.fields[field];
    if (!fs) { report('error', 'unknown-data-field', at, `${entry.name} has no field "${field}".`); return undefined; }
    value = item[field];
    type = fs.type;
  }
  const wantsNumber = descriptor?.type === 'number';
  if (wantsNumber) {
    if (!finite(value)) { if (value !== undefined && value !== null) report('error', 'data-shape', at, `"${field}" is not a number, and this prop takes one.`); return undefined; }
    return Number.isInteger(spec.digits) ? round(value, spec.digits) : value;
  }
  if (value === undefined || value === null) return descriptor?.required ? '—' : undefined;
  const format = spec.format ?? defaultFormat(type);
  if (!DATA_FORMATS.includes(format)) { report('error', 'enum-outside-values', `${at}.format`, `A format is one of ${DATA_FORMATS.join(', ')}.`); return undefined; }
  const currency = (kind === 'tables' ? entry.fields[field]?.currency : null) ?? (kind === 'groups' ? entry.currency : null) ?? model.currency;
  return typeof value === 'string' ? value : formatData(value, format, { locale: model.locale, digits: spec.digits, currency });
}
/**
 * Resolve one binding against the model, shaped by the prop's descriptor from the component contract.
 * A string prop takes a measure, written in its format; a number prop takes a measure's value; a list prop takes a group's
 * items or a table's rows, through "map" (objects) or "cells" (arrays of text, for a table).
 */
export function resolveBinding(model, binding, descriptor, at, report, record) {
  for (const key of Object.keys(binding)) if (!BINDING_KEYS.includes(key)) report('error', 'data-binding', `${at}.${key}`, `A binding takes ${BINDING_KEYS.join(', ')}.`);
  if (!model) { report('error', 'data-unavailable', at, 'This prop is bound to data, but the screen has no data block.'); return undefined; }
  const ref = parseRef(binding.$data);
  if (!ref) { report('error', 'unknown-data-ref', at, 'A binding names "measures.<name>", "groups.<name>", or "tables.<name>".'); return undefined; }
  const entry = model[ref.kind].get(ref.name);
  if (!entry) { report('error', 'unknown-data-ref', at, `There is no ${ref.kind.slice(0, -1)} "${ref.name}" in the screen data.`); return undefined; }
  record?.({ path: at, ref: binding.$data, kind: ref.kind, name: ref.name, entry });
  const type = descriptor?.type;
  if (ref.kind === 'measures') {
    if (type === 'array' || type === 'object') { report('error', 'data-shape', at, `${binding.$data} is one figure, and this prop takes a list.`); return undefined; }
    if (type === 'number') return finite(entry.value) ? (Number.isInteger(binding.digits) ? round(entry.value, binding.digits) : entry.value) : undefined;
    const format = binding.format ?? entry.format ?? 'number';
    if (!DATA_FORMATS.includes(format)) { report('error', 'enum-outside-values', `${at}.format`, `A format is one of ${DATA_FORMATS.join(', ')}.`); return undefined; }
    if (entry.text !== undefined) return String(entry.text);
    return formatData(entry.value, format, { locale: model.locale, digits: binding.digits ?? entry.spec.digits, currency: entry.currency });
  }
  if (type && type !== 'array') { report('error', 'data-shape', at, `${binding.$data} is a list, and this prop takes ${type === 'string' ? 'text' : `a ${type}`}.`); return undefined; }
  let items = ref.kind === 'groups' ? entry.items.map(item => ({ ...item })) : entry.rows.map(row => ({ ...row }));
  if (binding.where !== undefined) {
    if (ref.kind !== 'tables') report('error', 'data-binding', `${at}.where`, 'where filters a table\'s rows.');
    else items = items.filter(row => matches(row, binding.where));
  }
  if (binding.sort !== undefined) {
    const by = isObject(binding.sort) ? binding.sort.by : null, dir = isObject(binding.sort) && binding.sort.dir === 'asc' ? 1 : -1;
    if (typeof by !== 'string') report('error', 'data-binding', `${at}.sort`, 'sort is { "by": <field>, "dir": "asc" | "desc" }.');
    else items.sort((a, b) => { const x = a[by], y = b[by]; return (finite(x) && finite(y) ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * dir; });
  }
  if (binding.limit !== undefined) { if (Number.isInteger(binding.limit) && binding.limit > 0) items = items.slice(0, binding.limit); else report('error', 'data-binding', `${at}.limit`, 'limit is a whole number above 0.'); }
  const itemDescriptor = descriptor?.items;
  if (binding.cells !== undefined) {
    if (!Array.isArray(binding.cells) || !binding.cells.length) { report('error', 'data-binding', `${at}.cells`, 'cells lists one field per column.'); return undefined; }
    return items.map((item, i) => binding.cells.map((source, c) => fieldValue(model, ref.kind, entry, source, item, { type: 'string' }, binding, `${at}.cells[${c}]`, i ? () => {} : report) ?? ''));
  }
  if (binding.map !== undefined) {
    if (!isObject(binding.map) || !Object.keys(binding.map).length) { report('error', 'data-binding', `${at}.map`, 'map pairs each item field with a data field.'); return undefined; }
    return items.map((item, i) => {
      const out = {};
      for (const [target, source] of Object.entries(binding.map)) {
        const value = fieldValue(model, ref.kind, entry, source, item, itemDescriptor?.fields?.[target], binding, `${at}.map.${target}`, i ? () => {} : report);
        if (value !== undefined) out[target] = value;
      }
      return out;
    });
  }
  report('error', 'data-binding', at, `A list binding says how each item reads: "map" for objects, or "cells" for rows of text.`);
  return undefined;
}
/** Resolve every binding inside a component's props, using its contract to know what each prop expects. */
export function resolveProps(props, manifest, model, path, report, record) {
  const go = (value, descriptor, at) => {
    if (isBinding(value)) return resolveBinding(model, value, descriptor, at, report, record);
    if (Array.isArray(value)) return value.map((item, i) => go(item, descriptor?.type === 'array' ? descriptor.items : undefined, `${at}[${i}]`));
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, go(item, descriptor?.type === 'object' ? descriptor.fields?.[key] : descriptor?.fields?.[key], `${at}.${key}`)]).filter(([, item]) => item !== undefined));
    return value;
  };
  if (!isObject(props)) return props;
  return Object.fromEntries(Object.entries(props).map(([key, value]) => [key, go(value, manifest?.props?.[key], `${path}.${key}`)]).filter(([, value]) => value !== undefined));
}

/* ---------- Consistency: a literal figure that names data must agree with it ---------- */
/** A day range written in a label: "D0–D30", "0-30 días", "≤ 30 days", "D30". */
export function dayRange(label) {
  const text = normalLabel(label);
  let m = text.match(/\bd\s?(\d+)-d?\s?(\d+)\b/) ?? text.match(/\b(\d+)-(\d+)\s?(d|dias?|days?)\b/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = text.match(/(?:<=|≤|hasta|up to|within|en)\s?d?\s?(\d+)\s?(d|dias?|days?)?\b/) ?? text.match(/\bd0-(\d+)\b/);
  if (m) return [0, Number(m[1])];
  m = text.match(/(?:>|mas de|more than|over)\s?d?\s?(\d+)/);
  if (m) return [Number(m[1]) + 1, Infinity];
  m = text.match(/^d\s?(\d+)$/);
  if (m) return [Number(m[1]), Number(m[1])];
  return null;
}
const close = (a, b, unit) => Math.abs(a - b) <= (unit === 'percent' ? 0.5 : Math.max(0.5, Math.abs(b) * 0.01));
/** Items in a component that pair a label with figures: stats, metrics, columns, segments, points. */
function labelledFigures(props) {
  const out = [];
  for (const [key, list] of Object.entries(props ?? {})) {
    if (!Array.isArray(list)) continue;
    list.forEach((item, i) => {
      if (!isObject(item)) return;
      const label = item.label ?? item.metric ?? item.title;
      if (typeof label !== 'string') return;
      for (const field of ['value', 'share', 'a', 'b']) if (item[field] !== undefined) out.push({ key, index: i, field, label, raw: item[field], figure: parseFigure(item[field]) });
    });
  }
  return out;
}
/** A table, inferred from a table component's cells, when the screen has no data block: what its literals can be checked against. */
export function inferTables(screen) {
  const tables = [];
  const visit = (node, path) => {
    if (!isObject(node)) return;
    if (typeof node.component === 'string' && /table$/.test(node.component) && Array.isArray(node.props?.rows) && Array.isArray(node.props?.columns)) {
      const columns = node.props.columns.map(column => typeof column === 'string' ? column : column?.label ?? '');
      const rows = node.props.rows.filter(Array.isArray);
      const kinds = columns.map((_, c) => {
        const figures = rows.map(row => parseFigure(row[c]));
        if (figures.length && figures.every(f => f?.unit === 'days')) return 'days';
        if (figures.length && figures.every(f => f?.unit === 'percent')) return 'percent';
        if (figures.length && figures.every(f => f?.unit === 'currency')) return 'currency';
        return 'text';
      });
      tables.push({ id: node.id, path, columns, kinds, rows: rows.map(row => row.map((cell, c) => kinds[c] === 'text' ? cell : parseFigure(cell)?.value)) });
    }
    (Array.isArray(node.children) ? node.children : []).forEach((child, i) => visit(child, `${path}.children[${i}]`));
  };
  (Array.isArray(screen?.children) ? screen.children : []).forEach((child, i) => visit(child, `children[${i}]`));
  return tables;
}
/**
 * Check that every literal figure that names data agrees with it. With a data block the data is canonical, so a conflict
 * is an error: the part is not painted. Without one, the runtime can still compare a figure with a table on the same
 * screen; that inference is reported as a warning, because the table might not be what the figure was computed from.
 */
export function checkConsistency(screen, model, report) {
  const figures = [];
  const visit = (node, path, inBinding) => {
    if (!isObject(node)) return;
    if (typeof node.component === 'string' && isObject(node.props)) {
      for (const item of labelledFigures(node.props)) {
        if (item.figure && !isBinding(item.raw)) figures.push({ ...item, nodeId: node.id, path: `${path}.props.${item.key}[${item.index}].${item.field}`, node });
      }
    }
    (Array.isArray(node.children) ? node.children : []).forEach((child, i) => visit(child, `${path}.children[${i}]`, inBinding));
  };
  (Array.isArray(screen?.children) ? screen.children : []).forEach((child, i) => visit(child, `children[${i}]`));
  /* One finding per item: a segment's share and its written value say the same thing. */
  const itemKey = item => item.path.replace(/\.[^.]+$/, '');
  const reported = new Set();
  const once = (item, ...args) => { const key = itemKey(item); if (reported.has(key)) return; reported.add(key); report(...args); };
  figures.sort((a, b) => (a.field === 'share' ? -1 : 0) - (b.field === 'share' ? -1 : 0));
  const shown = (value, unit) => unit === 'percent' ? `${tidy(round(value, 1))}%` : String(tidy(round(value, 2)));
  if (model) {
    /* Every figure the data defines under a label. A literal conflicts only when no figure of that label agrees with it. */
    const byLabel = new Map();
    const add = (label, candidate) => { const key = normalLabel(label); if (!byLabel.has(key)) byLabel.set(key, []); byLabel.get(key).push(candidate); };
    for (const measure of model.measures.values()) if (finite(measure.value)) add(measure.label, { value: () => measure.value, what: `${measure.label}, ${measure.spec.formula ? 'computed from other measures' : `computed from ${model.tables.get(measure.table)?.label ?? 'the data'}`}` });
    for (const group of model.groups.values()) for (const item of group.items) {
      add(item.label, { value: field => field === 'share' ? item.share : field === 'b' ? (group.values[1] ? item[group.values[1]] : undefined) : field === 'a' ? item[group.values[0]] ?? item.value : item.value, what: `${group.label} · ${item.label}, computed from ${model.tables.get(group.table)?.label ?? group.table}` });
    }
    /* Ranges of days, such as "Liquidez D0–D30", are summed straight from the rows. */
    const dayTables = [...model.tables.values()].map(table => ({ table, days: Object.entries(table.fields).find(([, spec]) => spec.type === 'days')?.[0], share: Object.entries(table.fields).find(([, spec]) => spec.type === 'percent' && finite(spec.total))?.[0] })).filter(t => t.days && t.share);
    for (const item of figures) {
      let candidates = (byLabel.get(normalLabel(item.label)) ?? []).map(candidate => ({ expected: candidate.value(item.field), what: candidate.what })).filter(candidate => finite(candidate.expected));
      if (!candidates.length && item.figure.unit === 'percent') {
        const range = dayRange(item.label);
        const source = range && dayTables[0];
        if (source) candidates = [{ expected: tidy(source.table.rows.filter(row => finite(row[source.days]) && row[source.days] >= range[0] && row[source.days] <= range[1]).reduce((a, row) => a + (finite(row[source.share]) ? row[source.share] : 0), 0)), what: `${source.table.label} rows with ${source.table.fields[source.days].label ?? source.days} ${range[1] === Infinity ? `above ${range[0] - 1}` : `from ${range[0]} to ${range[1]}`}` }];
      }
      if (!candidates.length || candidates.some(candidate => close(item.figure.value, candidate.expected, item.figure.unit))) continue;
      const { expected, what } = candidates[0];
      once(item, 'error', 'data-conflict', item.path, `“${item.label}” shows ${shown(item.figure.value, item.figure.unit)}, but the screen data gives ${shown(expected, item.figure.unit)} (${what}). Bind it to the data instead of writing the figure.`);
    }
    return;
  }
  /* No data block: compare figures with a table on the same screen that has a day column and a share column. */
  const tables = inferTables(screen).filter(table => table.kinds.includes('days') && table.kinds.includes('percent'));
  const source = tables[0];
  if (!source) return;
  const d = source.kinds.indexOf('days'), p = source.kinds.indexOf('percent');
  const sum = (lo, hi) => tidy(round(source.rows.filter(row => finite(row[d]) && row[d] >= lo && row[d] <= hi).reduce((a, row) => a + (finite(row[p]) ? row[p] : 0), 0), 2));
  for (const item of figures) {
    if (item.nodeId === source.id || item.figure.unit !== 'percent' && !['a', 'b', 'share'].includes(item.field)) continue;
    const range = dayRange(item.label);
    if (!range) continue;
    const expected = sum(range[0], range[1]);
    if (close(item.figure.value, expected, 'percent')) continue;
    once(item, 'warning', 'data-conflict', item.path, `“${item.label}” shows ${shown(item.figure.value, 'percent')}, but the ${source.columns[p] || 'share'} column of the table on this screen adds up to ${shown(expected, 'percent')} for ${source.columns[d] || 'days'} ${range[1] === Infinity ? `above ${range[0] - 1}` : `${range[0]} to ${range[1]}`}. Put the rows in screen data and bind both to them.`);
  }
}
