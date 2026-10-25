const FALLBACK_API_BASE_URL = (process.env.NEXT_PUBLIC_DEFAULT_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');

export interface DraftAnalysis {
  section: string;
  summary: string;
  recommendations: string[];
  score?: number;
}

export interface ProposalPayload {
  projectTitle: string;
  organizationName: string;
  submissionDate?: string;
  executiveSummary?: string;
  communityBackground?: string;
  problemDescription?: string;
  objectives?: string[];
  milestones?: string[];
  requestedAmount?: string;
  risks?: string;
}

interface ProposalRequestPayload {
  project_title: string;
  organization_name: string;
  submission_date?: string;
  executive_summary?: string;
  community_background?: string;
  problem_description?: string;
  objectives?: string[];
  milestones?: string[];
  requested_amount?: string;
  risks?: string;
}

function serializeProposalPayload(payload: ProposalPayload): ProposalRequestPayload {
  return {
    project_title: payload.projectTitle,
    organization_name: payload.organizationName,
    submission_date: payload.submissionDate,
    executive_summary: payload.executiveSummary,
    community_background: payload.communityBackground,
    problem_description: payload.problemDescription,
    objectives: payload.objectives,
    milestones: payload.milestones,
    requested_amount: payload.requestedAmount,
    risks: payload.risks,
  };
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ConversationMessage[];
  voice_id?: string;
  section?: number;
  /** The saved proposal being worked on, so the assistant can use its files. */
  proposal_id?: string;
}

export interface ChatSource {
  number: number;
  document_id: string;
  title: string;
  section?: string | null;
  page?: number | null;
  /** The shared library, or one of the proposal's own files. */
  origin?: 'library' | 'background' | 'attachment';
}

export interface ChatResponseBody {
  message: string;
  audio_base64?: string;
  field_updates?: Record<string, string>;
  /** Passages cited in the reply as [1], [2], ... */
  sources?: ChatSource[];
}

export interface TranscriptionResponse {
  text: string;
}

export interface SynthesisResponse {
  audio_base64: string;
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || FALLBACK_API_BASE_URL;

function buildUrl(path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

/** Called by the sign-in layer so every backend request carries the user's token. */
export function setAccessTokenProvider(provider: AccessTokenProvider | null) {
  accessTokenProvider = provider;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = accessTokenProvider ? await accessTokenProvider() : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(buildUrl(path), { ...init, headers });
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        if (typeof payload.detail === 'string') {
          detail = payload.detail;
        } else if (Array.isArray(payload.detail) && payload.detail.length > 0) {
          const first = payload.detail[0];
          detail = first?.msg ?? detail;
        }
      }
    } catch {
      // ignore parsing issues; fall back to status text
    }
    throw new Error(detail || 'Request failed');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('Unexpected response from server.');
  }
}

export interface DraftAnalysisResponse {
  sections: DraftAnalysis[];
  /** 'keywords' means the AI analysis was unavailable and a simple keyword check was used. */
  method: 'model' | 'keywords';
  /** True when only the start of a very long draft was analysed. */
  truncated: boolean;
  characters_analysed: number;
  characters_total: number;
}

export async function analyzeDraft(file: File): Promise<DraftAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/proposals/analyze', {
    method: 'POST',
    body: formData,
  });

  return handleResponse<DraftAnalysisResponse>(response);
}


export async function chatWithAssistant(
  payload: ChatRequestBody,
): Promise<ChatResponseBody> {
  const response = await apiFetch('/assist/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<ChatResponseBody>(response);
}

export async function transcribeAudio(
  file: Blob,
  filename = 'audio.webm',
): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append(
    'file',
    new File([file], filename, { type: file.type || 'audio/webm' }),
  );

  const response = await apiFetch('/assist/stt', {
    method: 'POST',
    body: formData,
  });

  return handleResponse<TranscriptionResponse>(response);
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
): Promise<SynthesisResponse> {
  const response = await apiFetch('/assist/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  return handleResponse<SynthesisResponse>(response);
}

export async function exportProposalDoc(
  payload: ProposalPayload,
  attachments: File[],
  /** A saved proposal's stored files are listed in the export. */
  proposalId?: string | null,
): Promise<Blob> {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(serializeProposalPayload(payload)));
  attachments.forEach((file) => {
    formData.append('attachments', file, file.name);
  });
  if (proposalId) formData.append('proposal_id', proposalId);

  const response = await apiFetch('/proposals/export', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = response.statusText || 'Request failed';
    try {
      const data = await response.json();
      if (data?.detail) {
        message = typeof data.detail === 'string' ? data.detail : message;
      }
    } catch {
      // ignore parse issues
    }
    throw new Error(message);
  }

  return response.blob();
}

export interface CurrentUser {
  id: string;
  email: string;
  is_admin: boolean;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await apiFetch('/me');
  return handleResponse<CurrentUser>(response);
}

export type DocumentScope = 'library' | 'personal';
/** 'stored' means kept but not searchable; 'ready' means the assistant can search it. */
export type DocumentStatus = 'stored' | 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
  id: string;
  scope: DocumentScope;
  title: string;
  filename: string;
  kind: string | null;
  doc_type: string | null;
  funder: string | null;
  size_bytes: number;
  status: DocumentStatus;
  error: string | null;
  chunk_count: number;
  created_at: string;
}

export interface DocumentUploadOptions {
  title?: string;
  docType?: string;
  funder?: string;
}

/** Read the error message from a failed response, whatever shape the detail takes. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === 'string') return detail;
    if (typeof detail?.message === 'string') return detail.message;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  } catch {
    // fall through to the status text
  }
  return response.statusText || 'Request failed';
}

export async function listDocuments(scope?: DocumentScope): Promise<KnowledgeDocument[]> {
  const response = await apiFetch(scope ? `/documents?scope=${scope}` : '/documents');
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as KnowledgeDocument[];
}

/** Add a document to the shared library (library admins only). */
export async function uploadDocument(
  file: File,
  options: DocumentUploadOptions = {},
): Promise<KnowledgeDocument> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('scope', 'library');
  if (options.title?.trim()) formData.append('title', options.title.trim());
  if (options.docType) formData.append('doc_type', options.docType);
  if (options.funder?.trim()) formData.append('funder', options.funder.trim());

  const response = await apiFetch('/documents', { method: 'POST', body: formData });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as KnowledgeDocument;
}

export async function reindexDocument(documentId: string): Promise<KnowledgeDocument> {
  const response = await apiFetch(`/documents/${documentId}/reindex`, { method: 'POST' });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as KnowledgeDocument;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await apiFetch(`/documents/${documentId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
}

/** A saved proposal as listed on the home page. */
export interface SavedProposalSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/** A saved proposal with its form data. */
export interface SavedProposal extends SavedProposalSummary {
  data: Record<string, unknown>;
}

export async function listProposals(): Promise<SavedProposalSummary[]> {
  const response = await apiFetch('/proposals');
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SavedProposalSummary[];
}

export async function getProposal(proposalId: string): Promise<SavedProposal> {
  const response = await apiFetch(`/proposals/${proposalId}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SavedProposal;
}

export async function createProposal(data: Record<string, unknown>): Promise<SavedProposal> {
  const response = await apiFetch('/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SavedProposal;
}

export async function saveProposal(proposalId: string, data: Record<string, unknown>): Promise<SavedProposal> {
  const response = await apiFetch(`/proposals/${proposalId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as SavedProposal;
}

export async function deleteProposal(proposalId: string): Promise<void> {
  const response = await apiFetch(`/proposals/${proposalId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export type FileRole = 'background' | 'attachment';

/** A file in the user's My files. */
export interface MyFile {
  id: string;
  title: string;
  filename: string;
  kind: string | null;
  size_bytes: number;
  status: DocumentStatus;
  error: string | null;
  created_at: string;
  /** How many of the user's proposals use this file. */
  used_in: number;
}

/** A file as one proposal uses it. */
export interface ProposalFile {
  document_id: string;
  title: string;
  filename: string;
  kind: string | null;
  size_bytes: number;
  status: DocumentStatus;
  error: string | null;
  role: FileRole;
  label: string | null;
  /** Whether the assistant may read this file in this proposal. */
  use_in_chat: boolean;
  added_at: string;
}

export interface ProposalFileOptions {
  role: FileRole;
  label?: string;
  useInChat?: boolean;
}

export async function listMyFiles(): Promise<MyFile[]> {
  const response = await apiFetch('/files');
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as MyFile[];
}

/** Keep a file in My files without adding it to a proposal. */
export async function uploadMyFile(file: File): Promise<MyFile> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await apiFetch('/files', { method: 'POST', body: formData });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as MyFile;
}

/** Delete a file from My files and from every proposal that uses it. */
export async function deleteMyFile(documentId: string): Promise<void> {
  const response = await apiFetch(`/files/${documentId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
}

export async function listProposalFiles(proposalId: string): Promise<ProposalFile[]> {
  const response = await apiFetch(`/proposals/${proposalId}/files`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as ProposalFile[];
}

/** Upload a new file: it is kept in My files and added to the proposal. */
export async function uploadProposalFile(
  proposalId: string,
  file: File,
  options: ProposalFileOptions,
): Promise<ProposalFile> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('role', options.role);
  if (options.label) formData.append('label', options.label);
  if (options.useInChat !== undefined) formData.append('use_in_chat', String(options.useInChat));
  const response = await apiFetch(`/proposals/${proposalId}/files/upload`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as ProposalFile;
}

/** Add a file that is already in My files to the proposal. */
export async function addFileToProposal(
  proposalId: string,
  documentId: string,
  options: ProposalFileOptions,
): Promise<ProposalFile> {
  const response = await apiFetch(`/proposals/${proposalId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      role: options.role,
      label: options.label,
      use_in_chat: options.useInChat,
    }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as ProposalFile;
}

/** Switch whether the assistant may read this file in this proposal. */
export async function setProposalFileUseInChat(
  proposalId: string,
  documentId: string,
  useInChat: boolean,
): Promise<ProposalFile> {
  const response = await apiFetch(`/proposals/${proposalId}/files/${documentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ use_in_chat: useInChat }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as ProposalFile;
}

/** Take a file out of the proposal. It stays in My files. */
export async function removeFileFromProposal(proposalId: string, documentId: string): Promise<void> {
  const response = await apiFetch(`/proposals/${proposalId}/files/${documentId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
}
