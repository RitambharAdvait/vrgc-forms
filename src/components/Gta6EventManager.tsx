"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPassholders,
  subscribeToGtaTickets,
  addPassholder,
  deletePassholder,
  bulkImportPassholders,
  verifyAndAdmitTicket,
} from '@/lib/samvitya';
import { SamvityaPassHolder, GeneratedGtaTicket } from '@/types/samvitya';
import CameraQrScanner from './CameraQrScanner';

interface Gta6EventManagerProps {
  isAdmin?: boolean;
  userEmail?: string;
  userName?: string;
}

export default function Gta6EventManager({
  isAdmin = false,
  userEmail = '',
  userName = '',
}: Gta6EventManagerProps) {
  const [subTab, setSubTab] = useState<'overview' | 'checkin' | 'whitelist' | 'tickets'>('overview');
  const [passholders, setPassholders] = useState<SamvityaPassHolder[]>([]);
  const [tickets, setTickets] = useState<GeneratedGtaTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Scanner / Check-in State
  const [scannerInput, setScannerInput] = useState<string>('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    alreadyAdmitted?: boolean;
    ticket?: GeneratedGtaTicket;
    message: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Manual Add Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRegNo, setNewRegNo] = useState<string>('');
  const [newTxnId, setNewTxnId] = useState<string>('');
  const [newPassType, setNewPassType] = useState<string>('SAMVITYA_FEST_PASS');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Bulk CSV Import State
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<string>('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    const unsubHolders = subscribeToPassholders((data) => {
      setPassholders(data);
      setLoading(false);
    });

    const unsubTickets = subscribeToGtaTickets((data) => {
      setTickets(data);
    });

    return () => {
      unsubHolders();
      unsubTickets();
    };
  }, []);

  // Quick Stats
  const admittedCount = useMemo(() => {
    return tickets.filter((t) => t.verifiedAtVenue).length;
  }, [tickets]);

  // Check-In Action
  const processTicketAdmission = async (inputStr: string) => {
    if (!inputStr.trim()) return;

    setIsScanning(true);
    setScanResult(null);

    // If QR payload is raw JSON, extract tId or usr
    let searchKey = inputStr.trim();
    try {
      if (searchKey.startsWith('{') && searchKey.endsWith('}')) {
        const parsed = JSON.parse(searchKey);
        searchKey = parsed.tId || parsed.auth || parsed.usr || searchKey;
      }
    } catch {}

    const res = await verifyAndAdmitTicket(searchKey, userEmail || 'crew@vrgc.club');
    setScanResult(res);
    setIsScanning(false);
    if (res.success) {
      setScannerInput('');
    }
  };

  const handleCheckIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await processTicketAdmission(scannerInput);
  };

  const handleCameraScanSuccess = async (decodedText: string) => {
    setIsCameraScannerOpen(false);
    setScannerInput(decodedText);
    await processTicketAdmission(decodedText);
  };

  // Add Single Passholder
  const handleAddPassholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setActionLoading(true);
    const ok = await addPassholder(
      {
        email: newEmail.trim().toLowerCase(),
        name: newName.trim() || 'Participant',
        regNumber: newRegNo.trim().toUpperCase(),
        vtopTransactionId: newTxnId.trim() || 'VTOP-MANUAL',
        passType: newPassType,
      },
      userEmail || 'admin@vrgc.club'
    );

    setActionLoading(false);
    if (ok) {
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      setNewRegNo('');
      setNewTxnId('');
    } else {
      alert('Failed to add passholder. Check Firestore permissions.');
    }
  };

  // Bulk CSV Import
  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setActionLoading(true);
    setBulkStatus('Parsing lines...');

    // Expecting lines of format: email, name, regNumber, vtopTransactionId
    const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
    const parsedList: Array<Omit<SamvityaPassHolder, 'id'>> = [];

    lines.forEach((line) => {
      // Split by comma or tab
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length > 0 && parts[0].includes('@')) {
        parsedList.push({
          email: parts[0].toLowerCase(),
          name: parts[1] || 'Participant',
          regNumber: parts[2] ? parts[2].toUpperCase() : '',
          vtopTransactionId: parts[3] || 'VTOP-BULK',
          passType: parts[4] || 'SAMVITYA_FEST_PASS',
        });
      }
    });

    if (parsedList.length === 0) {
      setActionLoading(false);
      setBulkStatus('❌ No valid emails found in pasted text. Format: email, name, regNo, txnId');
      return;
    }

    setBulkStatus(`Uploading ${parsedList.length} participants to Firestore...`);
    const { added, failed } = await bulkImportPassholders(parsedList, userEmail || 'admin@vrgc.club');

    setActionLoading(false);
    setBulkStatus(`✓ Complete! ${added} added/updated, ${failed} skipped.`);
    if (added > 0) {
      setTimeout(() => {
        setShowBulkModal(false);
        setBulkText('');
        setBulkStatus('');
      }, 2000);
    }
  };

  // Filtered passholders list
  const filteredHolders = useMemo(() => {
    if (!searchQuery.trim()) return passholders;
    const q = searchQuery.toLowerCase();
    return passholders.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.regNumber.toLowerCase().includes(q) ||
        (p.vtopTransactionId && p.vtopTransactionId.toLowerCase().includes(q))
    );
  }, [passholders, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Vice City Event Showcase Hero ─────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border border-rose-500/40 p-6 sm:p-8 bg-gradient-to-r from-[#1b031b] via-[#2d052a] to-[#0a0218] shadow-[0_0_50px_rgba(244,63,94,0.25)]">
        {/* Palm Tree & Sun Aesthetic Accents */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/20 via-fuchsia-600/10 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-rose-500 to-amber-400" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                SAMVITYA 2026 OFFICIAL EVENT
              </span>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 rounded-full">
                Live URL: <a href="https://vrgc.live/events/gta6" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">vrgc.live/events/gta6</a>
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase flex items-center gap-3 font-display">
                <span>GTA VI: VICE CITY SHOWDOWN</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 text-black font-black font-mono">
                  VI
                </span>
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Attendees purchase Samvitya tickets via VTOP. Once whitelisted here, students log in on{' '}
                <strong className="text-rose-400">vrgc.live/events/gta6</strong> to generate their holographic venue entry pass.
              </p>
            </div>
          </div>

          {/* Quick Metrics Badge Grid */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-purple-500/30 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Whitelisted</span>
              <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono">{passholders.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/60 border border-rose-500/30 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Claimed</span>
              <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono">{tickets.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/60 border border-emerald-500/30 text-center min-w-[90px]">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Admitted</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{admittedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Secondary Sub-Navigation Toolbar ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl bg-[#0f041d]/90 border border-purple-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSubTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'overview'
                ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">dashboard</span>
            <span>Venue Gate Overview</span>
          </button>

          <button
            onClick={() => setSubTab('checkin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'checkin'
                ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
            <span>Check-in Scanner</span>
          </button>

          <button
            onClick={() => setSubTab('whitelist')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'whitelist'
                ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">group_add</span>
            <span>VTOP Whitelist ({passholders.length})</span>
          </button>

          <button
            onClick={() => setSubTab('tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              subTab === 'tickets'
                ? 'bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-sm">confirmation_number</span>
            <span>Issued Passes ({tickets.length})</span>
          </button>
        </div>

        {/* Action Buttons for Whitelist */}
        {isAdmin && subTab === 'whitelist' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span>Add Single</span>
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-500 hover:to-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              <span>Import VTOP CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Sub-Tab 1: Overview ────────────────────────────────────────── */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Scanner Launcher Card */}
            <div className="p-6 rounded-3xl bg-[#130724]/90 border border-rose-500/30 space-y-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Venue Entrance Scanner</h3>
                    <p className="text-xs text-slate-400">Scan QR codes or type verification codes to admit attendees.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  <span>Open Camera</span>
                </button>
              </div>

              <form onSubmit={handleCheckIn} className="space-y-3">
                <input
                  type="text"
                  placeholder="Paste QR payload, VCPD code (e.g. VCPD-123456) or Reg No..."
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  className="w-full bg-black/60 border border-rose-500/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-400 font-mono"
                />
                <button
                  type="submit"
                  disabled={isScanning || !scannerInput.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                >
                  <span className="material-symbols-outlined text-sm">how_to_reg</span>
                  <span>{isScanning ? 'Verifying...' : 'Admit Participant'}</span>
                </button>
              </form>

              {scanResult && (
                <div
                  className={`p-4 rounded-xl text-xs font-semibold space-y-1 ${
                    scanResult.success
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                      : scanResult.alreadyAdmitted
                      ? 'bg-amber-950/80 border border-amber-500/50 text-amber-200'
                      : 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">
                      {scanResult.success ? 'check_circle' : scanResult.alreadyAdmitted ? 'warning' : 'cancel'}
                    </span>
                    <span>{scanResult.message}</span>
                  </div>
                  {scanResult.ticket && (
                    <div className="text-[11px] font-mono text-slate-300 pt-1 border-t border-white/10">
                      <span>Pass: {scanResult.ticket.ticketId} • Reg: {scanResult.ticket.regNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Live Link & Guide */}
            <div className="p-6 rounded-3xl bg-[#130724]/90 border border-purple-500/30 space-y-4 backdrop-blur-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">link</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Attendee Workflow Guide</h3>
                    <p className="text-xs text-slate-400">How students claim and use their pass</p>
                  </div>
                </div>

                <ol className="text-xs text-slate-300 space-y-2.5 list-decimal list-inside leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5">
                  <li>Student purchases a Samvitya pass on VTOP.</li>
                  <li>VRGC Admin imports the VTOP email list into the Whitelist tab.</li>
                  <li>Student opens <strong className="text-cyan-300 font-mono">vrgc.live/events/gta6</strong> and signs in with their official college email.</li>
                  <li>Their unique digital pass &amp; QR code is instantly minted.</li>
                  <li>Volunteer scans the attendee's QR at the venue entrance.</li>
                </ol>
              </div>

              <a
                href="https://vrgc.live/events/gta6"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <span>Preview Student Experience on vrgc.live</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Tab 2: Check-In Scanner ────────────────────────────────── */}
      {subTab === 'checkin' && (
        <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#140626]/90 border border-rose-500/40 space-y-6 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/30">
              <span className="material-symbols-outlined text-white text-3xl">qr_code_scanner</span>
            </div>
            <h2 className="text-2xl font-black text-white">Venue Gate Scanner</h2>
            <p className="text-xs text-slate-400">Scan attendee QR pass using mobile camera or enter verification code</p>
          </div>

          {/* Quick Launch Mobile Camera Button */}
          <button
            type="button"
            onClick={() => setIsCameraScannerOpen(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-rose-500 to-amber-500 hover:opacity-95 text-black font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(244,63,94,0.35)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">photo_camera</span>
            <span>Scan with Device Camera</span>
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">OR ENTER CODE MANUALLY</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleCheckIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-purple-300 mb-1.5 uppercase font-mono">
                Scan Code / Ticket Identifier
              </label>
              <input
                type="text"
                autoFocus
                placeholder="VCPD-123456 or GTA6-A78B... or 23BCE10001"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                className="w-full bg-black/60 border border-rose-500/30 rounded-2xl px-4 py-3.5 text-base text-white focus:outline-none focus:border-rose-400 font-mono tracking-wider text-center"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || !scannerInput.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>{isScanning ? 'Verifying...' : 'Admit Participant'}</span>
            </button>
          </form>

          {scanResult && (
            <div
              className={`p-5 rounded-2xl text-xs space-y-2 border ${
                scanResult.success
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                  : scanResult.alreadyAdmitted
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                  : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-lg">
                  {scanResult.success ? 'check_circle' : scanResult.alreadyAdmitted ? 'warning' : 'cancel'}
                </span>
                <span>{scanResult.message}</span>
              </div>

              {scanResult.ticket && (
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-2 border-t border-white/10">
                  <div>Name: <span className="text-white font-bold">{scanResult.ticket.userName}</span></div>
                  <div>Reg No: <span className="text-cyan-300 font-bold">{scanResult.ticket.regNumber}</span></div>
                  <div>Pass: <span className="text-amber-300 font-bold">{scanResult.ticket.ticketId}</span></div>
                  <div>Category: <span className="text-purple-300">{scanResult.ticket.category}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-Tab 3: VTOP Whitelist ──────────────────────────────────── */}
      {subTab === 'whitelist' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search whitelisted participants by name, email, reg no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Whitelisted: <span className="text-purple-300 font-bold">{filteredHolders.length}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-[#120524]/80 overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-black/60 uppercase font-mono text-[10px] text-purple-300 border-b border-purple-500/20">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Participant Name</th>
                    <th className="py-3 px-4">College Email</th>
                    <th className="py-3 px-4">Reg Number</th>
                    <th className="py-3 px-4">VTOP Transaction</th>
                    <th className="py-3 px-4">Pass Type</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredHolders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                        No passholders found. Click &quot;Import VTOP CSV&quot; to bulk add confirmed buyers.
                      </td>
                    </tr>
                  ) : (
                    filteredHolders.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-white/5 transition-all">
                        <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                        <td className="py-3 px-4 font-mono text-purple-300">{p.email}</td>
                        <td className="py-3 px-4 font-mono text-cyan-300 font-bold">{p.regNumber || '—'}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{p.vtopTransactionId || 'VTOP-PASS'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-900/60 text-purple-200 border border-purple-500/30">
                            {p.passType}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                if (p.id && confirm(`Remove ${p.email} from GTA 6 whitelist?`)) {
                                  deletePassholder(p.id);
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300 cursor-pointer p-1"
                              title="Delete passholder"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Tab 4: Issued Passes ─────────────────────────────────── */}
      {subTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search issued passes by name, code, ticket id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Issued: <span className="text-rose-400 font-bold">{tickets.length}</span> • Admitted:{' '}
              <span className="text-emerald-400 font-bold">{admittedCount}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-[#120524]/80 overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-black/60 uppercase font-mono text-[10px] text-purple-300 border-b border-purple-500/20">
                  <tr>
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Reg Number</th>
                    <th className="py-3 px-4">Verification Code</th>
                    <th className="py-3 px-4">Category / Slot</th>
                    <th className="py-3 px-4">Venue Status</th>
                    <th className="py-3 px-4">Issued At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                        No GTA 6 passes claimed yet. When participants log into vrgc.live, their passes will appear here in real time.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.ticketId} className="hover:bg-white/5 transition-all">
                        <td className="py-3 px-4 font-mono text-rose-300 font-bold">{t.ticketId}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{t.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{t.userEmail}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300 font-bold">{t.regNumber}</td>
                        <td className="py-3 px-4 font-mono text-amber-300 font-bold">{t.verificationCode}</td>
                        <td className="py-3 px-4">
                          <span className="block text-slate-200">{t.category}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{t.slotTime}</span>
                        </td>
                        <td className="py-3 px-4">
                          {t.verifiedAtVenue ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 font-mono">
                              ✓ ADMITTED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                              UNCHECKED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">
                          {t.issuedAt ? new Date(t.issuedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Single Passholder ────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#140626] border border-purple-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Whitelist Participant</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddPassholder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">COLLEGE EMAIL *</label>
                <input
                  type="email"
                  required
                  placeholder="student@vitbhopal.ac.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1">PARTICIPANT NAME</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">REG NUMBER</label>
                  <input
                    type="text"
                    placeholder="23BCE10001"
                    value={newRegNo}
                    onChange={(e) => setNewRegNo(e.target.value)}
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-400 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-300 mb-1">VTOP TXN ID</label>
                  <input
                    type="text"
                    placeholder="VTOP-12345"
                    value={newTxnId}
                    onChange={(e) => setNewTxnId(e.target.value)}
                    className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow"
                >
                  {actionLoading ? 'Saving...' : 'Add to Whitelist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Bulk CSV Import ───────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#140626] border border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Import VTOP Buyer List (CSV)</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Paste lines copied from your VTOP Excel/CSV sheet. Format:
                <code className="block mt-1 p-2 rounded bg-black/60 text-cyan-300 font-mono text-[11px]">
                  email, name, registration_number, transaction_id
                </code>
              </p>

              <textarea
                rows={8}
                placeholder="player1@vitbhopal.ac.in, Alex Rivers, 23BCE10001, VTOP-99120&#10;player2@vitbhopal.ac.in, Jordan Cole, 23BCE10045, VTOP-99121"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-black/60 border border-purple-500/30 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
              />

              {bulkStatus && (
                <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-purple-200">
                  {bulkStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={actionLoading || !bulkText.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white text-xs font-bold shadow disabled:opacity-40"
              >
                {actionLoading ? 'Importing...' : 'Upload & Whitelist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Camera QR Scanner Viewport Modal ─────────────────── */}
      {isCameraScannerOpen && (
        <CameraQrScanner
          onScanSuccess={handleCameraScanSuccess}
          onClose={() => setIsCameraScannerOpen(false)}
        />
      )}
    </div>
  );
}
