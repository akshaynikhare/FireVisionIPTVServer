'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const pageNumbers = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
          acc.push(p);
          return acc;
        }, []),
    [totalPages, page],
  );

  if (totalCount <= pageSize) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between py-3 px-1">
      <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {start}–{end} of {totalCount}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-disabled={page <= 1}
          className="flex items-center justify-center h-11 w-11 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers.map((item, idx) =>
          item === 'ellipsis' ? (
            <span
              key={`e-${idx}`}
              className="px-1 text-muted-foreground text-xs"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item as number)}
              aria-label={`Go to page ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={`flex items-center justify-center h-11 min-w-[2.75rem] px-1 text-xs font-medium border focus-visible:ring-2 focus-visible:ring-primary transition-colors ${
                item === page
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
              }`}
            >
              {item}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-disabled={page >= totalPages}
          className="flex items-center justify-center h-11 w-11 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
