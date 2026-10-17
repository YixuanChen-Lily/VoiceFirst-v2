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

export interface ProposalResponse {
  message: string;
  proposal_id: string;
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
}

export interface ChatSource {
  number: number;
  document_id: string;
  title: string;
  section?: string | null;
  page?: number | null;
}

export interface ChatResponseBody {
  message: string;
  audio_base64?: string;
  field_updates?: Record<string, string>;
  /** Library passages cited in the reply as [1], [2], ... */
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

export async function analyzeDraft(file: File): Promise<DraftAnalysis[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/proposals/analyze', {
    method: 'POST',
    body: formData,
  });

  return handleResponse<DraftAnalysis[]>(response);
}

export async function submitProposal(payload: ProposalPayload): Promise<ProposalResponse> {
  const response = await apiFetch('/proposals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializeProposalPayload(payload)),
  });

  return handleResponse<ProposalResponse>(response);
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
): Promise<Blob> {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(serializeProposalPayload(payload)));
  attachments.forEach((file) => {
    formData.append('attachments', file, file.name);
  });

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

export type DocumentScope = 'library' | 'proposal';
export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
  id: string;
  scope: DocumentScope;
  proposal_id: string | null;
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
  scope?: DocumentScope;
  proposalId?: string;
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

export async function uploadDocument(
  file: File,
  options: DocumentUploadOptions = {},
): Promise<KnowledgeDocument> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('scope', options.scope ?? 'library');
  if (options.proposalId) formData.append('proposal_id', options.proposalId);
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
