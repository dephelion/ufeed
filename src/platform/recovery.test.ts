import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reload: vi.fn(),
}));

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: { reload: state.reload },
  },
}));

const { restartExtension } = await import('./recovery');

beforeEach(() => state.reload.mockReset());

describe('extension recovery', () => {
  it('clears model files before restarting without touching user data', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { delete: deleteCache });
    await restartExtension();
    expect(deleteCache).toHaveBeenCalledWith('transformers-cache');
    expect(state.reload).toHaveBeenCalledOnce();
  });

  it('does not claim recovery when model cache deletion fails', async () => {
    vi.stubGlobal('caches', {
      delete: vi.fn().mockRejectedValue(new Error('cache unavailable')),
    });
    await expect(restartExtension()).rejects.toThrow('cache unavailable');
    expect(state.reload).not.toHaveBeenCalled();
  });
});
