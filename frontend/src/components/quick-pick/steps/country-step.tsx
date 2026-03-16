'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import type { SourceType } from '../wizard-shell';

// Common countries for IPTV-org (no dedicated API)
const IPTV_ORG_COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Russia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'UAE' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'PL', name: 'Poland' },
];

interface Region {
  code: string;
  name: string;
  channelCount?: number;
}

interface CountryStepProps {
  selectedSources: SourceType[];
  countrySelections: Record<string, string>;
  onSetCountry: (source: SourceType, country: string) => void;
}

export function CountryStep({
  selectedSources,
  countrySelections,
  onSetCountry,
}: CountryStepProps) {
  const [regions, setRegions] = useState<Record<string, Region[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchRegions() {
      setLoading(true);
      const result: Record<string, Region[]> = {};

      const promises: Promise<void>[] = [];

      if (selectedSources.includes('iptv-org')) {
        result['iptv-org'] = IPTV_ORG_COUNTRIES;
      }

      if (selectedSources.includes('pluto-tv')) {
        promises.push(
          api
            .get('/external-sources/pluto-tv/regions')
            .then((res) => {
              result['pluto-tv'] = res.data.data || [];
            })
            .catch(() => {
              result['pluto-tv'] = [];
            }),
        );
      }

      if (selectedSources.includes('samsung-tv-plus')) {
        promises.push(
          api
            .get('/external-sources/samsung-tv-plus/regions')
            .then((res) => {
              result['samsung-tv-plus'] = res.data.data || [];
            })
            .catch(() => {
              result['samsung-tv-plus'] = [];
            }),
        );
      }

      await Promise.allSettled(promises);
      setRegions(result);
      setLoading(false);
    }
    fetchRegions();
  }, [selectedSources]);

  const SOURCE_LABELS: Record<string, string> = {
    'iptv-org': 'IPTV-org',
    'pluto-tv': 'Pluto TV',
    'samsung-tv-plus': 'Samsung TV Plus',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading regions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Step 2</p>
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Select Country / Region
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a country for each source, or skip to browse all regions.
        </p>
      </div>

      {selectedSources.map((source) => {
        const sourceRegions = regions[source] || [];
        const search = searchTerms[source] || '';
        const filtered = search
          ? sourceRegions.filter(
              (r) =>
                r.name.toLowerCase().includes(search.toLowerCase()) ||
                r.code.toLowerCase().includes(search.toLowerCase()),
            )
          : sourceRegions;
        const selected = countrySelections[source] || '';

        return (
          <div key={source} className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {SOURCE_LABELS[source]}
            </p>

            {sourceRegions.length > 8 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={search}
                  onChange={(e) =>
                    setSearchTerms((prev) => ({ ...prev, [source]: e.target.value }))
                  }
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
              {filtered.map((r) => {
                const isActive = selected === r.code;
                return (
                  <button
                    key={r.code}
                    onClick={() => onSetCountry(source, isActive ? '' : r.code)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all ${
                      isActive
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {r.name}
                    {r.channelCount != null && (
                      <span className="text-muted-foreground">({r.channelCount})</span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No regions found.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
