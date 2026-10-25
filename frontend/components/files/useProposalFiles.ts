import { useCallback, useEffect, useRef, useState } from 'react';

import { useProposal } from '../../context/ProposalContext';
import {
  addFileToProposal,
  listProposalFiles,
  removeFileFromProposal,
  setProposalFileUseInChat,
  uploadProposalFile,
  type ProposalFile,
  type ProposalFileOptions,
} from '../../lib/api';

/** Replace a file in the list, or add it at the end. */
function upsert(files: ProposalFile[], file: ProposalFile): ProposalFile[] {
  const index = files.findIndex((item) => item.document_id === file.document_id);
  if (index === -1) return [...files, file];
  return files.map((item, i) => (i === index ? file : item));
}

/**
 * The current proposal's files, and the actions that change them. A new proposal is
 * saved first when a file is added, because files are linked to a saved proposal.
 */
export function useProposalFiles() {
  const { proposalId, ensureSaved } = useProposal();
  const [files, setFiles] = useState<ProposalFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // How many uploads or adds are running, and which file is being switched or removed.
  const [pendingAdds, setPendingAdds] = useState(0);
  const pendingAddsRef = useRef(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string | null) => {
    if (!id) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const loaded = await listProposalFiles(id);
      // A list fetched while a file is being added may not include it yet; keep it.
      setFiles((prev) =>
        pendingAddsRef.current > 0
          ? [...loaded, ...prev.filter((item) => !loaded.some((file) => file.document_id === item.document_id))]
          : loaded,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the files.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(proposalId);
  }, [proposalId, refresh]);

  /** Run a change; on failure show why and reload, since the server may have kept part of it. */
  const run = async <T,>(action: (id: string) => Promise<T>): Promise<T | null> => {
    setError(null);
    let id: string | null = proposalId;
    try {
      id = await ensureSaved();
      return await action(id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
      await refresh(id);
      return null;
    }
  };

  const add = async (action: (id: string) => Promise<ProposalFile>) => {
    pendingAddsRef.current += 1;
    setPendingAdds(pendingAddsRef.current);
    const added = await run(action);
    if (added) setFiles((prev) => upsert(prev, added));
    pendingAddsRef.current -= 1;
    setPendingAdds(pendingAddsRef.current);
  };

  const upload = (file: File, options: ProposalFileOptions) =>
    add((id) => uploadProposalFile(id, file, options));

  const addExisting = (documentId: string, options: ProposalFileOptions) =>
    add((id) => addFileToProposal(id, documentId, options));

  const setUseInChat = async (documentId: string, useInChat: boolean) => {
    setBusyId(documentId);
    const updated = await run((id) => setProposalFileUseInChat(id, documentId, useInChat));
    setBusyId(null);
    if (updated) setFiles((prev) => upsert(prev, updated));
  };

  const remove = async (documentId: string) => {
    setBusyId(documentId);
    const done = await run(async (id) => {
      await removeFileFromProposal(id, documentId);
      return true;
    });
    setBusyId(null);
    if (done) setFiles((prev) => prev.filter((item) => item.document_id !== documentId));
  };

  return {
    files,
    isLoading,
    isAdding: pendingAdds > 0,
    busyId,
    error,
    upload,
    addExisting,
    setUseInChat,
    remove,
  };
}

export type ProposalFiles = ReturnType<typeof useProposalFiles>;
