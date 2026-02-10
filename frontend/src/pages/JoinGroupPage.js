import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Spinner } from '../components/ui';
import { useGroupsStore, useAuthStore } from '../store';

export function JoinGroupPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { joinGroup } = useGroupsStore();
  
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [error, setError] = useState(null);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!user) {
      // Store invite code for after login
      localStorage.setItem('pendingInvite', inviteCode);
      navigate('/');
      return;
    }

    const join = async () => {
      try {
        const group = await joinGroup(inviteCode);
        setGroupName(group.name);
        setStatus('success');
        setTimeout(() => navigate(`/groups/${group.id}`), 2000);
      } catch (err) {
        setError(err.response?.data?.detail || 'Ungültiger Einladungscode');
        setStatus('error');
      }
    };

    join();
  }, [inviteCode, user, navigate, joinGroup]);

  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-20">
        <Card className="text-center py-12">
          {status === 'loading' && (
            <>
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-muted">Trete Gruppe bei...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-success" />
              </div>
              <h2 className="text-xl font-bold mb-2">Erfolgreich beigetreten!</h2>
              <p className="text-muted">Du bist jetzt Mitglied von "{groupName}"</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-error" />
              </div>
              <h2 className="text-xl font-bold mb-2">Fehler</h2>
              <p className="text-muted mb-4">{error}</p>
              <Button onClick={() => navigate('/groups')}>
                Zurück zu Gruppen
              </Button>
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}
