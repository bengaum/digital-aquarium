import { useRef, useEffect, useCallback, useState } from "react";
import { ArrowRight, Save, FolderOpen, Download, UploadIcon, Trash2 } from "lucide-react";
import type { AquariumState, DesignAsset } from "@/lib/aquarium-engine";
import {
  buildBackground,
  drawAssetToContext,
  getCachedImage,
  getPointerPos,
  readFileAsDataURL,
  readFileAsText,
  loadVariantMap,
  saveVariantMap,
  downloadBlob,
  clamp,
} from "@/lib/aquarium-engine";

interface DesignViewProps {
  state: AquariumState;
  bgOffCanvas: HTMLCanvasElement;
  bgCtx: CanvasRenderingContext2D;
  onApply: () => void;
  onToast: (msg: string) => void;
}

const ASSET_TYPES = [
  { type: 'grass', label: '🌿', title: 'Seegras' },
  { type: 'kelp', label: '🌱', title: 'Kelp' },
  { type: 'coral', label: '🪸', title: 'Koralle' },
  { type: 'stone', label: '🪨', title: 'Stein' },
  { type: 'rock', label: '⛰️', title: 'Fels' },
  { type: 'chest', label: '🧰', title: 'Schatztruhe' },
  { type: 'star', label: '⭐', title: 'Seestern' },
  { type: 'bubble', label: '🫧', title: 'Blasen' },
];

export default function DesignView({ state, bgOffCanvas, bgCtx, onApply, onToast }: DesignViewProps) {
  const designCanvasRef = useRef<HTMLCanvasElement>(null);
  const assetUploadRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const variantImportRef = useRef<HTMLInputElement>(null);
  const designImportRef = useRef<HTMLInputElement>(null);

  const [variantName, setVariantName] = useState('');
  const [variants, setVariants] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [bgMode, setBgMode] = useState(state.design.type === 'image' ? 'image' : 'theme');
  const [theme, setTheme] = useState(state.design.theme);
  const [lightRays, setLightRays] = useState(state.design.light);
  const [lightIntensity, setLightIntensity] = useState(state.design.lightIntensity);
  const [vignette, setVignette] = useState(state.design.vignette);
  const [bgFit, setBgFit] = useState(state.design.bgFit);
  const [bgVignette, setBgVignette] = useState(state.design.bgVignette);
  const [selectedAssetType, setSelectedAssetType] = useState('grass');

  const refreshVariants = useCallback(() => {
    const map = loadVariantMap();
    setVariants(Object.keys(map).sort((a, b) => a.localeCompare(b, 'de')));
  }, []);

  useEffect(() => {
    refreshVariants();
  }, [refreshVariants]);

  const renderDesign = useCallback(() => {
    const canvas = designCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgOffCanvas, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / state.W;
    const scaleY = canvas.height / state.H;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    for (const a of (state.design.assets || [])) {
      drawAssetToContext(ctx, a);
    }
    ctx.restore();
  }, [state, bgOffCanvas]);

  const rebuild = useCallback(() => {
    buildBackground(bgCtx, state.W, state.H, state.design);
    renderDesign();
  }, [bgCtx, state, renderDesign]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  // Design canvas interactions
  useEffect(() => {
    const canvas = designCanvasRef.current;
    if (!canvas) return;

    let draggingIdx = -1;
    let dragDX = 0;
    let dragDY = 0;

    const toStage = (e: PointerEvent) => getPointerPos(canvas, e, state.W, state.H);

    const onDown = (e: PointerEvent) => {
      const p = toStage(e);
      const idx = (state.design.assets || []).findIndex(a => {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        return (dx * dx + dy * dy) < 900;
      });

      if (idx >= 0) {
        draggingIdx = idx;
        state.ui.selectedAssetIndex = idx;
        dragDX = state.design.assets[idx].x - p.x;
        dragDY = state.design.assets[idx].y - p.y;
      } else {
        const asset: DesignAsset = selectedAssetType === '__img__'
          ? { kind: 'img', data: state.ui.selectedImgData || undefined, x: p.x, y: p.y, s: 1, r: 0, type: 'img' }
          : { type: selectedAssetType, x: p.x, y: p.y, s: 1, r: 0 };

        state.design.assets.push(asset);
        state.ui.selectedAssetIndex = state.design.assets.length - 1;
        draggingIdx = state.ui.selectedAssetIndex;
        dragDX = 0;
        dragDY = 0;
        renderDesign();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (draggingIdx < 0) return;
      const p = toStage(e);
      const asset = state.design.assets[draggingIdx];
      if (asset) {
        asset.x = p.x + dragDX;
        asset.y = p.y + dragDY;
        renderDesign();
      }
    };

    const onUp = () => { draggingIdx = -1; };

    const onWheel = (e: WheelEvent) => {
      if (state.ui.selectedAssetIndex < 0) return;
      const a = state.design.assets[state.ui.selectedAssetIndex];
      if (!a) return;
      a.s = clamp((a.s || 1) + (e.deltaY < 0 ? 0.05 : -0.05), 0.2, 3.0);
      renderDesign();
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (state.ui.selectedAssetIndex < 0) return;
      const a = state.design.assets[state.ui.selectedAssetIndex];
      if (!a) return;
      if (e.key === 'r' || e.key === 'R') { a.r = (a.r || 0) + 0.1; renderDesign(); }
      if (e.key === 'Delete') {
        state.design.assets.splice(state.ui.selectedAssetIndex, 1);
        state.ui.selectedAssetIndex = -1;
        renderDesign();
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [state, selectedAssetType, renderDesign]);

  return (
    <div className="flex-1 min-h-0 p-4 animate-fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 h-full">
        {/* Palette */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          {/* Variants */}
          <div>
            <h3 className="font-display font-semibold text-base mb-2">📁 Varianten</h3>
            <input type="text" placeholder="Name der Variante" maxLength={40} value={variantName} onChange={e => setVariantName(e.target.value)} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2 mb-2 placeholder:text-muted-foreground" />
            <div className="flex flex-wrap gap-2 mb-2">
              <button onClick={() => {
                if (!variantName.trim()) { alert('Bitte Variantenname angeben'); return; }
                const map = loadVariantMap();
                map[variantName.trim()] = { design: JSON.parse(JSON.stringify(state.design)) };
                saveVariantMap(map);
                refreshVariants();
                onToast('Variante gespeichert');
              }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <Save className="w-3.5 h-3.5" /> Speichern
              </button>
              <button onClick={() => {
                const map = loadVariantMap();
                const name = selectedVariant || variantName;
                if (!name || !map[name]) { alert('Bitte Variante auswählen.'); return; }
                Object.assign(state.design, JSON.parse(JSON.stringify(map[name].design)));
                setTheme(state.design.theme);
                setLightRays(state.design.light);
                setLightIntensity(state.design.lightIntensity);
                setVignette(state.design.vignette);
                setBgMode(state.design.type === 'image' ? 'image' : 'theme');
                setBgFit(state.design.bgFit);
                setBgVignette(state.design.bgVignette);
                rebuild();
                onToast('Variante geladen');
              }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <FolderOpen className="w-3.5 h-3.5" /> Laden
              </button>
              <button onClick={() => {
                const raw = localStorage.getItem('da_variants') || '{}';
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                downloadBlob(new Blob([raw], { type: 'application/json' }), `da_variants_${ts}.json`);
              }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={() => variantImportRef.current?.click()} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <UploadIcon className="w-3.5 h-3.5" /> Import
              </button>
              <input ref={variantImportRef} type="file" accept="application/json" hidden onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const incoming = JSON.parse(await readFileAsText(f) || '{}');
                  const current = loadVariantMap();
                  saveVariantMap({ ...current, ...incoming });
                  refreshVariants();
                  onToast('Varianten importiert');
                } catch (err: any) { alert('Import fehlgeschlagen: ' + err.message); }
                e.target.value = '';
              }} />
              <button onClick={() => {
                const name = selectedVariant || variantName;
                if (!name) return;
                const map = loadVariantMap();
                delete map[name];
                saveVariantMap(map);
                refreshVariants();
                onToast('Variante gelöscht');
              }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/30 hover:bg-destructive/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Löschen
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <button onClick={() => {
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                downloadBlob(new Blob([JSON.stringify(state.design)], { type: 'application/json' }), `digitalaquarium_design_${ts}.json`);
              }} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <Download className="w-3.5 h-3.5" /> Design Export
              </button>
              <button onClick={() => designImportRef.current?.click()} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-secondary/80 transition-colors">
                <UploadIcon className="w-3.5 h-3.5" /> Design Import
              </button>
              <input ref={designImportRef} type="file" accept="application/json" hidden onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const incoming = JSON.parse(await readFileAsText(f) || '{}');
                  Object.assign(state.design, JSON.parse(JSON.stringify(incoming)));
                  setTheme(state.design.theme);
                  setLightRays(state.design.light);
                  setLightIntensity(state.design.lightIntensity);
                  setVignette(state.design.vignette);
                  setBgMode(state.design.type === 'image' ? 'image' : 'theme');
                  rebuild();
                  onToast('Design importiert');
                } catch (err: any) { alert('Design-Import fehlgeschlagen: ' + err.message); }
                e.target.value = '';
              }} />
            </div>
            <select size={4} value={selectedVariant} onChange={e => { setSelectedVariant(e.target.value); setVariantName(e.target.value); }} className="w-full min-h-[100px] border border-border rounded-xl bg-input text-foreground px-3 py-2 resize-y">
              {variants.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Background */}
          <div>
            <h3 className="font-display font-semibold text-base mb-2">🖼 Hintergrund</h3>
            <div className="flex gap-2 mb-3">
              <button onClick={() => { setBgMode('theme'); state.design.type = 'theme'; rebuild(); }} className={`swatch-btn ${bgMode === 'theme' ? 'selected' : ''}`}>🎨 Theme</button>
              <button onClick={() => { setBgMode('image'); state.design.type = 'image'; rebuild(); }} className={`swatch-btn ${bgMode === 'image' ? 'selected' : ''}`}>🖼 Bild</button>
            </div>

            {bgMode === 'theme' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <select value={theme} onChange={e => { const v = e.target.value; setTheme(v); state.design.theme = v; rebuild(); }} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                    <option value="deep">Deep Blue</option>
                    <option value="lagoon">Lagune Türkis</option>
                    <option value="night">Nacht</option>
                    <option value="sunset">Sonnenuntergang</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Lichtstrahlen</span>
                  <select value={lightRays ? 'Ein' : 'Aus'} onChange={e => { const v = e.target.value === 'Ein'; setLightRays(v); state.design.light = v; renderDesign(); }} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                    <option>Ein</option>
                    <option>Aus</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Licht-Intensität: {lightIntensity.toFixed(2)}</span>
                  <input type="range" min={0} max={1} step={0.05} value={lightIntensity} onChange={e => { const v = +e.target.value; setLightIntensity(v); state.design.lightIntensity = v; renderDesign(); }} className="w-full accent-primary" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Vignette: {vignette.toFixed(2)}</span>
                  <input type="range" min={0} max={1} step={0.05} value={vignette} onChange={e => { const v = +e.target.value; setVignette(v); state.design.vignette = v; rebuild(); }} className="w-full accent-primary" />
                </label>
              </div>
            )}

            {bgMode === 'image' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Hintergrundbild</span>
                  <input ref={bgFileRef} type="file" accept="image/*" onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      state.design.bgData = await readFileAsDataURL(f);
                      state.design.type = 'image';
                      setBgMode('image');
                      rebuild();
                    } catch { alert('Bild konnte nicht geladen werden.'); }
                    e.target.value = '';
                  }} className="w-full text-sm text-foreground file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border file:border-border file:bg-secondary file:text-secondary-foreground file:font-medium" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">Füllmodus</span>
                  <select value={bgFit} onChange={e => { const v = e.target.value; setBgFit(v); state.design.bgFit = v; rebuild(); }} className="w-full min-h-[44px] border border-border rounded-xl bg-input text-foreground px-3 py-2">
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 col-span-2">
                  <span className="text-sm text-muted-foreground">Overlay-Vignette: {bgVignette.toFixed(2)}</span>
                  <input type="range" min={0} max={1} step={0.05} value={bgVignette} onChange={e => { const v = +e.target.value; setBgVignette(v); state.design.bgVignette = v; rebuild(); }} className="w-full accent-primary" />
                </label>
              </div>
            )}
          </div>

          {/* Assets */}
          <div>
            <h3 className="font-display font-semibold text-base mb-2">🧱 Assets</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {ASSET_TYPES.map(a => (
                <button
                  key={a.type}
                  title={a.title}
                  onClick={() => setSelectedAssetType(a.type)}
                  className={`swatch-btn text-lg ${selectedAssetType === a.type ? 'selected' : ''}`}
                >
                  {a.label}
                </button>
              ))}
              <button onClick={() => assetUploadRef.current?.click()} title="Eigenes PNG" className={`swatch-btn text-lg ${selectedAssetType === '__img__' ? 'selected' : ''}`}>📤</button>
              <input ref={assetUploadRef} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  state.ui.selectedImgData = await readFileAsDataURL(f);
                  setSelectedAssetType('__img__');
                } catch { alert('Asset konnte nicht geladen werden.'); }
                e.target.value = '';
              }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Klick in die Bühne platziert das Asset. Drag = verschieben, Mausrad = Größe, R = rotieren, Entf = löschen.
            </p>
          </div>
        </div>

        {/* Design Stage */}
        <div className="relative bg-ocean-deep border border-border rounded-xl overflow-hidden min-h-[420px] flex items-center justify-center glow-primary">
          <canvas
            ref={designCanvasRef}
            width={1280}
            height={720}
            className="w-full h-full block cursor-crosshair"
            style={{ background: '#07172c' }}
          />
          <div className="absolute top-3 right-3 z-10">
            <button onClick={() => { rebuild(); onApply(); }} className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium border border-primary/60 hover:bg-primary/90 transition-colors glass-panel">
              <ArrowRight className="w-4 h-4" /> Auf Aquarium anwenden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
