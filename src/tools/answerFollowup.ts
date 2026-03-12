import { z } from "zod";
import { ScenarioEngine } from "../services/scenarioEngine.js";

export const answerFollowupSchema = z.object({
  analysis_id: z.string().min(1),
  question: z.string().min(1),
});

export type AnswerFollowupInput = z.infer<typeof answerFollowupSchema>;

export function createAnswerFollowupTool(scenarioEngine: ScenarioEngine) {
  return async function answerFollowup(input: AnswerFollowupInput) {
    const parsed = answerFollowupSchema.parse(input);
    return scenarioEngine.answerFollowup(parsed.analysis_id, parsed.question);
  };
}
