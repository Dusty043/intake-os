"use client";

import { usePathname } from "next/navigation";
import { ActorProvider } from "./ActorProvider";
import { AppShell } from "./AppShell";
import { AuthGate } from "./AuthGate";

const PUBLIC_PATHS = ["/login"];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <ActorProvider>
        <AppShell>{children}</AppShell>
      </ActorProvider>
    </AuthGate>
  );
}
