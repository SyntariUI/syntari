import { FIXTURES, fixtureAnswers } from "../tests/fixtures.mjs";
import { buildUiPlan } from "./policy.mjs";

for (const fixture of FIXTURES) {
  const plan = buildUiPlan(fixtureAnswers(fixture));
  console.log("\n" + fixture.name);
  console.log(JSON.stringify(plan, null, 2));
}
