'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StepIndicator } from './step-indicator';
import { SourceStep } from './steps/source-step';
import { CountryStep } from './steps/country-step';
import { LanguageStep } from './steps/language-step';
import { CategoryStep } from './steps/category-step';
import { RecommendationsStep } from './steps/recommendations-step';
import { ConfirmStep } from './steps/confirm-step';

export type SourceType = 'iptv-org' | 'pluto-tv' | 'samsung-tv-plus';

export interface ChannelLiveness {
  status: string;
  lastCheckedAt?: string;
  responseTimeMs?: number;
}

export interface WizardChannel {
  uid: string;
  source: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  tvgLogo: string;
  groupTitle: string;
  country: string;
  language: string;
  languages: string[];
  liveness?: ChannelLiveness;
  docId?: string; // MongoDB _id for external source channels (used for liveness check)
}

const TOTAL_STEPS = 6;

interface WizardShellProps {
  mode: 'user' | 'admin';
}

export function WizardShell({ mode }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(['iptv-org']);
  // Step 2
  const [countrySelections, setCountrySelections] = useState<Record<string, string>>({});
  // Step 3
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  // Step 4
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Step 5
  const [fetchedChannels, setFetchedChannels] = useState<WizardChannel[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  const toggleSource = useCallback((source: SourceType) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  }, []);

  const setCountry = useCallback((source: SourceType, country: string) => {
    setCountrySelections((prev) => ({ ...prev, [source]: country }));
  }, []);

  const toggleLanguage = useCallback((code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }, []);

  const handleSetFetchedChannels = useCallback((channels: WizardChannel[]) => {
    setFetchedChannels(channels);
    // Pre-select all
    setSelectedChannelIds(new Set(channels.map((ch) => ch.uid)));
  }, []);

  const toggleChannel = useCallback((uid: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set(fetchedChannels.map((ch) => ch.uid)));
  }, [fetchedChannels]);

  const deselectAllChannels = useCallback(() => {
    setSelectedChannelIds(new Set());
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSelectedSources(['iptv-org']);
    setCountrySelections({});
    setSelectedLanguages([]);
    setSelectedCategories([]);
    setFetchedChannels([]);
    setSelectedChannelIds(new Set());
  }, []);

  // Determine if the language step should be skipped
  const hasIptvOrg = selectedSources.includes('iptv-org');

  function handleNext() {
    let nextStep = currentStep + 1;
    // Skip language step if no IPTV-org
    if (nextStep === 2 && !hasIptvOrg) nextStep = 3;
    setCurrentStep(Math.min(nextStep, TOTAL_STEPS - 1));
  }

  const handleBack = useCallback(() => {
    // If leaving the channels step, clear fetched data so it re-fetches with updated filters
    if (currentStep === 4) {
      setFetchedChannels([]);
      setSelectedChannelIds(new Set());
    }
    let prevStep = currentStep - 1;
    // Skip language step if no IPTV-org
    if (prevStep === 2 && !hasIptvOrg) prevStep = 1;
    setCurrentStep(Math.max(prevStep, 0));
  }, [currentStep, hasIptvOrg]);

  const canProceed = (() => {
    switch (currentStep) {
      case 0:
        return selectedSources.length > 0;
      case 1:
        return true; // optional
      case 2:
        return true; // optional
      case 3:
        return true; // optional
      case 4:
        return selectedChannelIds.size > 0;
      case 5:
        return false; // confirm handles its own action
      default:
        return false;
    }
  })();

  const isLastBeforeConfirm = currentStep === 4;

  // Focus management: move focus to step content when step changes
  const stepContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepContentRef.current?.focus();
  }, [currentStep]);

  // Escape key handler: go back or navigate away on first step
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (currentStep === 0) {
          // On first step, could navigate away — for now just no-op
        } else {
          handleBack();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [currentStep, handleBack]);

  return (
    <main aria-label="Channel Quick Pick Wizard" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
          Quick Channel Pick
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Answer a few questions and we&apos;ll find the best channels for you.
        </p>
      </div>

      {/* Step Indicator */}
      <div>
        <StepIndicator
          currentStep={currentStep}
          onGoToStep={(step) => {
            // If leaving channels step to an earlier step, clear fetched data for re-fetch
            if (currentStep >= 4 && step < 4) {
              setFetchedChannels([]);
              setSelectedChannelIds(new Set());
            }
            setCurrentStep(step);
          }}
        />
      </div>

      {/* Step Content */}
      <div
        ref={stepContentRef}
        tabIndex={-1}
        aria-live="polite"
        className="min-h-[300px] focus:outline-none"
      >
        {currentStep === 0 && (
          <SourceStep selectedSources={selectedSources} onToggleSource={toggleSource} />
        )}
        {currentStep === 1 && (
          <CountryStep
            selectedSources={selectedSources}
            countrySelections={countrySelections}
            onSetCountry={setCountry}
          />
        )}
        {currentStep === 2 && (
          <LanguageStep selectedLanguages={selectedLanguages} onToggleLanguage={toggleLanguage} />
        )}
        {currentStep === 3 && (
          <CategoryStep selectedCategories={selectedCategories} onToggleCategory={toggleCategory} />
        )}
        {currentStep === 4 && (
          <RecommendationsStep
            selectedSources={selectedSources}
            countrySelections={countrySelections}
            selectedLanguages={selectedLanguages}
            selectedCategories={selectedCategories}
            fetchedChannels={fetchedChannels}
            selectedChannelIds={selectedChannelIds}
            onSetFetchedChannels={handleSetFetchedChannels}
            onToggleChannel={toggleChannel}
            onSelectAll={selectAllChannels}
            onDeselectAll={deselectAllChannels}
          />
        )}
        {currentStep === 5 && (
          <ConfirmStep
            fetchedChannels={fetchedChannels}
            selectedChannelIds={selectedChannelIds}
            mode={mode}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          aria-label="Go to previous step"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card hover:border-primary/40 uppercase tracking-[0.1em] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>

        <span className="text-xs text-muted-foreground" aria-live="polite">
          Step {currentStep + 1} of {TOTAL_STEPS}
        </span>

        {currentStep < 5 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            aria-label={isLastBeforeConfirm ? 'Finish and import channels' : 'Go to next step'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLastBeforeConfirm
              ? 'Review'
              : currentStep >= 1 && currentStep <= 3
                ? 'Next / Skip'
                : 'Next'}{' '}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div />
        )}
      </div>
    </main>
  );
}
