'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook that debounces search input to avoid firing API calls on every keystroke.
 * Returns the immediate search value (for the input), a debounced value (for API calls),
 * and an AbortController ref so consumers can cancel stale requests.
 */
export function useDebouncedSearch(initialValue = '', delay = 300) {
  const [search, setSearch] = useState(initialValue);
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setDebouncedSearch(value);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  return { search, debouncedSearch, handleSearchChange, searchAbortSignal: abortControllerRef };
}
