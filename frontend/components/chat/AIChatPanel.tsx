import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Mic, 
  Upload, 
  Send, 
  Bot, 
  X, 
  Volume2, 
  FileText,
  Sparkles,
  Loader
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProposal } from '../../context/ProposalContext';
import type { ProposalData } from '../../context/ProposalContext';
import { chatWithAssistant, transcribeAudio, type ChatSource, type ConversationMessage } from '../../lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface AIChatPanelProps {
  currentSection: number;
  onClose: () => void;
  hasExistingDraft: boolean;
}

type MessageType = 'ai' | 'user' | 'system' | 'action';

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  audioSrc?: string;
  sources?: ChatSource[];
  pendingUpdates?: {
    updates: Record<string, string>;
    labels: string[];
    section: number;
  };
}

const sectionNames = [
  'Cover Page',
  'Executive Summary',
  'Community Context',
  'Problem Statement',
  'Project Description',
  'Implementation Plan',
  'Budget Overview',
  'Expected Outcomes',
  'Alignment with Priorities',
  'Risk Management',
  'Attachments'
];

const BASE_SYSTEM_PROMPT = `You are an Indigenous grant-writing copilot helping users craft high-quality proposals.
Provide empathetic, concise, and actionable feedback.
Always ground advice in the current section of the proposal workflow and encourage culturally safe practices.`;

type ProposalFieldKey = keyof ProposalData;

const SECTION_FIELD_CONFIG: Record<number, { fields: ProposalFieldKey[]; fallback?: ProposalFieldKey }> = {
  0: {
    fields: [
      'projectTitle',
      'organizationName',
      'executiveSummary',
      'problemDescription',
      'expectedOutcomes',
      'objective1',
      'communityBackground',
      'needsChallenges',
    ],
    fallback: 'executiveSummary',
  },
  1: {
    fields: [
      'projectTitle',
      'organizationName',
      'submissionDate',
      'contactName',
      'contactPhone',
      'contactEmail',
      'contactAddress',
      'fundedBy',
    ],
  },
  2: { fields: ['executiveSummary'], fallback: 'executiveSummary' },
  3: {
    fields: [
      'communityName',
      'population',
      'communityBackground',
      'economicBaseline',
      'culturalContext',
      'needsChallenges',
    ],
  },
  4: {
    fields: ['problemDescription', 'supportingEvidence'],
    fallback: 'problemDescription',
  },
  5: {
    fields: [
      'objective1',
      'objective2',
      'objective3',
      'year1Activities',
      'year2Activities',
      'year3Activities',
    ],
  },
  6: {
    fields: [
      'governanceStructure',
      'implementationResponsibilities',
      'implementationPartnerships',
      'implementationRiskOverview',
    ],
  },
  7: {
    fields: [
      'totalBudget',
      'requestedAmount',
      'communityContribution',
      'personnelBudget',
      'equipmentBudget',
      'trainingBudget',
      'marketingBudget',
      'otherBudget',
      'sustainabilityPlan',
    ],
  },
  8: {
    fields: [
      'expectedOutcomes',
      'successIndicators',
      'dataCollectionPlan',
      'evaluationPlan',
    ],
    fallback: 'expectedOutcomes',
  },
  9: {
    fields: [
      'communityAlignment',
      'funderAlignment',
      'longTermSustainability',
    ],
    fallback: 'communityAlignment',
  },
  10: {
    fields: ['risksMitigation'],
    fallback: 'risksMitigation',
  },
};

const FIELD_LABELS: Partial<Record<ProposalFieldKey, string>> = {
  projectTitle: 'Project Title',
  organizationName: 'Organization Name',
  submissionDate: 'Submission Date',
  contactName: 'Contact Name',
  contactPhone: 'Contact Phone',
  contactEmail: 'Contact Email',
  contactAddress: 'Contact Address',
  fundedBy: 'Funding Source',
  executiveSummary: 'Executive Summary',
  communityName: 'Community Name',
  population: 'Population',
  communityBackground: 'Community Background',
  economicBaseline: 'Economic Baseline',
  culturalContext: 'Cultural Context',
  needsChallenges: 'Needs & Challenges',
  problemDescription: 'Problem Statement',
  supportingEvidence: 'Supporting Evidence',
  objective1: 'Objective 1',
  objective2: 'Objective 2',
  objective3: 'Objective 3',
  year1Activities: 'Year 1 Activities',
  year2Activities: 'Year 2 Activities',
  year3Activities: 'Year 3 Activities',
  governanceStructure: 'Governance Structure',
  implementationResponsibilities: 'Implementation Responsibilities',
  implementationPartnerships: 'Implementation Partnerships',
  implementationRiskOverview: 'Implementation Risk Overview',
  totalBudget: 'Total Project Cost',
  requestedAmount: 'Grant Requested',
  communityContribution: 'Community Contribution',
  personnelBudget: 'Personnel Budget',
  equipmentBudget: 'Equipment Budget',
  trainingBudget: 'Training Budget',
  marketingBudget: 'Marketing Budget',
  otherBudget: 'Other Costs',
  sustainabilityPlan: 'Sustainability Plan',
  expectedOutcomes: 'Expected Outcomes',
  successIndicators: 'Success Indicators',
  dataCollectionPlan: 'Data Collection Plan',
  evaluationPlan: 'Evaluation Plan',
  communityAlignment: 'Community Alignment',
  funderAlignment: 'Funder Alignment',
  longTermSustainability: 'Long-Term Sustainability',
  alignmentDescription: 'Alignment Summary',
  risksMitigation: 'Risk Mitigation Strategy',
};

const QUICK_START_SECTION_NAMES: Partial<Record<ProposalFieldKey, string>> = {
  projectTitle: 'Cover Page',
  organizationName: 'Cover Page',
  executiveSummary: 'Executive Summary',
  communityBackground: 'Community Context',
  needsChallenges: 'Community Context',
  problemDescription: 'Problem Statement',
  expectedOutcomes: 'Expected Outcomes',
  objective1: 'Project Description',
};

export function AIChatPanel({ currentSection, onClose, hasExistingDraft }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isQuickStartComplete, setIsQuickStartComplete] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const { updateMultipleFields, data } = useProposal();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome + quick-start prompt
    const now = Date.now();
    const welcomeMessage: Message = {
      id: `${now}-welcome`,
      type: 'ai',
      content: hasExistingDraft
        ? "Hello! I've reviewed your existing draft. Before we refine each section, let's make sure I understand your current goals."
        : "Hello! I'm your AI Grant Assistant. I'll help you craft a strong proposal, but first I'd love to understand the big picture.",
      timestamp: new Date(),
    };

    const quickStartMessage: Message = {
      id: `${now + 1}-quickstart`,
      type: 'ai',
      content:
        "Quick start question: In a few sentences, what's the goal of your project, who will benefit, and why it matters right now? I'll draft a starting proposal outline from your answer before we dive into each section.",
      timestamp: new Date(),
    };

    setMessages([welcomeMessage, quickStartMessage]);
    setErrorMessage(null);
    setIsQuickStartComplete(false);
  }, [hasExistingDraft]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getSectionGuidance = useCallback((section: number): string => {
    const guidance: { [key: number]: string } = {
      1: "For the Cover Page, I need: project title, organization name, contact information, and submission date. You can speak or type these details.",
      2: "The Executive Summary should be 150-250 words covering who you are, what you're proposing, why it's needed, expected outcomes, and your funding request. Want to draft this together?",
      3: "Let's establish your Community Context. Tell me about your community's background, population, strengths, and cultural significance.",
      4: "For the Problem Statement, describe the specific challenge or opportunity you're addressing. Include any supporting data or community feedback you have.",
      5: "Now for Project Description - let's define your SMART objectives and activities for each year. What are your main goals?",
      6: "The Implementation Plan needs a timeline with specific milestones and deliverables. When do you plan to start, and what are the key phases?",
      7: "For the Budget, I'll help you break down costs into categories: personnel, equipment, training, marketing, and other expenses. What's your total project budget?",
      8: "Expected Outcomes should include measurable results and long-term community impact. How will you measure success?",
      9: "Let's align your project with the funder's priorities. Do you have the funding guidelines? I can help match your project to their goals.",
      10: "For Risk Management, identify potential challenges and your mitigation strategies. What concerns do you have about project implementation?",
      11: "Finally, let's review what supporting documents you have: letters of support, community plans, detailed budgets, etc. What can you attach?"
    };
    return guidance[section] || "How can I help with this section?";
  }, []);

  useEffect(() => {
    if (currentSection <= 0) return;
    const sectionName = sectionNames[currentSection - 1];
    if (!sectionName) return;

    const sectionMessage: Message = {
      id: `${Date.now()}-section`,
      type: 'system',
      content: `📍 Now working on: ${sectionName}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, sectionMessage]);

    const timeout = setTimeout(() => {
      const guidanceMessage: Message = {
        id: `${Date.now()}-guidance`,
        type: 'ai',
        content: getSectionGuidance(currentSection),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, guidanceMessage]);
    }, 300);

    return () => clearTimeout(timeout);
  }, [currentSection, getSectionGuidance]);

  const autoFillFields = useCallback(
    (
      section: number,
      fieldUpdates: Record<string, unknown> | undefined,
      assistantReply: string,
    ) => {
      const config = SECTION_FIELD_CONFIG[section];
      if (!config) return;

      const updates: Record<string, string> = {};
      const updatedLabels: string[] = [];

      for (const field of config.fields) {
        const rawValue = fieldUpdates?.[field];
        if (typeof rawValue === 'string') {
          const trimmed = rawValue.trim();
          if (trimmed) {
            updates[field] = trimmed;
            updatedLabels.push(FIELD_LABELS[field] ?? field);
          }
        }
      }

      if (updatedLabels.length === 0) {
        if (section === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-quickstart-more-info`,
              type: 'system',
              content:
                "Thanks for sharing! I still need a bit more detail—try describing the project goal, who benefits, and why it matters so I can draft an initial outline for you.",
              timestamp: new Date(),
            },
          ]);
          return;
        }

        const fallbackField = config.fallback;
        if (fallbackField) {
          const trimmedReply = assistantReply.trim();
          if (trimmedReply) {
            updates[fallbackField] = trimmedReply;
            updatedLabels.push(FIELD_LABELS[fallbackField] ?? fallbackField);
          }
        }

        if (updatedLabels.length === 0) {
          return;
        }
      }

      if (section === 0) {
        const essentialFields: Array<{ key: keyof ProposalData; minLength: number }> = [
          { key: 'projectTitle', minLength: 5 },
          { key: 'executiveSummary', minLength: 40 },
          { key: 'communityBackground', minLength: 40 },
          { key: 'problemDescription', minLength: 40 },
          { key: 'expectedOutcomes', minLength: 40 },
          { key: 'objective1', minLength: 30 },
        ];

        const meaningfulCount = essentialFields.reduce((count, { key, minLength }) => {
          const value = updates[key];
          if (value && value.trim().length >= minLength) {
            return count + 1;
          }
          return count;
        }, 0);

        if (meaningfulCount === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-quickstart-insufficient`,
              type: 'system',
              content:
                "I'm still missing enough detail to draft your proposal. Share at least one or two sentences about your project goal, who benefits, or the challenge you're tackling so I can start filling things in for you.",
              timestamp: new Date(),
            },
          ]);
          return;
        }
      }

      const labelSummary = updatedLabels.length === 1 ? updatedLabels[0] : updatedLabels.join(', ');
      let actionText: string;
      if (section === 0) {
        const sectionNames = Array.from(
          new Set(
            Object.keys(updates)
              .map((key) => QUICK_START_SECTION_NAMES[key as ProposalFieldKey])
              .filter((name): name is string => Boolean(name)),
          ),
        );
        const sectionSummary =
          sectionNames.length > 0 ? sectionNames.join(', ') : 'multiple sections';
        actionText = `Quick-start drafted updates for ${sectionSummary}. Apply these AI-generated details to jumpstart your proposal?`;
      } else {
        actionText =
          updatedLabels.length === 1
            ? `The assistant drafted an update for ${labelSummary}.`
            : `The assistant drafted updates for ${labelSummary}.`;
      }

      const actionMessage: Message = {
        id: `${Date.now()}-auto-fill`,
        type: 'action',
        content: actionText,
        timestamp: new Date(),
        pendingUpdates: {
          updates,
          labels: updatedLabels,
          section,
        },
      };

      setMessages((prev) => [...prev, actionMessage]);
    },
    [],
  );

  const handleApplyPendingUpdates = useCallback(
    (messageId: string, pending: NonNullable<Message['pendingUpdates']>) => {
      updateMultipleFields(pending.updates);

      const appliedAt = Date.now();
      const confirmation: Message = {
        id: `${appliedAt}-apply`,
        type: 'system',
        content:
          pending.labels.length === 1
            ? `✅ Applied ${pending.labels[0]}.`
            : `✅ Applied updates to: ${pending.labels.join(', ')}.`,
        timestamp: new Date(),
      };

      const followUps: Message[] = [confirmation];

      if (pending.section === 0 && !isQuickStartComplete) {
        setIsQuickStartComplete(true);
        followUps.push({
          id: `${appliedAt + 1}-quickstart-complete`,
          type: 'system',
          content: '🚀 Quick start complete! Head to Section 1 (Cover Page) to review and fine-tune the draft details.',
          timestamp: new Date(),
        });
      }

      setMessages((prev) => {
        const withoutPrompt = prev.filter((message) => message.id !== messageId);
        return [...withoutPrompt, ...followUps];
      });
    },
    [isQuickStartComplete, updateMultipleFields],
  );

  const handleSkipPendingUpdates = useCallback(
    (messageId: string, pending: NonNullable<Message['pendingUpdates']>) => {
      const skippedAt = Date.now();
      const skipMessage: Message = {
        id: `${skippedAt}-skip`,
        type: 'system',
        content:
          pending.labels.length === 1
            ? `⏭️ Skipped auto-fill for ${pending.labels[0]}.`
            : `⏭️ Skipped auto-fill for: ${pending.labels.join(', ')}.`,
        timestamp: new Date(),
      };

      const followUps: Message[] = [skipMessage];

      if (pending.section === 0 && !isQuickStartComplete) {
        setIsQuickStartComplete(true);
        followUps.push({
          id: `${skippedAt + 1}-quickstart-skip`,
          type: 'system',
          content: 'No worries—when you are ready, you can start with Section 1 (Cover Page) and fill in the details manually.',
          timestamp: new Date(),
        });
      }

      setMessages((prev) => {
        const withoutPrompt = prev.filter((message) => message.id !== messageId);
        return [...withoutPrompt, ...followUps];
      });
    },
    [isQuickStartComplete],
  );

  const getActiveSectionName = useCallback(() => {
    if (currentSection <= 0) {
      return 'Document Preparation';
    }
    return sectionNames[currentSection - 1] ?? 'Proposal Section';
  }, [currentSection]);

  const getFormatInstruction = useCallback(
    (section: number): string | undefined => {
      const config = SECTION_FIELD_CONFIG[section];
      if (!config) return undefined;
      const allowedFields = config.fields
        .map((field) => {
          const label = FIELD_LABELS[field];
          return label ? `${field} (${label})` : field;
        })
        .join(', ');
      return [
        'Respond strictly with a JSON object shaped as',
        '{"chat_reply": "<natural language response for the user>", "field_updates": { "<field>": "<value>" }}.',
        `Only include keys inside "field_updates" from this allowlist: ${allowedFields}.`,
        'If you do not have structured updates, set "field_updates" to an empty object.',
        'Values must be plain strings without Markdown or additional commentary. Do not wrap the JSON in code fences or add text outside the JSON.',
      ].join(' ');
    },
    [],
  );

  const buildHistory = useCallback(
    (historyMessages: Message[]): ConversationMessage[] => {
      const sectionForAI = !isQuickStartComplete ? 0 : currentSection;
      const sectionLabel = !isQuickStartComplete
        ? 'Quick Start Intake'
        : getActiveSectionName();

      const history: ConversationMessage[] = [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        {
          role: 'system',
          content: `The user is currently working on the ${sectionLabel} section of a grant proposal. Provide focused, respectful support and suggest actionable next steps.`,
        },
      ];

      if (sectionForAI === 0) {
        history.push({
          role: 'system',
          content:
            "You are running a quick-start intake to capture the project's overarching goal. Ask clarifying questions if needed, craft a concise assistant reply, and propose structured field updates that draft an initial proposal outline.",
        });
      }

      const formatInstruction = getFormatInstruction(sectionForAI);
      if (formatInstruction) {
        history.push({ role: 'system', content: formatInstruction });
      }

      historyMessages.forEach((message) => {
        if (message.type === 'user') {
          history.push({ role: 'user', content: message.content });
        }
        if (message.type === 'ai') {
          history.push({ role: 'assistant', content: message.content });
        }
      });

      return history;
    },
    [currentSection, getActiveSectionName, getFormatInstruction, isQuickStartComplete],
  );

  const playAudioFromBase64 = useCallback((audioBase64: string) => {
    const src = `data:audio/mpeg;base64,${audioBase64}`;
    const audio = new Audio(src);
    audio.play().catch(() => undefined);
    return src;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setTextInput('');
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const activeSection =
        !isQuickStartComplete ? 0 : currentSection > 0 ? currentSection : undefined;

      const response = await chatWithAssistant({
        message: trimmed,
        history: buildHistory(messagesRef.current),
        section: activeSection,
      });

      const audioSrc = response.audio_base64
        ? playAudioFromBase64(response.audio_base64)
        : undefined;

      const aiMessage: Message = {
        id: `${Date.now()}-assistant`,
        type: 'ai',
        content: response.message,
        timestamp: new Date(),
        audioSrc,
        sources: response.sources ?? [],
      };

      setMessages((prev) => [...prev, aiMessage]);

      const sectionForAutoFill =
        activeSection !== undefined ? activeSection : currentSection;
      autoFillFields(sectionForAutoFill, response.field_updates, response.message);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unable to reach the assistant. Please try again.';
      setErrorMessage(detail);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          type: 'system',
          content: `⚠️ ${detail}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [autoFillFields, buildHistory, currentSection, isQuickStartComplete, playAudioFromBase64]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleVoiceRecord = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setErrorMessage('Recording failed. Please try again.');
        setIsRecording(false);
        setIsListening(false);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (!audioBlob.size) {
          return;
        }

        try {
          const transcription = await transcribeAudio(audioBlob, `voice-${Date.now()}.webm`);
          setTextInput(transcription.text);
          await sendMessage(transcription.text);
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : 'Unable to transcribe the recording.';
          setErrorMessage(detail);
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-stt-error`,
              type: 'system',
              content: `⚠️ ${detail}`,
              timestamp: new Date(),
            },
          ]);
        }
      };

      recorder.start();
      setIsRecording(true);
      setIsListening(true);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Microphone access denied. Please enable microphone permissions.';
      setErrorMessage(detail);
      setIsRecording(false);
      setIsListening(false);
    }
  }, [autoFillFields, currentSection, isRecording, sendMessage, stopRecording]);

  useEffect(() => () => {
    stopRecording();
  }, [stopRecording]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    void sendMessage(textInput);
  }, [sendMessage, textInput]);

  const handleFileUpload = useCallback(() => {
    const systemMessage: Message = {
      id: `${Date.now()}-upload`,
      type: 'system',
      content: '📎 Document uploaded and queued for analysis. I will incorporate its insights shortly.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  const handlePlayAudio = useCallback((message: Message) => {
    if (!message.audioSrc) return;
    const audio = new Audio(message.audioSrc);
    audio.play().catch(() => undefined);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-sky-50 to-blue-50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-stone-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-stone-900">AI Assistant</h3>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by OpenAI & ElevenLabs
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Current Section Indicator */}
      <div className="px-4 py-3 bg-emerald-100 border-b border-emerald-200">
        <p className="text-xs text-emerald-900 flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4" />
          {!isQuickStartComplete ? (
            <span>Working on: <strong>Quick Start Intake</strong></span>
          ) : currentSection === 0 ? (
            <span>Working on: <strong>Upload Documents</strong></span>
          ) : (
            <span>Working on: <strong>{sectionNames[currentSection - 1]}</strong></span>
          )}
        </p>
        {/* Show uploaded documents count */}
        {isQuickStartComplete && (
          <p className="text-xs text-emerald-700 flex items-center gap-2 mt-1 opacity-70">
            📚 RAG Context: Coming soon — you'll be able to upload documents to personalize responses even more.
          </p>
        )}
      </div>

      {/* Message Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {message.type === 'ai' && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-stone-200">
                      <p className="text-sm text-stone-800 leading-relaxed">
                        {message.content}
                      </p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-stone-100 space-y-1">
                          <p className="text-xs text-stone-500">Sources from the document library</p>
                          {message.sources.map((source) => (
                            <p key={source.number} className="text-xs text-stone-600">
                              [{source.number}] {source.title.replace(/\.(pdf|docx|txt|md)$/i, '')}
                              {source.section ? ` › ${source.section}` : ''}
                              {source.page ? `, page ${source.page}` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-stone-400">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!message.audioSrc}
                          className="h-6 gap-1 text-xs text-emerald-600 hover:text-emerald-700 disabled:text-stone-400"
                          onClick={() => handlePlayAudio(message)}
                        >
                          <Volume2 className="w-3 h-3" />
                          {message.audioSrc ? 'Play' : 'No Audio'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {message.type === 'action' && message.pendingUpdates && (
                <div className="flex justify-start">
                  <div className="max-w-[90%]">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                      <p className="text-sm text-emerald-900 leading-relaxed">
                        {message.content}
                      </p>
                      {message.pendingUpdates.labels.length > 1 && (
                        <ul className="mt-2 text-xs text-emerald-800 list-disc list-inside space-y-1">
                          {message.pendingUpdates.labels.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-emerald-700 mt-2">
                        Apply these updates to the form?
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApplyPendingUpdates(message.id, message.pendingUpdates!)}
                        >
                          Apply Updates
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-stone-300 text-stone-600 hover:bg-stone-100"
                          onClick={() => handleSkipPendingUpdates(message.id, message.pendingUpdates!)}
                        >
                          Not Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {message.type === 'user' && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl rounded-tr-sm p-4 shadow-sm">
                    <p className="text-sm text-white leading-relaxed">
                      {message.content}
                    </p>
                    <p className="text-xs text-emerald-100 mt-2 text-right">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              {message.type === 'system' && (
                <div className="flex justify-center">
                  <div className="w-full bg-amber-100 border-l-4 border-amber-500 rounded p-3">
                    <p className="text-xs text-amber-900">
                      {message.content}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-stone-200">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-emerald-600" />
                <p className="text-sm text-stone-600">AI is thinking...</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        {/* Voice Indicator */}
        {isListening && (
          <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Mic className="w-4 h-4 text-red-600" />
            </motion.div>
            <p className="text-xs text-red-800">Listening... Speak now</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            {errorMessage}
          </div>
        )}

        {/* Voice Button */}
        <div className="mb-3">
          <Button
            size="lg"
            onClick={handleVoiceRecord}
            className={`w-full gap-3 py-6 text-base transition-all ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Mic className="w-5 h-5" />
            {isRecording ? '🎤 Recording... Tap to stop' : '🎤 Tap to Speak'}
          </Button>
          <p className="text-xs text-center text-stone-500 mt-1">
            Powered by ElevenLabs Voice AI
          </p>
        </div>

        {/* Text Input */}
        <div className="flex gap-2 mb-3">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
            placeholder="Or type your message..."
            className="flex-1"
          />
          <Button
            onClick={handleTextSubmit}
            size="icon"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Upload Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-full">
              <div className="w-full gap-2 border-2 border-dashed border-stone-300 text-stone-500 text-sm py-3 rounded-md flex items-center justify-center cursor-not-allowed bg-stone-100">
                <Upload className="w-4 h-4" />
                📎 Coming Soon: Upload Documents for RAG Context
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              We're enhancing how the assistant uses your attachments. Stay tuned—soon you'll be able to upload community and funding documents directly from here.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
