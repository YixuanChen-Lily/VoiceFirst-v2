import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Upload, FileText } from 'lucide-react';

export function DocumentUploadSection() {
  return (
    <Card className="border-2 border-purple-200 shadow-lg opacity-60">
      <CardContent className="p-8">
        <SectionHeader
          number={0}
          title="Upload Documents (Coming Soon)"
          icon={Upload}
          description="We're enhancing the RAG-powered workflow so you can give the assistant rich context. Stay tuned!"
        />

        <div className="space-y-8">
          <DisabledUploadPanel
            title="Community Context Documents"
            gradient="from-sky-50 to-blue-50"
            border="border-sky-200"
            iconColor="bg-sky-600"
            tooltip="Soon you'll be able to upload community plans, needs assessments, and background research. The assistant will automatically weave that insight into every section."
          />

          <DisabledUploadPanel
            title="Funding Guidelines"
            gradient="from-amber-50 to-orange-50"
            border="border-amber-200"
            iconColor="bg-amber-600"
            tooltip="Upload support for funder rubrics and scoring criteria is coming. Once live, the assistant will align drafts with funder expectations automatically."
          />

          <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded">
            <h4 className="text-purple-900 mb-2">What to Expect</h4>
            <p className="text-sm text-stone-700">
              While we refine the document ingestion pipeline, you can keep building proposals using manual inputs.
              RAG-powered uploads will return soon with smarter context awareness and richer suggestions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DisabledUploadPanelProps {
  title: string;
  gradient: string;
  border: string;
  iconColor: string;
  tooltip: string;
}

function DisabledUploadPanel({ title, gradient, border, iconColor, tooltip }: DisabledUploadPanelProps) {
  return (
    <div className={`p-6 bg-gradient-to-br ${gradient} rounded-lg border-2 ${border}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex-shrink-0 w-12 h-12 ${iconColor} text-white rounded-lg flex items-center justify-center`}>
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-stone-900 mb-2">{title}</h3>
          <p className="text-sm text-stone-700">
            File uploads will be available shortly. We're polishing the experience so the AI can use your documents safely and effectively.
          </p>
        </div>
      </div>

      <div className="border-2 border-dashed rounded-lg p-6 bg-white/70 text-center cursor-not-allowed">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-full">
              <div className="text-stone-500 text-sm">Drag &amp; drop coming soon</div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
