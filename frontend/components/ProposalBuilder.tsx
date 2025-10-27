import React, { useState } from 'react';
import { DocumentUploadSection } from './DocumentUploadSection';
import { CoverPageSection } from './CoverPageSection';
import { ExecutiveSummarySection } from './ExecutiveSummarySection';
import { CommunityContextSection } from './CommunityContextSection';
import { ProblemStatementSection } from './ProblemStatementSection';
import { ProjectDescriptionSection } from './ProjectDescriptionSection';
import { ImplementationSection } from './ImplementationSection';
import { BudgetSection } from './BudgetSection';
import { OutcomesSection } from './OutcomesSection';
import { AlignmentSection } from './AlignmentSection';
import { RiskManagementSection } from './RiskManagementSection';
import { AttachmentsSection } from './AttachmentsSection';
import { ProgressTracker } from './ProgressTracker';
import { AIChatPanel } from './AIChatPanel';
import { Button } from './ui/button';
import { Save, FileDown, ArrowLeft, Menu } from 'lucide-react';
import { useProposal } from './ProposalContext';
import { exportProposalDoc, submitProposal } from '../lib/api';

interface ProposalBuilderProps {
  onBack: () => void;
  existingDraft?: File | null;
}

export function ProposalBuilder({ onBack, existingDraft }: ProposalBuilderProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const totalSections = 12;
  const { data } = useProposal();

  const handleNext = () => {
    if (currentSection < totalSections - 1) {
      setCurrentSection(currentSection + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSectionClick = (section: number) => {
    setCurrentSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildPayload = () => {
    const objectives = [data.objective1, data.objective2, data.objective3].filter(
      (value): value is string => Boolean(value?.trim()),
    );

    const milestones = data.milestones
      .filter((milestone) => milestone.name || milestone.date)
      .map((milestone) =>
        [milestone.name, milestone.date].filter(Boolean).join(' — '),
      );

    const projectTitle = data.projectTitle.trim() || 'Untitled Project';
    const organizationName = data.organizationName.trim() || 'Unknown Organization';

    return {
      project_title: projectTitle,
      organization_name: organizationName,
      submission_date: data.submissionDate || undefined,
      executive_summary: data.executiveSummary || undefined,
      community_background: data.communityBackground || undefined,
      problem_description: data.problemDescription || undefined,
      objectives,
      milestones,
      requested_amount: data.requestedAmount || undefined,
      risks: data.risksMitigation || undefined,
    };
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setSubmitStatus(null);

    try {
      const payload = buildPayload();
      const attachments: File[] = [...data.communityDocuments, ...data.fundingDocuments];
      if (existingDraft) {
        attachments.push(existingDraft);
      }
      const blob = await exportProposalDoc(payload, attachments);
      const safeTitle = payload.project_title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'proposal';
      const filename = `${safeTitle}-draft-proposal.docx`;
      downloadBlob(blob, filename);
      setSubmitStatus('Proposal exported successfully.');
    } catch (error) {
      setSubmitStatus(
        error instanceof Error
          ? `Unable to export proposal: ${error.message}`
          : 'Unable to export proposal. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const payload = buildPayload();
      const response = await submitProposal(payload);
      setSubmitStatus(`Draft saved as ${response.proposal_id}`);
    } catch (error) {
      setSubmitStatus(
        error instanceof Error
          ? `Unable to save draft: ${error.message}`
          : 'Unable to save draft. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      {/* Header */}
      <div className="bg-emerald-800 text-white py-6 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="gap-2 text-white hover:bg-emerald-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </Button>
            <div>
              <h1 className="text-xl">Grant Proposal Builder</h1>
              <p className="text-emerald-100 text-sm">
                {existingDraft ? `Improving: ${existingDraft.name}` : 'Creating new proposal'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="gap-2 text-white hover:bg-emerald-700 md:hidden"
          >
            <Menu className="w-5 h-5" />
            AI Assistant
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex max-w-7xl mx-auto">
        {/* Left: Form Content */}
        <div className={`flex-1 transition-all ${isChatOpen ? 'md:w-[60%]' : 'w-full'}`}>
          {/* Progress Tracker */}
          <div className="sticky top-0 z-10 bg-white shadow-md">
            <div className="px-4 py-4">
              <ProgressTracker
                currentSection={currentSection}
                totalSections={totalSections}
                onSectionClick={handleSectionClick}
              />
            </div>
          </div>

          {/* Section Content */}
          <div className="px-4 py-8">
            <div className="space-y-8">
              {currentSection === 0 && <DocumentUploadSection />}
              {currentSection === 1 && <CoverPageSection />}
              {currentSection === 2 && <ExecutiveSummarySection />}
              {currentSection === 3 && <CommunityContextSection />}
              {currentSection === 4 && <ProblemStatementSection />}
              {currentSection === 5 && <ProjectDescriptionSection />}
              {currentSection === 6 && <ImplementationSection />}
              {currentSection === 7 && <BudgetSection />}
              {currentSection === 8 && <OutcomesSection />}
              {currentSection === 9 && <AlignmentSection />}
              {currentSection === 10 && <RiskManagementSection />}
              {currentSection === 11 && <AttachmentsSection />}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-12 pt-8 border-t-2 border-stone-200">
              <Button
                onClick={handlePrevious}
                disabled={currentSection === 0}
                variant="outline"
                size="lg"
                className="border-emerald-700 text-emerald-700 hover:bg-emerald-50"
              >
                ← Previous
              </Button>
              
              <div className="text-stone-600 text-sm">
                Section {currentSection + 1} of {totalSections}
              </div>

              <Button
                onClick={handleNext}
                disabled={currentSection === totalSections - 1}
                size="lg"
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                Next →
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center mt-8 pb-12">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-sky-600 text-sky-700 hover:bg-sky-50"
                onClick={handleSubmit}
                disabled={isSubmitting || isExporting}
              >
                <Save className="w-5 h-5" />
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                size="lg"
                className="gap-2 bg-sky-700 hover:bg-sky-800"
                onClick={handleExport}
                disabled={isSubmitting || isExporting}
              >
                <FileDown className="w-5 h-5" />
                {isExporting ? 'Preparing...' : 'Export Proposal'}
              </Button>
            </div>
            {submitStatus && (
              <div className="text-center text-sm text-stone-600">
                {submitStatus}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Chat Panel */}
        {isChatOpen && (
          <div className="hidden md:block w-[40%] border-l border-stone-200 bg-white sticky top-0 h-screen overflow-hidden">
            <AIChatPanel 
              currentSection={currentSection} 
              onClose={() => setIsChatOpen(false)}
              hasExistingDraft={!!existingDraft}
            />
          </div>
        )}
      </div>

      {/* Mobile Chat Overlay */}
      {isChatOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-50 overflow-hidden">
          <AIChatPanel 
            currentSection={currentSection} 
            onClose={() => setIsChatOpen(false)}
            hasExistingDraft={!!existingDraft}
          />
        </div>
      )}
    </div>
  );
}
