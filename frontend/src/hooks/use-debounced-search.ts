'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook that debounces search input to avoid firing API calls on every keystroke.
 * Returns the immediate search value (for the input) and a debounced value (for API calls).
 */
export function useDebouncedSearch(initialValue = '', delay = 300) {
  const [search, setSearch] = useState(initialValue);
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDebouncedSearch(value);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return { search, debouncedSearch, handleSearchChange };
}
