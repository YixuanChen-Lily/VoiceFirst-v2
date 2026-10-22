import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Trash2 } from 'lucide-react';

import { deleteProposal, getProposal, listProposals, type SavedProposal, type SavedProposalSummary } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

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
    <Card className="border border-stone-200 mb-12">
      <CardContent className="p-6">
        <h2 className="text-stone-900 mb-4">My proposals</h2>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <ul className="divide-y divide-stone-100">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-stone-900 truncate">{proposal.title}</p>
                  <p className="text-xs text-stone-500">Last edited {formatEdited(proposal.updated_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  disabled={busyId === proposal.id}
                  onClick={() => handleOpen(proposal)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  {busyId === proposal.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === proposal.id}
                  onClick={() => handleDelete(proposal)}
                  className="text-red-600 hover:text-red-700"
                  aria-label={`Delete ${proposal.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
