"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { ACTOR_STORAGE_KEY, ACTORS, DEFAULT_ACTOR } from "@/lib/actors";
import type { UiActor } from "@/lib/types";

type ActorContextValue = {
  actor: UiActor;
  setActor: (a: UiActor) => void;
};

const ActorContext = createContext<ActorContextValue>({
  actor: DEFAULT_ACTOR,
  setActor: () => undefined,
});

export function ActorProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActorState] = useState<UiActor>(() => {
    // Synchronous read so children see the correct actor on first render.
    // Guard for SSR — localStorage is unavailable on the server.
    if (typeof window === "undefined") return DEFAULT_ACTOR;
    try {
      const raw = localStorage.getItem(ACTOR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UiActor;
        const valid = ACTORS.find((a) => a.id === parsed.id);
        if (valid) return valid;
      }
    } catch {
      // keep default
    }
    return DEFAULT_ACTOR;
  });

  const setActor = useCallback((a: UiActor) => {
    setActorState(a);
    try {
      localStorage.setItem(ACTOR_STORAGE_KEY, JSON.stringify(a));
    } catch {
      // ignore storage errors
    }
  }, []);

  return (
    <ActorContext.Provider value={{ actor, setActor }}>
      {children}
    </ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  return useContext(ActorContext);
}
