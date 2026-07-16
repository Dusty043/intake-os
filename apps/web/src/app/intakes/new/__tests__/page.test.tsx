import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NewIntakePage from "../page";
import * as apiClient from "@/lib/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api-client", () => ({
  createIntake: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Project Title/), "Test project");
  await user.type(screen.getByLabelText(/Requester/), "Jane");
  await user.type(
    screen.getByLabelText(/Detailed Description/),
    "This description is long enough to pass validation.",
  );
}

describe("NewIntakePage validation", () => {
  it("shows an inline error and blocks submit when description is under the 20-char minimum", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);

    await user.type(screen.getByLabelText(/Project Title/), "Test project");
    await user.type(screen.getByLabelText(/Requester/), "Jane");
    await user.type(screen.getByLabelText(/Detailed Description/), "too short");
    await user.click(screen.getByRole("button", { name: /Create Intake/ }));

    expect(await screen.findByText(/at least 20 characters/i)).toBeInTheDocument();
    expect(apiClient.createIntake).not.toHaveBeenCalled();
  });

  it("submits successfully once all fields meet the validation rules", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.createIntake).mockResolvedValue({ id: "intake-1" } as ReturnType<typeof apiClient.createIntake> extends Promise<infer T> ? T : never);
    render(<NewIntakePage />);

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /Create Intake/ }));

    await waitFor(() => expect(apiClient.createIntake).toHaveBeenCalledTimes(1));
  });

  it("shows a live character counter for the title field", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);
    await user.type(screen.getByLabelText(/Project Title/), "Test project");
    expect(screen.getByText("12/200")).toBeInTheDocument();
  });
});

describe("NewIntakePage unsaved-changes guard", () => {
  it("warns via beforeunload once the form has content", async () => {
    const user = userEvent.setup();
    render(<NewIntakePage />);

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    // Before typing anything, the guard should not fire.
    window.dispatchEvent(event);
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Project Title/), "Test project");

    const event2 = new Event("beforeunload", { cancelable: true });
    const preventDefaultSpy2 = vi.spyOn(event2, "preventDefault");
    window.dispatchEvent(event2);
    expect(preventDefaultSpy2).toHaveBeenCalled();
  });
});
