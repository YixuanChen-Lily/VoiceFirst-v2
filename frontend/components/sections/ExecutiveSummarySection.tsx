import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { FileText } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function ExecutiveSummarySection() {
  const { data, updateField } = useProposal();

  return (
    <Card className="border-2 border-sky-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={2}
          title="Executive Summary"
          icon={FileText}
          description="Provide a concise overview of your entire project"
        />

        <div className="space-y-4">
          <div>
            <Label htmlFor="executive-summary">Executive Summary *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
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

          <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded">
            <p className="text-sm text-sky-900">
              <span>💡 Example:</span>
            </p>
            <p className="text-sm text-stone-700 mt-2 italic">
              "XYZ First Nation proposes to develop a community-owned social enterprise combining artisan craft production with eco-tourism. This 3-year initiative will create 15 permanent jobs, preserve traditional knowledge, and generate sustainable revenue. We are requesting $500,000 to establish facilities, train community members, and launch marketing. Expected outcomes include increased employment, cultural preservation, and economic self-sufficiency."
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}