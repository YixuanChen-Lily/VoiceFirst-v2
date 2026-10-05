import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Paperclip, Upload, Plus, X } from 'lucide-react';

interface Attachment {
  name: string;
  file?: File;
}

export function AttachmentsSection() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [checklist, setChecklist] = useState({
    strategicPlan: false,
    lettersOfSupport: false,
    staffResumes: false,
    budgetSpreadsheet: false,
    facilityPlans: false,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, label: string) => {
    if (e.target.files && e.target.files[0]) {
      setAttachments([...attachments, { name: label, file: e.target.files[0] }]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleChecklistChange = (key: keyof typeof checklist) => {
    setChecklist({ ...checklist, [key]: !checklist[key] });
  };

  return (
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={11}
          title="Attachments / Supporting Documents"
          icon={Paperclip}
          description="Upload supporting documents to strengthen your proposal"
        />

        <div className="space-y-6">
          <div className="p-6 bg-stone-50 border-2 border-dashed border-stone-300 rounded-lg">
            <div className="text-center mb-4">
              <Upload className="w-12 h-12 mx-auto mb-3 text-stone-400" />
              <h3 className="text-stone-700 mb-2">Drag & Drop Files Here</h3>
              <p className="text-sm text-stone-500 mb-4">or click below to browse</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm text-stone-600 mb-3">📋 Recommended Documents Checklist:</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded border border-stone-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="strategic-plan"
                      checked={checklist.strategicPlan}
                      onCheckedChange={() => handleChecklistChange('strategicPlan')}
                    />
                    <Label htmlFor="strategic-plan" className="cursor-pointer">
                      Community Strategic Plan
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileUpload(e, 'Community Strategic Plan')}
                      />
                    </label>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border border-stone-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="letters-support"
                      checked={checklist.lettersOfSupport}
                      onCheckedChange={() => handleChecklistChange('lettersOfSupport')}
                    />
                    <Label htmlFor="letters-support" className="cursor-pointer">
                      Letters of Support
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileUpload(e, 'Letters of Support')}
                      />
                    </label>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border border-stone-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="staff-resumes"
                      checked={checklist.staffResumes}
                      onCheckedChange={() => handleChecklistChange('staffResumes')}
                    />
                    <Label htmlFor="staff-resumes" className="cursor-pointer">
                      Staff Resumes / Bios
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileUpload(e, 'Staff Resumes')}
                      />
                    </label>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border border-stone-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="budget-spreadsheet"
                      checked={checklist.budgetSpreadsheet}
                      onCheckedChange={() => handleChecklistChange('budgetSpreadsheet')}
                    />
                    <Label htmlFor="budget-spreadsheet" className="cursor-pointer">
                      Detailed Budget Spreadsheet
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => handleFileUpload(e, 'Budget Spreadsheet')}
                      />
                    </label>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded border border-stone-200">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="facility-plans"
                      checked={checklist.facilityPlans}
                      onCheckedChange={() => handleChecklistChange('facilityPlans')}
                    />
                    <Label htmlFor="facility-plans" className="cursor-pointer">
                      Facility Plans / Designs
                    </Label>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg"
                        onChange={(e) => handleFileUpload(e, 'Facility Plans')}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200">
                <Button variant="outline" className="w-full gap-2" asChild>
                  <label className="cursor-pointer">
                    <Plus className="w-4 h-4" />
                    Add Another Attachment
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'Additional Document')}
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
              <h4 className="text-emerald-900 mb-3">📎 Uploaded Files ({attachments.length})</h4>
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-white rounded border border-emerald-200"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="text-sm">{attachment.name}</p>
                        {attachment.file && (
                          <p className="text-xs text-stone-500">{attachment.file.name}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <h4 className="text-amber-900 mb-2">💡 Tips for Strong Supporting Documents</h4>
            <ul className="text-sm text-stone-700 space-y-1 list-disc list-inside">
              <li>Ensure all documents are clearly labeled and up to date</li>
              <li>Letters of support should be on official letterhead</li>
              <li>Include only relevant attachments that strengthen your proposal</li>
              <li>Keep file sizes reasonable for easy upload and review</li>
              <li>Check funder requirements for specific document formats</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
