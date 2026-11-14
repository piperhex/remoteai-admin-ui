import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { useI18n } from '../../i18n-context';

export interface ExtensionItem {
  id: string; name: string; description: string; version: string; icon: string;
  permissions: string[]; sha256: string; size: number; published: boolean; updatedAt: string;
}
export interface ExtensionPageProps {
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  canManage: boolean;
}
const ENDPOINT = '/admin/api/browser-extensions';
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;

export function useBrowserExtensions(api: ExtensionPageProps['api']) {
  const { t } = useI18n(), { message } = App.useApp();
  const [items, setItems] = useState<ExtensionItem[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const working = useRef(false), generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError(false);
    try {
      const result = await api<{ items: ExtensionItem[] }>(ENDPOINT);
      if (current === generation.current) setItems(result.items);
    } catch { if (current === generation.current) setError(true); }
    finally { if (current === generation.current) setLoading(false); }
  }, [api]);
  useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
  const mutate = async (suffix: string, options: RequestInit) => {
    if (working.current) return;
    working.current = true; setBusy(true);
    try {
      const item = await api<ExtensionItem>(ENDPOINT + suffix, options);
      if (options.method === 'DELETE') setItems(rows => rows.filter(row => '/' + row.id !== suffix));
      else setItems(rows => [item, ...rows.filter(row => row.id !== item.id)]);
      void message.success(t(options.method === 'POST' ? 'browserExtensions.uploaded' : 'browserExtensions.saved'));
    } catch (reason) {
      void message.error({ content: reason instanceof Error ? reason.message : t('browserExtensions.failed'),
        style: { maxWidth: 400, marginInline: 'auto' } });
    } finally { working.current = false; setBusy(false); }
  };
  const upload = (file: File, id?: string) => {
    if (file.size > MAX_PACKAGE_BYTES) { void message.error(t('browserExtensions.tooLarge')); return; }
    void mutate(id ? `/${id}/archive` : '', {
      method: 'POST', body: file, headers: { 'Content-Type': 'application/zip' },
    });
  };
  return { items, loading, busy, error, reload, upload,
    publish: (id: string, published: boolean) => mutate('/' + id, {
      method: 'PATCH', body: JSON.stringify({ published }),
    }),
    remove: (id: string) => mutate('/' + id, { method: 'DELETE' }),
  };
}
