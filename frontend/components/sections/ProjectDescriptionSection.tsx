import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Target } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function ProjectDescriptionSection() {
  const { data, updateField } = useProposal();

  return (
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={5}
          title="Project Description & Objectives"
          icon={Target}
          description="Define your project's goals and planned activities"
        />

        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Project Objectives *</Label>
            <p className="text-sm text-stone-600 mb-4">
              List the main objectives of your project (SMART: Specific, Measurable, Achievable, Relevant, Time-bound)
            </p>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm">
                  1
                </div>
                <Input
                  placeholder="Objective 1: e.g., Create 15 permanent jobs by Year 3"
                  className="flex-1"
                  value={data.objective1}
                  onChange={(e) => updateField('objective1', e.target.value)}
                />
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm">
                  2
                </div>
                <Input
                  placeholder="Objective 2: e.g., Train 30 community members in artisan skills"
                  className="flex-1"
                  value={data.objective2}
                  onChange={(e) => updateField('objective2', e.target.value)}
                />
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm">
                  3
                </div>
                <Input
                  placeholder="Objective 3: e.g., Generate $200K annual revenue by Year 3"
                  className="flex-1"
                  value={data.objective3}
                  onChange={(e) => updateField('objective3', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t-2 border-stone-200 pt-6">
            <Label className="mb-3 block">Activities by Year</Label>
            <p className="text-sm text-stone-600 mb-4">
              Describe the key activities planned for each year
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🛠️</span>
                  <h3 className="text-emerald-800">Year 1</h3>
                </div>
                <Textarea
                  placeholder="Setup phase: facility construction, equipment purchase, initial training..."
                  className="min-h-[100px] bg-white"
                  value={data.year1Activities}
                  onChange={(e) => updateField('year1Activities', e.target.value)}
                />
              </div>

              <div className="p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🌱</span>
                  <h3 className="text-emerald-800">Year 2</h3>
                </div>
                <Textarea
                  placeholder="Growth phase: expand training, pilot product lines, local marketing..."
                  className="min-h-[100px] bg-white"
                  value={data.year2Activities}
                  onChange={(e) => updateField('year2Activities', e.target.value)}
                />
              </div>

              <div className="p-4 bg-stone-50 rounded-lg border-2 border-stone-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🚀</span>
                  <h3 className="text-emerald-800">Year 3</h3>
                </div>
                <Textarea
                  placeholder="Scale phase: full operations, regional expansion, sustainability planning..."
                  className="min-h-[100px] bg-white"
                  value={data.year3Activities}
                  onChange={(e) => updateField('year3Activities', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}