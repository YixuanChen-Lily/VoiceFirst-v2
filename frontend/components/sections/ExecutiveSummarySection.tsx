import React from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useProposal } from '../../context/ProposalContext';

export function ExecutiveSummarySection() {
  const { data, updateField } = useProposal();

  return (
    <div>
        <SectionHeader title={STEP_NAMES[2]} description="A short overview of the whole project. Many people write this part last." />

        <div className="space-y-4">
          <div>
            <Label htmlFor="executive-summary">Executive Summary *</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Summarize: what you're doing, why it matters, how you'll do it, expected outcomes, and funding requested
            </p>
            <Textarea
              id="executive-summary"
              placeholder="Provide a concise overview of the project — what, why, how, outcomes, and requested funding."
              className="mt-2 min-h-[200px]"
              value={data.executiveSummary}
              onChange={(e) => updateField('executiveSummary', e.target.value)}
            />
          </div>

          <div className="p-4 bg-forest-tint border-l-4 border-forest rounded">
            <p className="text-base text-forest-dark">
              <span>Example:</span>
            </p>
            <p className="text-base text-ink mt-2 italic">
              "XYZ First Nation proposes to develop a community-owned social enterprise combining artisan craft production with eco-tourism. This 3-year initiative will create 15 permanent jobs, preserve traditional knowledge, and generate sustainable revenue. We are requesting $500,000 to establish facilities, train community members, and launch marketing. Expected outcomes include increased employment, cultural preservation, and economic self-sufficiency."
            </p>
          </div>
        </div>
      </div>
  );
}