import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

import { deleteProposal, getProposal, listProposals, type SavedProposal, type SavedProposalSummary } from '../../lib/api';

interface MyProposalsProps {
  onOpen: (proposal: SavedProposal) => void;
}

function formatEdited(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The signed-in user's saved proposals. Shows nothing until there is at least one. */
export function MyProposals({ onOpen }: MyProposalsProps) {
  const [proposals, setProposals] = useState<SavedProposalSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProposals(await listProposals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your proposals.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleOpen = async (proposal: SavedProposalSummary) => {
    setBusyId(proposal.id);
    setError(null);
    try {
      onOpen(await getProposal(proposal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that proposal.');
      setBusyId(null);
    }
  };

  const handleDelete = async (proposal: SavedProposalSummary) => {
    if (!window.confirm(`Delete "${proposal.title}"? This cannot be undone.`)) return;
    setBusyId(proposal.id);
    setError(null);
    try {
      await deleteProposal(proposal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that proposal.');
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  if (proposals.length === 0 && !error) return null;

  return (
    <section aria-labelledby="my-proposals-heading">
      <h2 id="my-proposals-heading" className="text-2xl font-bold mb-4">
        Continue where you left off
      </h2>
      {error && (
        <p role="alert" className="mb-3 text-base text-red-700">
          {error}
        </p>
      )}
      <ul className="bg-white border border-line rounded-2xl divide-y divide-line">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5">
            <div className="min-w-0">
              <p className="font-bold truncate">{proposal.title}</p>
              <p className="text-base text-ink-muted">Edited {formatEdited(proposal.updated_at)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={busyId === proposal.id}
                onClick={() => handleOpen(proposal)}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-forest-tint text-forest-dark font-bold hover:bg-forest hover:text-white transition-colors disabled:opacity-60"
              >
                {busyId === proposal.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Open
              </button>
              <button
                type="button"
                disabled={busyId === proposal.id}
                onClick={() => handleDelete(proposal)}
                aria-label={`Delete ${proposal.title}`}
                title="Delete"
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-ink-muted hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
