import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

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

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProposalData>(initialData);

  const updateField = (field: keyof ProposalData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateMultipleFields = (fields: Partial<ProposalData>) => {
    setData(prev => ({ ...prev, ...fields }));
  };

  const addCommunityDocument = (file: File) => {
    setData(prev => ({
      ...prev,
      communityDocuments: [...prev.communityDocuments, file]
    }));
  };

  const addFundingDocument = (file: File) => {
    setData(prev => ({
      ...prev,
      fundingDocuments: [...prev.fundingDocuments, file]
    }));
  };

  const removeCommunityDocument = (index: number) => {
    setData(prev => ({
      ...prev,
      communityDocuments: prev.communityDocuments.filter((_, i) => i !== index)
    }));
  };

  const removeFundingDocument = (index: number) => {
    setData(prev => ({
      ...prev,
      fundingDocuments: prev.fundingDocuments.filter((_, i) => i !== index)
    }));
  };

  return (
    <ProposalContext.Provider value={{ 
      data, 
      updateField, 
      updateMultipleFields,
      addCommunityDocument,
      addFundingDocument,
      removeCommunityDocument,
      removeFundingDocument
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
