import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { useProposal } from '../../context/ProposalContext';

interface Risk {
  risk: string;
  likelihood: string;
  mitigation: string;
}

export function RiskManagementSection() {
  const { data, updateField } = useProposal();
  const [risks, setRisks] = useState<Risk[]>([
    { risk: '', likelihood: '', mitigation: '' },
    { risk: '', likelihood: '', mitigation: '' },
    { risk: '', likelihood: '', mitigation: '' },
  ]);

  const addRiskRow = () => {
    setRisks([...risks, { risk: '', likelihood: '', mitigation: '' }]);
  };

  const updateRisk = (index: number, field: keyof Risk, value: string) => {
    const newRisks = [...risks];
    newRisks[index][field] = value;
    setRisks(newRisks);
  };

  return (
    <div>
        <SectionHeader title={STEP_NAMES[10]} description="What could go wrong, and how you'll handle it." />

        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Risk Assessment *</Label>
            <p className="text-base text-ink-muted mb-4">
              Identify potential risks and your mitigation strategies
            </p>
            
            <div className="border border-line rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ochre-tint">
                    <TableHead className="min-w-[200px]">Risk</TableHead>
                    <TableHead className="min-w-[120px]">Likelihood</TableHead>
                    <TableHead className="min-w-[250px]">Mitigation Measure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risks.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.risk}
                          onChange={(e) => updateRisk(index, 'risk', e.target.value)}
                          placeholder="e.g., Seasonal tourism demand may vary"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.likelihood}
                          onValueChange={(value) => updateRisk(index, 'likelihood', value)}
                        >
                          <SelectTrigger className="border-0 focus:ring-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.mitigation}
                          onChange={(e) => updateRisk(index, 'mitigation', e.target.value)}
                          placeholder="e.g., Develop year-round online sales platform"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-ochre-tint">
                    <TableCell colSpan={3}>
                      <Button
                        onClick={addRiskRow}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-ochre-text"
                      >
                        <Plus className="w-4 h-4" />
                        Add Risk
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-4 bg-forest-tint border-l-4 border-forest rounded">
            <p className="text-base text-forest-dark mb-2">
              <span>Example:</span>
            </p>
            <div className="text-base text-ink space-y-2">
              <div className="grid grid-cols-3 gap-4 p-2 bg-white rounded">
                <div>
                  <span className="text-[15px] text-ink-muted">Risk:</span>
                  <p>Seasonal tourism demand may vary</p>
                </div>
                <div>
                  <span className="text-[15px] text-ink-muted">Likelihood:</span>
                  <p>Medium</p>
                </div>
                <div>
                  <span className="text-[15px] text-ink-muted">Mitigation:</span>
                  <p>Develop year-round online sales platform + diversify product lines</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-ochre-tint border border-[#EBD3A8] rounded">
            <h3 className="text-ochre-text mb-2">Common Risk Categories</h3>
            <ul className="text-base text-ink space-y-1 list-disc list-inside grid grid-cols-1 md:grid-cols-2 gap-2">
              <li>Financial (budget overruns, funding delays)</li>
              <li>Operational (staffing, supply chain)</li>
              <li>Market (demand fluctuation, competition)</li>
              <li>Environmental (weather, natural events)</li>
              <li>Regulatory (permits, compliance)</li>
              <li>Partnership (partner withdrawal, conflicts)</li>
              <li>Technical (equipment failure, IT issues)</li>
              <li>Community (engagement, participation)</li>
            </ul>
          </div>

          <div>
            <Label htmlFor="risk-summary">Overall Risk Mitigation Strategy</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              Provide a narrative summary of your major risks and how you will address them.
            </p>
            <Textarea
              id="risk-summary"
              className="mt-2 min-h-[140px]"
              placeholder="Summarize key risks and mitigation strategies across governance, operations, partnerships, and finance."
              value={data.risksMitigation}
              onChange={(e) => updateField('risksMitigation', e.target.value)}
            />
          </div>
        </div>
      </div>
  );
}
