import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
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
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={7}
          title="Budget & Financial Plan"
          icon={DollarSign}
          description="Detailed breakdown of project costs and financial sustainability"
        />

        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
            <Label className="text-emerald-900">Budget Summary</Label>
            <p className="text-sm text-emerald-900/80 mt-1 mb-4">
              Capture high-level budget numbers for quick reference.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Total Project Cost</span>
                <Input
                  value={data.totalBudget}
                  onChange={(e) => updateField('totalBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Grant Requested</span>
                <Input
                  value={data.requestedAmount}
                  onChange={(e) => updateField('requestedAmount', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Other Contributions</span>
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
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Personnel</span>
                <Input
                  value={data.personnelBudget}
                  onChange={(e) => updateField('personnelBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Equipment</span>
                <Input
                  value={data.equipmentBudget}
                  onChange={(e) => updateField('equipmentBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Training</span>
                <Input
                  value={data.trainingBudget}
                  onChange={(e) => updateField('trainingBudget', e.target.value)}
                  placeholder="$0"
                  className="mt-1 bg-white text-right"
                />
              </div>
              <div>
                <span className="block text-xs text-stone-500 uppercase tracking-wide">Marketing</span>
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
            <div className="border-2 border-stone-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-emerald-50">
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
                  <TableRow className="bg-emerald-50">
                    <TableCell colSpan={2}>
                      <Button
                        onClick={addBudgetRow}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-emerald-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Row
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-emerald-800">
                        Total: ${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-sky-50 border-2 border-sky-200 rounded-lg">
              <h3 className="text-sky-900 mb-3">📊 Funding Breakdown</h3>
              <div className="space-y-2 text-sm">
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

            <div className="p-4 bg-stone-50 border-2 border-stone-200 rounded-lg flex items-center justify-center text-stone-500">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-2 bg-white rounded-full flex items-center justify-center border-4 border-emerald-200">
                  <DollarSign className="w-12 h-12 text-emerald-600" />
                </div>
                <p className="text-xs">Pie chart visualization placeholder</p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="sustainability-plan">Sustainability Plan *</Label>
            <p className="text-sm text-stone-600 mt-1 mb-2">
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
      </CardContent>
    </Card>
  );
}
