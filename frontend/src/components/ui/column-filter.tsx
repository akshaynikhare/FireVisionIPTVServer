'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Search, X } from 'lucide-react';

export interface ColumnFilterProps {
  /** Label shown as column header text */
  label: string;
  /** All available options to choose from */
  options: string[];
  /** Currently selected values */
  selected: string[];
  /** Callback when selection changes */
  onChange: (selected: string[]) => void;
  /** Optional: show a search box inside the dropdown (useful for many options) */
  searchable?: boolean;
}

export default function ColumnFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = selected.length > 0 && selected.length < options.length;
  const dropdownId = `filter-dropdown-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Reposition dropdown if it goes off-screen
  useEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    const dropdown = dropdownRef.current;
    const rect = dropdown.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      dropdown.style.left = 'auto';
      dropdown.style.right = '0';
    }
    if (rect.bottom > window.innerHeight) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = '100%';
      dropdown.style.marginBottom = '2px';
      dropdown.style.marginTop = '0';
    }
  }, [open]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setFilterSearch('');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const filteredOptions = useMemo(
    () =>
      filterSearch
        ? options.filter((o) => o.toLowerCase().includes(filterSearch.toLowerCase()))
        : options,
    [options, filterSearch],
  );

  function toggleOption(opt: string) {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  function selectAll() {
    onChange([...options]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1">
      {label && (
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
          {label}
        </span>
      )}
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          setFilterSearch('');
        }}
        className={`flex items-center justify-center h-10 w-10 rounded-sm transition-colors ${
          isActive
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground/50 hover:text-muted-foreground'
        }`}
        aria-label={`Filter by ${label}`}
        aria-expanded={open}
        aria-controls={dropdownId}
        title={
          isActive ? `Filtered: ${selected.length} of ${options.length}` : `Filter by ${label}`
        }
      >
        <Filter className="h-3 w-3" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          id={dropdownId}
          role="listbox"
          aria-label={`${label} filter options`}
          className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-w-[280px] bg-card border-2 border-border shadow-lg animate-fade-up"
          style={{ animationDuration: '100ms' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Filter: {label}
            </span>
            <button
              onClick={() => {
                setOpen(false);
                setFilterSearch('');
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Search within filter */}
          {(searchable || options.length > 8) && (
            <div className="px-2 pt-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search..."
                  aria-label={`Search ${label} options`}
                  className="w-full h-7 pl-7 pr-2 text-xs border border-border bg-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Select All / Clear */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
            <button
              onClick={selectAll}
              className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Select All
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              onClick={clearAll}
              className="text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Clear
            </button>
            {isActive && (
              <span className="ml-auto text-xs text-muted-foreground">
                {selected.length}/{options.length}
              </span>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <label
                    key={opt}
                    role="option"
                    aria-selected={isChecked}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                      className="accent-primary h-4 w-4 shrink-0"
                    />
                    <span className="text-xs truncate" title={opt}>
                      {opt || '(empty)'}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
