import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (username, password) =>
    api.post('/auth/token/', { username, password }),
  refresh: (refresh) =>
    api.post('/auth/token/refresh/', { refresh }),
  getMe: () => api.get('/users/me/'),
};

export const shoppingService = {
  getAll: () => api.get('/shopping/'),
  create: (data) => api.post('/shopping/', data),
  update: (id, data) => api.patch(`/shopping/${id}/`, data),
  delete: (id) => api.delete(`/shopping/${id}/`),
  toggle: (id) => api.post('/shopping/toggle_completed/', { id }),
};

export const recipeService = {
  getAll: () => api.get('/recipes/'),
  create: (data) => api.post('/recipes/', data),
  update: (id, data) => api.patch(`/recipes/${id}/`, data),
  delete: (id) => api.delete(`/recipes/${id}/`),
};

export const taskDefinitionService = {
  getAll: () => api.get('/task-definitions/'),
  create: (data) => api.post('/task-definitions/', data),
  update: (id, data) => api.patch(`/task-definitions/${id}/`, data),
  delete: (id, confirm = false) =>
    api.delete(`/task-definitions/${id}/`, confirm ? { params: { confirm: true } } : undefined),
};

export const taskInstanceService = {
  getRange: (start, end) => api.get('/task-instances/', { params: { start, end } }),
  create: (data) => api.post('/task-instances/', data),
  reassign: (id, assignedTo) => api.post(`/task-instances/${id}/reassign/`, { assigned_to: assignedTo }),
  snooze: (id) => api.post(`/task-instances/${id}/snooze/`),
  skip: (id) => api.post(`/task-instances/${id}/skip/`),
  reopen: (id) => api.post(`/task-instances/${id}/reopen/`),
  postpone: (id, scheduledDate) => api.post(`/task-instances/${id}/postpone/`, { scheduled_date: scheduledDate, is_in_backlog: false }),
  moveToBacklog: (id) => api.post(`/task-instances/${id}/postpone/`, { is_in_backlog: true }),
  complete: (id) => api.post(`/task-instances/${id}/complete/`),
  delete: (id) => api.delete(`/task-instances/${id}/`),
};

export const memberService = {
  getAll: () => api.get('/members/'),
  getMe: () => api.get('/members/me/'),
  update: (id, data) => api.patch(`/members/${id}/`, data),
  uploadAvatar: (id, file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.patch(`/members/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteAvatar: (id) => api.delete(`/members/${id}/avatar/`),
};

export const householdSettingsService = {
  get: () => api.get('/household-settings/'),
  update: (data) => api.patch('/household-settings/', data),
};

export const cookingPlanService = {
  getAll: () => api.get('/cooking-plans/'),
  create: (data) => api.post('/cooking-plans/', data),
  update: (id, data) => api.patch(`/cooking-plans/${id}/`, data),
  delete: (id) => api.delete(`/cooking-plans/${id}/`),
};

export default api;
