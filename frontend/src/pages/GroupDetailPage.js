import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Trophy, Link2, Copy, Check, Trash2, LogOut,
  UserMinus, Crown, Target, TrendingUp, Medal
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Badge, Modal, Spinner } from '../components/ui';
import { useGroupsStore, useAuthStore, useGamesStore } from '../store';
import { groupsAPI } from '../lib/api';

export function GroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentGroup, fetchGroup, leaveGroup, deleteGroup, kickMember, fetchGroupLeaderboard, groupLeaderboard, isLoading, error } = useGroupsStore();
  const { games, fetchGames } = useGamesStore();
  
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [groupBets, setGroupBets] = useState({});

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchGroup(id).catch(() => navigate('/groups'));
    fetchGroupLeaderboard(id);
    fetchGames();
  }, [id, user, navigate, fetchGroup, fetchGroupLeaderboard, fetchGames]);

  useEffect(() => {
    // Fetch bets for each game
    if (currentGroup && games.length > 0) {
      games.forEach(async (game) => {
        try {
          const { data } = await groupsAPI.getGroupBets(id, game.id);
          setGroupBets((prev) => ({ ...prev, [game.id]: data }));
        } catch (err) {
          // Ignore errors
        }
      });
    }
  }, [currentGroup, games, id]);

  const handleCopyCode = () => {
    if (currentGroup) {
      navigator.clipboard.writeText(currentGroup.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (currentGroup) {
      const link = `${window.location.origin}/groups/join/${currentGroup.invite_code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(id);
      navigate('/groups');
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGroup(id);
      navigate('/groups');
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleKick = async (userId, username) => {
    if (!window.confirm(`${username} wirklich aus der Gruppe entfernen?`)) return;
    try {
      await kickMember(id, userId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Fehler');
    }
  };

  if (!user) return null;

  if (isLoading || !currentGroup) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted">{error}</p>
          <Button onClick={() => navigate('/groups')} className="mt-4">
            Zurück zu Gruppen
          </Button>
        </div>
      </Layout>
    );
  }

  const isAdmin = currentGroup.admin_id === user.id;

  const getMedalColor = (index) => {
    switch (index) {
      case 0: return 'from-yellow-400 to-yellow-600';
      case 1: return 'from-gray-300 to-gray-500';
      case 2: return 'from-orange-400 to-orange-600';
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 text-muted hover:text-white transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft size={18} />
          Zurück zu Gruppen
        </button>

        {/* Group Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Users size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" data-testid="group-name">{currentGroup.name}</h1>
                  <div className="text-sm text-muted flex items-center gap-2 mt-1">
                    {currentGroup.members.length} Mitglied{currentGroup.members.length !== 1 && 'er'}
                    {isAdmin && <Badge variant="warning">Admin</Badge>}
                  </div>
                </div>
              </div>

              {/* Invite Code */}
              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-muted">Einladungscode</div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold tracking-widest" data-testid="invite-code">
                    {currentGroup.invite_code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    data-testid="copy-code-btn"
                  >
                    {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCopyLink} data-testid="copy-link-btn">
                  <Link2 size={14} />
                  Link kopieren
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'members' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
            data-testid="tab-members"
          >
            <Users size={16} />
            Mitglieder
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'leaderboard' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
            data-testid="tab-leaderboard"
          >
            <Trophy size={16} />
            Rangliste
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'bets' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'
            }`}
            data-testid="tab-bets"
          >
            <Target size={16} />
            Wetten
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {currentGroup.members.map((member, i) => (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`flex items-center justify-between ${
                    member.user_id === user.id ? 'border-white/20' : ''
                  }`}
                  data-testid={`member-${member.user_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-medium">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {member.username}
                        {member.user_id === user.id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10">Du</span>
                        )}
                        {member.user_id === currentGroup.admin_id && (
                          <Crown size={14} className="text-yellow-400" />
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        Beigetreten {new Date(member.joined_at).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  </div>

                  {isAdmin && member.user_id !== user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKick(member.user_id, member.username)}
                      data-testid={`kick-${member.user_id}`}
                    >
                      <UserMinus size={16} className="text-error" />
                    </Button>
                  )}
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {groupLeaderboard.length === 0 ? (
              <Card className="text-center py-8">
                <Trophy size={32} className="mx-auto text-muted mb-2" />
                <p className="text-muted">Noch keine Wetten ausgewertet</p>
              </Card>
            ) : (
              groupLeaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`flex items-center gap-4 ${
                      entry.user_id === user.id ? 'border-white/30 bg-white/5' : ''
                    }`}
                    data-testid={`leaderboard-${index}`}
                  >
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

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{entry.username}</span>
                        {entry.user_id === user.id && (
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
                          {entry.correct_winners} Richtig
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold">{entry.total_points}</div>
                      <div className="text-xs text-muted">Punkte</div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Bets Tab */}
        {activeTab === 'bets' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {games.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-muted">Keine Spiele vorhanden</p>
              </Card>
            ) : (
              games.slice(0, 10).map((game) => {
                const bets = groupBets[game.id] || [];
                return (
                  <Card key={game.id} data-testid={`game-bets-${game.id}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-semibold">
                          {game.home_team_abbr} vs {game.away_team_abbr}
                        </div>
                        <div className="text-xs text-muted">
                          Woche {game.week} • {new Date(game.game_date).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      {game.status === 'finished' && (
                        <div className="text-lg font-bold">
                          {game.home_score} : {game.away_score}
                        </div>
                      )}
                    </div>

                    {bets.length === 0 ? (
                      <p className="text-sm text-muted text-center py-2">Keine Wetten</p>
                    ) : (
                      <div className="space-y-2">
                        {bets.map((bet) => (
                          <div
                            key={bet.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              bet.user_id === user.id ? 'bg-white/10' : 'bg-white/5'
                            }`}
                          >
                            <span className="text-sm">{bet.username}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">
                                {bet.home_score_prediction} : {bet.away_score_prediction}
                              </span>
                              {game.status === 'finished' && (
                                <span className={`text-sm ${bet.points_earned > 0 ? 'text-success' : 'text-muted'}`}>
                                  {bet.points_earned} Pkt
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isAdmin ? (
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => setShowDeleteModal(true)}
              data-testid="delete-group-btn"
            >
              <Trash2 size={18} />
              Gruppe löschen
            </Button>
          ) : (
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => setShowLeaveModal(true)}
              data-testid="leave-group-btn"
            >
              <LogOut size={18} />
              Gruppe verlassen
            </Button>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Gruppe löschen"
      >
        <p className="text-muted mb-4">
          Bist du sicher, dass du die Gruppe "{currentGroup.name}" löschen möchtest? 
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteModal(false)}>
            Abbrechen
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} data-testid="confirm-delete">
            Löschen
          </Button>
        </div>
      </Modal>

      {/* Leave Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Gruppe verlassen"
      >
        <p className="text-muted mb-4">
          Bist du sicher, dass du die Gruppe "{currentGroup.name}" verlassen möchtest?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowLeaveModal(false)}>
            Abbrechen
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleLeave} data-testid="confirm-leave">
            Verlassen
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
