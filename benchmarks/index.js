/**
 * The benchmark scenarios, and how a composed screen carries its plan. Browser and Node alike: nothing here reads files.
 *
 * The plan in each intent-aware screen is not written by hand: it is planScreen()'s plan for the scenario's brief, with
 * the node ids that show each piece of information added. Changing the policy changes the plan the screen is checked
 * against, so a screen cannot pass with a plan tailored to it.
 */
import { planScreen } from '../ir-plan.js';
import { wealth } from './wealth.js';
import { support } from './support.js';
import { logistics } from './logistics.js';

export const scenarios = [...wealth, ...support, ...logistics];
export const products = [...new Set(scenarios.map(item => item.product))];

/**
 * The plan for a scenario's brief, with the intent-aware screen's node ids for each piece of information and the primary
 * action. With nodes: false, the plan alone: what a baseline screen, which has no mapping, is checked against.
 */
export function planFor(scenario, policy, { nodes: withNodes = true, ...options } = {}) {
  const { plan, status, cues } = planScreen(scenario.brief, policy, options);
  if (!withNodes) return { plan, status, cues };
  const nodes = scenario.intent?.nodes ?? {};
  const informationPriority = plan.informationPriority.map(item => nodes[item.id] ? { ...item, nodes: nodes[item.id] } : item);
  const actions = plan.actions?.primary && scenario.intent?.actionNode ? { ...plan.actions, primary: { ...plan.actions.primary, node: scenario.intent.actionNode } } : plan.actions;
  return { plan: { ...plan, informationPriority, actions }, status, cues };
}

/** One condition of a scenario as a screen: the baseline as composed, or the intent-aware screen with its plan in meta.plan. */
export function screenFor(scenario, condition, policy) {
  if (condition === 'baseline') return structuredClone(scenario.baseline.spec);
  const spec = structuredClone(scenario.intent.spec);
  spec.meta = { ...(spec.meta ?? {}), plan: planFor(scenario, policy).plan };
  return spec;
}
