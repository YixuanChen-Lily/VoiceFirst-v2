import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
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
    <div>
        <SectionHeader title={STEP_NAMES[0]} description="Give the assistant your own material to draw on while you write. Only you can see these files." />

        <div className="space-y-8">
          <UploadPanel
            title="Community plans and research"
            description="Community plans, needs assessments and background research. The assistant uses them when it helps you write each section."
            label="Community context"
            files={files}
            shown={background.filter((file) => file.label !== 'Funding guidelines')}
          />

          <UploadPanel
            title="The funder's guidelines"
            description="The funder's guidelines, rubrics or scoring criteria for this application, if they aren't in the document library already."
            label="Funding guidelines"
            files={files}
            shown={background.filter((file) => file.label === 'Funding guidelines')}
          />

          {files.error && (
            <p role="alert" className="text-base text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {files.error}
            </p>
          )}

          <div className="p-5 bg-white border border-line rounded-xl">
            <h2 className="text-lg font-bold mb-1.5">How the assistant uses these</h2>
            <p className="text-base text-ink">
              The assistant reads background documents for this proposal only, and shows which document an answer
              came from. Files are kept in My files, so you can add them to another proposal without uploading them
              again. PDF, Word, Excel and text files work; scanned PDFs can't be read.
            </p>
          </div>
        </div>
      </div>
  );
}

interface UploadPanelProps {
  title: string;
  description: string;
  label: string;
  files: ProposalFiles;
  shown: ProposalFiles['files'];
}

function UploadPanel({ title, description, label, files, shown }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const options = { role: 'background' as const, label };

  const uploadAll = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) => files.upload(file, options));
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-line">
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 bg-forest-tint text-forest rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold mb-1">{title}</h2>
          <p className="text-base text-ink-muted">{description}</p>
        </div>
      </div>

      <div
        className={`border border-dashed rounded-lg p-6 text-center mb-4 transition-colors ${
          dragActive ? 'border-forest bg-forest-tint' : 'border-line bg-birch'
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
        <p className="text-base text-ink-muted mb-3">Drag files here, or</p>
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
