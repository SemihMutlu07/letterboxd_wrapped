'use client';
import { Monitor, Smartphone } from 'lucide-react';

type Orientation = 'horizontal' | 'vertical';

type Props = {
  orientation: Orientation;
  onChange: (o: Orientation) => void;
};

export default function OrientationToggle({ orientation, onChange }: Props) {
  return (
    <div className="mt-6 flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Card orientation">
        <button
          onClick={() => onChange('horizontal')}
          aria-pressed={orientation === 'horizontal'}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
            orientation === 'horizontal'
              ? 'bg-white text-black'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Monitor size={18} />
          <div className="text-left">
            <div className="text-sm font-semibold">Horizontal</div>
            <div className="text-xs opacity-70">1200×630px</div>
          </div>
        </button>
        <button
          onClick={() => onChange('vertical')}
          aria-pressed={orientation === 'vertical'}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
            orientation === 'vertical'
              ? 'bg-white text-black'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Smartphone size={18} />
          <div className="text-left">
            <div className="text-sm font-semibold">Vertical</div>
            <div className="text-xs opacity-70">630×1200px</div>
          </div>
        </button>
      </div>
    </div>
  );
}
