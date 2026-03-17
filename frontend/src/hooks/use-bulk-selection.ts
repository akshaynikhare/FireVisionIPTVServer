'use client';

import { useState, useCallback } from 'react';

export interface UseBulkSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (key: string) => boolean;
  toggleOne: (key: string) => void;
  selectMany: (keys: string[]) => void;
  unselectMany: (keys: string[]) => void;
  selectAll: (keys: string[]) => void;
  unselectAll: () => void;
  count: number;
}

export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((key: string) => selectedIds.has(key), [selectedIds]);

  const toggleOne = useCallback((key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectMany = useCallback((keys: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }, []);

  const unselectMany = useCallback((keys: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const selectAll = useCallback((keys: string[]) => {
    setSelectedIds(new Set(keys));
  }, []);

  const unselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleOne,
    selectMany,
    unselectMany,
    selectAll,
    unselectAll,
    count: selectedIds.size,
  };
}
