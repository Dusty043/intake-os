import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PhaseZeroPacketPanel } from "../PhaseZeroPacketPanel";

describe("PhaseZeroPacketPanel", () => {
  it("offers forced generation after a low-confidence direction is selected", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <PhaseZeroPacketPanel
        confidence={0.72}
        directionSelected={true}
        busy={false}
        onGenerate={onGenerate}
        onDownload={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Generate with current information/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("previews ready documents and downloads the ZIP", async () => {
    const onDownload = vi.fn().mockResolvedValue(undefined);
    render(
      <PhaseZeroPacketPanel
        confidence={0.91}
        directionSelected={true}
        busy={false}
        onGenerate={vi.fn()}
        onDownload={onDownload}
        packet={{
          version: "1.0",
          state: "ready",
          qualityScore: 95,
          assumptions: [],
          warnings: [],
          documents: [{
            id: "summary",
            path: "00 Executive Summary/Executive Summary.md",
            mediaType: "text/markdown",
            status: "generated",
            content: "# Executive Summary",
            evidence: [],
            assumptions: [],
            confidence: 0.91,
            sha256: "hash",
          }],
        }}
      />,
    );
    expect(screen.getByText("# Executive Summary")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Download ZIP/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("offers one improvement pass for ready packets with warnings", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <PhaseZeroPacketPanel
        confidence={0.91}
        directionSelected={true}
        busy={false}
        onGenerate={onGenerate}
        onDownload={vi.fn()}
        packet={{
          version: "1.0",
          state: "ready_with_warnings",
          qualityScore: 46.5,
          assumptions: [],
          warnings: ["Needs more implementation detail."],
          documents: [],
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Improve packet/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });
});
