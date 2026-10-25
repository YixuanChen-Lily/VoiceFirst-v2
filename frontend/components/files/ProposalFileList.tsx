import React from 'react';
import { FileText, Loader2, X } from 'lucide-react';

import type { ProposalFile } from '../../lib/api';
import { formatSize } from '../../lib/format';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import type { ProposalFiles } from './useProposalFiles';

interface ProposalFileListProps {
  files: ProposalFile[];
  actions: ProposalFiles;
  emptyText: string;
}

/** What the assistant can do with a file in this proposal, in plain words. */
function accessText(file: ProposalFile): { text: string; tone: string } {
  if (file.use_in_chat && file.status === 'ready') {
    return { text: 'The assistant can read this file.', tone: 'text-emerald-700' };
  }
  if (file.use_in_chat && file.status === 'processing') {
    return { text: 'Preparing for the assistant…', tone: 'text-amber-700' };
  }
  if (file.use_in_chat) {
    return {
      text: "Couldn't prepare this file for the assistant. Switch it off and on again to retry.",
      tone: 'text-red-700',
    };
  }
  if (file.error) return { text: file.error, tone: 'text-red-700' };
  return { text: 'Stored with the proposal. The assistant only knows its name.', tone: 'text-stone-500' };
}

export function ProposalFileList({ files, actions, emptyText }: ProposalFileListProps) {
  if (files.length === 0) {
    return <p className="text-sm text-stone-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => {
        const busy = actions.busyId === file.document_id;
        const access = accessText(file);
        const switchId = `use-in-chat-${file.document_id}`;
        return (
          <li key={file.document_id} className="p-3 bg-white rounded border border-stone-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  {file.label && <p className="text-sm text-stone-900">{file.label}</p>}
                  <p className={`truncate ${file.label ? 'text-xs text-stone-500' : 'text-sm text-stone-900'}`}>
                    {file.filename} · {formatSize(file.size_bytes)}
                  </p>
                  <p className={`text-xs mt-1 ${access.tone}`}>{access.text}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => actions.remove(file.document_id)}
                title="Remove from this proposal (it stays in My files)"
                aria-label={`Remove ${file.filename} from this proposal`}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </Button>
            </div>
            {file.role === 'attachment' && (
              <div className="flex items-center gap-2 mt-2 pl-6">
                <Checkbox
                  id={switchId}
                  checked={file.use_in_chat}
                  disabled={busy}
                  onCheckedChange={(checked) => actions.setUseInChat(file.document_id, checked === true)}
                />
                <label htmlFor={switchId} className="text-xs text-stone-700 cursor-pointer">
                  Let the assistant use this file
                </label>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
