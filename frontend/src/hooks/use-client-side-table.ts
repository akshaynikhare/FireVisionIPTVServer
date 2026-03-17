'use client';

import { useMemo } from 'react';

export interface ColumnFilterConfig<T> {
  accessor: (item: T) => string | string[];
  selected: string[];
  allOptions: string[];
}

export interface UseClientSideTableOptions<T> {
  data: T[];
  search: string;
  searchFields: ((item: T) => string | undefined)[];
  filters?: ColumnFilterConfig<T>[];
  sortAccessor?: (item: T) => string;
  sortDir?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface UseClientSideTableReturn<T> {
  filtered: T[];
  paginated: T[];
  totalFiltered: number;
  totalPages: number;
}

export function useClientSideTable<T>({
  data,
  search,
  searchFields,
  filters = [],
  sortAccessor,
  sortDir = 'asc',
  page,
  pageSize,
}: UseClientSideTableOptions<T>): UseClientSideTableReturn<T> {
  return useMemo(() => {
    let result = data;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((fn) => fn(item)?.toLowerCase().includes(q)),
      );
    }

    // Column filters
    for (const filter of filters) {
      if (filter.selected.length > 0 && filter.selected.length < filter.allOptions.length) {
        result = result.filter((item) => {
          const val = filter.accessor(item);
          if (Array.isArray(val)) {
            return val.some((v) => filter.selected.includes(v));
          }
          return filter.selected.includes(val);
        });
      }
    }

    // Sort
    if (sortAccessor) {
      result = [...result].sort((a, b) => {
        const cmp = sortAccessor(a).localeCompare(sortAccessor(b), undefined, {
          sensitivity: 'base',
        });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      result = [...result];
    }

    const totalFiltered = result.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    return { filtered: result, paginated, totalFiltered, totalPages };
  }, [data, search, searchFields, filters, sortAccessor, sortDir, page, pageSize]);
}
