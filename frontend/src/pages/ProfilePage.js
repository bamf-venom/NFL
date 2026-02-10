import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Trophy, Target, Calendar, LogOut, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Spinner, Modal, Input } from '../components/ui';
import { useAuthStore, useBetsStore, useGamesStore } from '../store';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, deleteAccount, isLoading: authLoading } = useAuthStore();
  const { myBets, fetchMyBets, isLoading } = useBetsStore();
  const { games, fetchGames } = useGamesStore();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchMyBets();
    fetchGames();
  }, [user, navigate, fetchMyBets, fetchGames]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'LÖSCHEN') {
      setDeleteError('Bitte gib "LÖSCHEN" ein um zu bestätigen');
      return;
    }
    
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Fehler beim Löschen');
    }
  };

  if (!user) return null;

  const totalPoints = myBets.reduce((sum, bet) => sum + bet.points_earned, 0);
  const correctWinners = myBets.filter((bet) => bet.points_earned > 0).length;
  const correctScores = myBets.filter((bet) => bet.points_earned >= 3).length;

  const getGameForBet = (gameId) => games.find((g) => g.id === gameId);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <User size={32} />
            </div>
            <h1 className="text-2xl font-bold" data-testid="profile-username">{user.username}</h1>
            <p className="text-muted text-sm mt-1">{user.email}</p>
            {user.is_admin && (
              <span className="inline-block mt-2 px-3 py-1 text-xs font-medium bg-white/10 rounded-full">
                Admin
              </span>
            )}
          </Card>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="text-center">
              <Trophy size={24} className="mx-auto mb-2 text-muted" />
              <div className="text-2xl font-bold" data-testid="total-points">{totalPoints}</div>
              <div className="text-xs text-muted">Punkte</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="text-center">
              <Target size={24} className="mx-auto mb-2 text-muted" />
              <div className="text-2xl font-bold" data-testid="total-bets">{myBets.length}</div>
              <div className="text-xs text-muted">Wetten</div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="text-center">
              <Calendar size={24} className="mx-auto mb-2 text-muted" />
              <div className="text-2xl font-bold" data-testid="correct-winners">{correctWinners}</div>
              <div className="text-xs text-muted">Richtig</div>
            </Card>
          </motion.div>
        </div>

        {/* Bet History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <h3 className="text-lg font-semibold mb-4">Meine Wetten</h3>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : myBets.length === 0 ? (
              <p className="text-center text-muted py-8">
                Du hast noch keine Wetten platziert
              </p>
            ) : (
              <div className="space-y-3">
                {myBets.slice(0, 10).map((bet, i) => {
                  const game = getGameForBet(bet.game_id);
                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => navigate(`/game/${bet.game_id}`)}
                      data-testid={`my-bet-${bet.id}`}
                    >
                      <div>
                        <div className="font-medium">
                          {game ? `${game.home_team_abbr} vs ${game.away_team_abbr}` : 'Spiel'}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          Tipp: {bet.home_score_prediction} : {bet.away_score_prediction}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        game?.status === 'finished'
                          ? bet.points_earned > 0
                            ? 'bg-success/20 text-success'
                            : 'bg-white/5 text-muted'
                          : 'bg-white/10 text-white'
                      }`}>
                        {game?.status === 'finished' ? `${bet.points_earned} Pkt` : 'Offen'}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut size={18} />
            Abmelden
          </Button>
          
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setShowDeleteModal(true)}
            data-testid="delete-account-button"
          >
            <Trash2 size={18} />
            Account löschen
          </Button>
        </motion.div>
      </div>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirm('');
          setDeleteError(null);
        }}
        title="Account löschen"
      >
        <div className="space-y-4">
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-sm text-error">
              <strong>Warnung:</strong> Diese Aktion kann nicht rückgängig gemacht werden. 
              Alle deine Daten, Wetten und Gruppenmitgliedschaften werden gelöscht.
            </p>
          </div>

          <div>
            <label className="block text-sm text-muted mb-2">
              Gib <strong>LÖSCHEN</strong> ein um zu bestätigen
            </label>
            <Input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
              placeholder="LÖSCHEN"
              className="text-center tracking-widest"
              data-testid="delete-confirm-input"
            />
          </div>

          {deleteError && (
            <div className="flex items-center gap-2 text-error text-sm bg-error/10 px-4 py-2 rounded-lg">
              <AlertCircle size={16} />
              {deleteError}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirm('');
                setDeleteError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== 'LÖSCHEN' || authLoading}
              data-testid="confirm-delete-account"
            >
              {authLoading ? <Loader2 className="animate-spin" size={18} /> : 'Account löschen'}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
