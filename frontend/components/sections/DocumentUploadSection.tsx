import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Button } from '../ui/button';
import { FileText, Loader2, Upload } from 'lucide-react';
import { AddFromMyFiles } from '../files/AddFromMyFiles';
import { ProposalFileList } from '../files/ProposalFileList';
import { useProposalFiles, type ProposalFiles } from '../files/useProposalFiles';

const READABLE_TYPES = '.pdf,.docx,.xlsx,.txt,.md,.csv';

export function DocumentUploadSection() {
  const files = useProposalFiles();
  const background = files.files.filter((file) => file.role === 'background');

  return (
    <Card className="border-2 border-purple-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={0}
          title="Background Documents"
          icon={Upload}
          description="Give the assistant your own material to draw on while you write. Only you can see these files."
        />

        <div className="space-y-8">
          <UploadPanel
            title="Community Context Documents"
            description="Community plans, needs assessments and background research. The assistant uses them when it helps you write each section."
            label="Community context"
            gradient="from-sky-50 to-blue-50"
            border="border-sky-200"
            iconColor="bg-sky-600"
            files={files}
            shown={background.filter((file) => file.label !== 'Funding guidelines')}
          />

          <UploadPanel
            title="Funding Guidelines"
            description="The funder's guidelines, rubrics or scoring criteria for this application, if they aren't in the document library already."
            label="Funding guidelines"
            gradient="from-amber-50 to-orange-50"
            border="border-amber-200"
            iconColor="bg-amber-600"
            files={files}
            shown={background.filter((file) => file.label === 'Funding guidelines')}
          />

          {files.error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {files.error}
            </p>
          )}

          <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded">
            <h4 className="text-purple-900 mb-2">How the assistant uses these</h4>
            <p className="text-sm text-stone-700">
              The assistant reads background documents for this proposal only, and shows which document an answer
              came from. Files are kept in My files, so you can add them to another proposal without uploading them
              again. PDF, Word, Excel and text files work; scanned PDFs can't be read.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UploadPanelProps {
  title: string;
  description: string;
  label: string;
  gradient: string;
  border: string;
  iconColor: string;
  files: ProposalFiles;
  shown: ProposalFiles['files'];
}

function UploadPanel({ title, description, label, gradient, border, iconColor, files, shown }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const options = { role: 'background' as const, label };

  const uploadAll = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) => files.upload(file, options));
  };

  return (
    <div className={`p-6 bg-gradient-to-br ${gradient} rounded-lg border-2 ${border}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex-shrink-0 w-12 h-12 ${iconColor} text-white rounded-lg flex items-center justify-center`}>
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-stone-900 mb-2">{title}</h3>
          <p className="text-sm text-stone-700">{description}</p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
          dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-stone-300 bg-white/70'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          uploadAll(event.dataTransfer.files);
        }}
      >
        <p className="text-sm text-stone-500 mb-3">Drag &amp; drop files here, or</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <label className="cursor-pointer">
              {files.isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {files.isAdding ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                multiple
                className="hidden"
                accept={READABLE_TYPES}
                onChange={(event) => {
                  uploadAll(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </Button>
          <AddFromMyFiles actions={files} options={options} />
        </div>
      </div>

      <ProposalFileList files={shown} actions={files} emptyText="No documents added yet." />
    </div>
  );
}
