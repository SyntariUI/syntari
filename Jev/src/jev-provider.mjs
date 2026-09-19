import { TypeSafeClient } from "@typesafe-ai/sdk";
import { makeQuestions } from "./questions.mjs";

export class JevDecisionProvider {
  constructor({ apiKey, model, client, timeout = 10000 } = {}) {
    const config = { timeout };
    if (apiKey) config.apiKey = apiKey;
    if (model) config.defaultModel = model;

    this.client = client ?? new TypeSafeClient(config);
    this.model = model;
  }

  async decide({ state }) {
    const request = {
      state,
      questions: makeQuestions()
    };

    if (this.model) request.model = this.model;

    return this.client.systemOne(request);
  }
}
