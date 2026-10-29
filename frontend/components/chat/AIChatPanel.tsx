import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Mic, Send, Square, X, Volume2, FileText, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useProposal } from '../../context/ProposalContext';
import type { ProposalData } from '../../context/ProposalContext';
import { chatWithAssistant, transcribeAudio, type ChatSource, type ConversationMessage } from '../../lib/api';
import { STEP_NAMES } from '../../lib/proposalSteps';

interface AIChatPanelProps {
  currentSection: number;
  onClose: () => void;
  hasExistingDraft: boolean;
}

type MessageType = 'ai' | 'user' | 'system' | 'action';

const SOURCE_ORIGINS: Record<NonNullable<ChatSource['origin']>, string> = {
  library: 'From the document library',
  background: 'From your file',
  attachment: 'From your attachment',
};

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
  projectTitle: 'Project name',
  organizationName: 'Organization applying',
  submissionDate: 'Date you\'ll submit',
  contactName: 'Contact name',
  contactPhone: 'Contact phone',
  contactEmail: 'Contact email',
  contactAddress: 'Mailing address',
  fundedBy: 'Funder or program',
  executiveSummary: 'Summary',
  communityName: 'Community name',
  population: 'Population',
  communityBackground: 'About your community',
  economicBaseline: 'Local economy',
  culturalContext: 'Culture and land',
  needsChallenges: 'Challenges the community faces',
  problemDescription: 'The problem or opportunity',
  supportingEvidence: 'Evidence',
  objective1: 'Goal 1',
  objective2: 'Goal 2',
  objective3: 'Goal 3',
  year1Activities: 'Year 1 activities',
  year2Activities: 'Year 2 activities',
  year3Activities: 'Year 3 activities',
  governanceStructure: 'Who oversees the project',
  implementationResponsibilities: 'Who does what',
  implementationPartnerships: 'Partners',
  implementationRiskOverview: 'Main risks, in brief',
  totalBudget: 'Total project cost',
  requestedAmount: 'Amount you\'re asking for',
  communityContribution: 'Community contribution',
  personnelBudget: 'Staff costs',
  equipmentBudget: 'Equipment costs',
  trainingBudget: 'Training costs',
  marketingBudget: 'Promotion costs',
  otherBudget: 'Other funding',
  sustainabilityPlan: 'After the grant ends',
  expectedOutcomes: 'What will change',
  successIndicators: 'How you\'ll know it worked',
  dataCollectionPlan: 'How you\'ll gather information',
  evaluationPlan: 'How you\'ll review progress',
  communityAlignment: 'How it fits your community\'s plans',
  funderAlignment: 'How it fits the funder\'s priorities',
  longTermSustainability: 'What lasts after the funding ends',
  alignmentDescription: 'Alignment Summary',
  risksMitigation: 'Risks summary',
};

const QUICK_START_SECTION_NAMES: Partial<Record<ProposalFieldKey, string>> = {
  projectTitle: STEP_NAMES[1],
  organizationName: STEP_NAMES[1],
  executiveSummary: STEP_NAMES[2],
  communityBackground: STEP_NAMES[3],
  needsChallenges: STEP_NAMES[3],
  problemDescription: STEP_NAMES[4],
  objective1: STEP_NAMES[5],
  expectedOutcomes: STEP_NAMES[8],
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
  const { updateMultipleFields, data, proposalId } = useProposal();

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
        ? "Hello! I've read your draft. Before we work on each part, I'd like to make sure I understand your goals."
        : "Hello! I'm here to help you write a strong proposal. First, I'd like to understand the big picture.",
      timestamp: new Date(),
    };

    const quickStartMessage: Message = {
      id: `${now + 1}-quickstart`,
      type: 'ai',
      content:
        "To start: in a few sentences, what is your project's goal, who will benefit, and why does it matter now? I'll use your answer to sketch a first outline.",
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
      1: "For the cover page I need the project name, your organization, a contact person, and the date you'll submit. You can say them or type them.",
      2: "The summary is one short paragraph: what you'll do, why it matters, how, what will change, and how much you're asking for. Want to write it together?",
      3: "Tell me about your community: where it is, who lives there, and what daily life is like.",
      4: "What problem does your project solve, or what opportunity does it open up? Any numbers or survey results help.",
      5: "Let's set your goals. What are the main things you want this project to achieve, and by when?",
      6: "Who will oversee the project, and what are the main milestones? When do you plan to start?",
      7: "Let's work out the budget. What's the total cost, and how much are you asking this funder for?",
      8: "How will you know the project worked? Think of things you can count, like jobs created or people trained.",
      9: "Do you have the funder's guidelines? I can help show how your project fits what they're looking for.",
      10: "What could go wrong, and what would you do about it? Delays, staffing and costs are common ones.",
      11: "Last step: what documents can you attach? Letters of support, community plans and budgets are common."
    };
    return guidance[section] || "How can I help with this step?";
  }, []);

  useEffect(() => {
    if (currentSection <= 0) return;
    const sectionName = sectionNames[currentSection - 1];
    if (!sectionName) return;

    const sectionMessage: Message = {
      id: `${Date.now()}-section`,
      type: 'system',
      content: `Now on: ${STEP_NAMES[currentSection]}`,
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
          sectionNames.length > 0 ? sectionNames.join(', ') : 'several steps';
        actionText = `I drafted a start for: ${sectionSummary}.`;
      } else {
        actionText =
          updatedLabels.length === 1
            ? `I drafted this for ${labelSummary}.`
            : `I drafted these for ${labelSummary}.`;
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
            ? `Added to your proposal: ${pending.labels[0]}.`
            : `Added to your proposal: ${pending.labels.join(', ')}.`,
        timestamp: new Date(),
      };

      const followUps: Message[] = [confirmation];

      if (pending.section === 0 && !isQuickStartComplete) {
        setIsQuickStartComplete(true);
        followUps.push({
          id: `${appliedAt + 1}-quickstart-complete`,
          type: 'system',
          content: 'Good start. Next, open "Cover page" to check the details.',
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
            ? `Not added: ${pending.labels[0]}.`
            : `Not added: ${pending.labels.join(', ')}.`,
        timestamp: new Date(),
      };

      const followUps: Message[] = [skipMessage];

      if (pending.section === 0 && !isQuickStartComplete) {
        setIsQuickStartComplete(true);
        followUps.push({
          id: `${skippedAt + 1}-quickstart-skip`,
          type: 'system',
          content: 'No problem. When you\'re ready, start with "Cover page" and fill in the details yourself.',
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
        proposal_id: proposalId ?? undefined,
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
      content: 'Got your document. I\'ll use it once it\'s ready.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  const handlePlayAudio = useCallback((message: Message) => {
    if (!message.audioSrc) return;
    const audio = new Audio(message.audioSrc);
    audio.play().catch(() => undefined);
  }, []);

  const helpingWith = !isQuickStartComplete ? 'Getting started' : STEP_NAMES[currentSection];
  const timeOf = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full w-full flex flex-col bg-white text-ink font-readable text-[17px] leading-relaxed">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Assistant</h2>
          <p className="text-[15px] text-ink-muted truncate">
            Helping with: <strong className="text-ink">{helpingWith}</strong>
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} className="md:hidden gap-1.5">
          <X className="w-5 h-5" aria-hidden="true" />
          Close
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-birch">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {message.type === 'ai' && (
                <div className="max-w-[90%] bg-white border border-line rounded-2xl rounded-bl-[4px] px-4 py-3.5">
                  <p>{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-line space-y-1">
                      {message.sources.map((source) => (
                        <p key={source.number} className="flex items-start gap-2 text-[15px] text-ink-muted">
                          <FileText className="w-4 h-4 mt-1 shrink-0" aria-hidden="true" />
                          <span>
                            {SOURCE_ORIGINS[source.origin ?? 'library']}:{' '}
                            {source.title.replace(/\.(pdf|docx|xlsx|txt|md|csv)$/i, '')}
                            {source.section ? ` › ${source.section}` : ''}
                            {source.page ? `, page ${source.page}` : ''}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <p className="text-sm text-[#8C867E]">{timeOf(message.timestamp)}</p>
                    {message.audioSrc && (
                      <button
                        type="button"
                        onClick={() => handlePlayAudio(message)}
                        className="inline-flex items-center gap-1.5 min-h-9 text-[15px] font-bold text-forest hover:text-forest-dark"
                      >
                        <Volume2 className="w-4 h-4" aria-hidden="true" />
                        Read aloud
                      </button>
                    )}
                  </div>
                </div>
              )}

              {message.type === 'action' && message.pendingUpdates && (
                <div className="max-w-[92%] bg-forest-tint border border-[#C7DACD] rounded-2xl px-4 py-3.5 text-forest-dark">
                  <p className="font-bold mb-1">Add this to your proposal?</p>
                  <p className="text-base">{message.content}</p>
                  {message.pendingUpdates.labels.length > 1 && (
                    <ul className="mt-2 text-base list-disc list-inside space-y-0.5">
                      {message.pendingUpdates.labels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button onClick={() => handleApplyPendingUpdates(message.id, message.pendingUpdates!)}>
                      Add it
                    </Button>
                    <Button
                      variant="outline"
                      className="border-[#C7DACD]"
                      onClick={() => handleSkipPendingUpdates(message.id, message.pendingUpdates!)}
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              )}

              {message.type === 'user' && (
                <div className="ml-auto max-w-[85%] w-fit bg-forest text-white rounded-2xl rounded-br-[4px] px-4 py-3.5">
                  <p>{message.content}</p>
                  <p className="text-sm text-[#CFE0D5] mt-1 text-right">{timeOf(message.timestamp)}</p>
                </div>
              )}

              {message.type === 'system' && (
                <div className="bg-ochre-tint border-l-4 border-ochre rounded-lg px-3.5 py-2.5">
                  <p className="text-base text-ochre-text">{message.content}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="w-fit bg-white border border-line rounded-2xl rounded-bl-[4px] px-4 py-3.5 flex items-center gap-2">
            <Loader className="w-4 h-4 animate-spin text-forest" aria-hidden="true" />
            <p className="text-ink-muted">Thinking…</p>
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-5 border-t border-line">
        {isListening && (
          <p role="status" className="mb-3 px-3.5 py-2.5 rounded-lg bg-ochre-tint text-ochre-text flex items-center gap-2 text-base">
            <Mic className="w-4 h-4 animate-pulse" aria-hidden="true" />
            Listening. Speak now.
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="mb-3 px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-base">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleVoiceRecord}
          className={`w-full min-h-14 rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2.5 transition-colors ${
            isRecording ? 'bg-[#A4462E] hover:bg-[#8A3A26]' : 'bg-forest hover:bg-forest-dark'
          }`}
        >
          {isRecording ? (
            <Square className="w-5 h-5 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="w-[22px] h-[22px]" aria-hidden="true" />
          )}
          {isRecording ? 'Recording. Tap to stop' : 'Tap to talk'}
        </button>

        <div className="flex gap-2 mt-3">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
            placeholder="Or type here…"
            aria-label="Type a message"
            className="flex-1"
          />
          <Button
            onClick={handleTextSubmit}
            size="icon"
            variant="secondary"
            aria-label="Send"
            className="size-12"
          >
            <Send className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
