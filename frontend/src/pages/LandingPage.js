import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store';
import { Button, Input, Modal } from '../components/ui';

export function LandingPage() {
  const navigate = useNavigate();
  const { user, login, register, isLoading, error, clearError } = useAuthStore();
  const [authMode, setAuthMode] = useState(null); // 'login' | 'register'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (user) {
      navigate('/games');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        await login({ email: formData.email, password: formData.password });
      } else {
        await register(formData);
      }
      navigate('/games');
    } catch (err) {
      // Error handled in store
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-2">
            NFL BETT
          </h1>
          <p className="text-lg text-muted mb-12">
            Wette mit Freunden auf NFL Spiele
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => setAuthMode('register')}
              data-testid="register-button"
            >
              Registrieren
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setAuthMode('login')}
              data-testid="login-button"
            >
              Anmelden
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="py-6 text-center"
      >
        <p className="text-xs text-muted/60 tracking-widest uppercase">made by MBP</p>
      </motion.div>

      {/* Auth Modal */}
      <Modal
        isOpen={authMode !== null}
        onClose={() => {
          setAuthMode(null);
          clearError();
        }}
        title={authMode === 'login' ? 'Anmelden' : 'Registrieren'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-sm text-muted mb-2">Benutzername</label>
              <Input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Dein Benutzername"
                required
                data-testid="username-input"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-muted mb-2">E-Mail</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="deine@email.de"
              required
              data-testid="email-input"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">Passwort</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={6}
              data-testid="password-input"
            />
          </div>

          {error && (
            <div className="text-error text-sm bg-error/10 px-4 py-2 rounded-lg" data-testid="auth-error">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading} data-testid="submit-auth">
            {isLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : authMode === 'login' ? (
              'Anmelden'
            ) : (
              'Registrieren'
            )}
          </Button>

          <p className="text-center text-sm text-muted">
            {authMode === 'login' ? (
              <>
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    clearError();
                  }}
                  className="text-white hover:underline"
                  data-testid="switch-to-register"
                >
                  Registrieren
                </button>
              </>
            ) : (
              <>
                Bereits registriert?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    clearError();
                  }}
                  className="text-white hover:underline"
                  data-testid="switch-to-login"
                >
                  Anmelden
                </button>
              </>
            )}
          </p>
        </form>
      </Modal>
    </div>
  );
}
