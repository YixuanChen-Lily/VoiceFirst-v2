import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

import { STEP_NAMES, type DraftFillResult } from '../../lib/proposalSteps';

interface DraftFillNoticeProps {
  result: DraftFillResult;
  currentSection: number;
  onGoToStep: (step: number) => void;
  onDismiss: () => void;
}

/** Above the form after "Improve a draft I have": which steps were filled in from the draft. */
export function DraftFillNotice({ result, currentSection, onGoToStep, onDismiss }: DraftFillNoticeProps) {
  const failed = 'error' in result;
  const tone = failed
    ? 'bg-ochre-tint border-l-4 border-ochre text-ochre-text'
    : 'bg-forest-tint border border-[#C7DACD] text-forest-dark';

  return (
    <section role="status" className={`relative mb-8 rounded-xl px-5 py-4 pr-12 ${tone}`}>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close this message"
        className="absolute top-2.5 right-2.5 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/60"
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>

      {failed ? (
        <p className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Couldn&apos;t fill in your proposal from the draft: {result.error} You can fill it in yourself, or ask
            the assistant for help.
          </span>
        </p>
      ) : result.steps.length === 0 ? (
        <p className="flex items-start gap-2.5">
          <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Your draft didn&apos;t match any part of the proposal, so the steps are still empty. The assistant has
            your draft and can help you fill them in.
          </span>
        </p>
      ) : (
        <>
          <p className="flex items-start gap-2.5 font-bold mb-2">
            <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            We filled in these steps from your draft
          </p>
          <ul className="flex flex-wrap gap-2 mb-2.5 pl-[30px]">
            {result.steps.map((step) => (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => onGoToStep(step)}
                  aria-current={step === currentSection ? 'step' : undefined}
                  className={`min-h-9 px-3 rounded-full text-[15px] border transition-colors ${
                    step === currentSection
                      ? 'bg-forest text-white border-forest font-bold'
                      : 'bg-white border-[#C7DACD] hover:border-forest'
                  }`}
                >
                  {STEP_NAMES[step]}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-base pl-[30px]">Check each one. You can change anything, and it saves as you go.</p>
        </>
      )}
    </section>
  );
}
