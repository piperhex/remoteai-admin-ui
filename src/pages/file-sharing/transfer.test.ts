// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { fileSharingEndpoint, transferFile, uploadProgress, type FileSharingApi, type SharedFile } from './transfer';

const chunkBytes = 2;
const content = Buffer.from('0123456789abcd');
const source = new File([content], 'test.bin');
const prefix = `${fileSharingEndpoint}/sample`;

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest();
}

function resumeItem(): SharedFile {
  const parts = Array.from({ length: content.length / chunkBytes }, (_, index) =>
    sha256(content.subarray(index * chunkBytes, (index + 1) * chunkBytes)));
  return { id: 'sample', name: source.name, size: source.size, uploadedBytes: 0, updatedAt: '',
    fingerprint: sha256(Buffer.concat(parts)).toString('hex'), receivedChunks: [1, 4], receivedBytes: 4 };
}

it('refills a free slot before earlier chunks finish and resumes only missing chunks', async () => {
  const item = resumeItem();
  const acknowledged = new Map<number, () => void>();
  const complete = vi.fn();
  const progress: number[] = [];
  const api: FileSharingApi = async <T>(path: string, options?: RequestInit) => {
    if (path === prefix) return item as T;
    if (path === `${prefix}/complete`) {
      complete();
      return { ...item, uploadedBytes: item.size } as T;
    }
    const index = Number(path.split('/').at(-1));
    const supplied = new Headers(options?.headers).get('X-Upload-SHA256');
    expect(supplied).toBe(sha256(content.subarray(index * chunkBytes, (index + 1) * chunkBytes)).toString('hex'));
    return new Promise<T>(resolve => acknowledged.set(index, () => resolve(undefined as T)));
  };
  const transfer = transferFile({ source, name: source.name, id: item.id }, {
    api, chunkBytes, uploadWindow: 3, signal: new AbortController().signal,
    onCheck: () => {}, onSaved: saved => progress.push(uploadProgress(saved)),
  });
  await vi.waitFor(() => expect([...acknowledged.keys()]).toEqual([0, 2, 3]));
  acknowledged.get(3)!();
  await vi.waitFor(() => expect([...acknowledged.keys()]).toEqual([0, 2, 3, 5]));
  acknowledged.get(2)!();
  await vi.waitFor(() => expect([...acknowledged.keys()]).toEqual([0, 2, 3, 5, 6]));
  acknowledged.get(5)!();
  acknowledged.get(6)!();
  await vi.waitFor(() => expect(progress.at(-1)).toBe(85));
  expect(complete).not.toHaveBeenCalled();
  acknowledged.get(0)!();
  await transfer;
  expect(complete).toHaveBeenCalledOnce();
  expect(progress.slice(-2)).toEqual([99, 100]);
});

it('aborts all outstanding chunks on pause without publishing the file', async () => {
  const item = resumeItem();
  const controller = new AbortController();
  const started = vi.fn();
  const cancelled = vi.fn();
  const complete = vi.fn();
  const api: FileSharingApi = async <T>(path: string, options?: RequestInit) => {
    if (path === prefix) return item as T;
    if (path.endsWith('/complete')) complete();
    started();
    return new Promise<T>((_, reject) => {
      options?.signal?.addEventListener('abort', () => {
        cancelled();
        reject(options.signal?.reason);
      }, { once: true });
    });
  };
  const transfer = transferFile({ source, name: source.name, id: item.id }, {
    api, chunkBytes, uploadWindow: 3, signal: controller.signal, onCheck: () => {}, onSaved: () => {},
  });
  const interrupted = expect(transfer).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(3));
  controller.abort();
  await interrupted;
  expect(cancelled).toHaveBeenCalledTimes(3);
  expect(started).toHaveBeenCalledTimes(3);
  expect(complete).not.toHaveBeenCalled();
});
