import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import {
  deleteDocument,
  listDocuments,
  reindexDocument,
  uploadDocument,
  type KnowledgeDocument,
} from '../../lib/api';
import { formatDate, formatSize } from '../../lib/format';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SubPage } from '../layout/SubPage';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface LibraryPageProps {
  onBack: () => void;
}

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'guideline', label: 'Program guideline' },
  { value: 'policy', label: 'Policy' },
  { value: 'funder_program', label: 'Funder program description' },
  { value: 'template', label: 'Template or example' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map(({ value, label }) => [value, label]),
);

function StatusBadge({ document }: { document: KnowledgeDocument }) {
  if (document.status === 'ready') {
    return <Badge className="bg-forest-tint text-forest-dark border-forest/20">Ready</Badge>;
  }
  if (document.status === 'processing') {
    return <Badge className="bg-ochre-tint text-ochre-text border-ochre/30">Processing</Badge>;
  }
  return (
    <Badge className="bg-red-100 text-red-800 border-red-200" title={document.error ?? undefined}>
      Failed
    </Badge>
  );
}

export function LibraryPage({ onBack }: LibraryPageProps) {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value);
  const [funder, setFunder] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments('library'));
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load the library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setNotice(null);
    try {
      const uploaded = await uploadDocument(file, { title, docType, funder });
      setNotice(`"${uploaded.title}" was added and split into ${uploaded.chunk_count} passages.`);
      setFile(null);
      setTitle('');
      setFunder('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The upload failed.');
    } finally {
      setIsUploading(false);
      await refresh();
    }
  };

  const handleDelete = async (document: KnowledgeDocument) => {
    if (!window.confirm(`Remove "${document.title}" from the library? This cannot be undone.`)) return;
    setBusyId(document.id);
    setNotice(null);
    try {
      await deleteDocument(document.id);
      setNotice(`"${document.title}" was removed.`);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not remove the document.');
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  const handleReindex = async (document: KnowledgeDocument) => {
    setBusyId(document.id);
    setNotice(null);
    try {
      const updated = await reindexDocument(document.id);
      setNotice(`"${updated.title}" was processed again into ${updated.chunk_count} passages.`);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not process the document again.');
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  return (
    <SubPage
      title="Document library"
      onBack={onBack}
      description={
        <>
          Guidelines, policies and funder documents that the assistant can draw on for every proposal.
          {isAdmin ? '' : ' Library administrators add and remove documents.'}
        </>
      }
    >
        {isAdmin && (
          <Card className="border border-line mb-8">
            <CardContent className="p-6">
              <h2 className="text-ink mb-4">Add a document</h2>
              <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="library-file">File (PDF, Word .docx, Excel .xlsx or text, up to 20 MB)</Label>
                  <Input
                    id="library-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.txt,.md,.csv"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="library-title">Title (optional)</Label>
                  <Input
                    id="library-title"
                    placeholder="Defaults to the file name"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="library-funder">Funder or program (optional)</Label>
                  <Input
                    id="library-funder"
                    placeholder="e.g. Indigenous Services Canada"
                    value={funder}
                    onChange={(event) => setFunder(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="library-type">Type</Label>
                  <select
                    id="library-type"
                    value={docType}
                    onChange={(event) => setDocType(event.target.value)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-sm text-ink"
                  >
                    {DOCUMENT_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={!file || isUploading}
                    className="w-full bg-forest hover:bg-forest-dark text-white gap-2"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isUploading ? 'Uploading and indexing…' : 'Add to library'}
                  </Button>
                </div>
                {uploadError && (
                  <p role="alert" className="md:col-span-2 text-sm text-red-700">
                    {uploadError}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {notice && (
          <p role="status" className="mb-4 text-sm text-forest-dark bg-forest-tint border border-forest/20 rounded-lg px-4 py-2">
            {notice}
          </p>
        )}
        {listError && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {listError}
          </p>
        )}

        <Card className="border border-line">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-8 text-center text-ink-muted">Loading…</p>
            ) : documents.length === 0 ? (
              <div className="p-10 text-center text-ink-muted">
                <FileText className="w-8 h-8 mx-auto mb-3 text-ink-muted" />
                <p>The library is empty.</p>
                {isAdmin && <p className="text-sm mt-1">Add a guideline or policy above to get started.</p>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Funder</TableHead>
                    <TableHead>Passages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="text-ink">{document.title}</div>
                        <div className="text-xs text-ink-muted">
                          {document.filename} · {formatSize(document.size_bytes)}
                        </div>
                      </TableCell>
                      <TableCell>{TYPE_LABELS[document.doc_type ?? ''] ?? '—'}</TableCell>
                      <TableCell>{document.funder ?? '—'}</TableCell>
                      <TableCell>{document.chunk_count}</TableCell>
                      <TableCell>
                        <StatusBadge document={document} />
                      </TableCell>
                      <TableCell>{formatDate(document.created_at)}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === document.id}
                            onClick={() => handleReindex(document)}
                            title="Process this document again"
                            className="gap-1 text-ink-muted"
                          >
                            <RefreshCw className={`w-4 h-4 ${busyId === document.id ? 'animate-spin' : ''}`} />
                            Re-process
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === document.id}
                            onClick={() => handleDelete(document)}
                            className="gap-1 text-red-700 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </SubPage>
  );
}
