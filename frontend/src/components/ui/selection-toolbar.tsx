'use client';

interface SelectionToolbarProps {
  totalFiltered: number;
  totalUnfiltered: number;
  selectedCount: number;
  onSelectPage: () => void;
  onUnselectPage: () => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
  isFiltered?: boolean;
}

export default function SelectionToolbar({
  totalFiltered,
  totalUnfiltered,
  selectedCount,
  onSelectPage,
  onUnselectPage,
  onSelectAll,
  onUnselectAll,
  isFiltered,
}: SelectionToolbarProps) {
  const showFilteredCount = isFiltered ?? totalFiltered !== totalUnfiltered;

  return (
    <div className="flex items-center justify-between px-1 flex-wrap gap-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {totalFiltered} channels
        {showFilteredCount && ` (filtered from ${totalUnfiltered})`} &middot;{' '}
        <span className="text-foreground font-medium">{selectedCount} selected</span>
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onSelectPage}
          className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Select Page
        </button>
        <button
          onClick={onUnselectPage}
          className="text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          Unselect Page
        </button>
        <span className="w-px h-4 bg-border" />
        <button
          onClick={onSelectAll}
          className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Select All ({totalFiltered})
        </button>
        <button
          onClick={onUnselectAll}
          className="text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          Unselect All
        </button>
      </div>
    </div>
  );
}
