import { useRef, useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Progress, Typography } from 'antd';
import { RefreshCw, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../i18n-context';
import { FileSharingTable } from './file-sharing/FileSharingTable';
import { fileSharingEndpoint, validFileName, type FileSharingApi, type SharedFile } from './file-sharing/transfer';
import { useFileSharing } from './file-sharing/useFileSharing';
import './file-sharing/styles.css';

type NameDialog = { source: File; name: string } | { item: SharedFile; name: string };

export function FileSharingPage({ api, canManage }: { api: FileSharingApi; canManage: boolean }) {
  const { t } = useI18n();
  const { message } = App.useApp();
  const sharing = useFileSharing(api, t);
  const input = useRef<HTMLInputElement>(null);
  const resumeItem = useRef<SharedFile>();
  const [selection, setSelection] = useState<string[]>([]);
  const [nameDialog, setNameDialog] = useState<NameDialog>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string>();
  const items = sharing.library?.items ?? [];
  const selectionSet = new Set(selection);
  const selected = items.filter(item => selectionSet.has(item.id)).map(item => item.id);
  const busy = saving || Boolean(sharing.activity);

  function openPicker(item?: SharedFile) {
    resumeItem.current = item;
    input.current?.click();
  }

  function chooseFile(source?: File) {
    const item = resumeItem.current;
    resumeItem.current = undefined;
    if (!source || !sharing.library) return;
    if (source.size > sharing.library.maxBytes) {
      sharing.setError('fileSharing.tooLarge');
    } else if (item) {
      void sharing.start({ source, name: item.name, id: item.id });
    } else {
      setNameDialog({ source, name: source.name });
    }
  }

  async function submitName() {
    if (!nameDialog || !validFileName(nameDialog.name)) return;
    const name = nameDialog.name.trim();
    if ('source' in nameDialog) {
      setNameDialog(undefined);
      void sharing.start({ source: nameDialog.source, name });
      return;
    }
    if (await mutate(`${fileSharingEndpoint}/${nameDialog.item.id}`, 'PATCH', { name })) setNameDialog(undefined);
  }

  async function mutate(path: string, method: string, body: object) {
    setSaving(true);
    sharing.setError(undefined);
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await sharing.reload();
      return true;
    } catch {
      void message.error({ content: t('fileSharing.failed'), style: { maxWidth: 400, marginInline: 'auto' } });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (await mutate(`${fileSharingEndpoint}/batch/delete`, 'POST', { ids: selected })) {
      setSelection([]);
      setDeleteOpen(false);
    }
  }

  async function copyLink(item: SharedFile) {
    const url = new URL(`/shared-files/${item.id}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      void message.success({ key: 'file-sharing-copied', content: t('fileSharing.copied') });
    } catch {
      setLink(url);
    }
  }

  const nameTitle = nameDialog && 'item' in nameDialog ? 'fileSharing.rename' : 'fileSharing.upload';
  const invalidName = Boolean(nameDialog && !validFileName(nameDialog.name));
  const activity = sharing.activity;
  return <section className="file-sharing">
    <div className="file-sharing-heading">
      <div>
        <Typography.Title level={2}>{t('nav.fileSharing')}</Typography.Title>
        <Typography.Text type="secondary">{t('fileSharing.description')}</Typography.Text>
      </div>
      {canManage && <Button type="primary" icon={<Upload size={16} />} disabled={busy || !sharing.library}
        onClick={() => openPicker()}>{t('fileSharing.upload')}</Button>}
    </div>
    {sharing.error && <Alert type="error" showIcon closable
      message={<span className="file-sharing-alert-text">{t(sharing.error)}</span>}
      onClose={() => sharing.setError(undefined)} />}
    {activity && <Card size="small">
      <div className="file-sharing-activity">
        <div role="status" className="file-sharing-name">
          <Typography.Text strong>{activity.name}</Typography.Text>
          <div><Typography.Text type="secondary">{t(activity.phase)}</Typography.Text></div>
        </div>
        <Button onClick={sharing.pause}>{t(activity.id ? 'fileSharing.pause' : 'common.cancel')}</Button>
      </div>
      <Progress percent={activity.percent} size="small" />
    </Card>}
    <Card size="small">
      <div className="file-sharing-toolbar">
        <Button icon={<RefreshCw size={15} />} disabled={busy || sharing.loading} onClick={() => {
          sharing.setError(undefined);
          void sharing.reload();
        }}>{t('common.refresh')}</Button>
        {canManage && <Button danger icon={<Trash2 size={15} />} disabled={busy || !selected.length}
          onClick={() => setDeleteOpen(true)}>{t('fileSharing.remove', { count: selected.length })}</Button>}
      </div>
      <FileSharingTable items={items} loading={sharing.loading} canManage={canManage} busy={busy}
        activeId={activity?.phase === 'fileSharing.uploading' ? activity.id : undefined}
        selection={selected} selectionLimit={sharing.library?.maxBatch ?? 0} onSelect={setSelection}
        onCopy={copyLink} onRename={item => setNameDialog({ item, name: item.name })} onResume={openPicker} />
    </Card>
    {canManage && <input ref={input} type="file" hidden onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      chooseFile(file);
    }} />}
    <Modal title={t(nameTitle)} open={Boolean(nameDialog)} width={440} confirmLoading={saving}
      okText={t(nameDialog && 'item' in nameDialog ? 'common.save' : 'fileSharing.upload')}
      cancelText={t('common.cancel')} okButtonProps={{ disabled: invalidName }}
      onCancel={() => { if (!saving) setNameDialog(undefined); }} onOk={() => void submitName()}>
      <label>
        <Typography.Text>{t('fileSharing.name')}</Typography.Text>
        <Input autoFocus value={nameDialog?.name ?? ''} disabled={saving} status={invalidName ? 'error' : undefined}
          onChange={event => {
            const name = event.target.value;
            setNameDialog(current => current && { ...current, name });
          }} onPressEnter={() => { if (!saving) void submitName(); }} />
      </label>
      {invalidName && <Typography.Text type="danger">{t('fileSharing.invalidName')}</Typography.Text>}
    </Modal>
    <Modal title={t('fileSharing.removeTitle')} open={deleteOpen} width={440} confirmLoading={saving}
      onCancel={() => { if (!saving) setDeleteOpen(false); }} onOk={() => void removeSelected()}
      okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
      <div style={{ maxWidth: 400 }}>{t('fileSharing.removeConfirm', { count: selected.length })}</div>
    </Modal>
    <Modal title={t('fileSharing.link')} open={Boolean(link)} width={440} onCancel={() => setLink(undefined)}
      footer={<Button onClick={() => setLink(undefined)}>{t('common.close')}</Button>}>
      <Input readOnly aria-label={t('fileSharing.link')} value={link ?? ''}
        onFocus={event => event.currentTarget.select()} />
    </Modal>
  </section>;
}
