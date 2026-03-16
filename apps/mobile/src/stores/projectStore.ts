import { create } from 'zustand';
import { Project } from '../types';
import api from '../lib/api';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ data: Project[]; error: null }>('/projects');
      set({ projects: response.data.data, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch projects';
      set({ error: message, isLoading: false });
    }
  },

  addProject: (project: Project) => {
    set((state) => ({
      projects: [project, ...state.projects],
    }));
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  removeProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },
}));
