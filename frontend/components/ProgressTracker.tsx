import React, { useEffect, useRef } from 'react';

import { STEP_NAMES } from '../lib/proposalSteps';

interface ProgressTrackerProps {
  currentSection: number;
  onSectionClick: (section: number) => void;
}

/** The row of named steps above the form. Any step can be opened at any time. */
export function ProgressTracker({ currentSection, onSectionClick }: ProgressTrackerProps) {
  const rowRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const total = STEP_NAMES.length;

  // Keep the current step in view when the row is wider than the screen.
  // Only the row scrolls sideways; the page itself stays put.
  useEffect(() => {
    const row = rowRef.current;
    const step = currentRef.current;
    if (!row || !step) return;
    row.scrollTo({ left: step.offsetLeft - row.offsetLeft - (row.clientWidth - step.offsetWidth) / 2 });
  }, [currentSection]);

  return (
    <nav aria-label="Proposal steps">
      <div className="flex items-center gap-3.5 mb-3">
        <div className="flex-1 h-2 rounded bg-line overflow-hidden">
          <div
            className="h-full bg-forest transition-all duration-300"
            style={{ width: `${((currentSection + 1) / total) * 100}%` }}
          />
        </div>
        <p className="text-base text-ink-muted whitespace-nowrap">
          Step {currentSection + 1} of {total}
        </p>
      </div>
      <ol ref={rowRef} className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        {STEP_NAMES.map((name, index) => {
          const isCurrent = index === currentSection;
          const tone = isCurrent
            ? 'bg-forest text-white font-bold'
            : index < currentSection
              ? 'bg-forest-tint text-forest-dark hover:bg-[#D3E3D8]'
              : 'bg-white text-ink-muted border-[1.5px] border-line hover:border-forest';
          return (
            <li key={name} className="shrink-0">
              <button
                ref={isCurrent ? currentRef : undefined}
                type="button"
                onClick={() => onSectionClick(index)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`min-h-10 px-3.5 rounded-full text-[15px] whitespace-nowrap transition-colors ${tone}`}
              >
                {index + 1}. {name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
