import React, { useRef, useState } from 'react';
import { DocumentUploadSection } from './sections/DocumentUploadSection';
import { CoverPageSection } from './sections/CoverPageSection';
import { ExecutiveSummarySection } from './sections/ExecutiveSummarySection';
import { CommunityContextSection } from './sections/CommunityContextSection';
import { ProblemStatementSection } from './sections/ProblemStatementSection';
import { ProjectDescriptionSection } from './sections/ProjectDescriptionSection';
import { ImplementationSection } from './sections/ImplementationSection';
import { BudgetSection } from './sections/BudgetSection';
import { OutcomesSection } from './sections/OutcomesSection';
import { AlignmentSection } from './sections/AlignmentSection';
import { RiskManagementSection } from './sections/RiskManagementSection';
import { AttachmentsSection } from './sections/AttachmentsSection';
import { ProgressTracker } from './ProgressTracker';
import { AIChatPanel } from './chat/AIChatPanel';
import { AppMark } from './brand/AppMark';
import { DownloadMenu } from './proposals/DownloadMenu';
import { DraftFillNotice } from './proposals/DraftFillNotice';
import { ArrowLeft, MessageCircle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useProposal } from '../context/ProposalContext';
import { exportProposalDoc } from '../lib/api';
import { STEP_NAMES, type DraftFillResult } from '../lib/proposalSteps';

interface ProposalBuilderProps {
  onBack: () => void;
  existingDraft?: File | null;
  /** What filling in from an uploaded draft did; shown above the form until dismissed. */
  draftFill?: DraftFillResult | null;
  onDismissDraftFill?: () => void;
}

export function ProposalBuilder({ onBack, existingDraft, draftFill, onDismissDraftFill }: ProposalBuilderProps) {
  const [currentSection, setCurrentSection] = useState(0);
  // On small screens the assistant covers the form, so it starts closed there and opens from the
  // Assistant button. On wider screens it always sits beside the form.
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const totalSections = STEP_NAMES.length;
  const mainRef = useRef<HTMLElement>(null);
  const { data, proposalId, saveStatus, lastSavedAt, saveError, hasUnsavedChanges, saveNow } = useProposal();
  const isSaving = saveStatus === 'saving';

  const goToSection = (section: number) => {
    setCurrentSection(section);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const handleNext = () => {
    if (currentSection < totalSections - 1) goToSection(currentSection + 1);
  };

  const handlePrevious = () => {
    if (currentSection > 0) goToSection(currentSection - 1);
  };

  const handleSectionClick = goToSection;

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

  const handleExport = async (includeFiles: boolean) => {
    setIsExporting(true);
    setSubmitStatus(null);

    try {
      const blob = await exportProposalDoc(data, proposalId, includeFiles);
      const safeTitle = data.projectTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'proposal';
      const filename = `${safeTitle}-draft-proposal.${includeFiles ? 'zip' : 'docx'}`;
      downloadBlob(blob, filename);
      setSubmitStatus(
        includeFiles
          ? 'Your Word document and attachments are downloading as a .zip file.'
          : 'Your Word document is downloading.',
      );
    } catch (error) {
      setSubmitStatus(
        error instanceof Error
          ? `Couldn't make the Word document: ${error.message}`
          : "Couldn't make the Word document. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const saveLabel = (() => {
    if (saveStatus === 'saving') return 'Saving…';
    if (saveStatus === 'error') return saveError ? `Couldn't save: ${saveError}` : "Couldn't save";
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (lastSavedAt) {
      return `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Not saved yet';
  })();

  const SaveIcon = saveStatus === 'saving' ? Loader2 : saveStatus === 'error' ? AlertCircle : CheckCircle2;

  const prevName = currentSection > 0 ? STEP_NAMES[currentSection - 1] : null;
  const nextName = currentSection < totalSections - 1 ? STEP_NAMES[currentSection + 1] : null;
  const canSaveNow = saveStatus === 'error' || hasUnsavedChanges;

  return (
    <div className="h-screen flex flex-col bg-birch text-ink font-readable text-[17px] leading-relaxed">
      <header className="bg-white border-b border-line px-4 sm:px-7 py-3.5 flex items-center gap-4 sm:gap-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2.5 shrink-0 rounded-lg"
          aria-label="Back to home"
        >
          <AppMark size={38} />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-base text-ink-muted">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Home
          </span>
        </button>
        <div className="flex-1 min-w-0 pl-4 sm:pl-5 border-l border-line">
          <p className="font-bold text-lg truncate">
            {existingDraft ? `Improving: ${existingDraft.name}` : data.projectTitle.trim() || 'New proposal'}
          </p>
          <p
            role="status"
            className={`flex items-center gap-1.5 text-[15px] ${saveStatus === 'error' ? 'text-ochre-text' : 'text-ink-muted'}`}
          >
            <SaveIcon
              aria-hidden="true"
              className={`w-4 h-4 shrink-0 ${saveStatus === 'saving' ? 'animate-spin' : ''} ${
                saveStatus === 'error' ? 'text-ochre' : 'text-forest'
              }`}
            />
            <span className="truncate">{saveLabel}</span>
            {canSaveNow && !isSaving && (
              <button
                type="button"
                onClick={saveNow}
                className="shrink-0 font-bold text-forest underline underline-offset-2 hover:text-forest-dark"
              >
                Save now
              </button>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileChatOpen(true)}
          aria-expanded={isMobileChatOpen}
          className="md:hidden inline-flex items-center gap-2 min-h-11 px-3 rounded-lg text-forest-dark bg-forest-tint font-bold"
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          Assistant
        </button>
        <DownloadMenu
          className="hidden sm:block"
          proposalId={proposalId}
          isExporting={isExporting}
          disabled={isSaving}
          onDownload={handleExport}
        />
      </header>

      {submitStatus && (
        <p role="status" className="px-4 sm:px-7 py-2 bg-forest-tint text-forest-dark text-base border-b border-line">
          {submitStatus}
        </p>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-4 sm:px-8 py-4 border-b border-line bg-birch">
            <ProgressTracker currentSection={currentSection} onSectionClick={handleSectionClick} />
          </div>

          <main ref={mainRef} className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-9">
            <div className="max-w-[680px] mx-auto">
              {draftFill && (
                <DraftFillNotice
                  result={draftFill}
                  currentSection={currentSection}
                  onGoToStep={goToSection}
                  onDismiss={() => onDismissDraftFill?.()}
                />
              )}
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

              <div className="flex flex-wrap justify-between items-center gap-3 mt-10 pt-6 border-t border-line">
                {prevName ? (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="min-h-12 px-5 rounded-[10px] border-[1.5px] border-line bg-white hover:border-forest font-bold transition-colors"
                  >
                    Back: {prevName}
                  </button>
                ) : (
                  <span />
                )}
                {nextName ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="min-h-12 px-5 rounded-[10px] bg-forest hover:bg-forest-dark text-white font-bold transition-colors"
                  >
                    Next: {nextName}
                  </button>
                ) : (
                  <DownloadMenu
                    openUpward
                    proposalId={proposalId}
                    isExporting={isExporting}
                    disabled={isSaving}
                    onDownload={handleExport}
                  />
                )}
              </div>
            </div>
          </main>
        </div>

        {/* One assistant for every screen size, so the conversation is kept when it is closed on a phone. */}
        <aside
          aria-label="Assistant"
          className={`${
            isMobileChatOpen ? 'fixed inset-0 z-50 flex' : 'hidden'
          } md:static md:z-auto md:flex w-full md:w-[400px] lg:w-[440px] shrink-0 md:border-l border-line bg-white`}
        >
          <AIChatPanel
            currentSection={currentSection}
            onClose={() => setIsMobileChatOpen(false)}
            hasExistingDraft={!!existingDraft}
          />
        </aside>
      </div>

    </div>
  );
}
