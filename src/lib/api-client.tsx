// Local replacement for the missing "@workspace/api-client-react" package.
// Talks to whatever REST API you point it at via VITE_API_BASE_URL
// (e.g. a Flask/FastAPI server running on the Raspberry Pi, or a
// Cloudflare Tunnel URL pointing at it).
//
// Expected backend endpoints:
//   GET    /api/dashboard/summary        -> DashboardSummary
//   GET    /api/trees                    -> Tree[]
//   GET    /api/trees/alerts             -> Tree[] (only trees with alertActive)
//   POST   /api/trees            {name}  -> Tree
//   GET    /api/trees/:id                -> Tree
//   PATCH  /api/trees/:id        {name}  -> Tree
//   DELETE /api/trees/:id                -> {}
//   GET    /api/trees/:id/readings       -> Reading[]

import { useQuery, useMutation, type UseMutationResult } from "@tanstack/react-query";
import { getToken, setToken, clearToken } from "@/lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Photo URLs from the backend are relative (e.g. "/uploads/xxx.jpg"),
// meant to be combined with the Pi's API address, not the frontend's.
export function resolvePhotoUrl(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl) return undefined;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;
  return `${BASE_URL}${photoUrl}`;
}

export interface Reading {
  id: number;
  timestamp: string;
  moistureValue: number;
  soilStatus: string;
  soilMessage?: string;
  tempC?: number;
  pressureHpa?: number;
  plantStatus?: "healthy" | "stressed" | "uncertain";
  plantMessage?: string;
  photoUrl?: string;
}

export interface Tree {
  id: number;
  name: string;
  createdAt: string;
  alertActive: boolean;
  latestReading?: Reading;
}

export interface DashboardSummary {
  totalTrees: number;
  healthyCount: number;
  stressedCount: number;
  alertCount: number;
  lastSyncAt?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401 && path !== "/api/auth/login") {
    clearToken();
    window.location.href = `${import.meta.env.BASE_URL}login`;
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Routes ---
export interface RouteStep {
  action: "forward" | "backward" | "turn_left" | "turn_right";
  seconds: number;
  speed: number;
}
export interface RouteStop {
  id?: number;
  orderIndex?: number;
  treeName: string;
  markerId?: number | null;
  isReturn?: boolean;
  steps: RouteStep[];
}
export interface ScheduleEntry {
  id?: number;
  dayOfWeek: number; // 0=Monday ... 6=Sunday
  time: string; // "HH:MM"
}
export interface RouteSummary {
  id: number;
  name: string;
  createdAt: string;
  stopCount: number;
  schedule: ScheduleEntry[];
}
export interface RouteDetail extends RouteSummary {
  stops: RouteStop[];
}

export function useListRoutes() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: () => request<RouteSummary[]>("/api/routes"),
  });
}

export function useGetRoute(routeId: number) {
  return useQuery({
    queryKey: ["route", routeId],
    queryFn: () => request<RouteDetail>(`/api/routes/${routeId}`),
    enabled: Number.isFinite(routeId),
  });
}

export function useCreateRoute(): UseMutationResult<RouteSummary, Error, { name: string }> {
  return useMutation({
    mutationFn: (data) =>
      request<RouteSummary>("/api/routes", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useDeleteRoute(): UseMutationResult<void, Error, { routeId: number }> {
  return useMutation({
    mutationFn: ({ routeId }) => request<void>(`/api/routes/${routeId}`, { method: "DELETE" }),
  });
}

export function useSaveRouteStops(): UseMutationResult<RouteDetail, Error, { routeId: number; stops: RouteStop[] }> {
  return useMutation({
    mutationFn: ({ routeId, stops }) =>
      request<RouteDetail>(`/api/routes/${routeId}/stops`, { method: "PUT", body: JSON.stringify({ stops }) }),
  });
}

export function useSaveSchedule(): UseMutationResult<ScheduleEntry[], Error, { routeId: number; entries: ScheduleEntry[] }> {
  return useMutation({
    mutationFn: ({ routeId, entries }) =>
      request<ScheduleEntry[]>(`/api/routes/${routeId}/schedule`, { method: "PUT", body: JSON.stringify({ entries }) }),
  });
}

export function useGetDeviceStatus() {
  return useQuery({
    queryKey: ["device-status"],
    queryFn: () => request<{ batteryPercent: number | null; batteryVoltage: number | null; lastSeenAt: string | null }>("/api/device/status"),
    refetchInterval: 30_000,
  });
}

// --- Auth ---
export function useLogin(): UseMutationResult<
  { token: string },
  Error,
  { username: string; password: string }
> {
  return useMutation({
    mutationFn: async (credentials) => {
      const data = await request<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setToken(data.token);
      return data;
    },
  });
}

export function logout() {
  clearToken();
  window.location.href = `${import.meta.env.BASE_URL}login`;
}

// --- Query keys (kept as functions to match the old package's API) ---
export const getGetDashboardSummaryQueryKey = () => ["dashboard-summary"];
export const getListTreesQueryKey = () => ["trees"];
export const getGetTreeQueryKey = (treeId: number) => ["tree", treeId];
export const getListAlertsQueryKey = () => ["alerts"];
export const getListTreeReadingsQueryKey = (treeId: number) => ["tree-readings", treeId];

// --- Queries ---
export function useGetDashboardSummary() {
  return useQuery({
    queryKey: getGetDashboardSummaryQueryKey(),
    queryFn: () => request<DashboardSummary>("/api/dashboard/summary"),
    refetchInterval: 30_000,
  });
}

export function useListTrees() {
  return useQuery({
    queryKey: getListTreesQueryKey(),
    queryFn: () => request<Tree[]>("/api/trees"),
    refetchInterval: 30_000,
  });
}

export function useListAlerts() {
  return useQuery({
    queryKey: getListAlertsQueryKey(),
    queryFn: () => request<Tree[]>("/api/trees/alerts"),
    refetchInterval: 30_000,
  });
}

export function useGetTree(treeId: number) {
  return useQuery({
    queryKey: getGetTreeQueryKey(treeId),
    queryFn: () => request<Tree>(`/api/trees/${treeId}`),
    enabled: Number.isFinite(treeId),
  });
}

export function useListTreeReadings(treeId: number) {
  return useQuery({
    queryKey: getListTreeReadingsQueryKey(treeId),
    queryFn: () => request<Reading[]>(`/api/trees/${treeId}/readings`),
    enabled: Number.isFinite(treeId),
  });
}

// --- Mutations ---
export function useCreateTree(): UseMutationResult<Tree, Error, { data: { name: string } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      request<Tree>("/api/trees", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useUpdateTree(): UseMutationResult<
  Tree,
  Error,
  { treeId: number; data: { name: string } }
> {
  return useMutation({
    mutationFn: ({ treeId, data }) =>
      request<Tree>(`/api/trees/${treeId}`, { method: "PATCH", body: JSON.stringify(data) }),
  });
}

export function useDeleteTree(): UseMutationResult<void, Error, { treeId: number }> {
  return useMutation({
    mutationFn: ({ treeId }) => request<void>(`/api/trees/${treeId}`, { method: "DELETE" }),
  });
}
