export const fileSharingEndpoint = '/admin/api/file-sharing';

export type FileSharingApi = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  uploadedBytes: number;
  receivedBytes?: number;
  receivedChunks?: number[];
  fingerprint: string;
  updatedAt: string;
}

export interface SharedFileLibrary {
  items: SharedFile[];
  chunkBytes: number;
  maxBytes: number;
  maxBatch: number;
  uploadWindow?: number;
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

export function uploadProgress(item: SharedFile) {
  if (item.uploadedBytes === item.size) return 100;
  return Math.min(99, progress(item.receivedBytes ?? item.uploadedBytes, item.size));
}

const digestBytes = 32;

function hexDigest(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprint(file: File, chunkBytes: number, signal: AbortSignal, onProgress: (value: number) => void) {
  const digests = new Uint8Array(Math.ceil(file.size / chunkBytes) * digestBytes);
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    signal.throwIfAborted();
    const end = Math.min(offset + chunkBytes, file.size);
    const data = await file.slice(offset, end).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', data);
    digests.set(new Uint8Array(digest), offset / chunkBytes * digestBytes);
    onProgress(progress(end, file.size));
  }
  const hash = await crypto.subtle.digest('SHA-256', digests);
  return { hash: hexDigest(new Uint8Array(hash)), digests };
}

interface TransferOptions {
  api: FileSharingApi;
  chunkBytes: number;
  uploadWindow?: number;
  signal: AbortSignal;
  onCheck: (value: number) => void;
  onSaved: (item: SharedFile) => void;
}

export async function transferFile({ source, name, id }: TransferInput, options: TransferOptions) {
  const { api, chunkBytes, signal, onCheck, onSaved } = options;
  let item = id ? await api<SharedFile>(`${fileSharingEndpoint}/${id}`, { signal }) : undefined;
  if (item && item.size !== source.size) throw new FileMismatch();
  const { hash, digests } = await fingerprint(source, chunkBytes, signal, onCheck);
  signal.throwIfAborted();
  if (item && item.fingerprint !== hash) throw new FileMismatch();
  item ??= await api<SharedFile>(fileSharingEndpoint, {
    method: 'POST', signal, body: JSON.stringify({ name, size: source.size, fingerprint: hash }),
  });
  onSaved(item);
  if (item.uploadedBytes === item.size) return;
  if ((options.uploadWindow ?? 1) > 1) {
    await transferWindow(source, item, digests, options);
    return;
  }
  await transferInOrder(source, item, options);
}

async function transferInOrder(source: File, item: SharedFile, { api, chunkBytes, signal, onSaved }: TransferOptions) {
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

async function transferWindow(source: File, item: SharedFile, digests: Uint8Array, options: TransferOptions) {
  const { api, chunkBytes, signal, onSaved } = options;
  const received = new Set(item.receivedChunks);
  const pending = Array.from({ length: Math.ceil(item.size / chunkBytes) }, (_, index) => index)
    .filter(index => index * chunkBytes >= item.uploadedBytes && !received.has(index));
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener('abort', cancel, { once: true });
  const endpoint = `${fileSharingEndpoint}/${item.id}`;
  let receivedBytes = item.receivedBytes ?? item.uploadedBytes;
  let next = 0;

  async function worker() {
    try {
      while (!controller.signal.aborted) {
        const index = pending[next++];
        if (index === undefined) return;
        const body = source.slice(index * chunkBytes, (index + 1) * chunkBytes);
        const digest = hexDigest(digests.subarray(index * digestBytes, (index + 1) * digestBytes));
        await api(`${endpoint}/chunks/${index}`, {
          method: 'PUT', signal: controller.signal, body,
          headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-SHA256': digest },
        });
        controller.signal.throwIfAborted();
        receivedBytes += body.size;
        onSaved({ ...item, receivedBytes });
      }
    } catch (error) {
      controller.abort(error);
    }
  }

  try {
    signal.throwIfAborted();
    const workers = Math.min(options.uploadWindow ?? 1, pending.length);
    await Promise.all(Array.from({ length: workers }, worker));
    controller.signal.throwIfAborted();
    const complete = await api<SharedFile>(`${endpoint}/complete`, { method: 'POST', signal: controller.signal });
    controller.signal.throwIfAborted();
    onSaved(complete);
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
