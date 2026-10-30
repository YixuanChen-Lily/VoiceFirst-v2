import { useState } from 'react';
import type { NextPage } from 'next';
import { DraftAnalysisPage } from '../components/DraftAnalysisPage';
import type { DraftFillResult } from '../lib/proposalSteps';
import { LandingPage } from '../components/LandingPage';
import { MyFilesPage } from '../components/files/MyFilesPage';
import { LibraryPage } from '../components/library/LibraryPage';
import { ProposalBuilder } from '../components/ProposalBuilder';
import { useProposal } from '../context/ProposalContext';

type WorkflowStep = 'landing' | 'draft-analysis' | 'builder' | 'library' | 'my-files';

const HomePage: NextPage = () => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('landing');
  const [uploadedDraft, setUploadedDraft] = useState<File | null>(null);
  const [draftFill, setDraftFill] = useState<DraftFillResult | null>(null);
  const { startNewProposal, openProposal } = useProposal();

  return (
    <div className="min-h-screen">
      {currentStep === 'landing' && (
        <LandingPage
          onStartFromScratch={async () => {
            await startNewProposal();
            setUploadedDraft(null);
            setDraftFill(null);
            setCurrentStep('builder');
          }}
          onOpenLibrary={() => setCurrentStep('library')}
          onOpenMyFiles={() => setCurrentStep('my-files')}
          onOpenProposal={async (proposal) => {
            await openProposal(proposal);
            setUploadedDraft(null);
            setDraftFill(null);
            setCurrentStep('builder');
          }}
          onUploadDraft={async (file) => {
            await startNewProposal();
            setUploadedDraft(file);
            setCurrentStep('draft-analysis');
          }}
        />
      )}

      {currentStep === 'draft-analysis' && uploadedDraft && (
        <DraftAnalysisPage
          draftFile={uploadedDraft}
          onContinue={(fill) => {
            setDraftFill(fill);
            setCurrentStep('builder');
          }}
          onBack={() => setCurrentStep('landing')}
        />
      )}

      {currentStep === 'library' && <LibraryPage onBack={() => setCurrentStep('landing')} />}

      {currentStep === 'my-files' && <MyFilesPage onBack={() => setCurrentStep('landing')} />}

      {currentStep === 'builder' && (
        <ProposalBuilder
          onBack={() => setCurrentStep('landing')}
          existingDraft={uploadedDraft}
          draftFill={draftFill}
          onDismissDraftFill={() => setDraftFill(null)}
        />
      )}
    </div>
  );
};

export default HomePage;
