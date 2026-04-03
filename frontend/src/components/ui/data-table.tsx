'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  headerClassName?: string;
  ariaSort?: 'ascending' | 'descending' | 'none';
  /** Hide this column below the responsive breakpoint */
  mobileHidden?: boolean;
  /** Extra CSS rules applied to this column's cell below the responsive breakpoint */
  mobileStyle?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  gridTemplate: string;
  ariaLabel: string;
  emptyMessage?: string;
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  rowAriaLabel?: (item: T) => string;
  rowClassName?: string | ((item: T) => string);
  breakpoint?: 'md' | 'lg' | 'always';
  renderExpandedRow?: (item: T) => ReactNode;
  resizable?: boolean;
}

const BP_WIDTH: Record<string, string> = { md: '768px', lg: '1024px' };

export default function DataTable<T>({
  columns,
  data,
  gridTemplate,
  ariaLabel,
  emptyMessage = 'No data found.',
  rowKey,
  onRowClick,
  rowAriaLabel,
  rowClassName,
  breakpoint = 'lg',
  renderExpandedRow,
  resizable = false,
}: DataTableProps<T>) {
  const tableId = useId();
  const isAlways = breakpoint === 'always';
  const headerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const widthsRef = useRef<number[]>([]);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const buildRule = useCallback(
    (template: string) => {
      const rule = `[data-table-id="${tableId}"] [data-table-header],[data-table-id="${tableId}"] [data-table-row]{grid-template-columns:${template}}`;
      return isAlways ? rule : `@media(min-width:${BP_WIDTH[breakpoint]}){${rule}}`;
    },
    [tableId, isAlways, breakpoint],
  );

  const styleContent = buildRule(gridTemplate);

  /* Hide mobileHidden columns below the breakpoint */
  const bpMax = breakpoint === 'md' ? '767.98px' : '1023.98px';
  const mobileHideRules = isAlways
    ? ''
    : columns
        .map((col, i) =>
          col.mobileHidden
            ? `@media(max-width:${bpMax}){[data-table-id="${tableId}"] [data-col-index="${i}"]{display:none}}`
            : '',
        )
        .filter(Boolean)
        .join('');

  /* Apply per-column mobileStyle below the breakpoint */
  const sanitizeCss = (s: string) => s.replace(/[{}<>]/g, '');
  const mobileStyleRules = isAlways
    ? ''
    : columns
        .map((col, i) =>
          col.mobileStyle
            ? `@media(max-width:${bpMax}){[data-table-id="${tableId}"] [data-col-index="${i}"]{${sanitizeCss(col.mobileStyle)}}}`
            : '',
        )
        .filter(Boolean)
        .join('');

  /* Below breakpoint: rows use flex-wrap so name+actions share a line */
  const mobileRowRule = isAlways
    ? ''
    : `@media(max-width:${bpMax}){[data-table-id="${tableId}"] [data-table-row]{display:flex;flex-wrap:wrap;gap:0.5rem;padding-top:0.5rem;padding-bottom:0.5rem}}`;

  const headerVisibility = isAlways
    ? 'grid'
    : breakpoint === 'md'
      ? 'hidden md:grid'
      : 'hidden lg:grid';

  const rowGap = isAlways ? 'gap-4' : breakpoint === 'md' ? 'md:gap-4' : 'lg:gap-4';

  useEffect(() => {
    if (!resizable || !headerRef.current) return;
    const cells = headerRef.current.querySelectorAll('[role="columnheader"]');
    widthsRef.current = Array.from(cells).map((el) => (el as HTMLElement).offsetWidth);
  }, [resizable]);

  // Clean up any active resize listeners on unmount
  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      if (widthsRef.current.length === 0) return;

      const startX = e.clientX;
      const startWidth = widthsRef.current[colIndex];

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        widthsRef.current[colIndex] = Math.max(50, startWidth + delta);
        if (styleRef.current) {
          const template = widthsRef.current.map((w) => `${w}px`).join(' ');
          styleRef.current.textContent = buildRule(template);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        resizeCleanupRef.current = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizeCleanupRef.current = onMouseUp;
    },
    [buildRule],
  );

  const renderRow = (item: T, key?: string) => {
    const extra = typeof rowClassName === 'function' ? rowClassName(item) : rowClassName || '';

    return (
      <div
        key={key}
        role="row"
        data-table-row=""
        aria-label={rowAriaLabel?.(item)}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={onRowClick ? () => onRowClick(item) : undefined}
        onKeyDown={
          onRowClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(item);
                }
              }
            : undefined
        }
        className={[
          'grid gap-2 items-center px-4 py-3',
          rowGap,
          onRowClick &&
            'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          extra,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {columns.map((col, i) => (
          <div key={col.key} role="cell" className="min-w-0" data-col-index={i}>
            {col.cell(item)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <style ref={styleRef}>
        {styleContent}
        {mobileHideRules}
        {mobileStyleRules}
        {mobileRowRule}
      </style>
      <div
        data-table-id={tableId}
        role="table"
        aria-label={ariaLabel}
        className="border border-border divide-y divide-border"
      >
        <div
          ref={headerRef}
          role="rowgroup"
          data-table-header=""
          className={`${headerVisibility} gap-4 px-4 py-2 bg-muted/50`}
        >
          {columns.map((col, i) => (
            <div
              key={col.key}
              role="columnheader"
              className={`${col.headerClassName || ''}${resizable ? ' relative' : ''}`}
              aria-sort={col.ariaSort}
            >
              {col.header}
              {resizable && i < columns.length - 1 && (
                <div
                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center z-10 group"
                  onMouseDown={(e) => handleResizeStart(e, i)}
                  role="separator"
                  aria-orientation="vertical"
                >
                  <div className="w-px h-4 bg-border group-hover:bg-primary group-hover:h-full transition-all" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div role="rowgroup">
          {data.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : renderExpandedRow ? (
            data.map((item) => (
              <div key={rowKey(item)}>
                {renderRow(item)}
                {renderExpandedRow(item)}
              </div>
            ))
          ) : (
            data.map((item) => renderRow(item, rowKey(item)))
          )}
        </div>
      </div>
    </div>
  );
}
