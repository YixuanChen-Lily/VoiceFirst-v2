import React from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
    <div>
        <SectionHeader title={STEP_NAMES[6]} description="Who runs the project, and when each part happens." />

        <div className="space-y-6">
          <div>
            <Label htmlFor="governance">Who oversees the project</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              For example, a council committee, a board, or a project lead who reports to council.
            </p>
            <Textarea
              id="governance"
              placeholder="Who makes decisions, and how…"
              className="mt-2 min-h-[120px]"
              value={data.governanceStructure}
              onChange={(e) => updateField('governanceStructure', e.target.value)}
            />
          </div>

          <div>
            <Label>Milestones</Label>
            <p className="text-base text-ink-muted mt-1 mb-3">
              The main things you'll finish, and when.
            </p>
            <div className="p-4 bg-birch rounded-lg border border-dashed border-line">
              <div className="space-y-3">
                {data.milestones.map((milestone, index) => (
                  <div className="flex items-center gap-3" key={`milestone-${index}`}>
                    <Input
                      placeholder="Milestone, for example: Greenhouse built"
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
            <Label htmlFor="responsibilities">Who does what <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Key people or roles, and what each one is responsible for.
            </p>
            <Textarea
              id="responsibilities"
              placeholder="For example: Project lead – runs day-to-day work and reports to council…"
              className="mt-2 min-h-[100px]"
              value={data.implementationResponsibilities}
              onChange={(e) => updateField('implementationResponsibilities', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="partnerships">Partners <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Organizations working with you or supporting the project.
            </p>
            <Textarea
              id="partnerships"
              placeholder="For example: the school, the health centre, a regional college…"
              className="mt-2 min-h-[80px]"
              value={data.implementationPartnerships}
              onChange={(e) => updateField('implementationPartnerships', e.target.value)}
            />
          </div>

          <div className="p-4 bg-ochre-tint border-l-4 border-ochre rounded">
            <Label htmlFor="risk-mitigation" className="text-ochre-text">Main risks, in brief <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              A short version. You'll go into detail in the Risks step.
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
      </div>
  );
}
