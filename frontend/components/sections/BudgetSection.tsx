import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { DollarSign, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useProposal } from '../../context/ProposalContext';

interface BudgetItem {
  category: string;
  description: string;
  amount: string;
}

export function BudgetSection() {
  const { data, updateField } = useProposal();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([
    { category: 'Capital', description: '', amount: '' },
    { category: 'Operations', description: '', amount: '' },
    { category: 'Training', description: '', amount: '' },
    { category: 'Marketing', description: '', amount: '' },
    { category: 'Contingency', description: '', amount: '' },
  ]);

  const addBudgetRow = () => {
    setBudgetItems([...budgetItems, { category: '', description: '', amount: '' }]);
  };

  const updateBudgetItem = (index: number, field: keyof BudgetItem, value: string) => {
    const newItems = [...budgetItems];
    newItems[index][field] = value;
    setBudgetItems(newItems);
  };

  const calculateTotal = () => {
    return budgetItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount.replace(/,/g, '')) || 0;
      return sum + amount;
    }, 0);
  };

  return (
    <div>
        <SectionHeader title={STEP_NAMES[7]} description="What the project costs and where the money comes from." />

        <div className="space-y-6">
          <div className="p-4 bg-forest-tint border border-[#C7DACD] rounded-lg">
            <Label className="text-forest-dark">Budget Summary</Label>
            <p className="text-base text-forest-dark mt-1 mb-4">
              Capture high-level budget numbers for quick reference.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Total Project Cost</span>
                <Input
                  value={data.totalBudget}
                  onChange={(e) => updateField('totalBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Grant Requested</span>
                <Input
                  value={data.requestedAmount}
                  onChange={(e) => updateField('requestedAmount', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Other Contributions</span>
                <Input
                  value={data.otherBudget}
                  onChange={(e) => updateField('otherBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Personnel</span>
                <Input
                  value={data.personnelBudget}
                  onChange={(e) => updateField('personnelBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Equipment</span>
                <Input
                  value={data.equipmentBudget}
                  onChange={(e) => updateField('equipmentBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Training</span>
                <Input
                  value={data.trainingBudget}
                  onChange={(e) => updateField('trainingBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-[15px] text-ink-muted uppercase tracking-wide">Marketing</span>
                <Input
                  value={data.marketingBudget}
                  onChange={(e) => updateField('marketingBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Budget Breakdown *</Label>
            <div className="border border-line rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-forest-tint">
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="w-[200px]">
                        <Input
                          value={item.category}
                          onChange={(e) => updateBudgetItem(index, 'category', e.target.value)}
                          placeholder="Category"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateBudgetItem(index, 'description', e.target.value)}
                          placeholder="Brief description"
                          className="border-0 focus-visible:ring-1"
                        />
                      </TableCell>
                      <TableCell className="w-[180px]">
                        <Input
                          value={item.amount}
                          onChange={(e) => updateBudgetItem(index, 'amount', e.target.value)}
                          placeholder="0.00"
                          type="text"
                          className="border-0 focus-visible:ring-1 text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-forest-tint">
                    <TableCell colSpan={2}>
                      <Button
                        onClick={addBudgetRow}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-forest"
                      >
                        <Plus className="w-4 h-4" />
                        Add Row
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-forest-dark">
                        Total: ${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-forest-tint border border-[#C7DACD] rounded-lg">
              <h3 className="text-forest-dark mb-3">Funding Breakdown</h3>
              <div className="space-y-2 text-base">
                <div className="flex justify-between">
                  <span>Grant Requested:</span>
                  <Input
                    placeholder="$0"
                    className="w-32 h-8 text-right bg-white"
                    value={data.requestedAmount}
                    onChange={(e) => updateField('requestedAmount', e.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <span>Community Contribution:</span>
                  <Input
                    placeholder="$0"
                    className="w-32 h-8 text-right bg-white"
                    value={data.communityContribution}
                    onChange={(e) => updateField('communityContribution', e.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <span>Other Sources:</span>
                  <Input
                    placeholder="$0"
                    className="w-32 h-8 text-right bg-white"
                    value={data.otherBudget}
                    onChange={(e) => updateField('otherBudget', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-birch border border-line rounded-lg flex items-center justify-center text-ink-muted">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-2 bg-white rounded-full flex items-center justify-center border-4 border-[#C7DACD]">
                  <DollarSign className="w-12 h-12 text-forest" />
                </div>
                <p className="text-[15px]">Pie chart visualization placeholder</p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="sustainability-plan">Sustainability Plan *</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              How will the project continue after grant funding ends?
            </p>
            <Textarea
              id="sustainability-plan"
              placeholder="Explain your plan for financial sustainability (e.g., revenue generation, ongoing partnerships, self-sustaining operations...)"
              className="mt-2 min-h-[120px]"
              value={data.sustainabilityPlan}
              onChange={(e) => updateField('sustainabilityPlan', e.target.value)}
            />
          </div>
        </div>
      </div>
  );
}
