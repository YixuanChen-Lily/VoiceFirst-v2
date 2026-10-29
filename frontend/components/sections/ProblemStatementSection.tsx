import React from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useProposal } from '../../context/ProposalContext';

export function ProblemStatementSection() {
  const { data, updateField } = useProposal();

  return (
    <div>
        <SectionHeader title={STEP_NAMES[4]} description="The problem your project solves, or the opportunity it opens up." />

        <div className="space-y-4">
          <div>
            <Label htmlFor="problem-statement">Problem / Opportunity Statement *</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              What problem does your project solve? What opportunity does it create?
            </p>
            <Textarea
              id="problem-statement"
              placeholder="Explain the problem your project addresses and the opportunity it unlocks..."
              className="mt-2 min-h-[180px]"
              value={data.problemDescription}
              onChange={(e) => updateField('problemDescription', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="supporting-evidence">Supporting Evidence</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Reference data, community feedback, or research that supports the need for this project.
            </p>
            <Textarea
              id="supporting-evidence"
              placeholder="Include key statistics, consultation findings, or testimonials..."
              className="mt-2 min-h-[160px]"
              value={data.supportingEvidence}
              onChange={(e) => updateField('supportingEvidence', e.target.value)}
            />
          </div>

          <div className="p-4 bg-ochre-tint border-l-4 border-ochre rounded">
            <p className="text-base text-ochre-text">
              <span>Example:</span>
            </p>
            <p className="text-base text-ink mt-2 italic">
              "Demand for Indigenous artisan tourism is growing in region X, yet our community lacks the infrastructure and training to capitalize on this market. Current unemployment stands at 40%, and youth are leaving for urban centers. This project addresses these challenges by creating local employment opportunities while preserving and promoting our cultural traditions."
            </p>
          </div>
        </div>
      </div>
  );
}
