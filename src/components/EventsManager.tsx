"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  ClubEvent,
  EventType,
  EventStatus,
  EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_TYPE_STYLES,
} from '@/types/events';
import {
  subscribeToEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/lib/events';

interface EventsManagerProps {
  onRedirect?: () => void;
  userEmail?: string | null;
}

export default function EventsManager({ onRedirect, userEmail }: EventsManagerProps) {
  // Real-time events list loaded directly from Firestore
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'Synced' | 'Saving...' | 'Error'>('Synced');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<EventType | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | 'All'>('All');

  // Modal controls & editing state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form inputs state
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<EventType>('Tournament');
  const [formVenue, setFormVenue] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formLink, setFormLink] = useState<string>('');
  const [formStatus, setFormStatus] = useState<EventStatus>('upcoming');
  const [formError, setFormError] = useState<string | null>(null);

  // User feedback toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // ── Real-Time Firestore Subscription ──────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToEvents(
      (liveEvents) => {
        setEvents(liveEvents);
        setLoading(false);
        setSyncStatus('Synced');
      },
      (err) => {
        console.warn('Events sync warning:', err);
        setSyncStatus('Error');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Populate form when opening in create vs edit mode
  useEffect(() => {
    if (editingEvent) {
      setFormName(editingEvent.name);
      setFormType(editingEvent.eventType);
      setFormVenue(editingEvent.venue);
      setFormDate(editingEvent.eventDate);
      setFormTime(editingEvent.eventTime || '');
      setFormDesc(editingEvent.description);
      setFormLink(editingEvent.registrationLink);
      setFormStatus(editingEvent.status);
      setFormError(null);
    } else {
      setFormName('');
      setFormType('Tournament');
      setFormVenue('');
      const today = new Date().toISOString().split('T')[0];
      setFormDate(today);
      setFormTime('18:00 IST');
      setFormDesc('');
      setFormLink('');
      setFormStatus('upcoming');
      setFormError(null);
    }
  }, [editingEvent, isModalOpen]);

  // Filtered events calculation
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Search matching (name, venue, description)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ev.name.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q);

      // Category matching
      const matchesType = selectedType === 'All' || ev.eventType === selectedType;

      // Status matching
      const matchesStatus = selectedStatus === 'All' || ev.status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [events, searchQuery, selectedType, selectedStatus]);

  const activeCount = events.filter((e) => e.status !== 'completed' && e.status !== 'cancelled').length;

  const handleCopyLink = (event: ClubEvent) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(event.registrationLink);
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    if (!confirm(`Are you sure you want to delete "${eventName}"? This will remove it from the live site.`)) {
      return;
    }
    setSyncStatus('Saving...');
    try {
      await deleteEvent(eventId);
      setSyncStatus('Synced');
      showToast(`Deleted "${eventName}"`);
    } catch (err: any) {
      console.error('Failed to delete event:', err);
      setSyncStatus('Error');
      showToast('Failed to delete event. Please check connection.');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Form Validations
    if (!formName.trim()) {
      setFormError('Please enter an event name.');
      return;
    }
    if (!formVenue.trim()) {
      setFormError('Please enter the event venue or platform.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a valid event date.');
      return;
    }
    if (!formDesc.trim()) {
      setFormError('Please provide a brief description.');
      return;
    }
    if (!formLink.trim()) {
      setFormError('Please provide a registration link (Google Form / Discord / Unstop).');
      return;
    }

    // Ensure valid URL scheme
    let cleanLink = formLink.trim();
    if (!cleanLink.startsWith('http://') && !cleanLink.startsWith('https://')) {
      cleanLink = `https://${cleanLink}`;
    }

    setIsSubmitting(true);
    setSyncStatus('Saving...');

    try {
      if (editingEvent) {
        // Update existing event in Firestore
        await updateEvent(editingEvent.id, {
          name: formName.trim(),
          eventType: formType,
          venue: formVenue.trim(),
          eventDate: formDate,
          eventTime: formTime.trim(),
          description: formDesc.trim(),
          registrationLink: cleanLink,
          status: formStatus,
        });
        setSyncStatus('Synced');
        showToast(`Updated "${formName.trim()}"`);
      } else {
        // Create new event in Firestore
        await createEvent(
          {
            name: formName.trim(),
            eventType: formType,
            venue: formVenue.trim(),
            eventDate: formDate,
            eventTime: formTime.trim(),
            description: formDesc.trim(),
            registrationLink: cleanLink,
            status: formStatus,
          },
          userEmail || 'admin'
        );
        setSyncStatus('Synced');
        showToast(`Published "${formName.trim()}"`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save event to Firestore:', err);
      setSyncStatus('Error');
      setFormError(`Failed to save: ${err?.message || 'Database connection error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {}
    return dateStr;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 text-slate-100 select-none relative">
      {/* ── Toast Notification Pill ─────────────────────────────────── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-purple-950/95 border border-purple-500/50 text-white text-xs font-bold shadow-2xl shadow-purple-900/50 backdrop-blur-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-purple-300 text-base">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0c0517]/90 border border-purple-500/20 backdrop-blur-xl shadow-xl shadow-black/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <span className="material-symbols-outlined text-white text-2xl">celebration</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black tracking-wide text-white">Live Events Hub</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono tracking-wider">
                {activeCount} ACTIVE
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border ${
                  syncStatus === 'Synced'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                    : syncStatus === 'Saving...'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/30 animate-pulse'
                    : 'bg-rose-950/60 text-rose-300 border-rose-500/30'
                }`}
              >
                {syncStatus === 'Synced' ? '● LIVE SYNCED' : syncStatus === 'Saving...' ? '○ SAVING...' : '✕ SYNC ERROR'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Publish and manage collegiate esports tournaments, LANs, and workshops synced live to vrgc.live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onRedirect && (
            <button
              onClick={onRedirect}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#140a27] hover:bg-[#1f103d] text-slate-300 border border-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Dashboard</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingEvent(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Create Event</span>
          </button>
        </div>
      </header>

      {/* ── Search & Filters Toolbar ───────────────────────────────── */}
      <section className="p-4 rounded-2xl bg-[#0e061c]/80 border border-purple-500/20 backdrop-blur-xl space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event name, venue, or description..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#130726] border border-purple-500/30 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {/* Status Segmented Tabs */}
          <div className="flex items-center gap-1 bg-[#130726] p-1 rounded-xl border border-purple-500/30 self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => setSelectedStatus('All')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStatus === 'All'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({events.length})
            </button>
            {EVENT_STATUSES.map((st) => {
              const count = events.filter((e) => e.status === st.value).length;
              return (
                <button
                  key={st.value}
                  onClick={() => setSelectedStatus(st.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStatus === st.value
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <span className="text-[11px] font-mono text-purple-300 font-bold uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">filter_alt</span>
            <span>Category:</span>
          </span>

          <button
            onClick={() => setSelectedType('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              selectedType === 'All'
                ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-900/30'
                : 'bg-[#140a27] border-purple-500/20 text-slate-400 hover:text-slate-200 hover:border-purple-500/40'
            }`}
          >
            All Categories
          </button>

          {EVENT_TYPES.map((type) => {
            const isSelected = selectedType === type;
            const style = EVENT_TYPE_STYLES[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-900/30'
                    : 'bg-[#140a27] border-purple-500/20 text-slate-400 hover:text-slate-200 hover:border-purple-500/40'
                }`}
              >
                <span className="material-symbols-outlined text-sm opacity-80">{style?.icon || 'event'}</span>
                <span>{type}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Events List Section ────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Showing <strong className="text-white">{filteredEvents.length}</strong> of{' '}
            <strong className="text-white">{events.length}</strong> events
          </span>
          {(searchQuery || selectedType !== 'All' || selectedStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('All');
                setSelectedStatus('All');
              }}
              className="text-purple-400 hover:text-purple-300 underline cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mx-auto" />
            <p className="text-xs font-mono">Syncing events with cloud database...</p>
          </div>
        )}

        {/* Empty Search Result / Empty Collection */}
        {!loading && filteredEvents.length === 0 && (
          <div className="p-12 rounded-2xl bg-[#0e061c]/60 border border-purple-500/20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
              <span className="material-symbols-outlined text-2xl">event_busy</span>
            </div>
            <h3 className="text-base font-bold text-white">No matching events found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {events.length === 0
                ? 'No events have been published yet. Click "+ Create Event" above to publish your first collegiate event!'
                : 'No events matched your search and filter criteria. Try resetting filters.'}
            </p>
          </div>
        )}

        {/* Event Cards Grid */}
        {!loading && filteredEvents.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredEvents.map((ev) => {
              const typeStyle = EVENT_TYPE_STYLES[ev.eventType] || EVENT_TYPE_STYLES.Other;
              const statusStyle =
                EVENT_STATUSES.find((s) => s.value === ev.status) || EVENT_STATUSES[0];

              return (
                <div
                  key={ev.id}
                  className="p-5 rounded-2xl bg-[#0e061c]/90 border border-purple-500/20 hover:border-purple-500/40 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_10px_35px_rgba(168,85,247,0.15)] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Badges & Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Event Type Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase font-mono tracking-wider border flex items-center gap-1.5 ${typeStyle.badgeClass}`}
                        >
                          <span className="material-symbols-outlined text-sm">{typeStyle.icon}</span>
                          <span>{ev.eventType}</span>
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyle.badgeClass}`}
                        >
                          {statusStyle.label}
                        </span>
                      </div>

                      {/* Card Menu Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingEvent(ev);
                            setIsModalOpen(true);
                          }}
                          className="w-8 h-8 rounded-lg bg-[#140a27] hover:bg-purple-900/60 text-slate-300 hover:text-white border border-purple-500/20 flex items-center justify-center transition-all cursor-pointer"
                          title="Edit Event"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id, ev.name)}
                          className="w-8 h-8 rounded-lg bg-[#140a27] hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-purple-500/20 hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer"
                          title="Delete Event"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Event Title */}
                    <h3 className="text-lg font-black text-white tracking-wide leading-tight hover:text-purple-300 transition-colors">
                      {ev.name}
                    </h3>

                    {/* Meta Details: Venue & Date/Time */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {/* Venue */}
                      <div className="flex items-center gap-1.5 text-slate-300 bg-[#130726] px-2.5 py-1 rounded-lg border border-purple-500/20">
                        <span className="material-symbols-outlined text-purple-400 text-sm">location_on</span>
                        <span className="truncate max-w-[220px]">{ev.venue}</span>
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-1.5 text-slate-300 bg-[#130726] px-2.5 py-1 rounded-lg border border-purple-500/20">
                        <span className="material-symbols-outlined text-amber-400 text-sm">calendar_month</span>
                        <span className="font-mono">
                          {formatDateLabel(ev.eventDate)}
                          {ev.eventTime ? ` • ${ev.eventTime}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {ev.description}
                    </p>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-3 border-t border-purple-500/15 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      {/* Registration Link Button */}
                      <a
                        href={ev.registrationLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-500/30 hover:border-purple-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>Open Register Link</span>
                      </a>

                      {/* Copy Link Button */}
                      <button
                        onClick={() => handleCopyLink(ev)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#140a27] hover:bg-[#1e0f3b] text-slate-300 hover:text-white border border-purple-500/20 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Copy Registration Link"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {copiedId === ev.id ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedId === ev.id ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {ev.id.slice(0, 10)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Create / Edit Event Modal ───────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl bg-[#0e061c] border border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.2)] p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <span className="material-symbols-outlined text-xl">
                    {editingEvent ? 'edit' : 'add_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingEvent ? 'Edit Event' : 'Create New Event'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingEvent ? 'Modify event parameters and publishing details' : 'Publish a new tournament, LAN, or workshop live'}
                  </p>
                </div>
              </div>

              <button
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#140a27] hover:bg-purple-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Event Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Event Name</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VRGC Valorant Campus Championship 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              {/* Event Type & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                    <span>Category / Type</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as EventType)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white focus:outline-none focus:border-purple-400 transition-colors"
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Event Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as EventStatus)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white focus:outline-none focus:border-purple-400 transition-colors"
                  >
                    {EVENT_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Venue */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Venue / Platform</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formVenue}
                  onChange={(e) => setFormVenue(e.target.value)}
                  placeholder="e.g. Central Auditorium & Spatial Lab (Lab 304)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              {/* Date & Scheduled Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                    <span>Date</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                    Time / Duration
                  </label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="e.g. 17:00 IST or 10:00 AM - 48 Hours"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Description & Details</span>
                  <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Provide tournament format, eligibility, schedule highlights, rules, and prizes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Registration Link */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Registration Link</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="https://forms.gle/... or https://discord.gg/vrgc"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#130726] border border-purple-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <p className="text-[10px] text-slate-500">
                  Students on vrgc.live will be directed to this link when clicking &quot;Register Now&quot;.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-purple-500/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#140a27] hover:bg-[#1e0f3b] text-slate-300 border border-purple-500/20 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isSubmitting ? 'sync' : editingEvent ? 'save' : 'publish'}
                  </span>
                  <span>{isSubmitting ? 'Saving to Cloud...' : editingEvent ? 'Save Changes' : 'Publish Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
