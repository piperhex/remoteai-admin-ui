import { useCallback, useEffect, useRef, useState } from 'react';
import type { Translate, TranslationKey } from '../../i18n';
import {
  FileMismatch, fileSharingEndpoint, transferFile, uploadProgress,
  type FileSharingApi, type SharedFile, type SharedFileLibrary, type TransferInput,
} from './transfer';

interface TransferActivity {
  id?: string;
  name: string;
  percent: number;
  phase: 'fileSharing.checking' | 'fileSharing.uploading';
}

const visibleErrors = [
  'fileSharing.fileMismatch', 'fileSharing.invalidName', 'fileSharing.missing', 'fileSharing.tooLarge',
] as const;

function transferError(t: Translate, reason: unknown): TranslationKey {
  if (reason instanceof FileMismatch) return 'fileSharing.fileMismatch';
  const match = reason instanceof Error && visibleErrors.find(key => t(key) === reason.message);
  return match || 'fileSharing.interrupted';
}

export function useFileSharing(api: FileSharingApi, t: Translate) {
  const [library, setLibrary] = useState<SharedFileLibrary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TranslationKey>();
  const [activity, setActivity] = useState<TransferActivity>();
  const activeTransfer = useRef<AbortController>();
  const lifecycle = useRef<AbortController>();

  const reload = useCallback(async () => {
    const signal = lifecycle.current?.signal;
    setLoading(true);
    try {
      const data = await api<SharedFileLibrary>(fileSharingEndpoint, { signal });
      if (!signal?.aborted) setLibrary(data);
    } catch {
      if (!signal?.aborted) setError(previous => previous ?? 'fileSharing.failed');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    void reload();
    return () => { controller.abort(); activeTransfer.current?.abort(); };
  }, [reload]);

  function recordSaved(item: SharedFile) {
    setLibrary(data => {
      if (!data) return data;
      const items = data.items.some(row => row.id === item.id)
        ? data.items.map(row => row.id === item.id ? item : row) : [item, ...data.items];
      return { ...data, items };
    });
    setActivity({ id: item.id, name: item.name, phase: 'fileSharing.uploading',
      percent: uploadProgress(item) });
  }

  async function start(input: TransferInput) {
    if (!library || activeTransfer.current) return;
    const scope = lifecycle.current?.signal;
    const controller = new AbortController();
    activeTransfer.current = controller;
    setError(undefined);
    setActivity({ id: input.id, name: input.name, phase: 'fileSharing.checking', percent: 0 });
    try {
      await transferFile(input, { api, chunkBytes: library.chunkBytes, uploadWindow: library.uploadWindow,
        signal: controller.signal, onSaved: recordSaved,
        onCheck: percent => setActivity(current => current && { ...current, percent }) });
    } catch (reason) {
      if (!controller.signal.aborted) setError(transferError(t, reason));
      if (!scope?.aborted) await reload();
    } finally {
      activeTransfer.current = undefined;
      if (!scope?.aborted) setActivity(undefined);
    }
  }

  return { library, loading, error, setError, activity, reload, start, pause: () => activeTransfer.current?.abort() };
}
