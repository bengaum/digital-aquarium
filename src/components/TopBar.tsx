import { Waves, Palette, Sparkles } from "lucide-react";

interface TopBarProps {
  currentTab: string;
  mode: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'studio', label: 'Studio', icon: Sparkles },
  { id: 'design', label: 'Aquarium Design', icon: Palette },
  { id: 'aquarium', label: 'Aquarium', icon: Waves },
];

export default function TopBar({ currentTab, mode, onTabChange }: TopBarProps) {
  return (
    <header className="min-h-[64px] flex items-center justify-between gap-4 px-5 py-3 border-b border-border/40 bg-background/90 backdrop-blur-lg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Waves className="w-7 h-7 text-primary" />
        <h1 className="font-display font-extrabold text-xl tracking-tight text-foreground">
          Digitales Aquarium
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-sm font-medium
                transition-all duration-200 border
                ${isActive
                  ? 'bg-primary text-primary-foreground border-primary/80 shadow-lg shadow-primary/20'
                  : 'bg-secondary/50 text-foreground border-border/40 hover:bg-secondary hover:border-border'}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
        <span className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium bg-muted text-muted-foreground border border-border/30 pointer-events-none">
          {mode}
        </span>
      </div>
    </header>
  );
}
