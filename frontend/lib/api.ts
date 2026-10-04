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

export interface ChatResponseBody {
  message: string;
  audio_base64?: string;
  field_updates?: Record<string, string>;
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

  const response = await fetch(buildUrl('/proposals/analyze'), {
    method: 'POST',
    body: formData,
  });

  return handleResponse<DraftAnalysis[]>(response);
}

export async function submitProposal(payload: ProposalPayload): Promise<ProposalResponse> {
  const response = await fetch(buildUrl('/proposals'), {
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
  const response = await fetch(buildUrl('/assist/chat'), {
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

  const response = await fetch(buildUrl('/assist/stt'), {
    method: 'POST',
    body: formData,
  });

  return handleResponse<TranscriptionResponse>(response);
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
): Promise<SynthesisResponse> {
  const response = await fetch(buildUrl('/assist/tts'), {
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

  const response = await fetch(buildUrl('/proposals/export'), {
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
