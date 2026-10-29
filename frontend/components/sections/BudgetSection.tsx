import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useProposal, type ProposalData } from '../../context/ProposalContext';

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
          <MoneyGroup
            title="Where the money comes from"
            fields={[
              { field: 'totalBudget', label: 'Total project cost' },
              { field: 'requestedAmount', label: "Amount you're asking for" },
              { field: 'communityContribution', label: 'Community contribution' },
              { field: 'otherBudget', label: 'Other funding' },
            ]}
          />

          <MoneyGroup
            title="What the money pays for"
            fields={[
              { field: 'personnelBudget', label: 'Staff' },
              { field: 'equipmentBudget', label: 'Equipment' },
              { field: 'trainingBudget', label: 'Training' },
              { field: 'marketingBudget', label: 'Promotion' },
            ]}
          />

          <div>
            <Label className="mb-3 block">Cost breakdown</Label>
            <div className="border border-line rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-forest-tint">
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                        Add a row
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

          <div>
            <Label htmlFor="sustainability-plan">After the grant ends</Label>
            <p className="text-base text-ink-muted mt-1 mb-2">
              How the project keeps going: income it earns, partners, or other funding.
            </p>
            <Textarea
              id="sustainability-plan"
              placeholder="For example: greenhouse sales cover heating costs from Year 3…"
              className="mt-2 min-h-[120px]"
              value={data.sustainabilityPlan}
              onChange={(e) => updateField('sustainabilityPlan', e.target.value)}
            />
          </div>
        </div>
      </div>
  );
}

type MoneyField = 'totalBudget' | 'requestedAmount' | 'communityContribution' | 'otherBudget'
  | 'personnelBudget' | 'equipmentBudget' | 'trainingBudget' | 'marketingBudget';

interface MoneyGroupProps {
  title: string;
  fields: { field: MoneyField & keyof ProposalData; label: string }[];
}

/** A titled block of dollar amounts, two per row. */
function MoneyGroup({ title, fields }: MoneyGroupProps) {
  const { data, updateField } = useProposal();
  return (
    <section className="p-5 bg-white border border-line rounded-xl">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        {fields.map(({ field, label }) => (
          <div key={field}>
            <Label htmlFor={`budget-${field}`} className="mb-1.5">{label}</Label>
            <Input
              id={`budget-${field}`}
              inputMode="decimal"
              placeholder="$0"
              className="text-right"
              value={data[field]}
              onChange={(e) => updateField(field, e.target.value)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
