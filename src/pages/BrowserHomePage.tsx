import { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Card, Descriptions, Empty, Modal, Space, Switch, Typography } from 'antd';
import { Eye, RotateCcw, Upload } from 'lucide-react';
import { useI18n } from '../i18n-context';
import { formatDate } from '../utils/format';

interface HomeSettings {
  enabled: boolean; revision: string; md5: string; fileName: string;
  fileCount: number; totalBytes: number; updatedAt: string;
}
interface Props {
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  canManage: boolean;
}
const ENDPOINT = '/admin/api/browser-home';
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

function useHomeSettings(api: Props['api']) {
  const { t } = useI18n();
  const { message } = App.useApp();
  const [settings, setSettings] = useState<HomeSettings>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setSettings(await api<HomeSettings>(ENDPOINT)); }
    catch { void message.error(t('browserHome.failed')); }
    finally { setLoading(false); }
  }, [api, message, t]);
  useEffect(() => { void reload(); }, [reload]);
  const save = async (options: RequestInit, suffix = '') => {
    if (busy) return;
    setBusy(true);
    try {
      setSettings(await api<HomeSettings>(ENDPOINT + suffix, options));
      void message.success(t(suffix ? 'browserHome.uploaded' : 'browserHome.updated'));
    } catch (error) {
      void message.error({ content: error instanceof Error ? error.message : t('browserHome.failed'),
        style: { maxWidth: 400, marginInline: 'auto' } });
    } finally { setBusy(false); }
  };
  const upload = (file: File) => {
    if (file.size > MAX_ZIP_BYTES) { void message.error(t('browserHome.tooLarge')); return; }
    void save({ method: 'POST', body: file, headers: { 'Content-Type': 'application/zip' } },
      `/archive?name=${encodeURIComponent(file.name)}`);
  };
  return { settings, busy, loading, reload, upload,
    enable: (enabled: boolean) => save({ method: 'PATCH', body: JSON.stringify({ enabled }) }) };
}

export function BrowserHomePage({ api, canManage }: Props) {
  const { t } = useI18n();
  const { settings, busy, loading, reload, upload, enable } = useHomeSettings(api);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  return <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <div><Typography.Title level={2}>{t('nav.browserHome')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('browserHome.description')}</Typography.Paragraph></div>
    <Card title={t('browserHome.uploadTitle')} loading={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph>{t('browserHome.uploadHint')}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">{t('browserHome.buildHint')}</Typography.Paragraph>
        {!settings?.revision ? <Empty description={t('browserHome.empty')} /> : <Descriptions column={1}>
          <Descriptions.Item label={t('browserHome.uploadTitle')}>
            {settings.fileName} · {t('browserHome.fileCount', { count: settings.fileCount })}
            {' · '}{(settings.totalBytes / 1024 / 1024).toFixed(2)} MB
          </Descriptions.Item>
          <Descriptions.Item label="MD5"><Typography.Text copyable>{settings.md5}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label={t('browserHome.updatedAt')}>{formatDate(settings.updatedAt)}</Descriptions.Item>
        </Descriptions>}
        <Space wrap>
          <Switch aria-label={t('browserHome.enabled')} checked={settings?.enabled ?? false}
            disabled={!canManage || busy || !settings?.revision} onChange={value => { void enable(value); }} />
          <span>{t('browserHome.enabled')}</span>
        </Space>
        <Typography.Paragraph type="secondary">{t('browserHome.cacheHint')}</Typography.Paragraph>
        <Space wrap>
          <input ref={input} type="file" accept=".zip,application/zip" hidden
            onChange={event => {
              const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(file);
            }} />
          {canManage && <Button type="primary" icon={<Upload size={16} />} loading={busy}
            onClick={() => input.current?.click()}>{t('browserHome.upload')}</Button>}
          <Button icon={<Eye size={16} />} disabled={!settings?.revision || busy}
            onClick={() => setPreview(true)}>{t('browserHome.preview')}</Button>
          {canManage && <Button icon={<RotateCcw size={16} />} disabled={!settings?.enabled || busy}
            onClick={() => { void enable(false); }}>{t('browserHome.restore')}</Button>}
          <Button disabled={busy} onClick={() => { void reload(); }}>{t('common.refresh')}</Button>
        </Space>
      </Space>
    </Card>
    <Modal open={preview} title={t('browserHome.preview')} footer={null} width={1000}
      onCancel={() => setPreview(false)} destroyOnClose>
      {preview && settings?.revision && <iframe title={t('browserHome.preview')}
        src={`/browser-home/site/${settings.revision}/index.html`} sandbox="allow-scripts"
        referrerPolicy="no-referrer" style={{ width: '100%', height: '65vh', border: 0 }} />}
    </Modal>
  </Space>;
}
