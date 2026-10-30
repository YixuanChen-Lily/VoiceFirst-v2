import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

import { createProposal, saveProposal, type SavedProposal } from '../lib/api';

export interface BudgetLine {
  category: string;
  description: string;
  amount: string;
}

export interface Indicator {
  indicator: string;
  baseline: string;
  target: string;
  year: string;
}

export interface RiskRow {
  risk: string;
  likelihood: string;
  mitigation: string;
}

export interface ProposalData {
  // Cover Page
  projectTitle: string;
  organizationName: string;
  submissionDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  fundedBy: string;
  
  // Executive Summary
  executiveSummary: string;
  
  // Community Context
  communityName: string;
  population: string;
  communityBackground: string;
  economicBaseline: string;
  culturalContext: string;
  needsChallenges: string;
  
  // Problem Statement
  problemDescription: string;
  supportingEvidence: string;
  
  // Project Description
  objective1: string;
  objective2: string;
  objective3: string;
  year1Activities: string;
  year2Activities: string;
  year3Activities: string;
  
  // Implementation
  governanceStructure: string;
  implementationResponsibilities: string;
  implementationPartnerships: string;
  implementationRiskOverview: string;
  milestones: { name: string; date: string }[];
  
  // Budget
  totalBudget: string;
  requestedAmount: string;
  communityContribution: string;
  personnelBudget: string;
  equipmentBudget: string;
  trainingBudget: string;
  marketingBudget: string;
  otherBudget: string;
  sustainabilityPlan: string;
  budgetLines: BudgetLine[];
  
  // Outcomes
  expectedOutcomes: string;
  successIndicators: string;
  dataCollectionPlan: string;
  evaluationPlan: string;
  indicators: Indicator[];
  
  // Alignment
  alignmentDescription: string;
  communityAlignment: string;
  funderAlignment: string;
  longTermSustainability: string;
  
  // Risk Management
  risksMitigation: string;
  riskRows: RiskRow[];

  // Attachments: which recommended documents are ticked off. Files themselves are
  // stored on the server and linked to the saved proposal.
  attachmentChecklist: Record<string, boolean>;
}

interface ProposalContextType {
  data: ProposalData;
  updateField: (field: keyof ProposalData, value: any) => void;
  updateMultipleFields: (fields: Partial<ProposalData>) => void;
  /** Fill in only the fields that are still empty. Returns the names of the fields filled. */
  fillEmptyFields: (fields: Partial<ProposalData>) => string[];
  /** The saved proposal being edited; null until the first save of a new proposal. */
  proposalId: string | null;
  /** Save the proposal if it has never been saved, and return its id. Files need one. */
  ensureSaved: () => Promise<string>;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  saveError: string | null;
  hasUnsavedChanges: boolean;
  /** Save any pending changes, then start an empty proposal. */
  startNewProposal: () => Promise<void>;
  /** Save any pending changes, then load a saved proposal into the form. */
  openProposal: (proposal: SavedProposal) => Promise<void>;
  /** Save now instead of waiting for autosave. */
  saveNow: () => Promise<void>;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Autosave runs this long after the last change, so typing triggers one save, not many. */
const AUTOSAVE_DELAY_MS = 2000;

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

const initialData: ProposalData = {
  projectTitle: '',
  organizationName: '',
  submissionDate: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  fundedBy: '',
  executiveSummary: '',
  communityName: '',
  population: '',
  communityBackground: '',
  economicBaseline: '',
  culturalContext: '',
  needsChallenges: '',
  problemDescription: '',
  supportingEvidence: '',
  objective1: '',
  objective2: '',
  objective3: '',
  year1Activities: '',
  year2Activities: '',
  year3Activities: '',
  governanceStructure: '',
  implementationResponsibilities: '',
  implementationPartnerships: '',
  implementationRiskOverview: '',
  milestones: [
    { name: '', date: '' },
    { name: '', date: '' },
    { name: '', date: '' },
    { name: '', date: '' },
  ],
  totalBudget: '',
  requestedAmount: '',
  communityContribution: '',
  personnelBudget: '',
  equipmentBudget: '',
  trainingBudget: '',
  marketingBudget: '',
  otherBudget: '',
  sustainabilityPlan: '',
  budgetLines: ['Capital', 'Operations', 'Training', 'Marketing', 'Contingency'].map((category) => ({
    category,
    description: '',
    amount: '',
  })),
  expectedOutcomes: '',
  successIndicators: '',
  dataCollectionPlan: '',
  evaluationPlan: '',
  indicators: Array.from({ length: 3 }, () => ({ indicator: '', baseline: '', target: '', year: '' })),
  alignmentDescription: '',
  communityAlignment: '',
  funderAlignment: '',
  longTermSustainability: '',
  risksMitigation: '',
  riskRows: Array.from({ length: 3 }, () => ({ risk: '', likelihood: '', mitigation: '' })),
  attachmentChecklist: {},
};

/** Whether a field has something in it: text that isn't blank, or a table row with any text. */
function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) {
    return value.some((row) =>
      typeof row === 'object' && row !== null && Object.values(row).some((cell) => typeof cell === 'string' && cell.trim() !== ''),
    );
  }
  return false;
}

/** The form as it is saved. Uploaded files are saved separately, linked to the proposal. */
function toSavedData(data: ProposalData): Record<string, unknown> {
  return { ...data };
}

/** A saved form back into the shape the builder uses; fields added since it was saved start empty. */
function fromSavedData(saved: Record<string, unknown>): ProposalData {
  // Proposals saved before files were stored on the server may carry these empty lists.
  const { communityDocuments, fundingDocuments, ...rest } = saved;
  return { ...initialData, ...rest } as ProposalData;
}

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProposalData>(initialData);
  const [proposalId, setProposalId] = useState<string | null>(null);
  // Every change bumps `revision`; a save records which revision it stored.
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Saves run asynchronously, so they read the latest values through refs.
  const dataRef = useRef(data);
  const revisionRef = useRef(revision);
  const proposalIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  // Bumped when switching proposals, so a save that finishes late cannot touch the new one.
  const sessionRef = useRef(0);
  dataRef.current = data;
  revisionRef.current = revision;

  const change = (update: (prev: ProposalData) => ProposalData) => {
    setData(update);
    setRevision((value) => value + 1);
  };

  const updateField = (field: keyof ProposalData, value: any) => {
    change(prev => ({ ...prev, [field]: value }));
  };

  const updateMultipleFields = (fields: Partial<ProposalData>) => {
    change(prev => ({ ...prev, ...fields }));
  };

  const fillEmptyFields = (fields: Partial<ProposalData>): string[] => {
    const pick = (current: ProposalData) =>
      Object.fromEntries(
        Object.entries(fields).filter(
          ([key, value]) => key in initialData && isFilled(value) && !isFilled(current[key as keyof ProposalData]),
        ),
      ) as Partial<ProposalData>;
    const filled = Object.keys(pick(dataRef.current));
    if (filled.length > 0) change((prev) => ({ ...prev, ...pick(prev) }));
    return filled;
  };

  const save = useCallback(async () => {
    // One save at a time: wait for any save already running.
    while (inFlightRef.current) {
      await inFlightRef.current;
    }
    const session = sessionRef.current;
    const savingRevision = revisionRef.current;
    const snapshot = toSavedData(dataRef.current);

    setSaveStatus('saving');
    setSaveError(null);
    const run = (async () => {
      try {
        if (proposalIdRef.current) {
          await saveProposal(proposalIdRef.current, snapshot);
        } else {
          const created = await createProposal(snapshot);
          if (session !== sessionRef.current) return;
          proposalIdRef.current = created.id;
          setProposalId(created.id);
        }
        if (session !== sessionRef.current) return;
        setSavedRevision(savingRevision);
        setLastSavedAt(new Date());
        setSaveStatus('saved');
      } catch (error) {
        if (session !== sessionRef.current) return;
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : 'Could not save.');
      }
    })();
    inFlightRef.current = run;
    try {
      await run;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  // Autosave a short while after the last change. A failed save is retried on the next change.
  useEffect(() => {
    if (revision === savedRevision) return;
    const timer = setTimeout(() => {
      save();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revision, savedRevision, save]);

  const hasUnsavedChanges = revision !== savedRevision;

  // Warn before closing the tab while changes are not saved yet.
  useEffect(() => {
    if (!hasUnsavedChanges && saveStatus !== 'saving') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges, saveStatus]);

  const flush = async () => {
    if (revisionRef.current !== savedRevision || inFlightRef.current) {
      await save();
    }
  };

  const resetTo = (nextData: ProposalData, nextId: string | null, savedAt: Date | null) => {
    sessionRef.current += 1;
    proposalIdRef.current = nextId;
    setProposalId(nextId);
    setData(nextData);
    setRevision(0);
    setSavedRevision(0);
    setSaveStatus(savedAt ? 'saved' : 'idle');
    setLastSavedAt(savedAt);
    setSaveError(null);
  };

  const startNewProposal = async () => {
    await flush();
    resetTo(initialData, null, null);
  };

  const openProposal = async (proposal: SavedProposal) => {
    await flush();
    resetTo(fromSavedData(proposal.data), proposal.id, new Date(proposal.updated_at));
  };

  const saveNow = async () => {
    await save();
  };

  const ensureSaved = async (): Promise<string> => {
    if (proposalIdRef.current) return proposalIdRef.current;
    await save();
    if (!proposalIdRef.current) {
      throw new Error('The proposal could not be saved, so the file was not added. Try again.');
    }
    return proposalIdRef.current;
  };

  return (
    <ProposalContext.Provider value={{
      data,
      updateField,
      updateMultipleFields,
      fillEmptyFields,
      proposalId,
      ensureSaved,
      saveStatus,
      lastSavedAt,
      saveError,
      hasUnsavedChanges,
      startNewProposal,
      openProposal,
      saveNow,
    }}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal() {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposal must be used within ProposalProvider');
  }
  return context;
}
