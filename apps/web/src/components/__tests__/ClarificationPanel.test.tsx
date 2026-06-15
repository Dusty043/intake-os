import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClarificationPanel } from "../ClarificationPanel";
import type { PendingClarificationQuestion } from "@/lib/types";

const REQ: PendingClarificationQuestion = {
  id: "q1",
  question: "What is the scope?",
  required: true,
};

const OPT: PendingClarificationQuestion = {
  id: "q2",
  question: "Any extra context?",
  required: false,
};

describe("ClarificationPanel", () => {
  it("renders required and optional questions", () => {
    render(
      <ClarificationPanel
        questions={[REQ, OPT]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/What is the scope/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/optional/i)).toBeInTheDocument();
  });

  it("disables submit when required field is empty", () => {
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Resubmit/i })).toBeDisabled();
  });

  it("marks required textarea with aria-required", () => {
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-required");
  });

  it("shows inline error after blurring an empty required field", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    await user.click(screen.getByRole("textbox"));
    await user.tab();
    expect(screen.getByText("This answer is required.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid");
  });

  it("enables submit and calls onResubmit with correct args when required field filled", async () => {
    const user = userEvent.setup();
    const onResubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={onResubmit}
      />
    );
    await user.type(screen.getByRole("textbox"), "My answer");
    const btn = screen.getByRole("button", { name: /Resubmit/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    await waitFor(() =>
      expect(onResubmit).toHaveBeenCalledWith([
        { question: "What is the scope?", answer: "My answer" },
      ])
    );
  });

  it("shows success banner after resubmit resolves", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );
    await user.type(screen.getByRole("textbox"), "My answer");
    await user.click(screen.getByRole("button", { name: /Resubmit/i }));
    await waitFor(() =>
      expect(screen.getByText(/Resubmitted successfully/i)).toBeInTheDocument()
    );
  });

  it("shows error banner when onResubmit rejects", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn().mockRejectedValue(new Error("Server error"))}
      />
    );
    await user.type(screen.getByRole("textbox"), "My answer");
    await user.click(screen.getByRole("button", { name: /Resubmit/i }));
    await waitFor(() =>
      expect(screen.getByText("Server error")).toBeInTheDocument()
    );
  });

  it("prevents double submit via submittingRef", async () => {
    const user = userEvent.setup();
    let resolveFirst!: () => void;
    const onResubmit = vi.fn().mockImplementation(
      () => new Promise<void>((r) => { resolveFirst = r; })
    );
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={onResubmit}
      />
    );
    await user.type(screen.getByRole("textbox"), "My answer");
    const btn = screen.getByRole("button", { name: /Resubmit/i });
    // First click starts the async submit (submittingRef = true)
    await user.click(btn);
    // Second click hits the guard
    await user.click(btn);
    resolveFirst();
    await waitFor(() => expect(onResubmit).toHaveBeenCalledTimes(1));
  });

  it("resets form state when questions prop changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    await user.type(screen.getByRole("textbox"), "My answer");
    expect(screen.getByRole("textbox")).toHaveValue("My answer");

    const newQ: PendingClarificationQuestion = {
      id: "q99",
      question: "Completely new question?",
      required: true,
    };
    rerender(
      <ClarificationPanel
        questions={[newQ]}
        missingFields={[]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("renders prior clarifications when provided", () => {
    render(
      <ClarificationPanel
        questions={[REQ]}
        missingFields={[]}
        priorClarifications={[{ question: "Old question", answer: "Old answer" }]}
        busy={false}
        onResubmit={vi.fn()}
      />
    );
    expect(screen.getByText("Old question")).toBeInTheDocument();
    expect(screen.getByText(/Old answer/)).toBeInTheDocument();
  });
});
