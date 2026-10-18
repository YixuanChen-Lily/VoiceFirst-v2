import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  TrendingUp,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
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
            `This document is very long, so only the first ${share}% of it was analysed. Sections after that point were not scored.`,
          );
        }
        if (payload.method === 'keywords') {
          notices.push(
            'AI analysis was unavailable, so these scores come from a simple keyword check and are only a rough guide. Try again later for a full analysis.',
          );
        }
        setAnalysis({ ...transformed, notices });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to analyze draft. Please try again.');
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Strong';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Weak';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'good':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'needs-improvement':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'missing':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <Card className="max-w-md mx-auto border-2 border-emerald-200">
          <CardContent className="p-12 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            <h2 className="text-stone-900 mb-4">Analyzing Your Proposal</h2>
            <p className="text-stone-600 mb-6">
              Our AI is reviewing your document using RAG technology and GPT-4o...
            </p>
            <div className="space-y-3 text-left text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Extracting document content</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Analyzing section completeness</span>
              </div>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </motion.div>
                <span>Generating improvement suggestions...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
        <Card className="max-w-md mx-auto border-2 border-red-200">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
            <h2 className="text-stone-900">Analysis Failed</h2>
            <p className="text-stone-600 text-sm">
              {error}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-stone-600 hover:text-stone-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-emerald-600" />
            <div>
              <h1 className="text-stone-900">Draft Analysis Complete</h1>
              <p className="text-sm text-stone-600">{draftFile.name}</p>
            </div>
          </div>
        </div>

        {analysis.notices.map((notice) => (
          <div
            key={notice}
            role="status"
            className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        ))}

        {/* Overall Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50 mb-8">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-2">Competitiveness Score</p>
                  <h2 className={`${getScoreColor(analysis.overallScore)} mb-1`}>
                    {analysis.overallScore}/100
                  </h2>
                  <Badge variant="outline" className={`${getScoreColor(analysis.overallScore)}`}>
                    {getScoreLabel(analysis.overallScore)}
                  </Badge>
                </div>
                <div className="text-right">
                  <TrendingUp className={`w-16 h-16 ${getScoreColor(analysis.overallScore)}`} />
                </div>
              </div>
              <Progress value={analysis.overallScore} className="h-3 mt-6" />
              <p className="text-sm text-stone-600 mt-4">
                Your proposal shows promise. With targeted improvements, you could increase your competitiveness significantly.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section Breakdown */}
        <Card className="border-2 border-stone-200 mb-8">
          <CardContent className="p-8">
            <h3 className="text-stone-900 mb-6">Section-by-Section Analysis</h3>
            <div className="space-y-4">
              {analysis.sections.map((section, index) => (
                <motion.div
                  key={section.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="p-4 bg-stone-50 rounded-lg border border-stone-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(section.status)}
                      <div>
                        <p className="text-sm text-stone-900">{section.name}</p>
                        <p className="text-xs text-stone-500 mt-1">{section.feedback}</p>
                      </div>
                    </div>
                    <span className={`text-sm ${getScoreColor(section.score)}`}>
                      {section.score > 0 ? `${section.score}%` : 'Missing'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-stone-900">Strengths</h3>
              </div>
              <ul className="space-y-2">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-stone-700 flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-stone-900">Key Improvements</h3>
              </div>
              <ul className="space-y-2">
                {analysis.improvements.slice(0, 4).map((improvement, index) => (
                  <li key={index} className="text-sm text-stone-700 flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Action Button */}
        <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100">
          <CardContent className="p-8 text-center">
            <h3 className="text-stone-900 mb-3">Ready to Improve Your Proposal?</h3>
            <p className="text-stone-700 mb-6 max-w-2xl mx-auto">
              Continue with our AI assistant to strengthen weak sections, add missing content, and enhance your overall competitiveness.
            </p>
            <Button
              onClick={onContinue}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8"
            >
              Continue with AI Assistant
              <ArrowRight className="w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
