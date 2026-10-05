import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Target } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function AlignmentSection() {
  const { data, updateField } = useProposal();

  return (
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={9}
          title="Alignment & Sustainability"
          icon={Target}
          description="How does this project align with broader plans and priorities?"
        />

        <div className="space-y-6">
          <div>
            <Label htmlFor="community-alignment">Alignment with Community Plan *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              How does this project support your community's strategic plan or vision?
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
            <Label htmlFor="funder-alignment">Alignment with Funder Priorities *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              How does this project meet the funder's objectives and criteria?
            </p>
            <Textarea
              id="funder-alignment"
              placeholder="Describe how your project aligns with the funder's mandate, priority areas, and evaluation criteria..."
              className="mt-2 min-h-[120px]"
              value={data.funderAlignment}
              onChange={(e) => updateField('funderAlignment', e.target.value)}
            />
          </div>

          <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded">
            <Label htmlFor="long-term-sustainability" className="text-sky-900">Long-Term Sustainability & Impact</Label>
            <p className="text-sm text-stone-600 mt-1 mb-3">
              What will be the lasting impact of this project?
            </p>
            <Textarea
              id="long-term-sustainability"
              placeholder="Describe the long-term benefits, including economic, social, cultural, and environmental sustainability. How will outcomes continue beyond the funding period?"
              className="mt-2 min-h-[120px] bg-white"
              value={data.longTermSustainability}
              onChange={(e) => updateField('longTermSustainability', e.target.value)}
            />
          </div>

          <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded">
            <h3 className="text-amber-900 mb-2">💡 Tip: Strong Alignment Statements</h3>
            <ul className="text-sm text-stone-700 space-y-1 list-disc list-inside">
              <li>Reference specific goals from community and funder plans</li>
              <li>Use data to demonstrate need and potential impact</li>
              <li>Show how multiple priorities are addressed</li>
              <li>Explain capacity building and knowledge transfer</li>
              <li>Highlight collaboration and partnership benefits</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
