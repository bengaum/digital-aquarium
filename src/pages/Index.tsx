import { useState, useRef, useCallback, useMemo } from "react";
import TopBar from "@/components/TopBar";
import StudioView from "@/components/StudioView";
import DesignView from "@/components/DesignView";
import AquariumView, { AquariumViewHandle } from "@/components/AquariumView";
import { createInitialState, buildBackground, prepare as prepareEngine } from "@/lib/aquarium-engine";
import { toast } from "sonner";

export default function Index() {
  const [currentTab, setCurrentTab] = useState('studio');
  const [mode, setMode] = useState('Event');

  // Persistent state via useRef to avoid re-renders killing canvas state
  const stateRef = useRef(createInitialState());
  const state = stateRef.current;

  // Background offscreen canvas
  const bgCanvasRef = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null);
  if (!bgCanvasRef.current) {
    const canvas = document.createElement('canvas');
    canvas.width = state.W;
    canvas.height = state.H;
    const ctx = canvas.getContext('2d')!;
    bgCanvasRef.current = { canvas, ctx };
    buildBackground(ctx, state.W, state.H, state.design);
  }

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const aquariumViewRef = useRef<AquariumViewHandle>(null);

  const showToast = useCallback((msg: string) => {
    toast(msg, {
      duration: 1800,
      style: {
        background: 'hsl(214 55% 12%)',
        border: '1px solid hsl(214 50% 28%)',
        color: 'hsl(208 80% 95%)',
      },
    });
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab);
    state.ui.currentTab = tab;
  }, [state]);

  const handleTeleport = useCallback(() => {
    const params = (state as any)._spawnParams;
    if (!params) return;
    if (!state.preparedTex) {
      if (!state.originalImg) { showToast('Bitte zuerst ein Bild importieren.'); return; }
      state.preparedTex = prepareEngine(state.originalImg, 'region', 24, 2, true, state.bgSample);
    }
    if (!state.preparedTex) return;

    setCurrentTab('aquarium');
    state.ui.currentTab = 'aquarium';

    // Small delay to ensure aquarium view is mounted
    setTimeout(() => {
      aquariumViewRef.current?.teleport(state.preparedTex!, params.name, {
        scale: params.scale,
        speed: params.speed,
        headRight: params.headRight,
      });
    }, 100);
  }, [state, showToast]);

  const handleGotoAquarium = useCallback(() => {
    setCurrentTab('aquarium');
    state.ui.currentTab = 'aquarium';
  }, [state]);

  const handleClearAquarium = useCallback(() => {
    state.aquarium.creatures = [];
    state.aquarium.foods = [];
    showToast('Aquarium geleert');
  }, [state, showToast]);

  const handleDesignApply = useCallback(() => {
    buildBackground(bgCanvasRef.current!.ctx, state.W, state.H, state.design);
    setCurrentTab('aquarium');
    state.ui.currentTab = 'aquarium';
    showToast('Design angewendet');
  }, [state, showToast]);

  return (
    <div className="flex flex-col min-h-screen ocean-bg">
      <TopBar
        currentTab={currentTab}
        mode={`Modus: ${mode}`}
        onTabChange={handleTabChange}
      />

      <main className="flex-1 flex flex-col min-h-0">
        {currentTab === 'studio' && (
          <StudioView
            state={state}
            previewCanvasRef={previewCanvasRef}
            onTeleport={handleTeleport}
            onGotoAquarium={handleGotoAquarium}
            onClearAquarium={handleClearAquarium}
            onModeChange={setMode}
            onToast={showToast}
          />
        )}
        {currentTab === 'design' && (
          <DesignView
            state={state}
            bgOffCanvas={bgCanvasRef.current!.canvas}
            bgCtx={bgCanvasRef.current!.ctx}
            onApply={handleDesignApply}
            onToast={showToast}
          />
        )}
        {currentTab === 'aquarium' && (
          <AquariumView
            ref={aquariumViewRef}
            state={state}
            bgOffCanvas={bgCanvasRef.current!.canvas}
            bgCtx={bgCanvasRef.current!.ctx}
            onBack={() => handleTabChange('studio')}
            onToast={showToast}
          />
        )}
      </main>

      <footer className="border-t border-border/30 bg-background/80 text-muted-foreground text-xs flex justify-between items-center gap-3 px-5 py-3">
        <span>Offline · Lokal · © 2026 Digitales Aquarium by Ben Gaum</span>
        <span className="text-muted-foreground/60">v4.2</span>
      </footer>
    </div>
  );
}
