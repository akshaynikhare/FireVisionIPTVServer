'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Eye,
  Play,
  Loader2,
  Zap,
} from 'lucide-react';
import { useClientSideTable } from '@/hooks/use-client-side-table';
import type { UseBulkSelectionReturn } from '@/hooks/use-bulk-selection';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import SearchInput from '@/components/ui/search-input';
import SelectionToolbar from '@/components/ui/selection-toolbar';
import StatusDot from '@/components/ui/status-dot';
import ChannelLogo from '@/components/ui/channel-logo';
import type { SourceChannel } from '@/types/external-sources';

type SortField = 'name' | 'category' | 'country';
type SortDir = 'asc' | 'desc';

interface SourceChannelDataTableProps {
  channels: SourceChannel[];
  onDetail: (ch: SourceChannel) => void;
  onPlay: (ch: SourceChannel) => void;
  selection: UseBulkSelectionReturn;
  toolbarActions?: ReactNode;
  headerSlot?: ReactNode;
  bannerSlot?: ReactNode;
  showLiveness?: boolean;
  onTestChannel?: (ch: SourceChannel) => Promise<void>;
  pageSize?: number;
}

export default function SourceChannelDataTable({
  channels,
  onDetail,
  onPlay,
  selection,
  toolbarActions,
  headerSlot,
  bannerSlot,
  showLiveness = false,
  onTestChannel,
  pageSize = 50,
}: SourceChannelDataTableProps) {
  const {
    isSelected,
    toggleOne,
    selectMany,
    unselectMany,
    unselectAll,
    count: selectedCount,
  } = selection;

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.groupTitle) set.add(c.groupTitle);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.country) set.add(c.country);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [channels]);

  useEffect(() => {
    setSelectedCategories([]);
    setSelectedCountries([]);
    setSelectedStatuses([]);
    setSearch('');
    setPage(1);
  }, [channels]);

  const sortAccessor = useCallback(
    (ch: SourceChannel) => {
      switch (sortField) {
        case 'name':
          return ch.channelName || '';
        case 'category':
          return ch.groupTitle || '';
        case 'country':
          return ch.country || '';
      }
    },
    [sortField],
  );

  const filters = useMemo(
    () => [
      {
        accessor: (c: SourceChannel) => c.groupTitle || '',
        selected: selectedCategories,
        allOptions: categoryOptions,
      },
      {
        accessor: (c: SourceChannel) => c.country || '',
        selected: selectedCountries,
        allOptions: countryOptions,
      },
      ...(showLiveness
        ? [
            {
              accessor: (c: SourceChannel) => c.liveness?.status || 'unknown',
              selected: selectedStatuses,
              allOptions: ['alive', 'dead', 'unknown'],
            },
          ]
        : []),
    ],
    [
      selectedCategories,
      categoryOptions,
      selectedCountries,
      countryOptions,
      selectedStatuses,
      showLiveness,
    ],
  );

  const searchFields = useMemo(
    () => [
      (c: SourceChannel) => c.channelName,
      (c: SourceChannel) => c.channelId,
      (c: SourceChannel) => c.groupTitle,
      (c: SourceChannel) => c.country,
    ],
    [],
  );

  const { filtered, paginated } = useClientSideTable({
    data: channels,
    search,
    searchFields,
    filters,
    sortAccessor,
    sortDir,
    page,
    pageSize,
  });

  const pageAllSelected = paginated.length > 0 && paginated.every((ch) => isSelected(ch._uid));

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  async function handleTestChannel(ch: SourceChannel) {
    if (!onTestChannel || !ch._uid) return;
    setTestingChannelId(ch._uid);
    try {
      await onTestChannel(ch);
    } finally {
      setTestingChannelId(null);
    }
  }

  const headerGridCls = showLiveness
    ? 'hidden lg:grid grid-cols-[40px,44px,1fr,140px,100px,80px,80px] gap-2 px-4 py-2 bg-muted/50 border-b border-border'
    : 'hidden lg:grid grid-cols-[40px,44px,1fr,140px,100px,80px] gap-2 px-4 py-2 bg-muted/50 border-b border-border';
  const rowGridCls = showLiveness
    ? 'grid lg:grid-cols-[40px,44px,1fr,140px,100px,80px,80px] gap-2 items-center px-4 py-2 transition-colors hover:bg-muted/50'
    : 'grid lg:grid-cols-[40px,44px,1fr,140px,100px,80px] gap-2 items-center px-4 py-2 transition-colors hover:bg-muted/50';

  return (
    <div className="space-y-4">
      {headerSlot}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, category, or country..."
          ariaLabel="Search channels"
          className="flex-1 max-w-md w-full"
        />
        {toolbarActions && (
          <div className="flex items-center gap-2 flex-wrap">{toolbarActions}</div>
        )}
      </div>

      <SelectionToolbar
        totalFiltered={filtered.length}
        totalUnfiltered={channels.length}
        selectedCount={selectedCount}
        onSelectPage={() => selectMany(paginated.map((ch) => ch._uid))}
        onUnselectPage={() => unselectMany(paginated.map((ch) => ch._uid))}
        onSelectAll={() => selectMany(filtered.map((ch) => ch._uid))}
        onUnselectAll={unselectAll}
      />

      {bannerSlot}

      <div className="overflow-x-auto">
        <div role="table" aria-label="Channel management table" className="border border-border">
          <div role="rowgroup" className={headerGridCls}>
            <div role="columnheader" className="flex items-center justify-center">
              <button
                onClick={() =>
                  pageAllSelected
                    ? unselectMany(paginated.map((ch) => ch._uid))
                    : selectMany(paginated.map((ch) => ch._uid))
                }
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle page selection"
              >
                {pageAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
            </div>
            <span role="columnheader" />
            <button
              role="columnheader"
              onClick={() => handleSort('name')}
              aria-label="Sort by name"
              aria-sort={
                sortField === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
            >
              Name <SortIcon field="name" />
            </button>
            <div
              role="columnheader"
              aria-sort={
                sortField === 'category' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              className="relative inline-flex items-center gap-1.5"
            >
              <button
                onClick={() => handleSort('category')}
                aria-label="Sort by category"
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
              >
                Category <SortIcon field="category" />
              </button>
              <ColumnFilter
                label=""
                options={categoryOptions}
                selected={selectedCategories}
                onChange={(v) => {
                  setSelectedCategories(v);
                  setPage(1);
                }}
                searchable
              />
            </div>
            <div
              role="columnheader"
              aria-sort={
                sortField === 'country' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
              className="relative inline-flex items-center gap-1.5"
            >
              <button
                onClick={() => handleSort('country')}
                aria-label="Sort by country"
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium hover:text-foreground transition-colors text-left"
              >
                Country <SortIcon field="country" />
              </button>
              <ColumnFilter
                label=""
                options={countryOptions}
                selected={selectedCountries}
                onChange={(v) => {
                  setSelectedCountries(v);
                  setPage(1);
                }}
                searchable
              />
            </div>
            {showLiveness && (
              <span role="columnheader">
                <ColumnFilter
                  label="Status"
                  options={['alive', 'dead', 'unknown']}
                  selected={selectedStatuses}
                  onChange={(v) => {
                    setSelectedStatuses(v);
                    setPage(1);
                  }}
                />
              </span>
            )}
            <span role="columnheader" className="text-right">
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium ">
                Actions
              </span>
            </span>
          </div>

          <div role="rowgroup" className="divide-y divide-border">
            {paginated.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? 'No channels match your search' : 'No channels found'}
              </div>
            ) : (
              paginated.map((ch) => {
                const key = ch._uid;
                const selected = isSelected(key);
                const status = ch.liveness?.status || 'unknown';
                return (
                  <div
                    key={key}
                    role="row"
                    className={`${rowGridCls} ${selected ? 'bg-primary/5' : ''}`}
                  >
                    <div role="cell" className="flex items-center justify-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => toggleOne(key)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div role="cell">
                      <ChannelLogo src={ch.tvgLogo} alt={`${ch.channelName} logo`} />
                    </div>

                    <div role="cell" className="min-w-0">
                      <span className="text-sm font-medium truncate block">{ch.channelName}</span>
                      {ch.summary && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {ch.summary}
                        </span>
                      )}
                    </div>

                    <span role="cell" className="text-xs text-muted-foreground truncate">
                      {ch.groupTitle || '—'}
                    </span>

                    <span role="cell" className="text-xs text-muted-foreground truncate">
                      {ch.country || '—'}
                    </span>

                    {showLiveness && (
                      <div role="cell" className="relative inline-flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium px-1.5 py-0.5 ${
                            status === 'alive'
                              ? 'text-signal-green bg-signal-green/10'
                              : status === 'dead'
                                ? 'text-signal-red bg-signal-red/10'
                                : 'text-muted-foreground bg-muted'
                          }`}
                        >
                          <StatusDot status={status} showLabel={false} size="sm" />
                          {status}
                        </span>
                        {onTestChannel && (
                          <button
                            onClick={() => handleTestChannel(ch)}
                            disabled={testingChannelId === ch._uid}
                            className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                            title="Test stream"
                          >
                            {testingChannelId === ch._uid ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    <div role="cell" className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onDetail(ch)}
                        className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View details"
                        title="Channel info"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {ch.channelUrl && (
                        <button
                          onClick={() => onPlay(ch)}
                          className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                          aria-label="Preview stream"
                          title="Preview stream"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
