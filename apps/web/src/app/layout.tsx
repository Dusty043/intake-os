import type { Metadata } from "next";
import "./globals.css";
import { ActorProvider } from "@/components/ActorProvider";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Project Intake OS",
  description: "Internal pre-distribution control panel for project intake, AI-assisted analysis, approval, and dry-run provisioning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ActorProvider>
          <AppShell>{children}</AppShell>
        </ActorProvider>
      </body>
    </html>
  );
}
