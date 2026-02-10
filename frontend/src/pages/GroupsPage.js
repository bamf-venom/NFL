import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, Link2, ChevronRight, Loader2, AlertCircle, Check } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Input, Modal, Spinner } from '../components/ui';
import { useGroupsStore, useAuthStore } from '../store';

export function GroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { groups, fetchGroups, createGroup, joinGroup, isLoading } = useGroupsStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchGroups();
  }, [user, navigate, fetchGroups]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const group = await createGroup(groupName);
      setShowCreateModal(false);
      setGroupName('');
      setSuccess(`Gruppe "${group.name}" erstellt!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Erstellen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const group = await joinGroup(inviteCode.trim().toUpperCase());
      setShowJoinModal(false);
      setInviteCode('');
      setSuccess(`Gruppe "${group.name}" beigetreten!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ungültiger Einladungscode');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="groups-title">
              <Users size={28} />
              Meine Gruppen
            </h1>
            <p className="text-muted mt-1">Wette mit deinen Freunden</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowJoinModal(true)}
              data-testid="join-group-btn"
            >
              <Link2 size={18} />
              Beitreten
            </Button>
            <Button onClick={() => setShowCreateModal(true)} data-testid="create-group-btn">
              <Plus size={18} />
              Neue Gruppe
            </Button>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-success text-sm bg-success/10 px-4 py-3 rounded-lg"
          >
            <Check size={16} />
            {success}
          </motion.div>
        )}

        {/* Groups List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : groups.length === 0 ? (
          <Card className="text-center py-12">
            <Users size={48} className="mx-auto text-muted mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Gruppen</h3>
            <p className="text-muted text-sm mb-4">
              Erstelle eine Gruppe oder tritt einer bei, um mit Freunden zu wetten.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setShowJoinModal(true)}>
                <Link2 size={16} />
                Mit Code beitreten
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                Gruppe erstellen
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  hover
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="flex items-center justify-between"
                  data-testid={`group-card-${group.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="font-semibold">{group.name}</div>
                      <div className="text-sm text-muted">
                        {group.members.length} Mitglied{group.members.length !== 1 && 'er'}
                        {group.admin_id === user.id && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-white/10 rounded">Admin</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted" />
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setError(null);
        }}
        title="Neue Gruppe erstellen"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-2">Gruppenname</label>
            <Input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="z.B. NFL Experten"
              required
              maxLength={50}
              data-testid="group-name-input"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-sm bg-error/10 px-4 py-2 rounded-lg">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting || !groupName.trim()}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Gruppe erstellen'}
          </Button>
        </form>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setError(null);
        }}
        title="Gruppe beitreten"
      >
        <form onSubmit={handleJoinGroup} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-2">Einladungscode</label>
            <Input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="z.B. ABC12345"
              required
              maxLength={8}
              className="uppercase tracking-widest text-center text-lg"
              data-testid="invite-code-input"
            />
            <p className="text-xs text-muted mt-2 text-center">
              Frage einen Freund nach dem Einladungscode
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-sm bg-error/10 px-4 py-2 rounded-lg">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting || inviteCode.length !== 8}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Beitreten'}
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
