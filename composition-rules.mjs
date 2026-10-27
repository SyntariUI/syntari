/**
 * Composition rules for a project that installs Syntari components as source: generated from the composition policy, so
 * they never drift from what plan_screen, assess_composition, and lint_markup apply. `syntari rules` prints them, and
 * every installation carries them at runtime/COMPOSITION.md for an agent working in that project to read.
 */
export function compositionRules(policy, version) {
  const lines = [];
  const push = (...items) => lines.push(...items);
  push(`# Syntari composition rules`, '', `Generated from Syntari ${version}'s composition policy. Read this before composing a screen with Syntari components; it is the same policy the Screen IR renderer enforces.`, '');
  push('## Before choosing components', '',
    '1. Write a brief: who uses the screen, the job they come to do (one of ' + Object.keys(policy.jobs).join(', ') + '), the decisions they make, each piece of information with its kind and the decisions it informs, and the actions.',
    '2. Get a plan: `npx syntari plan --brief brief.json --json`, or the MCP tool `plan_screen`. It returns the archetype, the priority and disclosure of each piece of information, the layout, candidate components, and what to avoid. A plan with status `needs-context` lists the questions to ask.',
    '3. Compose from the plan’s zones, in their order. Information marked primary is visible and first; reference is collapsed or one step away; exceptions appear only while present.',
    '4. Check: in Screen IR, `validate_screen` and `assess_composition` with the plan in `meta.plan`. In your own markup, `npx syntari lint-markup <files> --plan plan.json`: it reads markup as text, so it cannot see layout or runtime state, and passing it is not validation.', '');
  push('## Archetypes', '');
  for (const [id, archetype] of Object.entries(policy.archetypes)) {
    push(`### ${archetype.label} (\`${id}\`)`, '', `${archetype.goal} Serves: ${archetype.jobs.join(', ')}.`, '');
    push(...archetype.useWhen.map(item => `- Use when: ${item}`), ...archetype.contraindications.map(item => `- Not when: ${item}`));
    push(`- Order: ${archetype.zones.map(zone => `${zone.label} (${zone.priority}, ${zone.disclosure})`).join(' → ')}.`);
    push(...archetype.avoid.map(item => `- Avoid \`${item.id}\`: ${item.reason}`), '');
  }
  push('## Information', '', ...Object.entries(policy.information.priorities).map(([id, means]) => `- **${id}**: ${means}`), '', ...Object.entries(policy.information.disclosures).map(([id, means]) => `- **${id}**: ${means}`), '', ...policy.information.rules.map(rule => `- ${rule}`), '');
  push('## Surfaces and dividers', '', policy.surfaces.description, '', ...Object.entries(policy.surfaces.kinds).map(([id, kind]) => `- **${id}**: ${kind.means} Reason: ${kind.reason}`), '', ...policy.surfaces.rules.map(rule => `- ${rule}`), '', policy.dividers.description, '', ...policy.dividers.rules.map(rule => `- ${rule}`), '');
  push('## What the linters report', '', policy.lint.description, '', '| Rule | Severity | Means |', '| --- | --- | --- |', ...Object.entries(policy.lint.rules).map(([id, rule]) => `| \`${id}\` | ${rule.severity} | ${rule.means} |`), '');
  return lines.join('\n');
}
