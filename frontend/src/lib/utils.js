import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status) {
  switch (status) {
    case 'live':
      return 'text-success';
    case 'finished':
      return 'text-muted';
    default:
      return 'text-foreground';
  }
}

export function getStatusBadge(status) {
  switch (status) {
    case 'live':
      return { text: 'LIVE', bg: 'bg-success/20', color: 'text-success' };
    case 'finished':
      return { text: 'BEENDET', bg: 'bg-muted/20', color: 'text-muted' };
    default:
      return { text: 'GEPLANT', bg: 'bg-white/10', color: 'text-white' };
  }
}
