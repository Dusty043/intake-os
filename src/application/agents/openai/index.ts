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

export function createAllOpenAIEvaluationAgents(apiKey: string, model: string) {
  return [
    new OpenAIIntakeAnalystAgent(apiKey, model),
    new OpenAIClarificationQuestionsAgent(apiKey, model),
    new OpenAIProjectClassifierAgent(apiKey, model),
    new OpenAISolutionsArchitectAgent(apiKey, model),
    new OpenAILowCodePathAgent(apiKey, model),
    new OpenAICustomBuildAgent(apiKey, model),
    new OpenAIRiskSecurityAgent(apiKey, model),
    new OpenAICostEffortAgent(apiKey, model),
    new OpenAIWorkBreakdownAgent(apiKey, model),
    new OpenAIDistributionPlannerAgent(apiKey, model),
    new OpenAIFinalSynthesisAgent(apiKey, model),
    new OpenAICriticQAAgent(apiKey, model),
  ];
}
