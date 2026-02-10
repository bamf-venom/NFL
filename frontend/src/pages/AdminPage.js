import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Plus, Trash2, Edit, Check, X, Loader2, Calendar, Users
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Input, Modal, Badge, Spinner } from '../components/ui';
import { useAuthStore, useGamesStore } from '../store';
import { adminAPI } from '../lib/api';

// NFL Teams data
const NFL_TEAMS = [
  { name: 'Arizona Cardinals', abbr: 'ARI' },
  { name: 'Atlanta Falcons', abbr: 'ATL' },
  { name: 'Baltimore Ravens', abbr: 'BAL' },
  { name: 'Buffalo Bills', abbr: 'BUF' },
  { name: 'Carolina Panthers', abbr: 'CAR' },
  { name: 'Chicago Bears', abbr: 'CHI' },
  { name: 'Cincinnati Bengals', abbr: 'CIN' },
  { name: 'Cleveland Browns', abbr: 'CLE' },
  { name: 'Dallas Cowboys', abbr: 'DAL' },
  { name: 'Denver Broncos', abbr: 'DEN' },
  { name: 'Detroit Lions', abbr: 'DET' },
  { name: 'Green Bay Packers', abbr: 'GB' },
  { name: 'Houston Texans', abbr: 'HOU' },
  { name: 'Indianapolis Colts', abbr: 'IND' },
  { name: 'Jacksonville Jaguars', abbr: 'JAX' },
  { name: 'Kansas City Chiefs', abbr: 'KC' },
  { name: 'Las Vegas Raiders', abbr: 'LV' },
  { name: 'Los Angeles Chargers', abbr: 'LAC' },
  { name: 'Los Angeles Rams', abbr: 'LAR' },
  { name: 'Miami Dolphins', abbr: 'MIA' },
  { name: 'Minnesota Vikings', abbr: 'MIN' },
  { name: 'New England Patriots', abbr: 'NE' },
  { name: 'New Orleans Saints', abbr: 'NO' },
  { name: 'New York Giants', abbr: 'NYG' },
  { name: 'New York Jets', abbr: 'NYJ' },
  { name: 'Philadelphia Eagles', abbr: 'PHI' },
  { name: 'Pittsburgh Steelers', abbr: 'PIT' },
  { name: 'San Francisco 49ers', abbr: 'SF' },
  { name: 'Seattle Seahawks', abbr: 'SEA' },
  { name: 'Tampa Bay Buccaneers', abbr: 'TB' },
  { name: 'Tennessee Titans', abbr: 'TEN' },
  { name: 'Washington Commanders', abbr: 'WAS' },
];

export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { games, fetchGames, createGame, updateGame, deleteGame, isLoading } = useGamesStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('games');
  const [submitting, setSubmitting] = useState(false);

  const [gameForm, setGameForm] = useState({
    home_team: '',
    away_team: '',
    game_date: '',
    week: 1,
    season: '2025',
  });

  const [scoreForm, setScoreForm] = useState({
    home_score: '',
    away_score: '',
    status: 'scheduled',
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (!user.is_admin) {
      navigate('/games');
      return;
    }
    fetchGames();
    loadUsers();
  }, [user, navigate, fetchGames]);

  const loadUsers = async () => {
    try {
      const { data } = await adminAPI.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const homeTeam = NFL_TEAMS.find((t) => t.abbr === gameForm.home_team);
      const awayTeam = NFL_TEAMS.find((t) => t.abbr === gameForm.away_team);

      await createGame({
        home_team: homeTeam?.name || gameForm.home_team,
        away_team: awayTeam?.name || gameForm.away_team,
        home_team_abbr: gameForm.home_team,
        away_team_abbr: gameForm.away_team,
        game_date: gameForm.game_date,
        week: parseInt(gameForm.week),
        season: gameForm.season,
      });
      setShowCreateModal(false);
      setGameForm({ home_team: '', away_team: '', game_date: '', week: 1, season: '2025' });
    } catch (err) {
      console.error('Failed to create game:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateScore = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateGame(selectedGame.id, {
        home_score: parseInt(scoreForm.home_score),
        away_score: parseInt(scoreForm.away_score),
        status: scoreForm.status,
      });
      setShowEditModal(false);
      setSelectedGame(null);
    } catch (err) {
      console.error('Failed to update game:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Spiel wirklich löschen? Alle Wetten gehen verloren!')) return;
    try {
      await deleteGame(gameId);
    } catch (err) {
      console.error('Failed to delete game:', err);
    }
  };

  const openEditModal = (game) => {
    setSelectedGame(game);
    setScoreForm({
      home_score: game.home_score?.toString() || '',
      away_score: game.away_score?.toString() || '',
      status: game.status,
    });
    setShowEditModal(true);
  };

  if (!user?.is_admin) return null;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="admin-title">
              <Shield size={28} />
              Admin Panel
            </h1>
            <p className="text-muted mt-1">Verwalte Spiele und Benutzer</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            onClick={() => setActiveTab('games')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'games' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
            data-testid="tab-games"
          >
            <Calendar size={16} />
            Spiele ({games.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'users' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
            data-testid="tab-users"
          >
            <Users size={16} />
            Benutzer ({users.length})
          </button>
        </div>

        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className="space-y-4">
            <Button onClick={() => setShowCreateModal(true)} data-testid="create-game-button">
              <Plus size={18} />
              Neues Spiel
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : games.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-muted">Noch keine Spiele vorhanden</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {games.map((game, i) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className="flex items-center justify-between" data-testid={`admin-game-${game.id}`}>
                      <div className="flex items-center gap-4">
                        <Badge variant={game.status === 'finished' ? 'success' : game.status === 'live' ? 'warning' : 'default'}>
                          {game.status === 'finished' ? 'Beendet' : game.status === 'live' ? 'Live' : 'Geplant'}
                        </Badge>
                        <div>
                          <div className="font-medium">
                            {game.home_team_abbr} vs {game.away_team_abbr}
                          </div>
                          <div className="text-xs text-muted">
                            Woche {game.week} •{' '}
                            {new Date(game.game_date).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {game.status === 'finished' && (
                          <div className="text-lg font-bold">
                            {game.home_score} : {game.away_score}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(game)}
                            data-testid={`edit-game-${game.id}`}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteGame(game.id)}
                            data-testid={`delete-game-${game.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="flex items-center justify-between" data-testid={`user-${u.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {u.username}
                        {u.is_admin && (
                          <Badge variant="warning">Admin</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{u.total_points} Pkt</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Game Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Neues Spiel erstellen"
      >
        <form onSubmit={handleCreateGame} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-2">Heimteam</label>
              <select
                value={gameForm.home_team}
                onChange={(e) => setGameForm({ ...gameForm, home_team: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-white/50"
                required
                data-testid="home-team-select"
              >
                <option value="">Wählen...</option>
                {NFL_TEAMS.map((team) => (
                  <option key={team.abbr} value={team.abbr}>
                    {team.abbr} - {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Gastteam</label>
              <select
                value={gameForm.away_team}
                onChange={(e) => setGameForm({ ...gameForm, away_team: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-white/50"
                required
                data-testid="away-team-select"
              >
                <option value="">Wählen...</option>
                {NFL_TEAMS.map((team) => (
                  <option key={team.abbr} value={team.abbr}>
                    {team.abbr} - {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-2">Datum & Uhrzeit</label>
            <Input
              type="datetime-local"
              value={gameForm.game_date}
              onChange={(e) => setGameForm({ ...gameForm, game_date: e.target.value })}
              required
              data-testid="game-date-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-2">Woche</label>
              <Input
                type="number"
                min="1"
                max="22"
                value={gameForm.week}
                onChange={(e) => setGameForm({ ...gameForm, week: e.target.value })}
                required
                data-testid="game-week-input"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Saison</label>
              <Input
                type="text"
                value={gameForm.season}
                onChange={(e) => setGameForm({ ...gameForm, season: e.target.value })}
                required
                data-testid="game-season-input"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Spiel erstellen'}
          </Button>
        </form>
      </Modal>

      {/* Edit Score Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Ergebnis eintragen"
      >
        <form onSubmit={handleUpdateScore} className="space-y-4">
          <div className="text-center mb-4">
            <span className="font-semibold">
              {selectedGame?.home_team_abbr} vs {selectedGame?.away_team_abbr}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-2">
                {selectedGame?.home_team_abbr} Punkte
              </label>
              <Input
                type="number"
                min="0"
                value={scoreForm.home_score}
                onChange={(e) => setScoreForm({ ...scoreForm, home_score: e.target.value })}
                required
                data-testid="edit-home-score"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">
                {selectedGame?.away_team_abbr} Punkte
              </label>
              <Input
                type="number"
                min="0"
                value={scoreForm.away_score}
                onChange={(e) => setScoreForm({ ...scoreForm, away_score: e.target.value })}
                required
                data-testid="edit-away-score"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-2">Status</label>
            <select
              value={scoreForm.status}
              onChange={(e) => setScoreForm({ ...scoreForm, status: e.target.value })}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:border-white/50"
              data-testid="edit-status"
            >
              <option value="scheduled">Geplant</option>
              <option value="live">Live</option>
              <option value="finished">Beendet</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowEditModal(false)}
            >
              <X size={18} />
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> Speichern</>}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
