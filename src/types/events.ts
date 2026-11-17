export type EventType =
  | 'Tournament'
  | 'LAN Battle'
  | 'Workshop'
  | 'Hackathon'
  | 'Game Jam'
  | 'VR Experience'
  | 'Community Night'
  | 'Other';

export type EventStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface ClubEvent {
  id: string;
  name: string;
  description: string;
  venue: string;
  eventDate: string;       // e.g. "2026-11-28"
  eventTime?: string;      // e.g. "17:00 IST" or "10:00 AM - 04:00 PM"
  eventType: EventType;
  registrationLink: string; // Target URL for student registration (Google Form / Unstop / Discord)
  status: EventStatus;
  bannerUrl?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const EVENT_TYPES: EventType[] = [
  'Tournament',
  'LAN Battle',
  'Workshop',
  'Hackathon',
  'Game Jam',
  'VR Experience',
  'Community Night',
  'Other',
];

export const EVENT_STATUSES: { value: EventStatus; label: string; badgeClass: string }[] = [
  { value: 'upcoming', label: 'Upcoming', badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' },
  { value: 'live', label: 'Live Now', badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse' },
  { value: 'completed', label: 'Completed', badgeClass: 'bg-slate-800/80 text-slate-400 border-slate-700' },
  { value: 'cancelled', label: 'Cancelled', badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/40' },
];

export const EVENT_TYPE_STYLES: Record<EventType, { badgeClass: string; borderClass: string; icon: string }> = {
  Tournament: {
    badgeClass: 'bg-rose-950/70 text-rose-300 border-rose-500/30',
    borderClass: 'border-rose-500/20',
    icon: 'emoji_events',
  },
  'LAN Battle': {
    badgeClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-500/30',
    borderClass: 'border-cyan-500/20',
    icon: 'sports_esports',
  },
  Workshop: {
    badgeClass: 'bg-purple-950/70 text-purple-300 border-purple-500/30',
    borderClass: 'border-purple-500/20',
    icon: 'school',
  },
  Hackathon: {
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/30',
    borderClass: 'border-amber-500/20',
    icon: 'terminal',
  },
  'Game Jam': {
    badgeClass: 'bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-500/30',
    borderClass: 'border-fuchsia-500/20',
    icon: 'videogame_asset',
  },
  'VR Experience': {
    badgeClass: 'bg-indigo-950/70 text-indigo-300 border-indigo-500/30',
    borderClass: 'border-indigo-500/20',
    icon: 'view_in_ar',
  },
  'Community Night': {
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30',
    borderClass: 'border-emerald-500/20',
    icon: 'groups',
  },
  Other: {
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    borderClass: 'border-slate-700/40',
    icon: 'event',
  },
};

export const MOCK_CLUB_EVENTS: ClubEvent[] = [
  {
    id: 'event-valorant-2026',
    name: 'VRGC Valorant Campus Championship 2026',
    description: 'Annual 5v5 collegiate tactical shooter LAN tournament. Teams battle across Ascent, Haven, and Bind for a prize pool of ₹25,000 and the championship trophy.',
    venue: 'Central Auditorium & Spatial Lab (Lab 304)',
    eventDate: '2026-11-28',
    eventTime: '17:00 IST',
    eventType: 'Tournament',
    registrationLink: 'https://discord.gg/vrgc',
    status: 'upcoming',
    createdAt: '2026-11-17T10:00:00Z',
  },
  {
    id: 'event-vr-jam-2026',
    name: '48-Hour Spatial VR Game Jam',
    description: 'Build immersive Unity / Unreal VR experiences for Meta Quest 3 headsets. Mentors from the technical division will provide SDK walkthroughs and device hardware.',
    venue: 'Spatial Computing Lab • Academic Block 2',
    eventDate: '2026-12-05',
    eventTime: '10:00 AM - 48 Hours',
    eventType: 'Game Jam',
    registrationLink: 'https://discord.gg/vrgc',
    status: 'upcoming',
    createdAt: '2026-11-17T10:30:00Z',
  },
  {
    id: 'event-unreal-workshop',
    name: 'Unreal Engine 5 Shader & Lumen Masterclass',
    description: 'Hands-on practical session covering Nanite geometries, custom HLSL shader graphs, and real-time ray-traced lighting pipelines for next-generation interactive titles.',
    venue: 'Lab 102 • Computer Center',
    eventDate: '2026-12-12',
    eventTime: '14:30 - 17:30 IST',
    eventType: 'Workshop',
    registrationLink: 'https://discord.gg/vrgc',
    status: 'upcoming',
    createdAt: '2026-11-17T11:00:00Z',
  },
];
