'use client';

import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Sources' },
  { label: 'Country' },
  { label: 'Language' },
  { label: 'Category' },
  { label: 'Channels' },
  { label: 'Confirm' },
];

interface StepIndicatorProps {
  currentStep: number;
  onGoToStep?: (step: number) => void;
}

export function StepIndicator({ currentStep, onGoToStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const canNavigate = onGoToStep && i <= currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => canNavigate && onGoToStep(i)}
                className={`h-8 w-8 flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                  i < currentStep
                    ? 'border-primary bg-primary/10 text-primary'
                    : i === currentStep
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground'
                } ${canNavigate ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              <span
                className={`hidden sm:block text-[10px] uppercase tracking-[0.15em] ${
                  i <= currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-colors ${
                  i < currentStep ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
