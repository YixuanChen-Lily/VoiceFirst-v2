import React from 'react';
import { ArrowLeft } from 'lucide-react';

import { AppMark } from '../brand/AppMark';

interface SubPageProps {
  title: string;
  description: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
}

/** The frame shared by the pages reached from home: the app's header, a way back, a title. */
export function SubPage({ title, description, onBack, children }: SubPageProps) {
  return (
    <div className="min-h-screen bg-birch text-ink font-readable">
      <header className="max-w-5xl mx-auto px-6 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-3 rounded-lg"
          aria-label="Community Grant Assistant, back to home"
        >
          <AppMark />
          <span className="text-lg font-bold">Community Grant Assistant</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-11 px-3.5 rounded-lg text-ink hover:bg-forest-tint transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to home
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-8 pt-6 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{title}</h1>
        <p className="text-lg text-ink-muted mb-8 max-w-3xl">{description}</p>
        {children}
      </main>
    </div>
  );
}
