"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchClubEvents,
  subscribeToClubEvents,
  createClubEvent,
  updateClubEvent,
  deleteClubEvent,
} from '@/lib/events';
import {
  ClubEvent,
  EventType,
  EventStatus,
  EVENT_TYPES,
  EVENT_STATUS_OPTIONS,
} from '@/types/events';
import SpecularButton from './SpecularButton';

interface EventsProps {
  isAdmin?: boolean;
  userEmail?: string;
  userName?: string;
  onRedirect?: () => void;
}

export default function Events({
  isAdmin = false,
  userEmail = '',
  userName = '',
  onRedirect,
}: EventsProps) {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<EventType | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formVenue, setFormVenue] = useState<string>('');
  const [formEventDate, setFormEventDate] = useState<string>('');
  const [formEventTime, setFormEventTime] = useState<string>('');
  const [formEventType, setFormEventType] = useState<EventType>('Tournament');
  const [formStatus, setFormStatus] = useState<EventStatus>('upcoming');
  const [formRegistrationLink, setFormRegistrationLink] = useState<string>('');
  const [formBannerUrl, setFormBannerUrl] = useState<string>('');

  // Subscribe to real-time events
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToClubEvents(
      (liveEvents) => {
        setEvents(liveEvents);
        setLoading(false);
      },
      (err) => {
        console.warn('Real-time events subscription notice:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Preset Date Helper
  const applyDatePreset = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setFormEventDate(`${yyyy}-${mm}-${dd}`);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingEventId(null);
    setFormName('');
    setFormDescription('');
    setFormVenue('VR Gaming Lounge / Audi 2');
    applyDatePreset(7);
    setFormEventTime('17:00 IST');
    setFormEventType('Tournament');
    setFormStatus('upcoming');
    setFormRegistrationLink('');
    setFormBannerUrl('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (event: ClubEvent) => {
    setEditingEventId(event.id);
    setFormName(event.name);
    setFormDescription(event.description);
    setFormVenue(event.venue || 'TBA');
    setFormEventDate(event.eventDate || '');
    setFormEventTime(event.eventTime || '');
    setFormEventType(event.eventType || 'Other');
    setFormStatus(event.status || 'upcoming');
    setFormRegistrationLink(event.registrationLink || '');
    setFormBannerUrl(event.bannerUrl || '');
    setIsModalOpen(true);
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEventDate.trim() || !formDescription.trim()) {
      showStatus('Please complete required fields (Event Name, Date, Description).', 'error');
      return;
    }

    setSavingEvent(true);
    try {
      if (editingEventId) {
        const ok = await updateClubEvent(editingEventId, {
          name: formName.trim(),
          description: formDescription.trim(),
          venue: formVenue.trim() || 'TBA',
          eventDate: formEventDate.trim(),
          eventTime: formEventTime.trim(),
          eventType: formEventType,
          status: formStatus,
          registrationLink: formRegistrationLink.trim(),
          bannerUrl: formBannerUrl.trim(),
        });
        if (ok) {
          showStatus('Event updated! Live on vrgc.live immediately.', 'success');
          setIsModalOpen(false);
        } else {
          showStatus('Failed to update event.', 'error');
        }
      } else {
        const created = await createClubEvent(
          {
            name: formName.trim(),
            description: formDescription.trim(),
            venue: formVenue.trim() || 'TBA',
            eventDate: formEventDate.trim(),
            eventTime: formEventTime.trim(),
            eventType: formEventType,
            status: formStatus,
            registrationLink: formRegistrationLink.trim(),
            bannerUrl: formBannerUrl.trim(),
          },
          userEmail || 'admin@vrgc.club'
        );
        if (created) {
          showStatus('Event created! Published to vrgc.live immediately.', 'success');
          setIsModalOpen(false);
        } else {
          showStatus('Failed to create event.', 'error');
        }
      }
    } catch (err) {
      console.error('Save event error:', err);
      showStatus('An unexpected error occurred.', 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? It will be removed immediately from vrgc.live.`)) {
      return;
    }
    const ok = await deleteClubEvent(eventId);
    if (ok) {
      showStatus('Event deleted from vrgc.live.', 'success');
    } else {
      showStatus('Failed to delete event.', 'error');
    }
  };

  // Quick Status Toggle
  const handleStatusChange = async (eventId: string, nextStatus: EventStatus) => {
    const ok = await updateClubEvent(eventId, { status: nextStatus });
    if (ok) {
      showStatus(`Event status updated to "${nextStatus}" on vrgc.live`, 'success');
    } else {
      showStatus('Failed to update status.', 'error');
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesCategory = selectedCategory === 'All' || ev.eventType === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || ev.status === selectedStatus;
      const matchesSearch =
        searchQuery.trim() === '' ||
        ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.venue.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [events, selectedCategory, selectedStatus, searchQuery]);

  const liveCount = events.filter((e) => e.status === 'live').length;
  const upcomingCount = events.filter((e) => e.status === 'upcoming').length;
  const completedCount = events.filter((e) => e.status === 'completed').length;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in text-left">
      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all shadow-lg backdrop-blur-xl ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          <span className="material-symbols-outlined">
            {statusMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3.5 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              LIVE EVENT SYNC
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Live Spectator Feed ::{' '}
              <a
                href="https://vrgc.live/events"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 hover:text-purple-200 underline inline-flex items-center gap-1"
              >
                vrgc.live/events
                <span className="material-symbols-outlined text-[11px]">open_in_new</span>
              </a>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Events Manager
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Create, schedule, and operate official tournaments, LAN battles, workshops, and VR gaming events.
            Every update here reflects in real time on <strong className="text-purple-300 font-mono">vrgc.live</strong>.
          </p>
        </div>

        {/* Action button */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <SpecularButton
              onClick={handleOpenCreateModal}
              className="!px-6 !py-3.5 !rounded-2xl !bg-purple-600 hover:!bg-purple-500 !text-white !font-black !text-xs !tracking-wider !uppercase shadow-[0_0_25px_rgba(168,85,247,0.4)] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Create Event</span>
            </SpecularButton>
          </div>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#120822] border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL EVENTS</span>
          <p className="text-2xl font-black text-white">{events.length}</p>
        </div>
        <div className="bg-[#120822] border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-1">
          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            LIVE NOW
          </span>
          <p className="text-2xl font-black text-rose-400">{liveCount}</p>
        </div>
        <div className="bg-[#120822] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-1">
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">UPCOMING</span>
          <p className="text-2xl font-black text-emerald-400">{upcomingCount}</p>
        </div>
        <div className="bg-[#120822] border border-slate-500/30 rounded-2xl p-4 sm:p-5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">COMPLETED</span>
          <p className="text-2xl font-black text-slate-400">{completedCount}</p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-[#120822]/80 border border-purple-500/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar flex-1">
          <span className="text-xs text-slate-400 font-semibold shrink-0 mr-1">Status:</span>
          {(['All', 'live', 'upcoming', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 capitalize ${
                selectedStatus === st
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="bg-black/60 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-semibold"
          >
            <option value="All">All Categories</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/60 border border-purple-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-[#120822]/40 rounded-3xl border border-white/5">
          <span className="material-symbols-outlined text-4xl text-purple-400 animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-slate-400 font-medium">Synchronizing live events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 sm:p-16 text-center space-y-4 bg-[#120822]/60 rounded-3xl border border-purple-500/20 backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-purple-400 text-3xl">event_busy</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white">No Events Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All'
                ? 'Try adjusting your filters or search keywords.'
                : 'No club events have been published yet.'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all inline-flex items-center gap-2 shadow-lg"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Create First Event
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredEvents.map((event) => {
            const isLive = event.status === 'live';
            const isUpcoming = event.status === 'upcoming';
            const isCompleted = event.status === 'completed';

            return (
              <div
                key={event.id}
                className={`bg-[#130822]/90 border rounded-3xl p-6 sm:p-8 backdrop-blur-xl transition-all duration-200 space-y-6 relative overflow-hidden ${
                  isLive
                    ? 'border-rose-500/50 shadow-[0_0_35px_rgba(244,63,94,0.15)]'
                    : 'border-purple-500/25 hover:border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.08)]'
                }`}
              >
                {/* Event Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Event Type Badge */}
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30 uppercase tracking-wider">
                        {event.eventType}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black border flex items-center gap-1.5 uppercase tracking-wider ${
                          isLive
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                            : isUpcoming
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isCompleted
                            ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full bg-current ${isLive ? 'animate-ping' : ''}`} />
                        {event.status === 'live' ? 'LIVE NOW' : event.status}
                      </span>

                      {/* Date & Time Badge */}
                      <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-white/5 text-slate-300 border border-white/10 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[13px] text-purple-400">calendar_month</span>
                        {event.eventDate}
                        {event.eventTime ? ` • ${event.eventTime}` : ''}
                      </span>

                      {/* Venue Badge */}
                      {event.venue && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-white/5 text-slate-300 border border-white/10 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px] text-cyan-400">location_on</span>
                          {event.venue}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{event.name}</h2>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 self-end sm:self-start shrink-0 flex-wrap">
                      {/* Status Selector Dropdown */}
                      <select
                        value={event.status}
                        onChange={(e) => handleStatusChange(event.id, e.target.value as EventStatus)}
                        className="bg-black/60 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-semibold"
                      >
                        {EVENT_STATUS_OPTIONS.map((st) => (
                          <option key={st.value} value={st.value}>
                            Set: {st.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleOpenEditModal(event)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.name)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/30 transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Event Description */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </div>

                {/* Banner Preview if present */}
                {event.bannerUrl && (
                  <div className="rounded-2xl overflow-hidden border border-white/10 max-h-56 bg-black/50">
                    <img
                      src={event.bannerUrl}
                      alt={event.name}
                      className="w-full h-full object-cover"
                      onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                    />
                  </div>
                )}

                {/* Registration Link / Footer Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {event.registrationLink ? (
                      <a
                        href={event.registrationLink.startsWith('http') ? event.registrationLink : `https://${event.registrationLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-base">how_to_reg</span>
                        Official Registration Link
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No external registration link</span>
                    )}

                    <a
                      href="https://vrgc.live/events"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
                    >
                      <span>View on vrgc.live</span>
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Updated: {new Date(event.updatedAt || event.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#120822] border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-[0_0_60px_rgba(168,85,247,0.3)] space-y-6 my-8 text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-black text-white">
                  {editingEventId ? 'Edit Event' : 'Create New Event'}
                </h3>
                <p className="text-xs text-purple-300 font-mono mt-0.5">
                  Publishes instantly to Cloud Firestore &amp; vrgc.live
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-5">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">
                  EVENT NAME / TITLE *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VRGC Valorant Invitational 2026, Game Jam 4.0"
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Event Type & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    EVENT CATEGORY *
                  </label>
                  <select
                    value={formEventType}
                    onChange={(e) => setFormEventType(e.target.value as EventType)}
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 font-semibold"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    STATUS *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as EventStatus)}
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 font-semibold"
                  >
                    {EVENT_STATUS_OPTIONS.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date, Time & Presets */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-purple-300 mb-1">
                      EVENT DATE (YYYY-MM-DD) *
                    </label>
                    <input
                      type="date"
                      required
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-300 mb-1">
                      TIME / DURATION (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={formEventTime}
                      onChange={(e) => setFormEventTime(e.target.value)}
                      placeholder="e.g. 17:00 IST or 10:00 AM - 48 Hours"
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">Presets:</span>
                  {[
                    { label: '+3 Days', days: 3 },
                    { label: '+7 Days', days: 7 },
                    { label: '+14 Days', days: 14 },
                    { label: '+30 Days', days: 30 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => applyDatePreset(p.days)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-purple-300 border border-purple-500/20 transition-all shrink-0"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">
                  VENUE / LOCATION
                </label>
                <input
                  type="text"
                  value={formVenue}
                  onChange={(e) => setFormVenue(e.target.value)}
                  placeholder="e.g. VR Gaming Lounge, Audi 2, Online Discord"
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">
                  EVENT DESCRIPTION &amp; OVERVIEW *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the tournament format, rules, prize pool, schedule, and team requirements..."
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Registration Link & Banner URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    REGISTRATION LINK (FORM / TICKETS)
                  </label>
                  <input
                    type="url"
                    value={formRegistrationLink}
                    onChange={(e) => setFormRegistrationLink(e.target.value)}
                    placeholder="https://forms.gle/... or https://..."
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">
                    BANNER IMAGE URL (OPTIONAL)
                  </label>
                  <input
                    type="url"
                    value={formBannerUrl}
                    onChange={(e) => setFormBannerUrl(e.target.value)}
                    placeholder="https://.../banner.png"
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={savingEvent}
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center gap-2 transition-all"
                >
                  {savingEvent ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Publishing…
                    </>
                  ) : (
                    'Publish to vrgc.live'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
