"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  const [actor, setActorState] = useState<UiActor>(DEFAULT_ACTOR);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTOR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UiActor;
        const valid = ACTORS.find((a) => a.id === parsed.id);
        if (valid) setActorState(valid);
      }
    } catch {
      // keep default
    }
  }, []);

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
