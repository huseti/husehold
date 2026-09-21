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

export const shoppingListService = {
  getAll: () => api.get('/shopping-lists/'),
  create: (data) => api.post('/shopping-lists/', data),
  update: (id, data) => api.patch(`/shopping-lists/${id}/`, data),
  delete: (id) => api.delete(`/shopping-lists/${id}/`),
  clearCompleted: (id) => api.post(`/shopping-lists/${id}/clear-completed/`),
  addIngredients: (id, lines) => api.post(`/shopping-lists/${id}/add-ingredients/`, { lines }),
};

export const purchaseService = {
  getAll: (params) => api.get('/purchases/', { params }),
  summary: (params) => api.get('/purchases/summary/', { params }),
};

export const shoppingService = {
  getAll: (listId) => api.get('/shopping/', { params: { list: listId } }),
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
  rate: (id, score) => api.post(`/recipes/${id}/rate/`, { score }),
  clearRating: (id) => api.delete(`/recipes/${id}/rate/`),
  shoppingLines: (id, servings) => api.get(`/recipes/${id}/shopping-lines/`, { params: { servings } }),
};

// Small config-editable lookup tables share one CRUD shape.
const lookupService = (path) => ({
  getAll: (params) => api.get(`/${path}/`, { params }),
  create: (data) => api.post(`/${path}/`, data),
  update: (id, data) => api.patch(`/${path}/${id}/`, data),
  delete: (id) => api.delete(`/${path}/${id}/`),
});

export const mealEventService = {
  getAll: (params) => api.get('/meal-events/', { params }),
  create: (data) => api.post('/meal-events/', data),
  delete: (id) => api.delete(`/meal-events/${id}/`),
};

export const unitService = lookupService('units');
export const ingredientService = lookupService('ingredients');
export const labelService = lookupService('labels');
export const mealCategoryService = lookupService('meal-categories');

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

export const notificationPreferenceService = {
  getAll: () => api.get('/notification-preferences/'),
  update: (prefs) => api.patch('/notification-preferences/', prefs),
};

export const notificationTestService = {
  sendTestEmail: () => api.post('/notifications/test-email/'),
  sendTestPush: () => api.post('/notifications/test-push/'),
};

export const pushSubscriptionService = {
  getVapidPublicKey: () => api.get('/vapid-public-key/'),
  // subscription.toJSON() already gives keys as base64url strings, matching
  // what pywebpush expects server-side -- no manual re-encoding needed.
  subscribe: (subscription, deviceLabel) => {
    const json = subscription.toJSON();
    return api.post('/push-subscriptions/', {
      endpoint: json.endpoint,
      p256dh_key: json.keys.p256dh,
      auth_key: json.keys.auth,
      device_label: deviceLabel,
    });
  },
};

export const voucherService = {
  getAll: () => api.get('/vouchers/'),
  create: (data) => api.post('/vouchers/', data),
  update: (id, data) => api.patch(`/vouchers/${id}/`, data),
  delete: (id) => api.delete(`/vouchers/${id}/`),
  redeem: (id, amountUsed) => api.post(`/vouchers/${id}/redeem/`, { amount_used: amountUsed }),
  toggleArchived: (id) => api.post(`/vouchers/${id}/toggle-archived/`),
};

export const cookingPlanEntryService = {
  getRange: (start, end) => api.get('/cooking-plan-entries/', { params: { start, end } }),
  create: (data) => api.post('/cooking-plan-entries/', data),
  update: (id, data) => api.patch(`/cooking-plan-entries/${id}/`, data),
  delete: (id) => api.delete(`/cooking-plan-entries/${id}/`),
  finalize: (start, end) => api.post('/cooking-plan-entries/finalize/', { start, end }),
  shoppingPreview: (start, end) => api.get('/cooking-plan-entries/shopping-preview/', { params: { start, end } }),
};

export const cookingPlanConfigService = {
  get: () => api.get('/cooking-plan-config/'),
  update: (data) => api.patch('/cooking-plan-config/', data),
};

export const cookingSuggestionService = {
  get: (mealCategoryId, excludeRecipeIds = [], seed) => api.get('/cooking-suggestions/', {
    params: { meal: mealCategoryId, exclude: excludeRecipeIds.join(','), seed },
  }),
};

export default api;
