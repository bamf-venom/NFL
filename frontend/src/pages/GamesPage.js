import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight, Filter } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Badge, Button, Spinner } from '../components/ui';
import { useGamesStore, useAuthStore } from '../store';
import { getStatusBadge } from '../lib/utils';

export function GamesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { games, fetchGames, isLoading } = useGamesStore();
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchGames(selectedWeek ? { week: selectedWeek } : {});
  }, [user, navigate, fetchGames, selectedWeek]);

  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);

  const groupedGames = games.reduce((acc, game) => {
    const date = new Date(game.game_date).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(game);
    return acc;
  }, {});

  if (!user) return null;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="games-title">Spiele</h1>
            <p className="text-muted mt-1">Wähle ein Spiel und platziere deine Wette</p>
          </div>

          {weeks.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select
                value={selectedWeek || ''}
                onChange={(e) => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
                className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/50"
                data-testid="week-filter"
              >
                <option value="">Alle Wochen</option>
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    Woche {week}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Games List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : games.length === 0 ? (
          <Card className="text-center py-12">
            <Calendar size={48} className="mx-auto text-muted mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Spiele gefunden</h3>
            <p className="text-muted text-sm">
              {user?.is_admin
                ? 'Als Admin kannst du neue Spiele hinzufügen.'
                : 'Es sind noch keine Spiele geplant.'}
            </p>
            {user?.is_admin && (
              <Button
                onClick={() => navigate('/admin')}
                className="mt-4"
                data-testid="go-to-admin"
              >
                Zum Admin Panel
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedGames).map(([date, dateGames], dateIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIndex * 0.1 }}
              >
                <h2 className="text-sm text-muted font-medium mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  {new Date(date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </h2>
                <div className="space-y-3">
                  {dateGames.map((game, i) => (
                    <GameCard key={game.id} game={game} index={i} onClick={() => navigate(`/game/${game.id}`)} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function GameCard({ game, index, onClick }) {
  const status = getStatusBadge(game.status);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        hover
        onClick={onClick}
        className="flex items-center gap-4"
        data-testid={`game-card-${game.id}`}
      >
        {/* Status Badge */}
        <Badge variant={game.status === 'live' ? 'live' : game.status === 'finished' ? 'default' : 'default'}>
          {status.text}
        </Badge>

        {/* Teams */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <div className="font-semibold">{game.home_team_abbr}</div>
            <div className="text-xs text-muted">{game.home_team}</div>
          </div>

          {game.status === 'finished' || game.status === 'live' ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg min-w-[100px] justify-center">
              <span className="text-2xl font-bold">{game.home_score ?? '-'}</span>
              <span className="text-muted">:</span>
              <span className="text-2xl font-bold">{game.away_score ?? '-'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 text-muted">
              <Clock size={14} />
              <span className="text-sm">
                {new Date(game.game_date).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          <div className="flex-1">
            <div className="font-semibold">{game.away_team_abbr}</div>
            <div className="text-xs text-muted">{game.away_team}</div>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={20} className="text-muted" />
      </Card>
    </motion.div>
  );
}
