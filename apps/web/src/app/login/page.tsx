"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getGoogleLoginUrl } from "@/lib/auth-client";

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Sign-in failed. Please try again.",
  not_allowed: "Your account is not allowed to access this application.",
  invalid_state: "Invalid login state. Please try again.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-canvas">
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { authenticated, authMode, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (!isLoading && authenticated) {
      router.replace("/intakes");
    }
  }, [isLoading, authenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  const errorMessage =
    error && ERROR_MESSAGES[error]
      ? ERROR_MESSAGES[error]
      : reason
        ? `Sign-in failed: ${reason}`
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm rounded-xl bg-sidebar border border-slate-700 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">
            Project Intake OS
          </p>
          <h1 className="text-2xl font-bold text-slate-100">Sign in</h1>
          <p className="text-sm text-slate-400 mt-1">Operational Control Panel</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3">
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        )}

        {authMode === "google" ? (
          <a
            href={getGoogleLoginUrl()}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow hover:bg-slate-100 transition-colors"
          >
            <GoogleIcon />
            Sign in with Google
          </a>
        ) : (
          <div className="rounded-lg bg-slate-800 border border-slate-600 px-4 py-3">
            <p className="text-xs text-slate-400 text-center">
              Dev mode — auth headers active. No sign-in required.
            </p>
            <a
              href="/intakes"
              className="mt-3 flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Continue to Intakes
            </a>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Auth mode: <span className="text-slate-400">{authMode}</span>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
