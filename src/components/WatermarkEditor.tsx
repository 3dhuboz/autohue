'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface WatermarkConfig {
  text: string;
  fontSize: number;
  opacity: number;
  color: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  rotation: number;
  fontFamily: string;
}

const DEFAULT_CONFIG: WatermarkConfig = {
  text: 'AutoHue',
  fontSize: 24,
  opacity: 0.3,
  color: '#ffffff',
  position: 'bottom-right',
  rotation: 0,
  fontFamily: 'Arial',
};

const POSITIONS = [
  { key: 'top-left', label: 'Top Left', icon: 'fa-arrow-up', style: 'rotate-[-45deg]' },
  { key: 'top-right', label: 'Top Right', icon: 'fa-arrow-up', style: 'rotate-[45deg]' },
  { key: 'center', label: 'Center', icon: 'fa-crosshairs', style: '' },
  { key: 'bottom-left', label: 'Bottom Left', icon: 'fa-arrow-down', style: 'rotate-[45deg]' },
  { key: 'bottom-right', label: 'Bottom Right', icon: 'fa-arrow-down', style: 'rotate-[-45deg]' },
] as const;

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana'];

export default function WatermarkEditor({
  onConfigChange,
  initialConfig,
}: {
  onConfigChange?: (config: WatermarkConfig) => void;
  initialConfig?: Partial<WatermarkConfig>;
}) {
  const [config, setConfig] = useState<WatermarkConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateConfig = useCallback((updates: Partial<WatermarkConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      onConfigChange?.(next);
      return next;
    });
  }, [onConfigChange]);

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark preview background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Fake car image placeholder
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.fillStyle = '#444';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Preview Image', w / 2, h / 2 - 20);

    // Draw watermark
    ctx.save();
    ctx.globalAlpha = config.opacity;
    ctx.fillStyle = config.color;
    ctx.font = `${config.fontSize}px ${config.fontFamily}`;

    let x = w / 2;
    let y = h / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const padding = 30;
    switch (config.position) {
      case 'top-left': x = padding; y = padding + config.fontSize / 2; ctx.textAlign = 'left'; break;
      case 'top-right': x = w - padding; y = padding + config.fontSize / 2; ctx.textAlign = 'right'; break;
      case 'bottom-left': x = padding; y = h - padding - config.fontSize / 2; ctx.textAlign = 'left'; break;
      case 'bottom-right': x = w - padding; y = h - padding - config.fontSize / 2; ctx.textAlign = 'right'; break;
      case 'center': break;
    }

    if (config.rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate((config.rotation * Math.PI) / 180);
      ctx.fillText(config.text, 0, 0);
    } else {
      ctx.fillText(config.text, x, y);
    }

    ctx.restore();
  }, [config]);

  return (
    <div className="glass-card rounded-3xl p-6 space-y-5">
      <h2 className="font-heading font-bold text-sm flex items-center gap-2">
        <i className="fas fa-stamp text-racing-500" />
        Watermark Editor
        <span className="text-[10px] bg-racing-600/20 text-racing-400 px-2 py-0.5 rounded-full font-bold">PRO</span>
      </h2>

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden border border-white/5">
        <canvas ref={canvasRef} width={400} height={250} className="w-full h-auto bg-carbon-500" />
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Text */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Watermark Text</label>
          <input
            type="text"
            value={config.text}
            onChange={e => updateConfig({ text: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:border-racing-600/50 focus:outline-none transition-colors"
            placeholder="Your watermark text"
          />
        </div>

        {/* Font & Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Font</label>
            <select
              value={config.fontFamily}
              onChange={e => updateConfig({ fontFamily: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              title="Select font"
            >
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Size: {config.fontSize}px</label>
            <input
              type="range"
              min="10"
              max="72"
              value={config.fontSize}
              onChange={e => updateConfig({ fontSize: Number(e.target.value) })}
              className="w-full accent-racing-600"
              title="Font size"
            />
          </div>
        </div>

        {/* Opacity & Rotation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Opacity: {Math.round(config.opacity * 100)}%</label>
            <input
              type="range"
              min="5"
              max="100"
              value={config.opacity * 100}
              onChange={e => updateConfig({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-racing-600"
              title="Opacity"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Rotation: {config.rotation}°</label>
            <input
              type="range"
              min="-45"
              max="45"
              value={config.rotation}
              onChange={e => updateConfig({ rotation: Number(e.target.value) })}
              className="w-full accent-racing-600"
              title="Rotation"
            />
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={config.color}
              onChange={e => updateConfig({ color: e.target.value })}
              className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
              title="Select watermark color"
            />
            <div className="flex gap-1.5">
              {['#ffffff', '#000000', '#dc2626', '#3b82f6', '#22c55e', '#eab308'].map(c => (
                <button
                  key={c}
                  onClick={() => updateConfig({ color: c })}
                  className={`w-6 h-6 rounded-lg border transition-all ${config.color === c ? 'border-racing-500 scale-110' : 'border-white/10'}`}
                  style={{ backgroundColor: c }}
                  title={`Set color to ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">Position</label>
          <div className="flex gap-1.5">
            {POSITIONS.map(p => (
              <button
                key={p.key}
                onClick={() => updateConfig({ position: p.key })}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${config.position === p.key ? 'bg-racing-600/20 text-racing-400 border border-racing-600/30' : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white/50'}`}
                title={p.label}
              >
                <i className={`fas ${p.icon} ${p.style}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { WatermarkConfig };
