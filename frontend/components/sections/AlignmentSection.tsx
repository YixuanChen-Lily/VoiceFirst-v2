import React from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useProposal } from '../../context/ProposalContext';

export function AlignmentSection() {
  const { data, updateField } = useProposal();

  return (
    <div>
        <SectionHeader title={STEP_NAMES[9]} description="How the project fits the funder's priorities and your community's plans." />

        <div className="space-y-6">
          <div>
            <Label htmlFor="community-alignment">How it fits your community's plans</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Point to the goals in your community plan that this project supports.
            </p>
            <Textarea
              id="community-alignment"
              placeholder="Explain how this project aligns with your community's strategic priorities, economic development plan, cultural preservation goals..."
              className="mt-2 min-h-[120px]"
              value={data.communityAlignment}
              onChange={(e) => updateField('communityAlignment', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="funder-alignment">How it fits the funder's priorities</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Use the funder's own words where you can. Their guidelines usually list what they look for.
            </p>
            <Textarea
              id="funder-alignment"
              placeholder="Describe how your project aligns with the funder's mandate, priority areas, and evaluation criteria..."
              className="mt-2 min-h-[120px]"
              value={data.funderAlignment}
              onChange={(e) => updateField('funderAlignment', e.target.value)}
            />
          </div>

          <div className="p-4 bg-forest-tint border-l-4 border-forest rounded">
            <Label htmlFor="long-term-sustainability" >What lasts after the funding ends <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-3">
              The benefits that continue once this grant is spent.
            </p>
            <Textarea
              id="long-term-sustainability"
              placeholder="Describe the long-term benefits, including economic, social, cultural, and environmental sustainability. How will outcomes continue beyond the funding period?"
              className="mt-2 min-h-[120px] bg-white"
              value={data.longTermSustainability}
              onChange={(e) => updateField('longTermSustainability', e.target.value)}
            />
          </div>

          <div className="p-4 bg-ochre-tint border border-[#EBD3A8] rounded">
            <h3 className="text-ochre-text mb-2">Tips</h3>
            <ul className="text-base text-ink space-y-1 list-disc list-inside">
              <li>Reference specific goals from community and funder plans</li>
              <li>Use data to demonstrate need and potential impact</li>
              <li>Show how multiple priorities are addressed</li>
              <li>Explain capacity building and knowledge transfer</li>
              <li>Highlight collaboration and partnership benefits</li>
            </ul>
          </div>
        </div>
      </div>
  );
}
