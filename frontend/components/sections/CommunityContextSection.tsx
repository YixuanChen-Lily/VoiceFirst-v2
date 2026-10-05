import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { MapPin, Upload, Info } from 'lucide-react';
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
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={3}
          title="Community / Background Context"
          icon={MapPin}
          description="Describe your community and its current situation"
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="community-name">Community Name *</Label>
              <Input
                id="community-name"
                placeholder="e.g., Inuvik"
                className="mt-2"
                value={data.communityName}
                onChange={(e) => updateField('communityName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="community-population">Population</Label>
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
              <Label htmlFor="community-overview">Community Overview *</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-stone-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Include population, location, key demographic facts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id="community-overview"
              placeholder="Describe your community: population, location, key facts..."
              className="mt-2 min-h-[120px]"
              value={data.communityBackground}
              onChange={(e) => updateField('communityBackground', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="economic-baseline">Economic Baseline</Label>
            <Textarea
              id="economic-baseline"
              placeholder="Current economic situation, employment rates, major industries..."
              className="mt-2 min-h-[100px]"
              value={data.economicBaseline}
              onChange={(e) => updateField('economicBaseline', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="cultural-context">Cultural/Environmental Context</Label>
            <Textarea
              id="cultural-context"
              placeholder="Cultural heritage, traditions, environmental features relevant to this project..."
              className="mt-2 min-h-[100px]"
              value={data.culturalContext}
              onChange={(e) => updateField('culturalContext', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="needs-challenges">Needs & Challenges</Label>
            <Textarea
              id="needs-challenges"
              placeholder="Key challenges your community faces that this project addresses..."
              className="mt-2 min-h-[100px]"
              value={data.needsChallenges}
              onChange={(e) => updateField('needsChallenges', e.target.value)}
            />
          </div>

          <div className="p-4 bg-stone-50 border-2 border-dashed border-stone-300 rounded">
            <Label>Strategic Plan Reference (Optional)</Label>
            <p className="text-sm text-stone-600 mt-1 mb-3">
              Upload your community strategic plan if available
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
                <span className="text-sm text-emerald-700">✓ {fileName}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
