import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useAuthenticatedApi } from './useAuthenticatedApi';
import type { AuthTokens } from '../types';
import type { Translate } from '../i18n';

const auth = (id: string): AuthTokens => ({ accessToken: `${id}-access`, refreshToken: `${id}-refresh`,
  user: { id, email: `${id}@test.invalid`, role: 'admin' } });
const t = ((key: string) => key) as Translate;
afterEach(() => vi.unstubAllGlobals());
it('makes a new session available to pages loading immediately after sign-in', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const save = vi.fn();
  const showError = vi.fn();
  type Api = ReturnType<typeof useAuthenticatedApi>['api'];
  function Page({ api }: { api: Api }) {
    useEffect(() => { void api('/admin/api/file-sharing').catch(showError); }, [api]);
    return null;
  }
  function Harness({ tokens }: { tokens: AuthTokens | null }) {
    const { api } = useAuthenticatedApi(tokens, save, t);
    return tokens && <Page api={api} />;
  }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(<Harness tokens={null} />));
    await act(async () => root.render(<Harness tokens={auth('operator')} />));
    expect(showError).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer operator-access');
  } finally {
    await act(async () => root.unmount());
  }
});

it('does not replay a mutation or replace credentials after an account switch during refresh', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let finish: (response: Response) => void = () => {};
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  const save = vi.fn();
  let api: ReturnType<typeof useAuthenticatedApi>['api'];
  function Harness({ tokens }: { tokens: AuthTokens }) { api = useAuthenticatedApi(tokens, save, t).api; return null; }
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<Harness tokens={auth('alice')} />));
  const pending = api!('/admin/api/provider-market', { method: 'POST' }).catch((error: unknown) => error);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await act(async () => root.render(<Harness tokens={auth('bob')} />));
  finish(new Response(JSON.stringify(auth('alice'))));
  expect(await pending).toBeInstanceOf(Error);
  expect(save).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
