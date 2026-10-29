import React, { useState } from 'react';
import { FolderOpen, Loader2, Plus } from 'lucide-react';

import { listMyFiles, type MyFile, type ProposalFileOptions } from '../../lib/api';
import { formatDate, formatSize } from '../../lib/format';
import { Button } from '../ui/button';
import type { ProposalFiles } from './useProposalFiles';

interface AddFromMyFilesProps {
  actions: ProposalFiles;
  /** How a file picked here is used in the proposal. */
  options: ProposalFileOptions;
}

/** Pick a file uploaded before (for any proposal) instead of uploading it again. */
export function AddFromMyFiles({ actions, options }: AddFromMyFilesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [myFiles, setMyFiles] = useState<MyFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setIsOpen(true);
    setError(null);
    try {
      setMyFiles(await listMyFiles());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load My files.');
    }
  };

  const inProposal = new Set(actions.files.map((file) => file.document_id));
  const available = (myFiles ?? []).filter((file) => !inProposal.has(file.id));

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={open}>
        <FolderOpen className="w-4 h-4" />
        Add from My files
      </Button>
    );
  }

  return (
    <div className="p-3 bg-white rounded-xl border border-line space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-ink">Files you uploaded before</p>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>
      {error && <p className="text-base text-[#A4462E]">{error}</p>}
      {myFiles === null && !error && <p className="text-base text-ink-muted">Loading…</p>}
      {myFiles !== null && available.length === 0 && (
        <p className="text-base text-ink-muted">
          {myFiles.length === 0 ? 'You have no files yet.' : 'All your files are already in this proposal.'}
        </p>
      )}
      <ul className="space-y-1">
        {available.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-ink">
              {file.filename}
              <span className="text-sm text-ink-muted">
                {' '}
                · {formatSize(file.size_bytes)} · added {formatDate(file.created_at)}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 flex-shrink-0"
              disabled={actions.isAdding}
              onClick={() => actions.addExisting(file.id, options)}
            >
              {actions.isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
