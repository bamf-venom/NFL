import React from 'react';
import { cn } from '../../lib/utils';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  const variants = {
    primary: 'bg-white text-black hover:bg-white/90',
    secondary: 'bg-card border border-border hover:bg-card-hover text-white',
    ghost: 'hover:bg-white/10 text-white',
    danger: 'bg-error/20 text-error hover:bg-error/30 border border-error/30',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        'font-medium rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, error, ...props }) {
  return (
    <input
      className={cn(
        'w-full px-4 py-3 bg-card border border-border rounded-lg',
        'text-white placeholder:text-muted',
        'focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/20',
        'transition-all duration-200',
        error && 'border-error focus:border-error',
        className
      )}
      {...props}
    />
  );
}

export function Card({ children, className, hover, ...props }) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-6',
        hover && 'card-hover cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-white/10 text-white',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-error/20 text-error',
    live: 'bg-success/20 text-success animate-pulse-subtle',
  };

  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-md uppercase tracking-wider',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Modal({ isOpen, onClose, children, title }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-xl font-semibold mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={cn(
        'border-2 border-white/20 border-t-white rounded-full animate-spin',
        sizes[size],
        className
      )}
    />
  );
}
