"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticated, authMode, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && authMode === "google" && !authenticated) {
      router.replace("/login");
    }
  }, [isLoading, authMode, authenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (authMode === "google" && !authenticated) {
    return null;
  }

  return <>{children}</>;
}
