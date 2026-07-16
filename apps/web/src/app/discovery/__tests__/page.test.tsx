import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DiscoveryListPage from "../page";
import type { DiscoverySession } from "@/lib/discovery-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const CONFIDENCE = {
  problemUnderstanding: 1,
  solutionFit: 1,
  scopeClarity: 1,
  technicalFeasibility: 1,
  stakeholderClarity: 1,
  downstreamMapping: 1,
};

function makeSession(overrides: Partial<DiscoverySession>): DiscoverySession {
  return {
    id: "sess-1",
    userId: "actor-1",
    status: "sent_to_evaluation",
    messages: [],
    timeline: [],
    intent: null,
    problemFrame: null,
    solutionOptions: [],
    clarificationQuestions: [],
    selectedSolutionId: null,
    proposal: null,
    manifest: null,
    confidence: CONFIDENCE,
    ...overrides,
  };
}

vi.mock("@/lib/discovery-client", () => ({
  listDiscoverySessions: vi.fn(),
  startDiscovery: vi.fn(),
  generateSolutions: vi.fn(),
}));

import * as discoveryClient from "@/lib/discovery-client";

describe("DiscoveryListPage", () => {
  it("shows the 'View intake →' link from session.linkedIntakeId, not localStorage", async () => {
    vi.mocked(discoveryClient.listDiscoverySessions).mockResolvedValue([
      makeSession({ linkedIntakeId: "intake-42" }),
    ]);
    // Deliberately do not touch localStorage — the old bug required this key to
    // be set for the link to appear; the fix must not depend on it.

    render(<DiscoveryListPage />);

    const link = await screen.findByRole("link", { name: /View intake/i });
    expect(link).toHaveAttribute("href", "/intakes/intake-42");
  });

  it("does not show the link when linkedIntakeId is absent", async () => {
    vi.mocked(discoveryClient.listDiscoverySessions).mockResolvedValue([
      makeSession({ linkedIntakeId: undefined }),
    ]);

    render(<DiscoveryListPage />);

    await screen.findAllByText(/sess-1/i);
    expect(screen.queryByRole("link", { name: /View intake/i })).not.toBeInTheDocument();
  });
});
