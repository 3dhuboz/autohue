'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import NavBar from '@/components/NavBar';

const WORKER_BASE = '/api/worker';

const COLOR_INFO: Record<string, { label: string; swatch: string; glow: string }> = {
  'red':         { label: 'Red',         swatch: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
  'blue':        { label: 'Blue',        swatch: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
  'green':       { label: 'Green',       swatch: '#22c55e', glow: 'rgba(34,197,94,0.3)' },
  'yellow':      { label: 'Yellow',      swatch: '#eab308', glow: 'rgba(234,179,8,0.3)' },
  'orange':      { label: 'Orange',      swatch: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  'purple':      { label: 'Purple',      swatch: '#a855f7', glow: 'rgba(168,85,247,0.3)' },
  'pink':        { label: 'Pink',        swatch: '#ec4899', glow: 'rgba(236,72,153,0.3)' },
  'brown':       { label: 'Brown',       swatch: '#a16207', glow: 'rgba(161,98,7,0.3)' },
  'black':       { label: 'Black',       swatch: '#334155', glow: 'rgba(51,65,85,0.3)' },
  'white':       { label: 'White',       swatch: '#e2e8f0', glow: 'rgba(226,232,240,0.2)' },
  'silver-grey': { label: 'Silver/Grey', swatch: '#94a3b8', glow: 'rgba(148,163,184,0.3)' },
  'unknown':     { label: 'Unknown',     swatch: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  'please-double-check': { label: 'Needs Review', swatch: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
};

interface FolderInfo { name: string; count: number; }
interface FileInfo { name: string; url: string; size: number; }
interface SessionMeta {
  id: string;
  workerSession: string;
  totalImages: number;
  status: string;
  colorCounts: Record<string, number> | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function SessionDetailPage() {
  const { data: authSession, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const sessionDbId = params.id as string;

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [expandedColor, setExpandedColor] = useState<string | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch session metadata from our API
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch(`/api/sort/sessions/${sessionDbId}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => setMeta(data))
      .catch(() => setError('Session not found or access denied.'));
  }, [authStatus, sessionDbId]);

  // Fetch folder listing from worker once we have the workerSession
  useEffect(() => {
    if (!meta?.workerSession) return;
    fetch(`${WORKER_BASE}/folders/${meta.workerSession}`)
      .then(r => r.json())
      .then(data => setFolders(data.folders || []))
      .catch(() => setFolders([]));
  }, [meta?.workerSession]);

  // Load files when a color folder is expanded
  const loadFiles = useCallback(async (folder: string) => {
    if (!meta?.workerSession) return;
    if (expandedColor === folder) { setExpandedColor(null); setFiles([]); return; }
    setExpandedColor(folder);
    setLoadingFiles(true);
    try {
      const res = await fetch(`${WORKER_BASE}/browse/${meta.workerSession}/${folder}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch { setFiles([]); }
    setLoadingFiles(false);
  }, [meta?.workerSession, expandedColor]);

  // Reassign a file to a different color
  const reassignFile = useCallback(async (filename: string, fromFolder: string, toFolder: string) => {
    if (!meta?.workerSession || fromFolder === toFolder) return;
    try {
      const res = await fetch(`${WORKER_BASE}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: meta.workerSession, filename, fromFolder, toFolder }),
      });
      if (res.ok) {
        // Refresh folders and files
        const foldersRes = await fetch(`${WORKER_BASE}/folders/${meta.workerSession}`);
        const foldersData = await foldersRes.json();
        setFolders(foldersData.folders || []);
        // Reload current expanded folder
        if (expandedColor) {
          const filesRes = await fetch(`${WORKER_BASE}/browse/${meta.workerSession}/${expandedColor}`);
          const filesData = await filesRes.json();
          setFiles(filesData.files || []);
          // Close if empty
          if ((filesData.files || []).length === 0) setExpandedColor(null);
        }
      }
    } catch { /* best effort */ }
  }, [meta?.workerSession, expandedColor]);

  // Delete session
  const handleDelete = async () => {
    if (!confirm('Delete this session and all its files? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await fetch(`/api/sort/sessions/${sessionDbId}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch { setDeleting(false); }
  };

  if (authStatus === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><i className="fas fa-spinner fa-spin text-racing-500 text-3xl" /></div>;
  }
  if (authStatus === 'unauthenticated') { router.push('/login'); return null; }

  if (error) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="container mx-auto px-6 max-w-4xl mt-20 text-center">
          <i className="fas fa-exclamation-triangle text-red-400 text-4xl mb-4" />
          <h1 className="text-xl font-heading font-bold mb-2">Session Not Found</h1>
          <p className="text-white/40 text-sm mb-6">{error}</p>
          <Link href="/dashboard" className="btn-racing px-6 py-2.5 rounded-xl text-sm">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!meta) {
    return <div className="min-h-screen flex items-center justify-center"><i className="fas fa-spinner fa-spin text-racing-500 text-3xl" /></div>;
  }

  const expired = meta.expiresAt ? new Date(meta.expiresAt).getTime() < Date.now() : false;
  const totalImages = folders.reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="min-h-screen">
      <NavBar />

      <div className="container mx-auto px-6 max-w-4xl mt-10 mb-20 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-white/30 hover:text-white/50 transition-colors mb-2 inline-block">
              <i className="fas fa-arrow-left mr-1" />Dashboard
            </Link>
            <h1 className="text-2xl font-heading font-black">Session Details</h1>
            <p className="text-white/40 text-xs mt-1">
              {new Date(meta.createdAt).toLocaleString()} &middot; {meta.totalImages} images &middot; {meta.status}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!expired && meta.status === 'completed' && (
              <button
                onClick={() => window.open(`${WORKER_BASE}/download/${meta.workerSession}`, '_blank')}
                className="btn-racing px-5 py-2.5 rounded-xl text-sm"
              >
                <i className="fas fa-download mr-2" />Download ZIP
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-carbon px-4 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 disabled:opacity-30"
            >
              <i className={`fas ${deleting ? 'fa-spinner fa-spin' : 'fa-trash'} mr-1`} />Delete
            </button>
          </div>
        </div>

        {/* Expiry warning */}
        {expired && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <i className="fas fa-exclamation-circle" />
            This session&apos;s files have expired and may no longer be available on the server.
          </div>
        )}

        {/* No folders / files gone */}
        {folders.length === 0 && !expired && (
          <div className="glass-card rounded-2xl p-8 text-center text-white/30">
            <i className="fas fa-folder-open text-3xl mb-3" />
            <p className="text-sm">No sorted files found on the server for this session.</p>
            <p className="text-xs mt-1">Files may have been cleaned up or the worker was redeployed.</p>
          </div>
        )}

        {/* Color folders grid */}
        {folders.length > 0 && (
          <>
            <div className="text-xs text-white/30 font-bold uppercase tracking-wider">
              {totalImages} images in {folders.length} folders — click to expand &amp; edit
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {folders.map(folder => {
                const info = COLOR_INFO[folder.name] || COLOR_INFO['unknown'];
                const isExpanded = expandedColor === folder.name;
                return (
                  <button
                    key={folder.name}
                    onClick={() => loadFiles(folder.name)}
                    className={`glass-card rounded-2xl p-4 text-center transition-all border ${isExpanded ? 'border-racing-600/40 ring-1 ring-racing-600/20' : 'border-white/5 hover:border-white/10'}`}
                    title={`${info.label}: ${folder.count} images`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl mx-auto mb-2"
                      style={{ backgroundColor: info.swatch, boxShadow: `0 0 20px ${info.glow}` }}
                    />
                    <div className="text-sm font-bold">{info.label}</div>
                    <div className="text-2xl font-heading font-black text-white mt-1">{folder.count}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">images</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Expanded folder: image list with reassign */}
        {expandedColor && (
          <div className="glass-card rounded-2xl p-5 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: (COLOR_INFO[expandedColor] || COLOR_INFO['unknown']).swatch }}
                />
                {(COLOR_INFO[expandedColor] || COLOR_INFO['unknown']).label} — {files.length} images
              </h3>
              <button onClick={() => { setExpandedColor(null); setFiles([]); }} className="text-white/20 hover:text-white/50 text-xs" title="Close">
                <i className="fas fa-times" />
              </button>
            </div>

            {loadingFiles ? (
              <div className="text-center py-6 text-white/20"><i className="fas fa-spinner fa-spin text-xl" /></div>
            ) : files.length === 0 ? (
              <div className="text-center py-6 text-white/20 text-sm">No images in this folder</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map(file => (
                  <div key={file.name} className="bg-white/[0.02] rounded-xl p-2 border border-white/5">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-black/30 mb-2">
                      <img
                        src={`${WORKER_BASE}${file.url}`}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="text-[10px] text-white/30 truncate mb-1.5" title={file.name}>{file.name}</div>
                    <select
                      value={expandedColor}
                      onChange={e => reassignFile(file.name, expandedColor, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/50 focus:outline-none"
                      aria-label={`Reassign ${file.name}`}
                      title="Move to different color"
                    >
                      {Object.entries(COLOR_INFO).map(([key, ci]) => (
                        <option key={key} value={key} className="bg-gray-900">{ci.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
