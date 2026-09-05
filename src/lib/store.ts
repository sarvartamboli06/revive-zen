import { useSyncExternalStore } from "react";
import { getState, subscribe, type AppState } from "@/lib/api";

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useCase(id: string) {
  const state = useAppState();
  return state.cases.find((c) => c.id === id);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCompactINR(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}
