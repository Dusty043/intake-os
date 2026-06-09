"use client";

import { ACTORS } from "@/lib/actors";
import { useActor } from "./ActorProvider";

export function ActorSelector() {
  const { actor, setActor } = useActor();

  return (
    <div className="px-4 py-3 border-t border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
        Acting as
      </p>
      <select
        value={actor.id}
        onChange={(e) => {
          const found = ACTORS.find((a) => a.id === e.target.value);
          if (found) setActor(found);
        }}
        className="w-full bg-slate-800 text-slate-100 text-sm rounded-md px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Select actor role"
      >
        {ACTORS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.role})
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 mt-1.5 leading-tight">
        Controls API permission headers.
      </p>
    </div>
  );
}
