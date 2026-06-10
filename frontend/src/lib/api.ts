import axios from "axios";

import type {
  AgendaItem,
  FileAsset,
  Plan,
  PlanStep,
  PlanSummary,
  SearchResult,
  Token,
  Topic,
  TopicCard,
  TopicNode,
  User,
  Version,
  VersionSummary,
} from "../types";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "studynotes_token";

export const api = axios.create({ baseURL });

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      setToken(null);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; full_name?: string }) =>
    api.post<Token>("/auth/register", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<Token>("/auth/login", data).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

export const topicsApi = {
  tree: () => api.get<TopicNode[]>("/topics/tree").then((r) => r.data),
  children: (parentId: string | null) =>
    api
      .get<TopicCard[]>("/topics/children", {
        params: parentId ? { parent_id: parentId } : {},
      })
      .then((r) => r.data),
  pinned: () => api.get<TopicCard[]>("/topics/pinned").then((r) => r.data),
  get: (id: string) => api.get<Topic>(`/topics/${id}`).then((r) => r.data),
  create: (data: { title?: string; parent_id?: string | null }) =>
    api.post<Topic>("/topics", data).then((r) => r.data),
  update: (
    id: string,
    data: { title?: string; content?: unknown[]; tags?: string[]; is_pinned?: boolean }
  ) => api.patch<Topic>(`/topics/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/topics/${id}`).then(() => undefined),
  move: (id: string, data: { parent_id: string | null; position: number }) =>
    api.post<Topic>(`/topics/${id}/move`, data).then((r) => r.data),
  reorder: (data: { parent_id: string | null; ordered_ids: string[] }) =>
    api.post("/topics/reorder", data).then(() => undefined),
};

export const plansApi = {
  list: () => api.get<PlanSummary[]>("/plans").then((r) => r.data),
  agenda: () => api.get<AgendaItem[]>("/plans/agenda").then((r) => r.data),
  get: (id: string) => api.get<Plan>(`/plans/${id}`).then((r) => r.data),
  create: (data: { title: string; kind: "roadmap" | "checklist"; description?: string }) =>
    api.post<Plan>("/plans", data).then((r) => r.data),
  update: (id: string, data: { title?: string; description?: string }) =>
    api.patch<Plan>(`/plans/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/plans/${id}`).then(() => undefined),
  addStep: (
    planId: string,
    data: { title: string; due_at?: string | null; topic_id?: string | null; note?: string }
  ) => api.post<PlanStep>(`/plans/${planId}/steps`, data).then((r) => r.data),
  updateStep: (
    stepId: string,
    data: {
      title?: string;
      status?: "todo" | "doing" | "done";
      note?: string;
      due_at?: string | null;
      topic_id?: string | null;
    }
  ) => api.patch<PlanStep>(`/plans/steps/${stepId}`, data).then((r) => r.data),
  removeStep: (stepId: string) => api.delete(`/plans/steps/${stepId}`).then(() => undefined),
  reorderSteps: (planId: string, orderedIds: string[]) =>
    api.post(`/plans/${planId}/steps/reorder`, { ordered_ids: orderedIds }).then(() => undefined),
};

export const searchApi = {
  search: (q: string, tag?: string) =>
    api
      .get<SearchResult[]>("/search", { params: { q, ...(tag ? { tag } : {}) } })
      .then((r) => r.data),
  tags: () => api.get<string[]>("/tags").then((r) => r.data),
};

export const versionsApi = {
  list: (topicId: string) =>
    api.get<VersionSummary[]>(`/topics/${topicId}/versions`).then((r) => r.data),
  createCheckpoint: (topicId: string, label?: string) =>
    api.post<Version>(`/topics/${topicId}/versions`, { label }).then((r) => r.data),
  get: (versionId: string) =>
    api.get<Version>(`/versions/${versionId}`).then((r) => r.data),
  restore: (versionId: string) =>
    api.post<Topic>(`/versions/${versionId}/restore`).then((r) => r.data),
  remove: (versionId: string) =>
    api.delete(`/versions/${versionId}`).then(() => undefined),
};

export const filesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<FileAsset>("/files", form).then((r) => r.data);
  },
};
