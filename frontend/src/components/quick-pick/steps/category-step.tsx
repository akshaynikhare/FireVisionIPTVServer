'use client';

import { useState } from 'react';

const CATEGORIES = [
  // Prominent — shown by default
  { id: 'news', label: 'News' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'movies', label: 'Movies' },
  { id: 'kids', label: 'Kids' },
  { id: 'music', label: 'Music' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'general', label: 'General' },
  // Extended
  { id: 'animation', label: 'Animation' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'culture', label: 'Culture' },
  { id: 'education', label: 'Education' },
  { id: 'family', label: 'Family' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'religious', label: 'Religious' },
  { id: 'science', label: 'Science' },
  { id: 'series', label: 'Series' },
  { id: 'travel', label: 'Travel' },
  { id: 'weather', label: 'Weather' },
  { id: 'business', label: 'Business' },
  { id: 'classic', label: 'Classic' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'relax', label: 'Relax' },
  { id: 'shop', label: 'Shopping' },
  { id: 'auto', label: 'Auto' },
  { id: 'legislative', label: 'Legislative' },
];

const PROMINENT_COUNT = 8;

interface CategoryStepProps {
  selectedCategories: string[];
  onToggleCategory: (id: string) => void;
}

export function CategoryStep({ selectedCategories, onToggleCategory }: CategoryStepProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? CATEGORIES : CATEGORIES.slice(0, PROMINENT_COUNT);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Step 4</p>
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Pick Categories
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          What kind of channels are you looking for? Skip for all.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Category selection">
        {displayed.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => onToggleCategory(cat.id)}
              aria-pressed={isSelected}
              className={`px-4 py-2.5 text-sm border-2 transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {!showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:text-primary/80 uppercase tracking-[0.1em] font-medium"
        >
          Show all categories ({CATEGORIES.length - PROMINENT_COUNT} more)
        </button>
      )}

      {selectedCategories.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'}{' '}
          selected
        </p>
      )}
    </div>
  );
}
