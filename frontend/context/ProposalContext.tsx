import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

import { createProposal, saveProposal, type SavedProposal } from '../lib/api';

export interface ProposalData {
  // Document uploads
  communityDocuments: File[];
  fundingDocuments: File[];
  
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
  
  // Outcomes
  expectedOutcomes: string;
  successIndicators: string;
  dataCollectionPlan: string;
  evaluationPlan: string;
  
  // Alignment
  alignmentDescription: string;
  communityAlignment: string;
  funderAlignment: string;
  longTermSustainability: string;
  
  // Risk Management
  risksMitigation: string;
}

interface ProposalContextType {
  data: ProposalData;
  updateField: (field: keyof ProposalData, value: any) => void;
  updateMultipleFields: (fields: Partial<ProposalData>) => void;
  addCommunityDocument: (file: File) => void;
  addFundingDocument: (file: File) => void;
  removeCommunityDocument: (index: number) => void;
  removeFundingDocument: (index: number) => void;
  /** The saved proposal being edited; null until the first save of a new proposal. */
  proposalId: string | null;
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
  communityDocuments: [],
  fundingDocuments: [],
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
  expectedOutcomes: '',
  successIndicators: '',
  dataCollectionPlan: '',
  evaluationPlan: '',
  alignmentDescription: '',
  communityAlignment: '',
  funderAlignment: '',
  longTermSustainability: '',
  risksMitigation: '',
};

/** The form as it is saved: uploaded files are not part of it. */
function toSavedData(data: ProposalData): Record<string, unknown> {
  const { communityDocuments, fundingDocuments, ...rest } = data;
  return rest;
}

/** A saved form back into the shape the builder uses; fields added since it was saved start empty. */
function fromSavedData(saved: Record<string, unknown>): ProposalData {
  return { ...initialData, ...saved, communityDocuments: [], fundingDocuments: [] } as ProposalData;
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

  const addCommunityDocument = (file: File) => {
    change(prev => ({
      ...prev,
      communityDocuments: [...prev.communityDocuments, file]
    }));
  };

  const addFundingDocument = (file: File) => {
    change(prev => ({
      ...prev,
      fundingDocuments: [...prev.fundingDocuments, file]
    }));
  };

  const removeCommunityDocument = (index: number) => {
    change(prev => ({
      ...prev,
      communityDocuments: prev.communityDocuments.filter((_, i) => i !== index)
    }));
  };

  const removeFundingDocument = (index: number) => {
    change(prev => ({
      ...prev,
      fundingDocuments: prev.fundingDocuments.filter((_, i) => i !== index)
    }));
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

  return (
    <ProposalContext.Provider value={{
      data,
      updateField,
      updateMultipleFields,
      addCommunityDocument,
      addFundingDocument,
      removeCommunityDocument,
      removeFundingDocument,
      proposalId,
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
