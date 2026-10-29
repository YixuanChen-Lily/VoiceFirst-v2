import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Upload, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useProposal } from '../../context/ProposalContext';

export function CommunityContextSection() {
  const [fileName, setFileName] = useState<string | null>(null);
  const { data, updateField } = useProposal();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  return (
    <div>
        <SectionHeader title={STEP_NAMES[3]} description="Help the funder picture where the project happens and who it is for." />

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="community-name">Community name</Label>
              <Input
                id="community-name"
                placeholder="e.g., Inuvik"
                className="mt-2"
                value={data.communityName}
                onChange={(e) => updateField('communityName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="community-population">Population <span className="font-normal text-ink-muted">(optional)</span></Label>
              <Input
                id="community-population"
                placeholder="e.g., 3,243"
                className="mt-2"
                value={data.population}
                onChange={(e) => updateField('population', e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="community-overview">About your community</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-[#8C867E]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Include population, location, key demographic facts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id="community-overview"
              placeholder="Where it is, who lives there, and what daily life is like…"
              className="mt-2 min-h-[120px]"
              value={data.communityBackground}
              onChange={(e) => updateField('communityBackground', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="economic-baseline">Local economy <span className="font-normal text-ink-muted">(optional)</span></Label>
            <Textarea
              id="economic-baseline"
              placeholder="Main jobs, income sources, and costs that affect this project…"
              className="mt-2 min-h-[100px]"
              value={data.economicBaseline}
              onChange={(e) => updateField('economicBaseline', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="cultural-context">Culture and land <span className="font-normal text-ink-muted">(optional)</span></Label>
            <Textarea
              id="cultural-context"
              placeholder="Traditions, language, land and environment that matter to this project…"
              className="mt-2 min-h-[100px]"
              value={data.culturalContext}
              onChange={(e) => updateField('culturalContext', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="needs-challenges">Challenges the community faces <span className="font-normal text-ink-muted">(optional)</span></Label>
            <Textarea
              id="needs-challenges"
              placeholder="The challenges this project helps with…"
              className="mt-2 min-h-[100px]"
              value={data.needsChallenges}
              onChange={(e) => updateField('needsChallenges', e.target.value)}
            />
          </div>

          <div className="p-4 bg-birch border border-dashed border-line rounded">
            <Label>Community plan <span className="font-normal text-ink-muted">(optional)</span></Label>
            <p className="text-base text-ink-muted mt-1 mb-3">
              If you have a community plan, add it here.
            </p>
            <div className="flex items-center gap-4">
              <Button variant="outline" className="gap-2" asChild>
                <label htmlFor="strategic-plan" className="cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Choose File
                  <input
                    id="strategic-plan"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                  />
                </label>
              </Button>
              {fileName && (
                <span className="text-base text-forest">✓ {fileName}</span>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
