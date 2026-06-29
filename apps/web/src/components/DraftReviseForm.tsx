"use client";

import { useState } from "react";
import { formatProjectType } from "@/lib/formatting";

type ProjectType =
  | "n8n_automation" | "data_sync_integration" | "internal_dashboard"
  | "internal_tool" | "client_portal" | "saas_platform" | "api_service"
  | "ai_workflow_tool" | "discovery_research" | "reporting_automation";

const PROJECT_TYPES: ProjectType[] = [
  "internal_tool", "internal_dashboard", "api_service", "client_portal",
  "saas_platform", "n8n_automation", "data_sync_integration",
  "ai_workflow_tool", "discovery_research", "reporting_automation",
];

export interface DraftReviseValues {
  projectType: ProjectType;
  complexity: "low" | "medium" | "high";
  estimatedStoryPoints: number;
  brief: {
    problem: string;
    solution: string;
    scope: string[];
    outOfScope: string[];
  };
  subtasks: { title: string; description: string; storyPoints: number }[];
  recommendedTechStack: string[];
  infrastructureRequirements: string[];
  missingInformation: string[];
  reviewerNotes: string;
}

interface Props {
  initialValues: Omit<DraftReviseValues, "reviewerNotes">;
  busy: boolean;
  onSave: (values: DraftReviseValues) => void;
  onCancel: () => void;
}

function lines(arr: readonly string[]): string {
  return arr.join("\n");
}

function parseLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function DraftReviseForm({ initialValues: init, busy, onSave, onCancel }: Props) {
  const [projectType, setProjectType] = useState<ProjectType>(init.projectType);
  const [complexity, setComplexity] = useState(init.complexity);
  const [storyPoints, setStoryPoints] = useState(String(init.estimatedStoryPoints));
  const [problem, setProblem] = useState(init.brief.problem ?? "");
  const [solution, setSolution] = useState(init.brief.solution ?? "");
  const [scope, setScope] = useState(lines(init.brief.scope ?? []));
  const [outOfScope, setOutOfScope] = useState(lines(init.brief.outOfScope ?? []));
  const [techStack, setTechStack] = useState(lines(init.recommendedTechStack ?? []));
  const [infraNeeds, setInfraNeeds] = useState(lines(init.infrastructureRequirements ?? []));
  const [missingInfo, setMissingInfo] = useState(lines(init.missingInformation ?? []));
  const [subtasks, setSubtasks] = useState(
    (init.subtasks ?? []).map((t) => ({ ...t, storyPoints: String(t.storyPoints) }))
  );
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [validationErr, setValidationErr] = useState<string | null>(null);

  function addSubtask() {
    setSubtasks((prev) => [...prev, { title: "", description: "", storyPoints: "1" }]);
  }

  function removeSubtask(i: number) {
    setSubtasks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSubtask(i: number, field: "title" | "description" | "storyPoints", value: string) {
    setSubtasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function handleSave() {
    const sp = parseInt(storyPoints, 10);
    if (!reviewerNotes.trim()) {
      setValidationErr("Reviewer notes are required when saving a revised package.");
      return;
    }
    if (isNaN(sp) || sp < 1) {
      setValidationErr("Story points must be a positive number.");
      return;
    }
    setValidationErr(null);

    onSave({
      projectType,
      complexity,
      estimatedStoryPoints: sp,
      brief: {
        problem,
        solution,
        scope: parseLines(scope),
        outOfScope: parseLines(outOfScope),
      },
      subtasks: subtasks.map((t) => ({
        title: t.title,
        description: t.description,
        storyPoints: parseInt(t.storyPoints, 10) || 1,
      })),
      recommendedTechStack: parseLines(techStack),
      infrastructureRequirements: parseLines(infraNeeds),
      missingInformation: parseLines(missingInfo),
      reviewerNotes,
    });
  }

  return (
    <div className="space-y-5 pt-3">
      {/* Classification */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="form-label">Project Type</label>
          <select
            className="form-input"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as ProjectType)}
          >
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{formatProjectType(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Complexity</label>
          <select
            className="form-input"
            value={complexity}
            onChange={(e) => setComplexity(e.target.value as "low" | "medium" | "high")}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="form-label">Est. Story Points</label>
          <input
            type="number"
            min={1}
            className="form-input"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
          />
        </div>
      </div>

      {/* Brief */}
      <div className="space-y-3">
        <p className="section-label">Brief</p>
        <div>
          <label className="form-label">Problem</label>
          <textarea
            className="form-textarea h-16"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What problem does this project solve?"
          />
        </div>
        <div>
          <label className="form-label">Solution</label>
          <textarea
            className="form-textarea h-16"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="What is the proposed solution?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">In Scope <span className="font-normal text-gray-400">(one item per line)</span></label>
            <textarea
              className="form-textarea h-24"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder={"User authentication\nDashboard view\nEmail notifications"}
            />
          </div>
          <div>
            <label className="form-label">Out of Scope <span className="font-normal text-gray-400">(one item per line)</span></label>
            <textarea
              className="form-textarea h-24"
              value={outOfScope}
              onChange={(e) => setOutOfScope(e.target.value)}
              placeholder={"Mobile app\nThird-party integrations"}
            />
          </div>
        </div>
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Subtasks</p>
          <button type="button" className="btn-secondary text-xs py-1 px-2.5" onClick={addSubtask}>
            + Add subtask
          </button>
        </div>
        {subtasks.length === 0 && (
          <p className="text-xs text-gray-500 py-2">No subtasks. Add one above.</p>
        )}
        <div className="space-y-2">
          {subtasks.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-start bg-gray-50 rounded-lg px-3 py-2">
              <div>
                {i === 0 && <p className="text-xs text-gray-500 mb-1">Title</p>}
                <input
                  className="form-input text-sm"
                  value={t.title}
                  onChange={(e) => updateSubtask(i, "title", e.target.value)}
                  placeholder="Subtask title"
                />
              </div>
              <div>
                {i === 0 && <p className="text-xs text-gray-500 mb-1">Description</p>}
                <input
                  className="form-input text-sm"
                  value={t.description}
                  onChange={(e) => updateSubtask(i, "description", e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div>
                {i === 0 && <p className="text-xs text-gray-500 mb-1">SP</p>}
                <input
                  type="number"
                  min={1}
                  className="form-input text-sm"
                  value={t.storyPoints}
                  onChange={(e) => updateSubtask(i, "storyPoints", e.target.value)}
                />
              </div>
              <div className={i === 0 ? "mt-5" : ""}>
                <button
                  type="button"
                  onClick={() => removeSubtask(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                  aria-label="Remove subtask"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech + Infra */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Recommended Tech Stack <span className="font-normal text-gray-400">(one per line)</span></label>
          <textarea
            className="form-textarea h-20"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            placeholder={"Next.js\nPostgreSQL\nTailwind CSS"}
          />
        </div>
        <div>
          <label className="form-label">Infrastructure Needs <span className="font-normal text-gray-400">(one per line)</span></label>
          <textarea
            className="form-textarea h-20"
            value={infraNeeds}
            onChange={(e) => setInfraNeeds(e.target.value)}
            placeholder={"Postgres container\nS3 bucket"}
          />
        </div>
      </div>

      {/* Missing info */}
      <div>
        <label className="form-label">Missing Information <span className="font-normal text-gray-400">(one per line)</span></label>
        <textarea
          className="form-textarea h-16"
          value={missingInfo}
          onChange={(e) => setMissingInfo(e.target.value)}
          placeholder={"Budget not confirmed\nDesign assets pending"}
        />
      </div>

      {/* Reviewer notes — required */}
      <div>
        <label className="form-label">
          Reviewer Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          className="form-textarea h-16"
          value={reviewerNotes}
          onChange={(e) => { setReviewerNotes(e.target.value); setValidationErr(null); }}
          placeholder="Describe what you changed and why…"
        />
      </div>

      {validationErr && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{validationErr}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-primary" disabled={busy} onClick={handleSave}>
          {busy ? "Saving reviewed package…" : "Save Reviewed Package"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
