import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { Maximize, Minimize, ArrowLeft, Camera, Fish, Menu, Volume2, VolumeX } from "lucide-react";
import type { AquariumState } from "@/lib/aquarium-engine";
import {
  buildBackground,
  drawAssetToContext,
  drawBackgroundFrame,
  Creature,
  rand,
  ensureAudio,
  unlockAudio,
  startAmbientProfile,
  stopAmbientLoop,
  playTone,
  clamp,
} from "@/lib/aquarium-engine";

export interface AquariumViewHandle {
  teleport: (tex: HTMLCanvasElement, name: string, spawn: { scale: number; speed: number; headRight: boolean }) => void;
}

interface AquariumViewProps {
  state: AquariumState;
  bgOffCanvas: HTMLCanvasElement;
  bgCtx: CanvasRenderingContext2D;
  onBack: () => void;
  onToast: (msg: string) => void;
}

const AquariumView = forwardRef<AquariumViewHandle, AquariumViewProps>(({ state, bgOffCanvas, bgCtx, onBack, onToast }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [menuHidden, setMenuHidden] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [speed, setSpeed] = useState(state.aquarium.speed);
  const [scale, setScale] = useState(state.aquarium.scale);
  const [fx, setFx] = useState(state.aquarium.fx);
  const [volume, setVolume] = useState(state.aquarium.volume);
  const [soundProfile, setSoundProfile] = useState(state.aquarium.profile);
  const [soundEnabled, setSoundEnabled] = useState(state.aquarium.soundEnabled);
  const [, forceUpdate] = useState(0);
  const animRef = useRef<number>(0);
  const lastRef = useRef(performance.now());

  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const pr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.parentElement.getBoundingClientRect();
    const newW = Math.max(640, Math.floor(rect.width * pr));
    const newH = Math.max(360, Math.floor(rect.height * pr));
    canvas.width = newW;
    canvas.height = newH;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    state.W = canvas.width;
    state.H = canvas.height;
    bgOffCanvas.width = state.W;
    bgOffCanvas.height = state.H;
    buildBackground(bgCtx, state.W, state.H, state.design);
  }, [state, bgOffCanvas, bgCtx]);

  // Aquarium loop
  useEffect(() => {
    fitCanvas();

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }

      const now = performance.now();
      const rawDt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      state.smoothedDt = state.smoothedDt * (1 - state.dtAlpha) + rawDt * state.dtAlpha;

      ctx.clearRect(0, 0, state.W, state.H);
      drawBackgroundFrame(ctx, bgOffCanvas, now, state);

      // Draw assets
      for (const a of (state.design.assets || [])) drawAssetToContext(ctx, a);

      // Update food
      for (const f of state.aquarium.foods) f.y += f.vy * rawDt;
      state.aquarium.foods = state.aquarium.foods.filter(f => f.y < state.H - 50);

      // Update creatures
      for (const c of state.aquarium.creatures) c.update(rawDt, state.aquarium.creatures, state.aquarium, state.W, state.H);

      // Draw food
      ctx.save();
      ctx.fillStyle = '#ffd56a';
      for (const f of state.aquarium.foods) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Draw creatures
      for (const c of state.aquarium.creatures) c.draw(ctx, state.aquarium.scale);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    const onResize = () => fitCanvas();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [state, bgOffCanvas, bgCtx, fitCanvas]);

  // Teleport
  useImperativeHandle(ref, () => ({
    teleport: async (tex, name, spawn) => {
      await unlockAudio(state.aquarium);
      playTone(state.aquarium, { freq: 220, type: 'sine', duration: 0.18, gain: 0.045, slideTo: 660 });
      setTimeout(() => playTone(state.aquarium, { freq: 480, type: 'sine', duration: 0.16, gain: 0.035, slideTo: 820 }), 70);

      fitCanvas();

      const c = new Creature(tex, name, {
        scale: spawn.scale,
        speed: spawn.speed,
        headRight: spawn.headRight,
      }, state.W, state.H);

      c.x = state.W / 2;
      c.y = state.H * 0.3;
      c.nameA = 1.0;

      state.aquarium.creatures.push(c);

      if (state.aquarium.creatures.length > state.aquarium.max) {
        state.aquarium.creatures.shift();
        onToast('Ältestes Tier entfernt (Limit erreicht)');
      }

      onToast('Dein Tier schwimmt! 🐟');
    },
  }), [state, fitCanvas, onToast]);

  const toggleSound = useCallback(async () => {
    const ok = await unlockAudio(state.aquarium);
    if (!ok) return;
    const next = !state.aquarium.soundEnabled;
    if (next && (!state.aquarium.ambientNodes || state.aquarium.ambientNodes.length === 0) && state.aquarium.profile !== 'off') {
      startAmbientProfile(state.aquarium, state.aquarium.profile || 'aquarium');
    }
    state.aquarium.soundEnabled = next;
    if (state.aquarium.ambientGain && state.aquarium.audioCtx) {
      const now = state.aquarium.audioCtx.currentTime;
      state.aquarium.ambientGain.gain.cancelScheduledValues(now);
      state.aquarium.ambientGain.gain.linearRampToValueAtTime(next ? 0.08 : 0, now + 0.4);
    }
    setSoundEnabled(next);
    onToast(next ? 'Sound aktiviert' : 'Sound deaktiviert');
  }, [state, onToast]);

  const handleFeed = useCallback(async () => {
    await unlockAudio(state.aquarium);
    for (let i = 0; i < 6; i++) {
      state.aquarium.foods.push({ x: rand(40, state.W - 40), y: 80, vy: rand(20, 35) });
    }
    playTone(state.aquarium, { freq: 420, type: 'triangle', duration: 0.08, gain: 0.035, slideTo: 260 });
    setTimeout(() => playTone(state.aquarium, { freq: 360, type: 'triangle', duration: 0.07, gain: 0.03, slideTo: 220 }), 60);
    onToast('Fütterung 🍤');
  }, [state, onToast]);

  const handleScreenshot = useCallback(async () => {
    await unlockAudio(state.aquarium);
    playTone(state.aquarium, { freq: 900, type: 'square', duration: 0.05, gain: 0.02, slideTo: 700 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = data;
    a.download = `DigitalAquarium_${ts}.png`;
    a.click();
  }, [state]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === stageRef.current) {
        await document.exitFullscreen();
      } else {
        await stageRef.current?.requestFullscreen();
      }
      setTimeout(fitCanvas, 50);
    } catch { onToast('Vollbild nicht möglich'); }
  }, [fitCanvas, onToast]);

  const isFs = typeof document !== 'undefined' && document.fullscreenElement === stageRef.current;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      <div ref={stageRef} className="relative flex-1 min-h-0 flex overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="w-full h-full block"
          style={{ background: '#061222', touchAction: 'none', cursor: 'crosshair' }}
          role="img"
          aria-label="Digitales Aquarium"
        />

        {/* Floating panel */}
        {!menuHidden && (
          <div className="absolute right-3 top-3 z-30 w-[min(340px,calc(100vw-24px))] glass-panel p-3 flex flex-col gap-2 max-h-[calc(100vh-100px)] overflow-y-auto animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Speed</span>
              <input type="range" min={0.5} max={3} step={0.1} value={speed} onChange={e => { const v = +e.target.value; setSpeed(v); state.aquarium.speed = v; }} className="flex-1 accent-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Größe</span>
              <input type="range" min={0.5} max={2} step={0.05} value={scale} onChange={e => { const v = +e.target.value; setScale(v); state.aquarium.scale = v; }} className="flex-1 accent-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Effekte</span>
              <input type="range" min={0} max={1} step={0.1} value={fx} onChange={e => { const v = +e.target.value; setFx(v); state.aquarium.fx = v; }} className="flex-1 accent-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Lautstärke</span>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => {
                const v = +e.target.value;
                setVolume(v);
                state.aquarium.volume = v;
                if (state.aquarium.masterGain && state.aquarium.audioCtx) {
                  state.aquarium.masterGain.gain.cancelScheduledValues(state.aquarium.audioCtx.currentTime);
                  state.aquarium.masterGain.gain.linearRampToValueAtTime(v, state.aquarium.audioCtx.currentTime + 0.08);
                }
              }} className="flex-1 accent-primary" />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Soundprofil</span>
              <select value={soundProfile} onChange={async e => {
                const p = e.target.value;
                setSoundProfile(p);
                const ok = await unlockAudio(state.aquarium);
                if (!ok) return;
                state.aquarium.profile = p;
                if (p === 'off') {
                  stopAmbientLoop(state.aquarium);
                  state.aquarium.soundEnabled = false;
                  setSoundEnabled(false);
                } else {
                  startAmbientProfile(state.aquarium, p);
                  if (state.aquarium.soundEnabled) {
                    const now = state.aquarium.audioCtx!.currentTime;
                    state.aquarium.ambientGain!.gain.cancelScheduledValues(now);
                    state.aquarium.ambientGain!.gain.setValueAtTime(0, now);
                    state.aquarium.ambientGain!.gain.linearRampToValueAtTime(0.08, now + 0.45);
                  }
                }
                const labels: Record<string, string> = { aquarium: 'Aquarium', ocean: 'Meeresrauschen', lagoon: 'Lagune', deep: 'Tiefsee', off: 'Aus' };
                onToast('Soundprofil: ' + (labels[p] || p));
              }} className="w-full min-h-[40px] border border-border rounded-xl bg-input text-foreground px-3 py-1.5 text-sm">
                <option value="aquarium">Aquarium</option>
                <option value="ocean">Meeresrauschen</option>
                <option value="lagoon">Lagune</option>
                <option value="deep">Tiefsee</option>
                <option value="off">Aus</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-2 mt-1">
              <button onClick={() => { setListOpen(p => !p); forceUpdate(n => n + 1); }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <Fish className="w-3.5 h-3.5" /> Liste
              </button>
              <button onClick={handleFeed} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                🍤 Füttern
              </button>
              <button onClick={handleScreenshot} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <Camera className="w-3.5 h-3.5" /> Screenshot
              </button>
              <button onClick={toggleSound} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                {soundEnabled ? 'Sound aus' : 'Sound an'}
              </button>
              <button onClick={toggleFullscreen} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                {isFs ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                {isFs ? 'Vollbild aus' : 'Vollbild'}
              </button>
              <button onClick={onBack} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/30 hover:bg-destructive/20 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Zurück
              </button>
              <button onClick={() => setMenuHidden(true)} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                Menü ausblenden
              </button>
            </div>
          </div>
        )}

        {/* Creature list panel */}
        {!menuHidden && listOpen && (
          <div className="absolute right-3 top-[360px] z-40 w-[min(340px,calc(100vw-24px))] glass-panel p-3 max-h-[40vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <strong className="text-sm">🐟 Tiere ({state.aquarium.creatures.length})</strong>
              <button onClick={() => setListOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">✖</button>
            </div>
            {state.aquarium.creatures.map((c, i) => (
              <div key={i} className="bg-card/50 border border-border/50 rounded-lg p-2 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <input type="text" value={c.name} onChange={e => { c.name = e.target.value; c.nameA = 1; forceUpdate(n => n + 1); }} maxLength={24} placeholder="Name" className="flex-1 min-h-[32px] text-sm border border-border rounded-lg bg-input text-foreground px-2 py-1" />
                  <button onClick={() => { state.aquarium.creatures.splice(i, 1); forceUpdate(n => n + 1); onToast('Tier entfernt'); }} className="text-destructive hover:text-destructive/80 text-xs">🗑️</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label>Größe: {c.baseS.toFixed(2)}
                    <input type="range" min={0.5} max={2} step={0.05} value={c.baseS} onChange={e => { c.baseS = clamp(+e.target.value, 0.5, 2); forceUpdate(n => n + 1); }} className="w-full accent-primary" />
                  </label>
                  <label>Speed: {c.speedF.toFixed(2)}
                    <input type="range" min={0.5} max={2} step={0.05} value={c.speedF} onChange={e => { c.speedF = clamp(+e.target.value, 0.5, 2); forceUpdate(n => n + 1); }} className="w-full accent-primary" />
                  </label>
                </div>
              </div>
            ))}
            {state.aquarium.creatures.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Tiere im Aquarium.</p>}
          </div>
        )}

        {/* Peek button when menu hidden */}
        {menuHidden && (
          <button
            onClick={() => setMenuHidden(false)}
            className="absolute top-3 right-3 z-50 inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl glass-panel font-medium text-sm text-foreground hover:bg-secondary/80 transition-colors animate-fade-in"
          >
            <Menu className="w-4 h-4" /> Menü
          </button>
        )}
      </div>
    </div>
  );
});

AquariumView.displayName = 'AquariumView';
export default AquariumView;
