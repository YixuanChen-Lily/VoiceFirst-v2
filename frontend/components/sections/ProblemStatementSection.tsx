import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { AlertCircle } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function ProblemStatementSection() {
  const { data, updateField } = useProposal();

  return (
    <Card className="border-2 border-sky-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={4}
          title="Problem / Opportunity Statement"
          icon={AlertCircle}
          description="Explain the problem your project addresses and the opportunity it unlocks"
        />

        <div className="space-y-4">
          <div>
            <Label htmlFor="problem-statement">Problem / Opportunity Statement *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
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
            <p className="text-sm text-stone-600 mt-1 mb-2">
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

          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <p className="text-sm text-amber-900">
              <span>💡 Example:</span>
            </p>
            <p className="text-sm text-stone-700 mt-2 italic">
              "Demand for Indigenous artisan tourism is growing in region X, yet our community lacks the infrastructure and training to capitalize on this market. Current unemployment stands at 40%, and youth are leaving for urban centers. This project addresses these challenges by creating local employment opportunities while preserving and promoting our cultural traditions."
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
