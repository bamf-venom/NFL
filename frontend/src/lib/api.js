import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
};

// Games
export const gamesAPI = {
  getAll: (params) => api.get('/api/games', { params }),
  getOne: (id) => api.get(`/api/games/${id}`),
  create: (data) => api.post('/api/games', data),
  update: (id, data) => api.put(`/api/games/${id}`, data),
  delete: (id) => api.delete(`/api/games/${id}`),
};

// Bets
export const betsAPI = {
  create: (data) => api.post('/api/bets', data),
  getForGame: (gameId) => api.get(`/api/bets/game/${gameId}`),
  getMyBets: () => api.get('/api/bets/my'),
  getUserBets: (userId) => api.get(`/api/bets/user/${userId}`),
};

// Leaderboard
export const leaderboardAPI = {
  get: () => api.get('/api/leaderboard'),
};

// Groups
export const groupsAPI = {
  getMyGroups: () => api.get('/api/groups'),
  getGroup: (id) => api.get(`/api/groups/${id}`),
  create: (data) => api.post('/api/groups', data),
  join: (inviteCode) => api.post(`/api/groups/join/${inviteCode}`),
  leave: (id) => api.post(`/api/groups/${id}/leave`),
  kick: (groupId, userId) => api.post(`/api/groups/${groupId}/kick/${userId}`),
  delete: (id) => api.delete(`/api/groups/${id}`),
  getGroupBets: (groupId, gameId) => api.get(`/api/groups/${groupId}/bets/${gameId}`),
  getGroupLeaderboard: (groupId) => api.get(`/api/groups/${groupId}/leaderboard`),
};

// User
export const userAPI = {
  deleteAccount: () => api.delete('/api/auth/delete-account'),
};

// Admin
export const adminAPI = {
  getUsers: () => api.get('/api/admin/users'),
  makeAdmin: (userId) => api.post(`/api/admin/make-admin/${userId}`),
};

export default api;
