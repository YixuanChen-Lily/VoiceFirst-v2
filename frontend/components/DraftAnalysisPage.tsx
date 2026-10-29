import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { CheckCircle, AlertTriangle, AlertCircle, ArrowRight } from 'lucide-react';
import { SubPage } from './layout/SubPage';
import { analyzeDraft, DraftAnalysis as DraftAnalysisPayload } from '../lib/api';

interface DraftAnalysisPageProps {
  draftFile: File;
  onContinue: () => void;
  onBack: () => void;
}

interface AnalysisResult {
  overallScore: number;
  sections: {
    name: string;
    score: number;
    status: 'excellent' | 'good' | 'needs-improvement' | 'missing';
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  /** Notes about how the analysis was done, shown above the score. */
  notices: string[];
}

export function DraftAnalysisPage({ draftFile, onContinue, onBack }: DraftAnalysisPageProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const analyzeDocument = async () => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const payload = await analyzeDraft(draftFile);
        if (!isMounted) return;

        const transformed = transformAnalysis(payload.sections);
        const notices: string[] = [];
        if (payload.truncated) {
          const share = Math.round((payload.characters_analysed / payload.characters_total) * 100);
          notices.push(
            `This document is very long, so only the first ${share}% of it was checked. Parts after that point were not scored.`,
          );
        }
        if (payload.method === 'keywords') {
          notices.push(
            'The full check was unavailable, so these scores come from a simple keyword check and are only a rough guide. Try again later for a full check.',
          );
        }
        setAnalysis({ ...transformed, notices });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        if (isMounted) {
          setIsAnalyzing(false);
        }
      }
    };

    analyzeDocument();

    return () => {
      isMounted = false;
    };
  }, [draftFile]);

  const transformAnalysis = (payload: DraftAnalysisPayload[]): AnalysisResult => {
    if (payload.length === 0) {
      return {
        overallScore: 60,
        sections: [],
        strengths: [],
        improvements: [],
        notices: [],
      };
    }

    const sections = payload.map((item) => {
      const rawScore = typeof item.score === 'number' ? item.score : 65;
      const score = Math.min(100, Math.max(0, Math.round(rawScore)));
      let status: AnalysisResult['sections'][number]['status'] = 'good';

      if (score >= 85) status = 'excellent';
      else if (score >= 65) status = 'good';
      else if (score >= 50) status = 'needs-improvement';
      else status = 'missing';

      return {
        name: formatSectionName(item.section),
        score,
        status,
        feedback: item.summary,
      };
    });

    const averageScore =
      sections.reduce((sum, section) => sum + section.score, 0) / sections.length;

    const strengths = sections
      .filter((section) => section.score >= 80 && section.feedback.trim().length > 0)
      .map((section) => `${section.name}: ${section.feedback}`);

    const improvements = payload
      .flatMap((item) => item.recommendations ?? [])
      .filter((tip) => typeof tip === 'string' && tip.trim().length > 0)
      .map((tip) => tip.trim());

    return {
      overallScore: Math.round(averageScore),
      sections,
      strengths,
      improvements,
      notices: [],
    };
  };

  const formatSectionName = (raw: string) => {
    return raw
      .replace(/[_-]+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Forest for strong, ochre for in-between, clay for weak or missing.
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-forest';
    if (score >= 60) return 'text-ochre-text';
    return 'text-[#A4462E]';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs work';
    return 'Weak';
  };

  const getScoreSummary = (score: number) => {
    if (score >= 80) return 'Your draft is in good shape. A few changes could make it even stronger.';
    if (score >= 60) return 'Your draft has a solid base. The suggestions below show where to focus.';
    return 'Your draft needs more work in several places. The assistant can help you fill the gaps, one part at a time.';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="w-5 h-5 text-forest" aria-hidden="true" />;
      case 'needs-improvement':
        return <AlertTriangle className="w-5 h-5 text-ochre" aria-hidden="true" />;
      case 'missing':
        return <AlertCircle className="w-5 h-5 text-[#A4462E]" aria-hidden="true" />;
    }
  };

  if (isAnalyzing || error) {
    return (
      <div className="min-h-screen bg-birch text-ink font-readable flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-line rounded-2xl p-8 sm:p-10 text-center">
          {isAnalyzing ? (
            <>
              <div className="w-14 h-14 mx-auto mb-6 rounded-full border-4 border-forest-tint border-t-forest animate-spin" aria-hidden="true" />
              <h1 className="text-2xl font-bold mb-2">Reading your draft</h1>
              <p role="status" className="text-lg text-ink-muted mb-1">
                Checking each part of {draftFile.name} and noting what could be stronger.
              </p>
              <p className="text-base text-ink-muted">This usually takes under a minute.</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-10 h-10 text-[#A4462E] mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-2xl font-bold mb-2">We couldn&apos;t read your draft</h1>
              <p role="alert" className="text-lg text-ink-muted mb-6">
                {error}
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => window.location.reload()} size="lg">
                  Try again
                </Button>
                <Button onClick={onBack} variant="outline" size="lg">
                  Back to home
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const listCard = (title: string, icon: React.ReactNode, items: string[], empty: string) => (
    <section className="bg-white border border-line rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
        {icon}
        {title}
      </h2>
      {items.length > 0 ? (
        <ul className="space-y-3 list-disc pl-5 marker:text-ink-muted">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">{empty}</p>
      )}
    </section>
  );

  return (
    <SubPage title="Your draft, checked" description={draftFile.name} onBack={onBack}>
      <div className="flex flex-col gap-6 text-[17px] leading-relaxed">
        {analysis.notices.map((notice) => (
          <p
            key={notice}
            role="status"
            className="flex items-start gap-2.5 rounded-xl border-l-4 border-ochre bg-ochre-tint px-4 py-3 text-ochre-text"
          >
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </p>
        ))}

        <section className="bg-white border border-line rounded-2xl p-6 sm:p-8">
          <p className="text-base text-ink-muted mb-1">Overall score</p>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className={`text-5xl font-bold ${getScoreColor(analysis.overallScore)}`}>{analysis.overallScore}</span>
            <span className="text-xl text-ink-muted">out of 100</span>
            <span className={`text-xl font-bold ${getScoreColor(analysis.overallScore)}`}>
              · {getScoreLabel(analysis.overallScore)}
            </span>
          </p>
          <div className="h-2.5 rounded bg-line overflow-hidden mt-5" aria-hidden="true">
            <div className="h-full bg-forest" style={{ width: `${analysis.overallScore}%` }} />
          </div>
          <p className="text-lg mt-5">{getScoreSummary(analysis.overallScore)}</p>
        </section>

        {analysis.sections.length > 0 && (
          <section className="bg-white border border-line rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-4">Each part of your draft</h2>
            <ul className="divide-y divide-line">
              {analysis.sections.map((section) => (
                <li key={section.name} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <span className="mt-0.5 shrink-0">{getStatusIcon(section.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{section.name}</p>
                    {section.feedback && <p className="text-base text-ink-muted mt-0.5">{section.feedback}</p>}
                  </div>
                  <span className={`shrink-0 font-bold ${getScoreColor(section.score)}`}>
                    {section.score > 0 ? `${section.score}%` : 'Missing'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {listCard(
            'What works well',
            <CheckCircle className="w-5 h-5 text-forest" aria-hidden="true" />,
            analysis.strengths,
            'No part stood out as strong yet.',
          )}
          {listCard(
            'What to improve first',
            <AlertTriangle className="w-5 h-5 text-ochre" aria-hidden="true" />,
            analysis.improvements.slice(0, 4),
            'No specific suggestions this time.',
          )}
        </div>

        <section className="bg-forest-tint border border-[#C7DACD] rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-2xl font-bold text-forest-dark mb-2">Ready to improve it?</h2>
          <p className="text-lg text-forest-dark mb-6 max-w-2xl mx-auto">
            The assistant will go through your proposal with you, one part at a time, starting with what needs the most work.
          </p>
          <Button onClick={onContinue} size="lg" className="gap-2 px-7 text-lg">
            Continue with the assistant
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Button>
        </section>
      </div>
    </SubPage>
  );
}
