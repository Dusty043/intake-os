import type { LlmClient } from "../../llm-client.js";
import { OpenAIIntakeAnalystAgent } from "./openai-intake-analyst-agent.js";
import { OpenAIClarificationQuestionsAgent } from "./openai-clarification-questions-agent.js";
import { OpenAIProjectClassifierAgent } from "./openai-project-classifier-agent.js";
import { OpenAISolutionsArchitectAgent } from "./openai-solutions-architect-agent.js";
import { OpenAILowCodePathAgent } from "./openai-low-code-path-agent.js";
import { OpenAICustomBuildAgent } from "./openai-custom-build-agent.js";
import { OpenAIRiskSecurityAgent } from "./openai-risk-security-agent.js";
import { OpenAICostEffortAgent } from "./openai-cost-effort-agent.js";
import { OpenAIWorkBreakdownAgent } from "./openai-work-breakdown-agent.js";
import { OpenAIDistributionPlannerAgent } from "./openai-distribution-planner-agent.js";
import { OpenAIFinalSynthesisAgent } from "./openai-final-synthesis-agent.js";
import { OpenAICriticQAAgent } from "./openai-critic-qa-agent.js";

export {
  OpenAIIntakeAnalystAgent,
  OpenAIClarificationQuestionsAgent,
  OpenAIProjectClassifierAgent,
  OpenAISolutionsArchitectAgent,
  OpenAILowCodePathAgent,
  OpenAICustomBuildAgent,
  OpenAIRiskSecurityAgent,
  OpenAICostEffortAgent,
  OpenAIWorkBreakdownAgent,
  OpenAIDistributionPlannerAgent,
  OpenAIFinalSynthesisAgent,
  OpenAICriticQAAgent,
};

export function createAllEvaluationAgents(client: LlmClient, model: string) {
  return [
    new OpenAIIntakeAnalystAgent(client, model),
    new OpenAIClarificationQuestionsAgent(client, model),
    new OpenAIProjectClassifierAgent(client, model),
    new OpenAISolutionsArchitectAgent(client, model),
    new OpenAILowCodePathAgent(client, model),
    new OpenAICustomBuildAgent(client, model),
    new OpenAIRiskSecurityAgent(client, model),
    new OpenAICostEffortAgent(client, model),
    new OpenAIWorkBreakdownAgent(client, model),
    new OpenAIDistributionPlannerAgent(client, model),
    new OpenAIFinalSynthesisAgent(client, model),
    new OpenAICriticQAAgent(client, model),
  ];
}
