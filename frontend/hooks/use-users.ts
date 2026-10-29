"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { usersApi } from "@/lib/api";
import { useSession } from "@/store/session";

export function useUsers(query: string, enabled = true) {
  const token = useSession((state) => state.token);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["users", debounced],
    queryFn: () => usersApi.search(token as string, debounced),
    enabled: Boolean(token) && enabled,
    staleTime: 15_000,
  });
}
