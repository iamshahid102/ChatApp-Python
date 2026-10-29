import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { UserPublic } from "@/types/api";

interface SessionState {
  token: string | null;
  user: UserPublic | null;
  setSession: (token: string, user: UserPublic) => void;
  setUser: (user: UserPublic) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    {
      name: "chatapp.session",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
