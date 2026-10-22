import { useState } from 'react';
import type { NextPage } from 'next';
import { DraftAnalysisPage } from '../components/DraftAnalysisPage';
import { LandingPage } from '../components/LandingPage';
import { LibraryPage } from '../components/library/LibraryPage';
import { ProposalBuilder } from '../components/ProposalBuilder';
import { useProposal } from '../context/ProposalContext';

type WorkflowStep = 'landing' | 'draft-analysis' | 'builder' | 'library';

const HomePage: NextPage = () => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('landing');
  const [uploadedDraft, setUploadedDraft] = useState<File | null>(null);
  const { startNewProposal, openProposal } = useProposal();

  return (
    <div className="min-h-screen">
      {currentStep === 'landing' && (
        <LandingPage
          onStartFromScratch={async () => {
            await startNewProposal();
            setUploadedDraft(null);
            setCurrentStep('builder');
          }}
          onOpenLibrary={() => setCurrentStep('library')}
          onOpenProposal={async (proposal) => {
            await openProposal(proposal);
            setUploadedDraft(null);
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
          onContinue={() => setCurrentStep('builder')}
          onBack={() => setCurrentStep('landing')}
        />
      )}

      {currentStep === 'library' && <LibraryPage onBack={() => setCurrentStep('landing')} />}

      {currentStep === 'builder' && (
        <ProposalBuilder
          onBack={() => setCurrentStep('landing')}
          existingDraft={uploadedDraft}
        />
      )}
    </div>
  );
};

export default HomePage;
