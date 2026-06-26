"use client";

type Props = {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
};

export function DiscoveryLayout({ left, center, right }: Props) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — Timeline */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
        {left}
      </aside>

      {/* Center — Conversation (grows, scrollable internally) */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col border-r border-gray-200 bg-white">
        {center}
      </div>

      {/* Right — AI Understanding */}
      <aside className="w-72 shrink-0 bg-gray-50 overflow-hidden flex flex-col">
        {right}
      </aside>
    </div>
  );
}
