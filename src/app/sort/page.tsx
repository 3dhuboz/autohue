'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import TachoGauge from '@/components/gauges/TachoGauge';
import WatermarkEditor from '@/components/WatermarkEditor';

const WORKER_BASE = '/api/worker';
const MANUAL_SECONDS_PER_IMAGE = 20; // avg time to manually sort one car photo

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

type Phase = 'upload' | 'processing' | 'complete';

interface ProcessingStats {
  processed: number;
  total: number;
  currentFile: string;
  startTime: number;
  imagesPerSecond: number;
  avgConfidence: number;
  timeSavedSeconds: number;
  results: Array<{ file: string; color: string; confidence: number }>;
  colorCounts: Record<string, number>;
}

export default function SortPage() {
  const { data: authSession, status: authStatus } = useSession();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [creditError, setCreditError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedColor, setExpandedColor] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessingStats>({
    processed: 0, total: 0, currentFile: '', startTime: 0,
    imagesPerSecond: 0, avgConfidence: 0, timeSavedSeconds: 0,
    results: [], colorCounts: {},
  });
  const [dragOver, setDragOver] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ remaining: number; isUnlimited: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef(0);
  const completionRecorded = useRef(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetch('/api/credits')
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(setCreditsInfo)
        .catch(() => {});
    }
  }, [authStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(f =>
      f.type.startsWith('image/') || /\.(zip|rar)$/i.test(f.name)
    );
    setFiles(prev => [...prev, ...arr]);
  }, []);

  const startProcessing = async () => {
    if (files.length === 0) return;
    setCreditError('');
    setUploading(true);

    // Check credits before uploading
    try {
      const creditCheck = await fetch('/api/sort/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageCount: files.length }),
      });
      if (!creditCheck.ok) {
        const creditData = await creditCheck.json().catch(() => ({ error: 'Credit check failed' }));
        setCreditError(creditData.error || 'Credit check failed');
        return;
      }
    } catch {
      setCreditError('Could not verify credits. Please try again.');
      setUploading(false);
      return;
    }

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch(`${WORKER_BASE}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Processing worker is not available. Please try again later.');
      }
      const data = await res.json();

      setSessionId(data.session_id);
      cursorRef.current = 0;
      completionRecorded.current = false;
      setStats({
        processed: 0, total: 0, currentFile: 'Starting...', startTime: Date.now(),
        imagesPerSecond: 0, avgConfidence: 0, timeSavedSeconds: 0,
        results: [], colorCounts: {},
      });
      setPhase('processing');
      startPolling(data.session_id);
    } catch (err: unknown) {
      setCreditError(err instanceof Error ? err.message : 'Processing worker is not available.');
      setUploading(false);
    }
  };

  const startPolling = (sid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${WORKER_BASE}/status/${sid}?since=${cursorRef.current}`);
        if (res.status === 404) return;
        const data = await res.json();

        if (data.new_results?.length) {
          cursorRef.current += data.new_results.length;
          setStats(prev => {
            const confMap: Record<string, number> = { high: 0.95, medium: 0.75, low: 0.5, none: 0.3 };
            const newResults = [...prev.results, ...data.new_results.map((r: { file: string; color: string; confidence: string | number }) => ({
              file: r.file, color: r.color, confidence: typeof r.confidence === 'number' ? r.confidence : (confMap[r.confidence] ?? 0.5),
            }))];
            const elapsed = (Date.now() - prev.startTime) / 1000;
            const processed = data.processed || newResults.length;
            const ips = elapsed > 0 ? processed / elapsed : 0;
            const avgConf = newResults.reduce((sum: number, r: { confidence: number }) => sum + r.confidence, 0) / newResults.length;
            const manualTime = processed * MANUAL_SECONDS_PER_IMAGE;
            const aiTime = elapsed;
            const counts: Record<string, number> = {};
            newResults.forEach((r: { color: string }) => { counts[r.color] = (counts[r.color] || 0) + 1; });

            return {
              ...prev,
              processed,
              total: data.total || prev.total,
              currentFile: data.current_file || prev.currentFile,
              imagesPerSecond: ips,
              avgConfidence: avgConf,
              timeSavedSeconds: Math.max(0, manualTime - aiTime),
              results: newResults,
              colorCounts: counts,
            };
          });
        }

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPhase('complete');
          // Record completion and deduct credits
          if (!completionRecorded.current) {
            completionRecorded.current = true;
            setStats(prev => {
              fetch('/api/sort/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workerSession: sid,
                  totalImages: prev.processed,
                  colorCounts: prev.colorCounts,
                }),
              }).catch(console.error);
              return prev;
            });
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1500);
  };

  const reassignImage = async (filename: string, fromFolder: string, toFolder: string) => {
    try {
      const res = await fetch(`${WORKER_BASE}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, filename, fromFolder, toFolder }),
      });
      if (!res.ok) return;
      setStats(prev => {
        const updatedResults = prev.results.map(r =>
          r.file === filename && r.color === fromFolder ? { ...r, color: toFolder } : r
        );
        const counts: Record<string, number> = {};
        updatedResults.forEach(r => { counts[r.color] = (counts[r.color] || 0) + 1; });
        return { ...prev, results: updatedResults, colorCounts: counts };
      });
    } catch (e) { console.error('Reassign failed:', e); }
  };

  const progressPct = stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0;
  const speedPct = Math.min((stats.imagesPerSecond / 10) * 100, 100);
  const confPct = stats.avgConfidence * 100;
  const timeSavedFormatted = formatTimeSaved(stats.timeSavedSeconds);

  return (
    <div className="min-h-screen pb-20">
      <NavBar />

      <div className="container mx-auto px-6 max-w-6xl mt-8">

        {/* ═══════ UPLOAD PHASE ═══════ */}
        {phase === 'upload' && (
          <div className="animate-fade-up space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-heading font-black mb-2">
                Upload Your <span className="text-racing-500">Car Photos</span>
              </h1>
              <p className="text-white/40 text-sm">Drag & drop images or archives. We&apos;ll sort them by color in seconds.</p>
              {creditsInfo && (
                <div className="inline-flex items-center gap-2 mt-3 bg-white/[0.03] border border-white/5 rounded-full px-4 py-1.5 text-xs">
                  <i className="fas fa-coins text-racing-500" />
                  <span className="text-white/50">
                    {creditsInfo.isUnlimited ? 'Unlimited credits' : `${creditsInfo.remaining} credits remaining`}
                  </span>
                </div>
              )}
            </div>

            {creditError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <i className="fas fa-exclamation-circle" />
                {creditError}
                <Link href="/account" className="ml-auto text-racing-500 hover:text-racing-400 text-xs font-bold">Upgrade</Link>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`drop-zone glass-card rounded-3xl p-12 text-center cursor-pointer ${dragOver ? 'dragover' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.zip,.rar"
                className="hidden"
                title="Select car photos or archives"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
              <div className="w-20 h-20 rounded-2xl bg-racing-600/10 border border-racing-600/20 flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-cloud-upload-alt text-racing-500 text-3xl" />
              </div>
              <p className="text-white/60 font-semibold mb-2">Drop car photos here or click to browse</p>
              <p className="text-white/25 text-xs">JPG, PNG, WEBP, ZIP, RAR &mdash; up to 5,000+ images per batch</p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="glass-card rounded-3xl p-6 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                    <i className="fas fa-images text-racing-500" />
                    Ready to Process
                    <span className="bg-racing-600/20 text-racing-400 text-xs font-bold px-2.5 py-0.5 rounded-full">{files.length}</span>
                  </h3>
                  <button onClick={() => setFiles([])} className="text-xs text-white/30 hover:text-red-400 transition-colors">
                    <i className="fas fa-trash-alt mr-1" />Clear
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-6">
                  {files.slice(0, 50).map((f, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-white/[0.02] text-xs">
                      <i className="fas fa-image text-white/20" />
                      <span className="text-white/50 truncate flex-1">{f.name}</span>
                      <span className="text-white/20">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                  {files.length > 50 && (
                    <div className="text-center text-xs text-white/20 py-2">
                      + {files.length - 50} more files
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  <button onClick={startProcessing} disabled={uploading} className="btn-racing px-10 py-4 rounded-2xl text-lg shadow-xl glow-red disabled:opacity-60 disabled:cursor-wait">
                    {uploading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2" />
                        Uploading & Starting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-flag-checkered mr-2" />
                        Start Sorting
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ PROCESSING PHASE ═══════ */}
        {phase === 'processing' && (
          <div className="animate-fade-up space-y-6">
            {/* Racing dashboard header */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-heading font-black text-white">
                <i className="fas fa-flag-checkered text-racing-500 mr-2 animate-pulse" />
                Sorting in Progress
              </h2>
              <p className="text-white/30 text-sm mt-1">AI is detecting cars and classifying colors</p>
            </div>

            {/* ─── GAUGES ROW ─── */}
            <div className="glass-card rounded-3xl p-8 red-accent-top">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                {/* Speed gauge */}
                <TachoGauge
                  value={speedPct}
                  max={10}
                  label="SPEED"
                  unit="img/sec"
                  displayValue={stats.imagesPerSecond.toFixed(1)}
                  size={180}
                  variant="red"
                  redZoneStart={80}
                />

                {/* Accuracy gauge */}
                <TachoGauge
                  value={confPct}
                  max={100}
                  label="ACCURACY"
                  unit="confidence"
                  displayValue={confPct > 0 ? `${confPct.toFixed(0)}%` : '--'}
                  size={180}
                  variant="green"
                  redZoneStart={95}
                />

                {/* Progress gauge */}
                <TachoGauge
                  value={progressPct}
                  max={100}
                  label="PROGRESS"
                  unit={`${stats.processed}/${stats.total}`}
                  displayValue={`${progressPct}%`}
                  size={180}
                  variant="amber"
                  redZoneStart={90}
                />

                {/* Time saved display */}
                <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-racing-600/10 border border-racing-600/20 flex items-center justify-center">
                    <i className="fas fa-stopwatch text-racing-500 text-2xl" />
                  </div>
                  <div className="text-center">
                    <div className="digital-readout text-3xl font-black text-white">{timeSavedFormatted}</div>
                    <div className="text-[10px] text-white/30 mt-1">TIME SAVED vs manual</div>
                  </div>
                  <div className="text-[10px] text-white/20 text-center leading-relaxed">
                    Manual: ~{MANUAL_SECONDS_PER_IMAGE}s per photo
                    <br />
                    AutoHue: {stats.imagesPerSecond > 0 ? `~${(1/stats.imagesPerSecond).toFixed(1)}s` : '--'} per photo
                  </div>
                </div>
              </div>
            </div>

            {/* ─── PROGRESS BAR + CURRENT FILE ─── */}
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50 flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin text-racing-500 text-xs" />
                  {stats.currentFile ? `Processing: ${stats.currentFile}` : 'Starting...'}
                </span>
                <span className="digital-readout text-white/60">{stats.processed} / {stats.total}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden relative">
                <div
                  className="h-3 rounded-full transition-all duration-700 ease-out relative"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #dc2626, #ef4444, #f97316)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>
              </div>
              <div className="text-center text-xs text-white/20">{progressPct}% complete</div>
            </div>

            {/* ─── COLOR DISTRIBUTION BAR ─── */}
            {Object.keys(stats.colorCounts).length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white/30 mb-3 flex items-center gap-2">
                  <i className="fas fa-chart-bar text-racing-500" />
                  Live Color Distribution
                </h3>
                <div className="flex h-8 rounded-lg overflow-hidden bg-white/5 mb-3">
                  {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([color, count]) => {
                    const info = COLOR_INFO[color] || COLOR_INFO['unknown'];
                    const pct = stats.processed > 0 ? (count / stats.processed) * 100 : 0;
                    return (
                      <div
                        key={color}
                        className="h-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: info.swatch, minWidth: count > 0 ? '3px' : '0' }}
                        title={`${info.label}: ${count} (${pct.toFixed(0)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([color, count]) => {
                    const info = COLOR_INFO[color] || COLOR_INFO['unknown'];
                    return (
                      <div key={color} className="flex items-center gap-1.5 text-[10px] text-white/40">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: info.swatch, boxShadow: `0 0 4px ${info.glow}` }} />
                        {info.label} ({count})
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ COMPLETE PHASE ═══════ */}
        {phase === 'complete' && (
          <div className="animate-fade-up space-y-6">
            {/* Completion header */}
            <div className="glass-card rounded-3xl p-10 text-center red-accent-top">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-racing-600 to-racing-800 mb-6 glow-red-strong">
                <i className="fas fa-flag-checkered text-white text-3xl" />
              </div>
              <h2 className="text-3xl font-heading font-black mb-2">Sorting Complete!</h2>
              <p className="text-white/40 text-sm">{stats.processed} images sorted into {Object.keys(stats.colorCounts).length} color folders</p>

              {/* Retention notice */}
              <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-400">
                <i className="fas fa-clock" />
                Your sorted files are stored based on your plan. Download before they expire, or upgrade for longer retention.
              </div>

              {/* Final stats */}
              <div className="flex items-center justify-center gap-8 mt-8 pt-6 border-t border-white/5">
                <div className="text-center">
                  <div className="text-2xl font-heading font-black text-racing-500">{stats.imagesPerSecond.toFixed(1)}</div>
                  <div className="text-[10px] text-white/30 mt-1">img/sec avg</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-heading font-black text-green-400">{confPct.toFixed(0)}%</div>
                  <div className="text-[10px] text-white/30 mt-1">accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-heading font-black text-amber-400">{timeSavedFormatted}</div>
                  <div className="text-[10px] text-white/30 mt-1">time saved</div>
                </div>
              </div>
            </div>

            {/* Color cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 stagger">
              {Object.entries(stats.colorCounts).sort((a, b) => b[1] - a[1]).map(([color, count]) => {
                const info = COLOR_INFO[color] || COLOR_INFO['unknown'];
                const isExpanded = expandedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => setExpandedColor(isExpanded ? null : color)}
                    className={`color-card glass-card rounded-2xl p-5 text-left transition-all ${isExpanded ? 'ring-2 ring-white/30' : 'hover:scale-[1.03]'}`}
                    style={{ borderColor: `${info.swatch}20` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl" style={{ background: info.swatch, boxShadow: `0 0 12px ${info.glow}` }} />
                      <span className="font-heading font-bold text-sm">{info.label}</span>
                      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-white/20 text-xs ml-auto`} />
                    </div>
                    <div className="digital-readout text-2xl font-black" style={{ color: info.swatch }}>{count}</div>
                    <div className="text-[10px] text-white/25 mt-1">images — click to review</div>
                  </button>
                );
              })}
            </div>

            {/* Expanded color panel — shows images for the selected color */}
            {expandedColor && (
              <div className="glass-card rounded-2xl p-6 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg" style={{ background: (COLOR_INFO[expandedColor] || COLOR_INFO['unknown']).swatch }} />
                    {(COLOR_INFO[expandedColor] || COLOR_INFO['unknown']).label} — {stats.results.filter(r => r.color === expandedColor).length} images
                  </h3>
                  <button onClick={() => setExpandedColor(null)} title="Close panel" className="text-white/30 hover:text-white transition-colors">
                    <i className="fas fa-times" />
                  </button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {stats.results.filter(r => r.color === expandedColor).map((result, idx) => (
                    <div key={`${result.file}-${idx}`} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                      <i className="fas fa-image text-white/20 text-sm" />
                      <span className="text-sm text-white/70 truncate flex-1">{result.file}</span>
                      <select
                        value={result.color}
                        onChange={(e) => reassignImage(result.file, result.color, e.target.value)}
                        aria-label={`Color for ${result.file}`}
                        className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 cursor-pointer focus:outline-none focus:border-racing-500"
                      >
                        {Object.entries(COLOR_INFO).map(([key, ci]) => (
                          <option key={key} value={key} className="bg-gray-900 text-white">{ci.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Watermark editor for Pro/Enterprise */}
            {(authSession?.user?.plan === 'PRO' || authSession?.user?.plan === 'ENTERPRISE') && (
              <WatermarkEditor />
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => window.open(`${WORKER_BASE}/download/${sessionId}`, '_blank')}
                className="btn-racing px-10 py-4 rounded-2xl text-lg shadow-xl glow-red"
              >
                <i className="fas fa-download mr-2" />
                Download Sorted ZIP
              </button>
              <button
                onClick={() => { setPhase('upload'); setFiles([]); setSessionId(''); }}
                className="btn-carbon px-6 py-3 rounded-xl"
              >
                <i className="fas fa-redo mr-2" />Sort More
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <i className={`fas ${icon} text-racing-500 text-xs`} />
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{label}</span>
      </div>
      {value && <div className="digital-readout text-xl font-black text-white">{value}</div>}
      <div className="text-xs text-white/25 truncate">{sub}</div>
    </div>
  );
}

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
