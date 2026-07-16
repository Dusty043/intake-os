"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActor } from "@/components/ActorProvider";
import { ErrorBanner } from "@/components/ErrorBanner";
import { createIntake } from "@/lib/api-client";
import type { CreateIntakeInput } from "@/lib/types";
import { PROJECT_TYPES } from "@/lib/project-types";
import {
  validateIntakeForm,
  MAX_INTAKE_TITLE_LENGTH,
  MIN_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
  type IntakeFormErrors,
} from "@/lib/intake-form-validation";

export default function NewIntakePage() {
  const { actor } = useActor();
  const router = useRouter();

  const [form, setForm] = useState<CreateIntakeInput>({
    title: "",
    description: "",
    requester: "",
    department: "",
    projectType: "internal_tool",
  });
  const [errors, setErrors] = useState<IntakeFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof CreateIntakeInput, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateIntakeForm(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      const intake = await createIntake(form, actor);
      router.push(`/intakes/${intake.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intake.");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-5">
        <Link href="/intakes" className="hover:text-indigo-600">Intakes</Link>
        <span className="mx-2">/</span>
        <span className="text-brand-text font-medium">New Intake</span>
      </nav>

      {/* Workflow preview */}
      <div className="card p-4 mb-6 bg-surface-subtle border-indigo-100">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
          Workflow
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          {["Submission", "AI Draft", "Human Review", "Gate 1", "Gate 2", "Distribution Preview"].map(
            (s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                  {s}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-brand-text">New Intake Request</h1>
          <p className="text-sm text-brand-muted mt-1">
            Use this form to initiate a new project intake. Include enough context for analysis and review.
          </p>
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-5 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="title" className="form-label">Project Title *</label>
              <span className="text-xs text-gray-400">{form.title.length}/{MAX_INTAKE_TITLE_LENGTH}</span>
            </div>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="form-input"
              placeholder="e.g. Client Billing Portal"
              maxLength={MAX_INTAKE_TITLE_LENGTH}
              required
              disabled={loading}
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="projectType" className="form-label">Project Type</label>
              <select
                id="projectType"
                value={form.projectType}
                onChange={(e) => set("projectType", e.target.value)}
                className="form-input"
                disabled={loading}
              >
                {PROJECT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="requester" className="form-label">Requester *</label>
                <span className="text-xs text-gray-400">{form.requester.length}/{MAX_REQUESTER_NAME_LENGTH}</span>
              </div>
              <input
                id="requester"
                type="text"
                value={form.requester}
                onChange={(e) => set("requester", e.target.value)}
                className="form-input"
                placeholder="Team or person"
                maxLength={MAX_REQUESTER_NAME_LENGTH}
                required
                disabled={loading}
                aria-invalid={!!errors.requester}
              />
              {errors.requester && <p className="text-xs text-red-600 mt-1">{errors.requester}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="department" className="form-label">Department</label>
              <span className="text-xs text-gray-400">{(form.department ?? "").length}/{MAX_DEPARTMENT_NAME_LENGTH}</span>
            </div>
            <input
              id="department"
              type="text"
              value={form.department ?? ""}
              onChange={(e) => set("department", e.target.value)}
              className="form-input"
              placeholder="e.g. Finance"
              maxLength={MAX_DEPARTMENT_NAME_LENGTH}
              disabled={loading}
              aria-invalid={!!errors.department}
            />
            {errors.department && <p className="text-xs text-red-600 mt-1">{errors.department}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="description" className="form-label">Detailed Description *</label>
              <span className="text-xs text-gray-400">{form.description.length}/{MAX_INTAKE_DESCRIPTION_LENGTH}</span>
            </div>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="form-textarea h-32"
              placeholder="Describe the project goals, context, and requirements…"
              maxLength={MAX_INTAKE_DESCRIPTION_LENGTH}
              required
              disabled={loading}
              aria-invalid={!!errors.description}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum {MIN_INTAKE_DESCRIPTION_LENGTH} characters.</p>
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating intake…" : "Create Intake"}
            </button>
            <Link href="/intakes" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
