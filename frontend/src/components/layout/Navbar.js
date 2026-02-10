import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, Trophy, Calendar, User, LogOut, Shield, ChevronDown, Users } from 'lucide-react';
import { useAuthStore } from '../../store';
import { cn } from '../../lib/utils';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/games', label: 'Spiele', icon: Calendar },
    { path: '/groups', label: 'Gruppen', icon: Users },
    { path: '/leaderboard', label: 'Rangliste', icon: Trophy },
  ];

  if (user?.is_admin) {
    navItems.push({ path: '/admin', label: 'Admin', icon: Shield });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/games"
            className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
            data-testid="logo-link"
          >
            KICK<span className="text-muted">WAGER</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all',
                  location.pathname === item.path
                    ? 'bg-white/10 text-white'
                    : 'text-muted hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:block relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              data-testid="user-menu-button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <User size={16} />
              </div>
              <span className="text-sm font-medium">{user?.username}</span>
              <ChevronDown size={14} className={cn('transition-transform', isUserMenuOpen && 'rotate-180')} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl overflow-hidden animate-slide-down">
                <Link
                  to="/profile"
                  data-testid="profile-link"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <User size={16} />
                  Mein Profil
                </Link>
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-error hover:bg-error/10 transition-colors"
                >
                  <LogOut size={16} />
                  Abmelden
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden p-2 hover:bg-white/5 rounded-lg"
            data-testid="mobile-menu-toggle"
          >
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileOpen && (
          <div className="md:hidden py-4 border-t border-border animate-slide-down">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium',
                  location.pathname === item.path
                    ? 'bg-white/10 text-white'
                    : 'text-muted hover:text-white'
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            <div className="border-t border-border mt-2 pt-2">
              <Link
                to="/profile"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-white"
              >
                <User size={18} />
                Mein Profil
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error"
              >
                <LogOut size={18} />
                Abmelden
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
