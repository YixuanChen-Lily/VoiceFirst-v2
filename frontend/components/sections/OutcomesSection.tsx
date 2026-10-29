import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useProposal } from '../../context/ProposalContext';

interface Indicator {
  indicator: string;
  baseline: string;
  target: string;
  year: string;
}

export function OutcomesSection() {
  const { data, updateField } = useProposal();
  const [indicators, setIndicators] = useState<Indicator[]>([
    { indicator: '', baseline: '', target: '', year: '' },
    { indicator: '', baseline: '', target: '', year: '' },
    { indicator: '', baseline: '', target: '', year: '' },
  ]);

  const addIndicatorRow = () => {
    setIndicators([...indicators, { indicator: '', baseline: '', target: '', year: '' }]);
  };

  const updateIndicator = (index: number, field: keyof Indicator, value: string) => {
    const newIndicators = [...indicators];
    newIndicators[index][field] = value;
    setIndicators(newIndicators);
  };

  return (
    <div>
        <SectionHeader title={STEP_NAMES[8]} description="How you'll know the project worked." />

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="expected-outcomes">What will change</Label>
              <p className="text-base text-ink-muted mt-1 mb-2">
                The main results you expect for the community.
              </p>
              <Textarea
                id="expected-outcomes"
                className="mt-2 min-h-[140px]"
                placeholder="Outline the key community, economic, and cultural outcomes you expect."
                value={data.expectedOutcomes}
                onChange={(e) => updateField('expectedOutcomes', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="success-indicators">How you'll know it worked</Label>
              <p className="text-base text-ink-muted mt-1 mb-2">
                The signs of success you'll watch for, like jobs created or people trained.
              </p>
              <Textarea
                id="success-indicators"
                className="mt-2 min-h-[140px]"
                placeholder="Describe how you will measure progress (jobs created, revenue, training completions, etc.)"
                value={data.successIndicators}
                onChange={(e) => updateField('successIndicators', e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Label>Targets</Label>
              <span className="text-[15px] text-ink-muted"></span>
            </div>
            <p className="text-base text-ink-muted mb-4">
              For each sign of success: where you are now, and where you aim to be.
            </p>
            
            <div className="border border-line rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-forest-tint">
                    <TableHead>Sign of success</TableHead>
                    <TableHead>Now</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.indicator}
                          onChange={(e) => updateIndicator(index, 'indicator', e.target.value)}
                          placeholder="e.g., Jobs created"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell className="w-[150px]">
                        <Input
                          value={item.baseline}
                          onChange={(e) => updateIndicator(index, 'baseline', e.target.value)}
                          placeholder="e.g., 0"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell className="w-[150px]">
                        <Input
                          value={item.target}
                          onChange={(e) => updateIndicator(index, 'target', e.target.value)}
                          placeholder="e.g., 15"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <Input
                          value={item.year}
                          onChange={(e) => updateIndicator(index, 'year', e.target.value)}
                          placeholder="Year 3"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-forest-tint">
                    <TableCell colSpan={4}>
                      <Button
                        onClick={addIndicatorRow}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-forest"
                      >
                        <Plus className="w-4 h-4" />
                        Add Indicator
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-4 bg-ochre-tint border-l-4 border-ochre rounded">
            <p className="text-base text-ochre-text mb-2">
              <span>Examples</span>
            </p>
            <ul className="text-base text-ink space-y-1 list-disc list-inside">
              <li>Number of full-time jobs created</li>
              <li>Revenue generated from sales</li>
              <li>Number of community members trained</li>
              <li>Tourist visits to community</li>
              <li>Youth retention rate</li>
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="data-collection">How you'll gather information <span className="font-normal text-ink-muted">(optional)</span></Label>
              <span className="text-[15px] text-ink-muted"></span>
            </div>
            <p className="text-base text-ink-muted mt-1 mb-2">
              For example: sign-in sheets, sales records, or a yearly survey.
            </p>
            <Textarea
              id="data-collection"
              placeholder="How you'll collect information…"
              className="mt-2 min-h-[100px]"
              value={data.dataCollectionPlan}
              onChange={(e) => updateField('dataCollectionPlan', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="evaluation-plan">How you'll review progress <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              When you'll check how it's going, and who will do it.
            </p>
            <Textarea
              id="evaluation-plan"
              placeholder="Your plan for reviewing progress…"
              className="mt-2 min-h-[100px]"
              value={data.evaluationPlan}
              onChange={(e) => updateField('evaluationPlan', e.target.value)}
            />
          </div>
        </div>
      </div>
  );
}
