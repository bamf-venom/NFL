import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Target, TrendingUp, Medal } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Spinner } from '../components/ui';
import { useLeaderboardStore, useAuthStore } from '../store';

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { leaderboard, fetchLeaderboard, isLoading } = useLeaderboardStore();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchLeaderboard();
  }, [user, navigate, fetchLeaderboard]);

  if (!user) return null;

  const getMedalColor = (index) => {
    switch (index) {
      case 0:
        return 'from-yellow-400 to-yellow-600';
      case 1:
        return 'from-gray-300 to-gray-500';
      case 2:
        return 'from-orange-400 to-orange-600';
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4"
          >
            <Trophy size={32} />
          </motion.div>
          <h1 className="text-3xl font-bold" data-testid="leaderboard-title">Rangliste</h1>
          <p className="text-muted mt-2">Die besten Tipper der Saison</p>
        </div>

        {/* Leaderboard */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card className="text-center py-12">
            <Trophy size={48} className="mx-auto text-muted mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Daten</h3>
            <p className="text-muted text-sm">
              Die Rangliste wird gefüllt sobald Wetten ausgewertet werden.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`flex items-center gap-4 ${
                    entry.user_id === user?.id ? 'border-white/30 bg-white/5' : ''
                  }`}
                  data-testid={`leaderboard-entry-${index}`}
                >
                  {/* Rank */}
                  <div className="w-12 text-center">
                    {getMedalColor(index) ? (
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center mx-auto`}
                      >
                        <Medal size={20} className="text-white" />
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-muted">{index + 1}</div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{entry.username}</span>
                      {entry.user_id === user?.id && (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10">Du</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted mt-1">
                      <span className="flex items-center gap-1">
                        <Target size={12} />
                        {entry.total_bets} Wetten
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {entry.correct_winners} Gewinner
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="text-2xl font-bold">{entry.total_points}</div>
                    <div className="text-xs text-muted">Punkte</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
