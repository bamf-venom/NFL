import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Trophy, Clock, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Badge, Button, Input, Spinner } from '../components/ui';
import { useGamesStore, useBetsStore, useAuthStore } from '../store';
import { formatDate, getStatusBadge } from '../lib/utils';

export function GameDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentGame, fetchGame, isLoading: gameLoading } = useGamesStore();
  const { gameBets, fetchGameBets, placeBet, isLoading: betsLoading } = useBetsStore();

  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchGame(id);
    fetchGameBets(id);
  }, [id, user, navigate, fetchGame, fetchGameBets]);

  const myBet = gameBets.find((bet) => bet.user_id === user?.id);
  const canBet = currentGame?.status === 'scheduled' && !myBet;

  const handleSubmitBet = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await placeBet({
        game_id: id,
        home_score_prediction: parseInt(homeScore),
        away_score_prediction: parseInt(awayScore),
      });
      setSuccess(true);
      setHomeScore('');
      setAwayScore('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Platzieren der Wette');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (gameLoading || !currentGame) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const status = getStatusBadge(currentGame.status);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/games')}
          className="flex items-center gap-2 text-muted hover:text-white transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft size={18} />
          Zurück zu den Spielen
        </button>

        {/* Game Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="text-center">
            <Badge variant={currentGame.status === 'live' ? 'live' : 'default'} className="mb-4">
              {status.text}
            </Badge>

            <div className="flex items-center justify-center gap-8 mb-4">
              {/* Home Team */}
              <div className="flex-1">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold">{currentGame.home_team_abbr}</span>
                </div>
                <h3 className="font-semibold" data-testid="home-team-name">{currentGame.home_team}</h3>
              </div>

              {/* Score or VS */}
              {currentGame.status === 'finished' || currentGame.status === 'live' ? (
                <div className="flex items-center gap-4 px-6 py-4 bg-white/5 rounded-xl">
                  <span className="text-4xl font-bold" data-testid="home-score">{currentGame.home_score ?? '-'}</span>
                  <span className="text-2xl text-muted">:</span>
                  <span className="text-4xl font-bold" data-testid="away-score">{currentGame.away_score ?? '-'}</span>
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted">VS</div>
              )}

              {/* Away Team */}
              <div className="flex-1">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold">{currentGame.away_team_abbr}</span>
                </div>
                <h3 className="font-semibold" data-testid="away-team-name">{currentGame.away_team}</h3>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted text-sm">
              <Clock size={14} />
              <span>Woche {currentGame.week} • {formatDate(currentGame.game_date)}</span>
            </div>
          </Card>
        </motion.div>

        {/* Bet Form */}
        {canBet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Trophy size={18} />
                Deine Wette platzieren
              </h3>

              <form onSubmit={handleSubmitBet} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted mb-2">
                      {currentGame.home_team_abbr} Punkte
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      placeholder="0"
                      required
                      data-testid="home-score-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-2">
                      {currentGame.away_team_abbr} Punkte
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      placeholder="0"
                      required
                      data-testid="away-score-input"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-error text-sm bg-error/10 px-4 py-2 rounded-lg">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 text-success text-sm bg-success/10 px-4 py-2 rounded-lg">
                    <Check size={16} />
                    Wette erfolgreich platziert!
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !homeScore || !awayScore}
                  data-testid="submit-bet-button"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    'Wette platzieren'
                  )}
                </Button>

                <p className="text-xs text-muted text-center">
                  3 Punkte pro richtigem Team-Score • 1 Punkt für richtigen Gewinner
                </p>
              </form>
            </Card>
          </motion.div>
        )}

        {/* My Bet */}
        {myBet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-success/30 bg-success/5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-success">
                <Check size={18} />
                Deine Wette
              </h3>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold" data-testid="my-bet-home">{myBet.home_score_prediction}</div>
                  <div className="text-sm text-muted">{currentGame.home_team_abbr}</div>
                </div>
                <div className="text-2xl text-muted">:</div>
                <div className="text-center">
                  <div className="text-3xl font-bold" data-testid="my-bet-away">{myBet.away_score_prediction}</div>
                  <div className="text-sm text-muted">{currentGame.away_team_abbr}</div>
                </div>
              </div>
              {currentGame.status === 'finished' && (
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <div className="text-sm text-muted">Punkte erhalten</div>
                  <div className="text-2xl font-bold text-success">{myBet.points_earned}</div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* All Bets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={18} />
              Alle Wetten ({gameBets.length})
            </h3>

            {betsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : gameBets.length === 0 ? (
              <p className="text-center text-muted py-8">
                Noch keine Wetten für dieses Spiel
              </p>
            ) : (
              <div className="space-y-3">
                {gameBets.map((bet, i) => (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      bet.user_id === user?.id ? 'bg-success/10 border border-success/20' : 'bg-white/5'
                    }`}
                    data-testid={`bet-${bet.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">
                        {bet.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{bet.username}</div>
                        <div className="text-xs text-muted">
                          {new Date(bet.created_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold">
                          {bet.home_score_prediction} : {bet.away_score_prediction}
                        </div>
                      </div>
                      {currentGame.status === 'finished' && (
                        <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          bet.points_earned > 0 ? 'bg-success/20 text-success' : 'bg-white/5 text-muted'
                        }`}>
                          {bet.points_earned} Pkt
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
