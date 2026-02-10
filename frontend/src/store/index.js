import { create } from 'zustand';
import { authAPI, gamesAPI, betsAPI, leaderboardAPI, groupsAPI, userAPI } from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.login(credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Login fehlgeschlagen', isLoading: false });
      throw error;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.register(userData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Registrierung fehlgeschlagen', isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  deleteAccount: async () => {
    set({ isLoading: true });
    try {
      await userAPI.deleteAccount();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export const useGamesStore = create((set, get) => ({
  games: [],
  currentGame: null,
  isLoading: false,
  error: null,

  fetchGames: async (params) => {
    set({ isLoading: true });
    try {
      const { data } = await gamesAPI.getAll(params);
      set({ games: data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchGame: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await gamesAPI.getOne(id);
      set({ currentGame: data, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  createGame: async (gameData) => {
    try {
      const { data } = await gamesAPI.create(gameData);
      set((state) => ({ games: [...state.games, data] }));
      return data;
    } catch (error) {
      throw error;
    }
  },

  updateGame: async (id, updateData) => {
    try {
      const { data } = await gamesAPI.update(id, updateData);
      set((state) => ({
        games: state.games.map((g) => (g.id === id ? data : g)),
        currentGame: state.currentGame?.id === id ? data : state.currentGame,
      }));
      return data;
    } catch (error) {
      throw error;
    }
  },

  deleteGame: async (id) => {
    try {
      await gamesAPI.delete(id);
      set((state) => ({
        games: state.games.filter((g) => g.id !== id),
      }));
    } catch (error) {
      throw error;
    }
  },
}));

export const useBetsStore = create((set, get) => ({
  gameBets: [],
  myBets: [],
  isLoading: false,

  fetchGameBets: async (gameId) => {
    set({ isLoading: true });
    try {
      const { data } = await betsAPI.getForGame(gameId);
      set({ gameBets: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  fetchMyBets: async () => {
    set({ isLoading: true });
    try {
      const { data } = await betsAPI.getMyBets();
      set({ myBets: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  placeBet: async (betData) => {
    try {
      const { data } = await betsAPI.create(betData);
      set((state) => ({
        gameBets: [...state.gameBets, data],
        myBets: [data, ...state.myBets],
      }));
      return data;
    } catch (error) {
      throw error;
    }
  },
}));

export const useLeaderboardStore = create((set) => ({
  leaderboard: [],
  isLoading: false,

  fetchLeaderboard: async () => {
    set({ isLoading: true });
    try {
      const { data } = await leaderboardAPI.get();
      set({ leaderboard: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));

export const useGroupsStore = create((set, get) => ({
  groups: [],
  currentGroup: null,
  groupLeaderboard: [],
  isLoading: false,
  error: null,

  fetchGroups: async () => {
    set({ isLoading: true });
    try {
      const { data } = await groupsAPI.getMyGroups();
      set({ groups: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  fetchGroup: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await groupsAPI.getGroup(id);
      set({ currentGroup: data, isLoading: false });
      return data;
    } catch (error) {
      set({ error: error.response?.data?.detail, isLoading: false });
      throw error;
    }
  },

  createGroup: async (name) => {
    try {
      const { data } = await groupsAPI.create({ name });
      set((state) => ({ groups: [...state.groups, data] }));
      return data;
    } catch (error) {
      throw error;
    }
  },

  joinGroup: async (inviteCode) => {
    try {
      const { data } = await groupsAPI.join(inviteCode);
      set((state) => ({ groups: [...state.groups, data] }));
      return data;
    } catch (error) {
      throw error;
    }
  },

  leaveGroup: async (id) => {
    try {
      await groupsAPI.leave(id);
      set((state) => ({ groups: state.groups.filter((g) => g.id !== id) }));
    } catch (error) {
      throw error;
    }
  },

  kickMember: async (groupId, userId) => {
    try {
      await groupsAPI.kick(groupId, userId);
      // Refresh current group
      const { data } = await groupsAPI.getGroup(groupId);
      set({ currentGroup: data });
    } catch (error) {
      throw error;
    }
  },

  deleteGroup: async (id) => {
    try {
      await groupsAPI.delete(id);
      set((state) => ({ groups: state.groups.filter((g) => g.id !== id), currentGroup: null }));
    } catch (error) {
      throw error;
    }
  },

  fetchGroupLeaderboard: async (groupId) => {
    try {
      const { data } = await groupsAPI.getGroupLeaderboard(groupId);
      set({ groupLeaderboard: data });
    } catch (error) {
      set({ groupLeaderboard: [] });
    }
  },

  clearError: () => set({ error: null }),
}));
