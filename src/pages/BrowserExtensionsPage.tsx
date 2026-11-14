import { useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Popconfirm, Popover, Space, Tag, Typography, Upload } from 'antd';
import { PackagePlus, Puzzle, RefreshCw, Search, Trash2, UploadCloud } from 'lucide-react';
import { useI18n } from '../i18n-context';
import { formatDate } from '../utils/format';
import { useBrowserExtensions, type ExtensionPageProps } from './browser-extensions/useBrowserExtensions';
import './browser-extensions/styles.css';

export function BrowserExtensionsPage({ api, canManage }: ExtensionPageProps) {
  const { t } = useI18n();
  const extensions = useBrowserExtensions(api);
  const [query, setQuery] = useState('');
  const replacement = useRef<string>(), input = useRef<HTMLInputElement>(null);
  const items = extensions.items.filter(item => `${item.name} ${item.description}`
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Space direction="vertical" size="large" className="admin-browser-extensions">
    <div><Typography.Title level={2}>{t('nav.browserExtensions')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('browserExtensions.description')}</Typography.Paragraph></div>
    {canManage && <Upload.Dragger accept=".zip,.crx" multiple={false} showUploadList={false}
      disabled={extensions.busy} beforeUpload={file => { extensions.upload(file); return false; }}>
      <UploadCloud size={28} className="admin-extension-upload-icon" />
      <Typography.Paragraph strong>{t('browserExtensions.upload')}</Typography.Paragraph>
      <Typography.Text type="secondary">{t('browserExtensions.hint')}</Typography.Text>
    </Upload.Dragger>}
    <Card loading={extensions.loading} title={t('nav.browserExtensions')}
      extra={<Button type="text" icon={<RefreshCw size={16} />} aria-label={t('common.refresh')}
        disabled={extensions.busy || extensions.loading} onClick={() => void extensions.reload()} />}>
      {extensions.error && <Alert type="error" showIcon message={t('browserExtensions.failed')} />}
      <Input allowClear prefix={<Search size={16} />} value={query} placeholder={t('browserExtensions.search')}
        aria-label={t('browserExtensions.search')} onChange={event => setQuery(event.target.value)} />
      <div className="admin-extension-list">
        {items.map(item => <div key={item.id} className="admin-extension-row">
          <span className="admin-extension-avatar">{item.icon
            ? <img src={item.icon} alt="" /> : <Puzzle size={26} />}</span>
          <div className="admin-extension-details">
            <Space wrap size={8}><Typography.Text strong>{item.name}</Typography.Text>
              <Typography.Text type="secondary">{item.version}</Typography.Text>
              <Tag bordered={false} color={item.published ? 'success' : 'default'}>
                {t(item.published ? 'browserExtensions.published' : 'browserExtensions.draft')}</Tag></Space>
            {item.description && <Typography.Paragraph type="secondary">{item.description}</Typography.Paragraph>}
            <Space wrap size={12}><Typography.Text type="secondary">
              {(item.size / 1024 / 1024).toFixed(2)} MB · {formatDate(item.updatedAt)}</Typography.Text>
              <Popover trigger="click" title={t('browserExtensions.permissions')}
                styles={{ root: { maxWidth: 400 }, body: { maxWidth: 400, overflowWrap: 'anywhere' } }}
                content={item.permissions.length ? item.permissions.join(', ') : t('browserExtensions.none')}>
                <Button size="small" type="text">{t('browserExtensions.permissions')}</Button></Popover></Space>
          </div>
          {canManage && <Space wrap className="admin-extension-actions">
            <Button disabled={extensions.busy} type={item.published ? 'default' : 'primary'}
              onClick={() => void extensions.publish(item.id, !item.published)}>
              {t(item.published ? 'browserExtensions.unpublish' : 'browserExtensions.publish')}</Button>
            <Popover trigger="hover" content={t('browserExtensions.replaceHint')}
              styles={{ root: { maxWidth: 400 }, body: { maxWidth: 400 } }}>
              <Button disabled={extensions.busy} icon={<PackagePlus size={16} />}
                aria-label={t('browserExtensions.replace') + ': ' + item.name}
                onClick={() => { replacement.current = item.id; input.current?.click(); }} />
            </Popover>
            <Popconfirm title={t('browserExtensions.removeConfirm')}
              styles={{ root: { maxWidth: 400 }, body: { maxWidth: 400 } }}
              onConfirm={() => extensions.remove(item.id)}>
              <Button danger type="text" disabled={extensions.busy} icon={<Trash2 size={16} />}
                aria-label={t('browserExtensions.remove') + ': ' + item.name} />
            </Popconfirm>
          </Space>}
        </div>)}
        {!items.length && !extensions.error && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('browserExtensions.empty')} />}
      </div>
    </Card>
    <input ref={input} type="file" accept=".zip,.crx" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file && replacement.current) extensions.upload(file, replacement.current);
      replacement.current = undefined;
    }} />
  </Space>;
}
