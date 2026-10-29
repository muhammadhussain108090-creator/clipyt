import React from 'react';
import { Smartphone, Square, Monitor, Type, Sliders, Palette, Layers } from 'lucide-react';

export interface GenerationSettings {
  clipDuration: number; // 15, 30, 45, 60
  clipCount: number; // 1, 3, 5, 10
  aspectRatio: '9:16' | '1:1' | '16:9';
  captionStyle: 'viral_yellow' | 'cyber_purple' | 'clean_white' | 'boxed_dark';
  fontSize: number; // 20 - 44
  captionPosition: 'bottom' | 'top' | 'center';
  burnSubtitles: boolean;
}

interface ClipSettingsProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
  disabled?: boolean;
}

export const ClipSettings: React.FC<ClipSettingsProps> = ({
  settings,
  onChange,
  disabled = false,
}) => {
  const updateSetting = <K extends keyof GenerationSettings>(
    key: K,
    val: GenerationSettings[K]
  ) => {
    onChange({
      ...settings,
      [key]: val,
    });
  };

  const captionStyles = [
    {
      id: 'viral_yellow',
      name: 'Viral Yellow',
      subtitle: 'MrBeast / Hormozi style',
      preview: 'TEXT HOOK',
      previewClass: 'text-amber-300 font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] stroke-black',
    },
    {
      id: 'cyber_purple',
      name: 'Cyber Purple',
      subtitle: 'Neon gradient & glow',
      preview: 'TEXT HOOK',
      previewClass: 'text-fuchsia-400 font-extrabold drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]',
    },
    {
      id: 'clean_white',
      name: 'Clean White',
      subtitle: 'Crisp minimal aesthetic',
      preview: 'TEXT HOOK',
      previewClass: 'text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
    },
    {
      id: 'boxed_dark',
      name: 'Boxed Dark',
      subtitle: 'Modern dark pill backing',
      preview: 'TEXT HOOK',
      previewClass: 'text-white font-bold bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700',
    },
  ];

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Sliders className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Clip & Caption Preferences
        </h3>
      </div>

      {/* Row 1: Duration & Number of Clips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Clip Duration */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Target Clip Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={disabled}
                onClick={() => updateSetting('clipDuration', sec)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.clipDuration === sec
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/40'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Number of Clips */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Max Clips to Extract
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                disabled={disabled}
                onClick={() => updateSetting('clipCount', count)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.clipCount === count
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/40'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                {count} {count === 1 ? 'Clip' : 'Clips'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aspect Ratio Options */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">
          Output Aspect Ratio & Framing
        </label>
        <div className="grid grid-cols-3 gap-3">
          {/* 9:16 Vertical */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateSetting('aspectRatio', '9:16')}
            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              settings.aspectRatio === '9:16'
                ? 'bg-purple-950/50 border-purple-500 ring-1 ring-purple-500 text-white'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-5 h-5 text-purple-400" />
            <div className="text-center">
              <p className="text-xs font-bold">9:16 Vertical</p>
              <p className="text-[10px] text-slate-400">TikTok, Shorts, Reels</p>
            </div>
          </button>

          {/* 1:1 Square */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateSetting('aspectRatio', '1:1')}
            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              settings.aspectRatio === '1:1'
                ? 'bg-purple-950/50 border-purple-500 ring-1 ring-purple-500 text-white'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Square className="w-5 h-5 text-pink-400" />
            <div className="text-center">
              <p className="text-xs font-bold">1:1 Square</p>
              <p className="text-[10px] text-slate-400">Instagram, LinkedIn</p>
            </div>
          </button>

          {/* 16:9 Landscape */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateSetting('aspectRatio', '16:9')}
            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              settings.aspectRatio === '16:9'
                ? 'bg-purple-950/50 border-purple-500 ring-1 ring-purple-500 text-white'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-5 h-5 text-indigo-400" />
            <div className="text-center">
              <p className="text-xs font-bold">16:9 Standard</p>
              <p className="text-[10px] text-slate-400">YouTube, Twitter/X</p>
            </div>
          </button>
        </div>
      </div>

      {/* Subtitle & Caption Customization */}
      <div className="pt-2 border-t border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-semibold text-slate-200">
              Captions & Subtitle Styling
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-400">Burn into video</span>
            <input
              type="checkbox"
              disabled={disabled}
              checked={settings.burnSubtitles}
              onChange={(e) => updateSetting('burnSubtitles', e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-700 cursor-pointer"
            />
          </label>
        </div>

        {/* Caption Style Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {captionStyles.map((style) => {
            const isSelected = settings.captionStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                disabled={disabled}
                onClick={() => updateSetting('captionStyle', style.id as any)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-pink-500 bg-pink-950/30 ring-1 ring-pink-500/40 text-white shadow-md shadow-pink-950/20'
                    : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="h-9 flex items-center justify-center mb-1">
                  <span className={`text-xs ${style.previewClass}`}>{style.preview}</span>
                </div>
                <p className="text-[11px] font-bold text-white">{style.name}</p>
                <p className="text-[9px] text-slate-400 truncate">{style.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* Font size & position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
              <span>Font Size</span>
              <span className="font-semibold text-purple-300">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={20}
              max={44}
              step={2}
              disabled={disabled}
              value={settings.fontSize}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-1.5">Caption Position</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['bottom', 'center', 'top'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateSetting('captionPosition', pos)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-all cursor-pointer ${
                    settings.captionPosition === pos
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
