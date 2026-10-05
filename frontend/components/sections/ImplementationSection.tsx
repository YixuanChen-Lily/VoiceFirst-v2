import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Settings } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function ImplementationSection() {
  const { data, updateField, updateMultipleFields } = useProposal();

  const handleMilestoneChange = (index: number, field: 'name' | 'date', value: string) => {
    const updated = data.milestones.map((milestone, idx) =>
      idx === index ? { ...milestone, [field]: value } : milestone
    );
    updateMultipleFields({ milestones: updated });
  };

  return (
    <Card className="border-2 border-sky-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={6}
          title="Implementation Plan / Governance"
          icon={Settings}
          description="How will the project be organized, managed, and executed?"
        />

        <div className="space-y-6">
          <div>
            <Label htmlFor="governance">Governance Structure *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              Who will oversee the project? Board, committee, management team?
            </p>
            <Textarea
              id="governance"
              placeholder="Describe the governance structure, decision-making processes, and leadership..."
              className="mt-2 min-h-[120px]"
              value={data.governanceStructure}
              onChange={(e) => updateField('governanceStructure', e.target.value)}
            />
          </div>

          <div>
            <Label>Timeline</Label>
            <p className="text-sm text-stone-600 mt-1 mb-3">
              Key milestones and timeline
            </p>
            <div className="p-4 bg-stone-50 rounded-lg border-2 border-dashed border-stone-300">
              <div className="space-y-3">
                {data.milestones.map((milestone, index) => (
                  <div className="flex items-center gap-3" key={`milestone-${index}`}>
                    <Input
                      placeholder="Milestone (e.g., Complete facility construction)"
                      className="flex-1 bg-white"
                      value={milestone.name}
                      onChange={(e) => handleMilestoneChange(index, 'name', e.target.value)}
                    />
                    <Input
                      type="date"
                      className="w-40 bg-white"
                      value={milestone.date}
                      onChange={(e) => handleMilestoneChange(index, 'date', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="responsibilities">Responsibilities</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              Who leads what? Key roles and responsibilities
            </p>
            <Textarea
              id="responsibilities"
              placeholder="List key team members and their roles (e.g., Project Manager: Sarah Johnson - oversees all operations...)"
              className="mt-2 min-h-[100px]"
              value={data.implementationResponsibilities}
              onChange={(e) => updateField('implementationResponsibilities', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="partnerships">Partnerships</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              List key partners, collaborators, or supporting organizations
            </p>
            <Textarea
              id="partnerships"
              placeholder="e.g., Tourism Association, Local College (training partner), Economic Development Corporation..."
              className="mt-2 min-h-[80px]"
              value={data.implementationPartnerships}
              onChange={(e) => updateField('implementationPartnerships', e.target.value)}
            />
          </div>

          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <Label htmlFor="risk-mitigation" className="text-amber-900">Risk Mitigation (Brief Overview)</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
              What could go wrong and how will you address it? (Detailed in Section 10)
            </p>
            <Textarea
              id="risk-mitigation"
              placeholder="Example: Weather delays → build buffer time into schedule; Skills shortage → partner with training institutions..."
              className="mt-2 min-h-[80px] bg-white"
              value={data.implementationRiskOverview}
              onChange={(e) => updateField('implementationRiskOverview', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
