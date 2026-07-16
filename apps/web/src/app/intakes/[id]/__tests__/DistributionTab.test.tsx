import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DistributionTab } from "../DistributionTab";
import * as apiClient from "@/lib/api-client";
import type { ProjectIntakeRecord, UiActor } from "@/lib/types";

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof apiClient>("@/lib/api-client");
  return {
    ...actual,
    executeDistribution: vi.fn(),
    getIntake: vi.fn(),
    listProvisioningRuns: vi.fn(),
  };
});

const actor: UiActor = { id: "u1", role: "request_creator", name: "Test User" };

const intake: ProjectIntakeRecord = {
  id: "intake-1",
  title: "Test intake",
  status: "approved",
  provisioningPlan: { id: "plan-1", status: "ready_for_provisioning" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.listProvisioningRuns).mockResolvedValue([]);
});

describe("DistributionTab", () => {
  it("calls onSuccess with a message once distribution executes successfully", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.executeDistribution).mockResolvedValue({
      id: "run-1",
      intakeId: "intake-1",
      planId: "plan-1",
      status: "executing",
      kind: "initial",
      triggeredById: "u1",
      triggeredByRole: "request_creator",
      startedAt: new Date(0).toISOString(),
      targets: [],
    });
    vi.mocked(apiClient.getIntake).mockResolvedValue({ ...intake, status: "provisioning" });

    const onSuccess = vi.fn();
    render(
      <DistributionTab
        intake={intake}
        actor={actor}
        onIntakeUpdate={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /Execute Distribution/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/executing/i)));
  });
});
