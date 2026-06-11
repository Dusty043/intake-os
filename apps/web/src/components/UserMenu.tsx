"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  intake_owner: "Intake Owner",
  devops_lead: "DevOps Lead",
  developer: "Developer",
  request_creator: "Requester",
};

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="px-4 py-3 border-t border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
        Signed in
      </p>
      <div className="mb-2">
        <p className="text-sm text-slate-100 font-medium truncate">{user.name}</p>
        <p className="text-xs text-slate-400 truncate">{user.email}</p>
        <span className="inline-block mt-1 text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded">
          {roleLabel}
        </span>
      </div>
      <button
        onClick={() => void handleLogout()}
        className="w-full text-left text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        Sign out →
      </button>
    </div>
  );
}
