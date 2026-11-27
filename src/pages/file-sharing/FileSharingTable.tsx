import { Button, Progress, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { Copy, Pencil, Upload } from 'lucide-react';
import { useI18n } from '../../i18n-context';
import { formatDate } from '../../utils/format';
import { uploadProgress, type SharedFile } from './transfer';

interface Props {
  items: SharedFile[];
  loading: boolean;
  canManage: boolean;
  busy: boolean;
  activeId?: string;
  selection: string[];
  selectionLimit: number;
  onSelect: (ids: string[]) => void;
  onCopy: (item: SharedFile) => void;
  onRename: (item: SharedFile) => void;
  onResume: (item: SharedFile) => void;
}

const units = ['B', 'KiB', 'MiB', 'GiB'] as const;

function formatSize(bytes: number, language: string) {
  const power = bytes === 0 ? 0 : Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
  const amount = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(bytes / 1024 ** power);
  return `${amount} ${units[power]}`;
}

export function FileSharingTable({ items, loading, canManage, busy, activeId, selection, selectionLimit,
  onSelect, onCopy, onRename, onResume }: Props) {
  const { language, t } = useI18n();
  return <Table<SharedFile> rowKey="id" dataSource={items} loading={loading && !items.length}
    scroll={{ x: 620 }} rowSelection={canManage ? {
      selectedRowKeys: selection,
      onChange: keys => onSelect(keys.map(String).slice(0, selectionLimit)),
      getCheckboxProps: item => ({ disabled: busy || (selection.length >= selectionLimit && !selection.includes(item.id)) }),
    } : undefined}
    pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
    locale={{ emptyText: t('fileSharing.empty') }} columns={[
      { title: t('fileSharing.name'), dataIndex: 'name', render: (name: string) => (
        <Typography.Text strong className="file-sharing-name">{name}</Typography.Text>
      ) },
      { title: t('fileSharing.size'), dataIndex: 'size', width: 98, responsive: ['sm'],
        render: size => formatSize(size, language) },
      { title: t('fileSharing.status'), width: 156, render: (_, item) => item.uploadedBytes === item.size
        ? <Tag color="success">{t('fileSharing.ready')}</Tag>
        : <div>
            <Typography.Text type="secondary">
              {t(item.id === activeId ? 'fileSharing.uploading' : 'fileSharing.waiting')}
            </Typography.Text>
            <Progress size="small" percent={uploadProgress(item)} />
          </div> },
      { title: t('fileSharing.updatedAt'), width: 180, responsive: ['xl'],
        render: (_, item) => formatDate(item.updatedAt, language) },
      { title: t('common.actions'), width: canManage ? 170 : 130, render: (_, item) => (
        <Space wrap size={4} className="file-sharing-actions">
          {item.uploadedBytes === item.size && <Button type="text" size="small" icon={<Copy size={14} />}
            onClick={() => onCopy(item)}>{t('fileSharing.copy')}</Button>}
          {canManage && item.uploadedBytes < item.size && <Tooltip title={t('fileSharing.resumeHint')}
            styles={{ root: { maxWidth: 400 } }}>
            <Button type="text" size="small" icon={<Upload size={14} />} disabled={busy}
              onClick={() => onResume(item)}>{t('fileSharing.resume')}</Button>
          </Tooltip>}
          {canManage && <Tooltip title={t('fileSharing.rename')}>
            <Button type="text" size="small" icon={<Pencil size={14} />} disabled={busy}
              aria-label={t('fileSharing.rename')} onClick={() => onRename(item)} />
          </Tooltip>}
        </Space>
      ) },
    ]} />;
}
