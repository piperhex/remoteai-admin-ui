export const fileSharingEndpoint = '/admin/api/file-sharing';

export type FileSharingApi = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  uploadedBytes: number;
  fingerprint: string;
  updatedAt: string;
}

export interface SharedFileLibrary {
  items: SharedFile[];
  chunkBytes: number;
  maxBytes: number;
  maxBatch: number;
}

export interface TransferInput {
  source: File;
  name: string;
  id?: string;
}

export class FileMismatch extends Error {}

export function validFileName(value: string) {
  const name = value.trim();
  return Boolean(name) && new TextEncoder().encode(name).length <= 200 && !name.endsWith('.')
    && !/[<>:"/\\|?*]|\p{Cc}/u.test(name);
}

export function progress(completed: number, total: number) {
  return completed === total ? 100 : Math.floor(100 * completed / total);
}

async function fingerprint(file: File, chunkBytes: number, signal: AbortSignal, onProgress: (value: number) => void) {
  const digestBytes = 32;
  const digests = new Uint8Array(Math.ceil(file.size / chunkBytes) * digestBytes);
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    signal.throwIfAborted();
    const end = Math.min(offset + chunkBytes, file.size);
    const data = await file.slice(offset, end).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', data);
    digests.set(new Uint8Array(digest), offset / chunkBytes * digestBytes);
    onProgress(progress(end, file.size));
  }
  const result = await crypto.subtle.digest('SHA-256', digests);
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
}

interface TransferOptions {
  api: FileSharingApi;
  chunkBytes: number;
  signal: AbortSignal;
  onCheck: (value: number) => void;
  onSaved: (item: SharedFile) => void;
}

export async function transferFile({ source, name, id }: TransferInput, options: TransferOptions) {
  const { api, chunkBytes, signal, onCheck, onSaved } = options;
  let item = id ? await api<SharedFile>(`${fileSharingEndpoint}/${id}`, { signal }) : undefined;
  if (item && item.size !== source.size) throw new FileMismatch();
  const digest = await fingerprint(source, chunkBytes, signal, onCheck);
  signal.throwIfAborted();
  if (item && item.fingerprint !== digest) throw new FileMismatch();
  item ??= await api<SharedFile>(fileSharingEndpoint, {
    method: 'POST', signal, body: JSON.stringify({ name, size: source.size, fingerprint: digest }),
  });
  onSaved(item);
  while (item.uploadedBytes < item.size) {
    const start: number = item.uploadedBytes;
    signal.throwIfAborted();
    item = await api<SharedFile>(`${fileSharingEndpoint}/${item.id}/chunks/${start / chunkBytes}`, {
      method: 'PUT', signal, headers: { 'Content-Type': 'application/octet-stream' },
      body: source.slice(start, start + chunkBytes),
    });
    if (item.uploadedBytes <= start) throw new Error();
    onSaved(item);
  }
}
