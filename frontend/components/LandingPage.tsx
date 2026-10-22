import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Upload, FileText, MessageSquare, CheckCircle, Sparkles, ArrowRight, Library } from 'lucide-react';
import { motion } from 'motion/react';
import { MyProposals } from './proposals/MyProposals';
import type { SavedProposal } from '../lib/api';

interface LandingPageProps {
  onStartFromScratch: () => void;
  onUploadDraft: (file: File) => void;
  onOpenLibrary: () => void;
  onOpenProposal: (proposal: SavedProposal) => void;
}

export function LandingPage({ onStartFromScratch, onUploadDraft, onOpenLibrary, onOpenProposal }: LandingPageProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadDraft(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadDraft(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-stone-50">
      <div className="max-w-6xl mx-auto px-6 pt-4 flex justify-end">
        <Button variant="ghost" onClick={onOpenLibrary} className="gap-2 text-stone-600 hover:text-stone-900">
          <Library className="w-4 h-4" />
          Document library
        </Button>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-stone-900 mb-4">
              Community Grant Assistant
            </h1>
            <p className="text-stone-600 max-w-2xl mx-auto">
              AI-powered grant proposal builder for communities.
              Get expert guidance through voice conversations and intelligent document analysis.
            </p>
          </motion.div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm mb-12">
            <Sparkles className="w-4 h-4" />
            <span>Powered by RAG, GPT-4o & ElevenLabs Voice AI</span>
          </div>
        </div>

        <MyProposals onOpen={onOpenProposal} />

        {/* Two Main Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Option 1: Upload Existing Draft */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border-2 border-stone-200 hover:border-emerald-400 hover:shadow-xl transition-all h-full">
              <CardContent className="p-8">
                <div className="w-14 h-14 mb-6 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-amber-600" />
                </div>
                
                <h2 className="text-stone-900 mb-3">Improve Existing Draft</h2>
                <p className="text-stone-600 mb-6">
                  Upload your current proposal for AI analysis. Get a competitiveness score and personalized suggestions to strengthen your application.
                </p>

                {/* Upload Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/30'
                  }`}
                >
                  <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                  <p className="text-sm text-stone-700 mb-2">
                    Drag & drop your proposal here
                  </p>
                  <p className="text-xs text-stone-500 mb-4">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileInput}
                  />
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    variant="outline"
                    className="gap-2 border-2"
                  >
                    <FileText className="w-4 h-4" />
                    Choose File
                  </Button>
                </div>

                <div className="mt-6 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Instant competitiveness score</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Section-by-section feedback</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>AI-powered improvements</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Option 2: Start from Scratch */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:shadow-xl transition-all h-full">
              <CardContent className="p-8">
                <div className="w-14 h-14 mb-6 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-emerald-600" />
                </div>
                
                <h2 className="text-stone-900 mb-3">Start New Proposal</h2>
                <p className="text-stone-600 mb-6">
                  Create a professional grant proposal from scratch. Our AI assistant will guide you through each section with voice and text support.
                </p>

                <Button
                  onClick={onStartFromScratch}
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2 py-6 text-base"
                >
                  <MessageSquare className="w-5 h-5" />
                  Start with AI Assistant
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <div className="mt-8 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Voice-guided conversations</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>11-section structured workflow</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>RAG-based smart suggestions</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-900">
                    💡 <strong>Tip:</strong> You can upload community plans and funding guidelines during the process to get tailored recommendations.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <Card className="border border-stone-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-sky-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-stone-900 mb-2">RAG Technology</h3>
              <p className="text-sm text-stone-600">
                Upload your community documents for context-aware proposal generation
              </p>
            </CardContent>
          </Card>

          <Card className="border border-stone-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-purple-100 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-stone-900 mb-2">Voice & Text</h3>
              <p className="text-sm text-stone-600">
                Speak naturally or type - powered by ElevenLabs voice AI
              </p>
            </CardContent>
          </Card>

          <Card className="border border-stone-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-stone-900 mb-2">GPT-4o Powered</h3>
              <p className="text-sm text-stone-600">
                Advanced AI understands Indigenous and Northern community context
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Note */}
        <div className="mt-16 text-center">
          <p className="text-sm text-stone-500">
            Designed specifically for small Northern and Indigenous communities.
            <br />
            Works offline/low-bandwidth with saved progress.
          </p>
        </div>
      </div>
    </div>
  );
}
