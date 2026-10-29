import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Upload, Plus, CheckCircle2 } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';
import { AddFromMyFiles } from '../files/AddFromMyFiles';
import { ProposalFileList } from '../files/ProposalFileList';
import { useProposalFiles } from '../files/useProposalFiles';

const RECOMMENDED = [
  { key: 'strategicPlan', label: 'Community Strategic Plan' },
  { key: 'lettersOfSupport', label: 'Letters of Support' },
  { key: 'staffResumes', label: 'Staff Resumes / Bios' },
  { key: 'budgetSpreadsheet', label: 'Detailed Budget Spreadsheet' },
  { key: 'facilityPlans', label: 'Facility Plans / Designs' },
];

const OTHER_LABEL = 'Additional Document';

export function AttachmentsSection() {
  const { data, updateField } = useProposal();
  const files = useProposalFiles();
  const attachments = files.files.filter((file) => file.role === 'attachment');
  const [dragActive, setDragActive] = useState(false);
  const checklist = data.attachmentChecklist ?? {};

  // Attachments start with the assistant switched off; each file can be switched on below.
  const uploadAll = (list: FileList | null, label: string) => {
    Array.from(list ?? []).forEach((file) => files.upload(file, { role: 'attachment', label }));
  };

  const hasFile = (label: string) => attachments.some((file) => file.label === label);

  const toggle = (key: string) => {
    updateField('attachmentChecklist', { ...checklist, [key]: !checklist[key] });
  };

  return (
    <div>
        <SectionHeader title={STEP_NAMES[11]} description="Letters, plans and other documents that back up your proposal." />

        <div className="space-y-6">
          <div
            className={`p-6 border border-dashed rounded-lg transition-colors ${
              dragActive ? 'border-forest bg-forest-tint' : 'bg-birch border-line'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              uploadAll(event.dataTransfer.files, OTHER_LABEL);
            }}
          >
            <div className="text-center mb-4">
              <Upload className="w-12 h-12 mx-auto mb-3 text-[#8C867E]" />
              <h3 className="text-ink mb-2">Drag files here</h3>
              <p className="text-base text-ink-muted mb-4">or upload each recommended document below</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-base text-ink-muted mb-3">Documents funders often ask for</h4>

              <div className="space-y-3">
                {RECOMMENDED.map(({ key, label }) => {
                  const uploaded = hasFile(label);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-white rounded border border-line"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`checklist-${key}`}
                          checked={uploaded || Boolean(checklist[key])}
                          disabled={uploaded}
                          onCheckedChange={() => toggle(key)}
                        />
                        <Label htmlFor={`checklist-${key}`} className="cursor-pointer">
                          {label}
                        </Label>
                        {uploaded && (
                          <span className="flex items-center gap-1 text-[15px] text-forest">
                            <CheckCircle2 className="w-3 h-3" />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="gap-2" asChild>
                        <label className="cursor-pointer">
                          <Upload className="w-3 h-3" />
                          Upload
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              uploadAll(event.target.files, label);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-line flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <label className="cursor-pointer">
                    <Plus className="w-4 h-4" />
                    Add Another Attachment
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        uploadAll(event.target.files, OTHER_LABEL);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </Button>
                <AddFromMyFiles actions={files} options={{ role: 'attachment', label: OTHER_LABEL }} />
              </div>
            </div>
          </div>

          {files.error && (
            <p role="alert" className="text-base text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {files.error}
            </p>
          )}

          {(attachments.length > 0 || files.isAdding) && (
            <div className="p-4 bg-forest-tint border border-[#C7DACD] rounded-lg">
              <h4 className="text-forest-dark mb-1">
                📎 Uploaded Files ({attachments.length}){files.isAdding ? ' · uploading…' : ''}
              </h4>
              <p className="text-[15px] text-ink-muted mb-3">
                Saved with this proposal. The assistant knows each file's name; tick the box to let it read the file
                too, for example a budget it should check your numbers against.
              </p>
              <ProposalFileList files={attachments} actions={files} emptyText="" />
            </div>
          )}

          <div className="p-4 bg-ochre-tint border-l-4 border-ochre rounded">
            <h4 className="text-ochre-text mb-2">Tips</h4>
            <ul className="text-base text-ink space-y-1 list-disc list-inside">
              <li>Ensure all documents are clearly labeled and up to date</li>
              <li>Letters of support should be on official letterhead</li>
              <li>Include only relevant attachments that strengthen your proposal</li>
              <li>Keep file sizes reasonable for easy upload and review</li>
              <li>Check funder requirements for specific document formats</li>
            </ul>
          </div>
        </div>
      </div>
  );
}
