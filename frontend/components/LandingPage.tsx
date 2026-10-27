import React, { useRef } from 'react';
import { FolderOpen, Library } from 'lucide-react';
import { AppMark } from './brand/AppMark';
import { MyProposals } from './proposals/MyProposals';
import type { SavedProposal } from '../lib/api';

interface LandingPageProps {
  onStartFromScratch: () => void;
  onUploadDraft: (file: File) => void;
  onOpenLibrary: () => void;
  onOpenMyFiles: () => void;
  onOpenProposal: (proposal: SavedProposal) => void;
}

const STEPS = [
  {
    title: 'Tell us about your project',
    text: 'Talk or type. The assistant asks one question at a time.',
  },
  {
    title: 'Add your plans',
    text: "Upload community plans or the funder's guidelines so advice fits your situation.",
  },
  {
    title: 'Review and export',
    text: 'Polish each section, then download it as a Word document.',
  },
];

export function LandingPage({ onStartFromScratch, onUploadDraft, onOpenLibrary, onOpenMyFiles, onOpenProposal }: LandingPageProps) {
  const draftInputRef = useRef<HTMLInputElement>(null);

  const handleDraftChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadDraft(file);
    e.target.value = '';
  };

  const navLink = 'inline-flex items-center gap-2 min-h-11 px-3.5 rounded-lg text-ink hover:bg-forest-tint transition-colors';

  return (
    <div className="min-h-screen bg-birch text-ink font-readable text-lg leading-relaxed">
      <header className="max-w-6xl mx-auto px-6 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AppMark />
          <span className="text-lg font-bold">Community Grant Assistant</span>
        </div>
        <nav aria-label="Main" className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenMyFiles} className={navLink}>
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            My files
          </button>
          <button type="button" onClick={onOpenLibrary} className={navLink}>
            <Library className="w-4 h-4" aria-hidden="true" />
            Document library
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 sm:px-8 pb-16 flex flex-col gap-14">
        <section className="pt-10 sm:pt-14 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-4">
            Build your funding proposal by talking it through
          </h1>
          <p className="text-xl text-ink-muted mb-8">
            Answer questions by voice or by typing. The assistant helps turn your answers into a clear, complete proposal.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStartFromScratch}
              className="min-h-[52px] px-6 rounded-xl bg-forest hover:bg-forest-dark text-white font-bold transition-colors"
            >
              Start a new proposal
            </button>
            <button
              type="button"
              onClick={() => draftInputRef.current?.click()}
              className="min-h-[52px] px-6 rounded-xl border-[1.5px] border-forest text-forest hover:bg-forest-tint font-bold transition-colors"
            >
              Improve a draft I have
            </button>
            <input
              ref={draftInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleDraftChosen}
            />
          </div>
          <p className="mt-5 text-base text-ink-muted">Your work saves as you go. Only you can see your files.</p>
        </section>

        <MyProposals onOpen={onOpenProposal} />

        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-bold mb-5">
            How it works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-white border border-line rounded-2xl p-6">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full bg-ochre-tint text-ochre-text font-bold flex items-center justify-center mb-3.5"
                >
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold mb-1.5">{step.title}</h3>
                <p className="text-base text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="pt-6 border-t border-line text-base text-ink-muted">
          Made for small Northern and Indigenous communities.
        </footer>
      </main>
    </div>
  );
}
