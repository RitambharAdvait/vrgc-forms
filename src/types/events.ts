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
  eventDate: string;       // YYYY-MM-DD
  eventTime?: string;      // e.g. "17:00 IST" or "10:00 AM"
  eventType: EventType;
  registrationLink: string; // Target registration form or ticket link
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

export const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string; color: string }[] = [
  { value: 'upcoming', label: 'Upcoming', color: 'emerald' },
  { value: 'live', label: 'Live Now', color: 'rose' },
  { value: 'completed', label: 'Completed', color: 'slate' },
  { value: 'cancelled', label: 'Cancelled', color: 'amber' },
];
