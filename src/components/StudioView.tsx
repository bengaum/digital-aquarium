import { useRef, useCallback, useState } from "react";
import { Camera, Upload, Sparkles, Wrench, Rocket, Waves, Trash2 } from "lucide-react";
import type { AquariumState } from "@/lib/aquarium-engine";
import { autoBackgroundSample, prepare as prepareEngine, getPointerPos } from "@/lib/aquarium-engine";

interface StudioViewProps {
  state: AquariumState;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  onTeleport: () => void;
  onGotoAquarium: () => void;
  onClearAquarium: () => void;
  onModeChange: (mode: string) => void;
  onToast: (msg: string) => void;
}

export default function StudioView({
  state,
  previewCanvasRef,
  onTeleport,
  onGotoAquarium,
  onClearAquarium,
  onModeChange,
  onToast,
}: StudioViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [childName, setChildName] = useState('');
  const [segMode, setSegMode] = useState('region');
  const [segThreshold, setSegThreshold] = useState(24);
  const [edgeFeather, setEdgeFeather] = useState(2);
  const [autoCrop, setAutoCrop] = useState(true);
  const [spawnScale, setSpawnScale] = useState(1.0);
  const [spawnSpeed, setSpawnSpeed] = useState(1.2);
  const [headSide, setHeadSide] = useState<'right' | 'left'>('right');
  const [mode, setMode] = useState('Event');
  const [maxCreatures, setMaxCreatures] = useState(100);
  const [speedFactor, setSpeedFactor] = useState(1.7);
  const [fxDensity, setFxDensity] = useState(0.6);
  const [dragging, setDragging] = useState(false);

  // Expose values to parent via state
  state.aquarium.max = maxCreatures;

  const drawPreview = useCallback((img?: HTMLImageElement | HTMLCanvasElement) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const src = img || state.preparedTex || state.originalImg;
    if (!src) return;

    const sc = Math.min(canvas.width / src.width, canvas.height / src.height);
    const w = src.width * sc;
    const h = src.height * sc;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(src, x, y, w, h);
  }, [state, previewCanvasRef]);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.originalImg = img;
      state.preparedTex = null;
      URL.revokeObjectURL(url);
      drawPreview(img);
      state.bgSample = autoBackgroundSample(img);
      onToast('Bild geladen');
    };
    img.onerror = () => {
      alert('Bild konnte nicht geladen werden.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [state, drawPreview, onToast]);

  const handlePrepare = useCallback(() => {
    if (!state.originalImg) {
      onToast('Bitte zuerst ein Bild auswählen.');
      return;
    }
    try {
      const tex = prepareEngine(state.originalImg, segMode, segThreshold, edgeFeather, autoCrop, state.bgSample);
      if (tex) {
        state.preparedTex = tex;
        drawPreview(tex);
        onToast('Freistellung fertig.');
      }
    } catch (e: any) {
      alert('Fehler beim Freistellen: ' + e.message);
    }
  }, [state, segMode, segThreshold, edgeFeather, autoCrop, drawPreview, onToast]);

  const handleTeleport = useCallback(() => {
    if (!state.originalImg) {
      onToast('Bitte zuerst ein Bild importieren.');
      return;
    }
    if (!state.preparedTex) handlePrepare();
    // Store spawn params in a temp location
    (state as any)._spawnParams = {
      scale: spawnScale,
      speed: spawnSpeed,
      headRight: headSide !== 'left',
      name: childName,
    };
    onTeleport();
    setChildName('');
  }, [state, spawnScale, spawnSpeed, headSide, childName, handlePrepare, onTeleport, onToast]);

  const handleModeChange = useCallback((m: string) => {
    setMode(m);
    onModeChange(m);

    const presets: Record<string, { speed: number; fx: number; max: number }> = {
      Event: { speed: 1.7, fx: 0.8, max: 120 },
      Schule: { speed: 1.5, fx: 0.6, max: 100 },
      Museum: { speed: 1.3, fx: 0.5, max: 80 },
      App: { speed: 1.3, fx: 0.5, max: 70 },
      Schwimmbad: { speed: 1.1, fx: 0.3, max: 70 },
    };
    const p = presets[m] || presets.Event;
    setSpeedFactor(p.speed);
    setFxDensity(p.fx);
    setMaxCreatures(p.max);
    state.aquarium.speed = p.speed;
    state.aquarium.fx = p.fx;
    state.aquarium.max = p.max;
  }, [state, onModeChange]);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!['sample', 'chroma'].includes(segMode)) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const { x, y } = getPointerPos(canvas, e.nativeEvent, canvas.width, canvas.height);
    const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    state.bgSample = [d[0], d[1], d[2]];
    onToast('Pipette gesetzt');
  }, [segMode, state, previewCanvasRef, onToast]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 items-start animate-fade-in">
      {/* Left column */}
      <div className="flex flex-col gap-4">
        {/* 1) Import */}
        <div className="bg-card border border-border rounded-xl p-4 glow-primary">
          <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
            Bild importieren
          </h3>

          <div
            ref={dropRef}
            className={`drop-zone p-5 text-center cursor-pointer ${dragging ? 'dragging' : ''}`}
            onDragEnter={e => { e.preventDefault(); setDragging(true); }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={e => {
              if ((e.target as HTMLElement).closest('label') || (e.target as HTMLElement).closest('input')) return;
              fileInputRef.current?.click();
            }}
          >
            <p className="text-foreground font-medium mb-3">Bild hierher ziehen oder</p>

            <div className="flex gap-2 flex-wrap justify-center">
              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium cursor-pointer hover:bg-primary/90 transition-colors border border-primary/60">
                <Camera className="w-4 h-4" />
                Fotografieren
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-medium cursor-pointer hover:bg-secondary/80 transition-colors border border-border">
                <Upload className="w-4 h-4" />
                Datei hochladen
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </label>
            </div>

            <p className="text-muted-foreground text-xs mt-3">
              Tipp: heller Hintergrund, gerade Aufnahme. Danach „Freistellen" nutzen.
            </p>
          </div>

          <label className="flex flex-col gap-1.5 mt-3">
            <span className="text-sm text-muted-foreground">Name (optional)</span>
            <input
              type="text"
              maxLength={24}
              placeholder="z. B. Mia"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2 placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </label>
        </div>

        {/* 2) Freistellen */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
            Freistellen
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Modus</span>
              <select value={segMode} onChange={e => setSegMode(e.target.value)} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                <option value="region">Rand Region (empfohlen)</option>
                <option value="white">Weiß Hintergrund</option>
                <option value="sample">Pipette</option>
                <option value="chroma">Chromakey</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Toleranz: {segThreshold}</span>
              <input type="range" min={5} max={80} value={segThreshold} onChange={e => setSegThreshold(+e.target.value)} className="w-full accent-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Kanten-Weichzeichnung: {edgeFeather}px</span>
              <input type="range" min={0} max={6} step={1} value={edgeFeather} onChange={e => setEdgeFeather(+e.target.value)} className="w-full accent-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Auto-Zuschnitt</span>
              <select value={autoCrop ? 'Ja' : 'Nein'} onChange={e => setAutoCrop(e.target.value === 'Ja')} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                <option>Ja</option>
                <option>Nein</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={handlePrepare} className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-medium border border-border hover:bg-secondary/80 transition-colors">
              <Sparkles className="w-4 h-4" /> Freistellen
            </button>
            <button onClick={handlePrepare} className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-medium border border-border hover:bg-secondary/80 transition-colors">
              <Wrench className="w-4 h-4" /> Vorschau aktualisieren
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Rand Region entfernt nur den Hintergrund, der mit dem Rand verbunden ist. Innenflächen bleiben erhalten.
          </p>
        </div>

        {/* 3) Spawn */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
            Spawn Parameter
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Größe: {spawnScale.toFixed(2)}</span>
              <input type="range" min={0.5} max={2.0} step={0.05} value={spawnScale} onChange={e => setSpawnScale(+e.target.value)} className="w-full accent-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Geschwindigkeit: {spawnSpeed.toFixed(1)}</span>
              <input type="range" min={0.6} max={2.4} step={0.1} value={spawnSpeed} onChange={e => setSpawnSpeed(+e.target.value)} className="w-full accent-primary" />
            </label>
            <label className="flex flex-col gap-1.5 col-span-2">
              <span className="text-sm text-muted-foreground">Kopfseite</span>
              <select value={headSide} onChange={e => setHeadSide(e.target.value as 'right' | 'left')} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                <option value="right">Kopf nach rechts</option>
                <option value="left">Kopf nach links</option>
              </select>
            </label>
          </div>

          <button onClick={handleTeleport} className="w-full mt-3 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold border border-primary/60 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            <Rocket className="w-5 h-5" /> Ins Aquarium senden
          </button>
        </div>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-4">
        {/* Preview */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-base mb-3">Vorschau</h3>
          <div className="relative bg-ocean-deep border border-border rounded-xl overflow-hidden min-h-[280px]">
            <canvas
              ref={previewCanvasRef}
              width={1000}
              height={560}
              className="w-full h-auto canvas-checker"
              style={{ aspectRatio: '16/9' }}
              onClick={handlePreviewClick}
            />
          </div>
        </div>

        {/* 4) Presentation */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">4</span>
            Präsentation
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Modus</span>
              <select value={mode} onChange={e => handleModeChange(e.target.value)} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                <option>Event</option>
                <option>Schule</option>
                <option>Museum</option>
                <option>App</option>
                <option>Schwimmbad</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Max. Tiere: {maxCreatures}</span>
              <input type="number" min={5} max={250} value={maxCreatures} onChange={e => { const v = +e.target.value; setMaxCreatures(v); state.aquarium.max = v; }} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Geschwindigkeit: {speedFactor.toFixed(1)}</span>
              <input type="range" min={0.5} max={3.0} step={0.1} value={speedFactor} onChange={e => { const v = +e.target.value; setSpeedFactor(v); state.aquarium.speed = v; }} className="w-full accent-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Effektdichte: {fxDensity.toFixed(1)}</span>
              <input type="range" min={0} max={1} step={0.1} value={fxDensity} onChange={e => { const v = +e.target.value; setFxDensity(v); state.aquarium.fx = v; }} className="w-full accent-primary" />
            </label>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={onGotoAquarium} className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-secondary text-secondary-foreground font-medium border border-border hover:bg-secondary/80 transition-colors">
              <Waves className="w-4 h-4" /> Aquarium anzeigen
            </button>
            <button onClick={onClearAquarium} className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-destructive/10 text-destructive font-medium border border-destructive/30 hover:bg-destructive/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Aquarium leeren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
