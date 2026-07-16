import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscoveryChat } from "../DiscoveryChat";

const CONFIDENCE = {
  problemUnderstanding: 1,
  solutionFit: 1,
  scopeClarity: 1,
  technicalFeasibility: 1,
  stakeholderClarity: 1,
  downstreamMapping: 1,
};

const BASE_PROPS = {
  messages: [],
  clarificationQuestions: [],
  confidence: CONFIDENCE,
  proposal: null,
  manifest: null,
  discoveryStatus: "conversation_started" as const,
  onSendMessage: vi.fn(),
  onAnswerClarification: vi.fn(),
  onSkipClarifications: vi.fn(),
  onSendToEvaluation: vi.fn(),
};

describe("DiscoveryChat streaming status announcement", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  it("renders the busy stage text inside a persistent aria-live region", () => {
    render(
      <DiscoveryChat
        {...BASE_PROPS}
        busy={true}
        activeStages={new Set(["intent_extraction"])}
      />,
    );
    const region = screen.getByText(/Understanding your request/i).closest('[aria-live]');
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the aria-live region mounted (not conditionally rendered) even when not busy", () => {
    const { container } = render(
      <DiscoveryChat {...BASE_PROPS} busy={false} activeStages={new Set()} />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
