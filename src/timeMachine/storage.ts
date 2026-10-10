import type { JourneyTicket, WallEntry } from './types';
import { MOMENTS } from './moments';
import { PLACES } from './places';

export const TICKET_KEY = 'campus-time-machine:current:v1';
export const WALL_KEY = 'campus-time-machine:wall:v1';
export function readStored(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
export function storeValue(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}
export function readTicket(): JourneyTicket | undefined {
  const value = readStored(TICKET_KEY);
  if (!value || typeof value !== 'object') return;
  const ticket = value as Partial<JourneyTicket>;
  if (typeof ticket.jobId !== 'string' || !ticket.jobId || !['mock', 'http'].includes(String(ticket.provider)) || typeof ticket.placeName !== 'string' ||
      !MOMENTS.some(moment => moment.id === ticket.moment) ||
      !['snapshot', 'film'].includes(String(ticket.length)) ||
      (ticket.place !== undefined && !PLACES.some(place => place.id === ticket.place))) return;
  return ticket as JourneyTicket;
}
export function safeMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.startsWith('//')) return false;
  return value.startsWith('/') || /^https?:\/\//i.test(value);
}
export function isWallEntry(value: unknown): value is WallEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WallEntry>;
  return typeof entry.id === 'string' && typeof entry.place === 'string' && typeof entry.moment === 'string' &&
    safeMediaUrl(entry.url) && (entry.thumbnail === undefined || safeMediaUrl(entry.thumbnail));
}
export function readLocalWall(): WallEntry[] {
  const value = readStored(WALL_KEY);
  return Array.isArray(value) ? value.filter(isWallEntry).slice(0, 24) : [];
}
export function saveToWall(entry: WallEntry) {
  const entries = readLocalWall();
  return storeValue(WALL_KEY, [entry, ...entries.filter(item => item.id !== entry.id)].slice(0, 24));
}
