import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyLoading } from '../src/timeMachine/JourneyLoading';

describe('Generation progress', () => {
  it('shows real worker progress and a distinct export stage', () => {
    const html = renderToStaticMarkup(<JourneyLoading demo={false} onStop={() => {}} job={{ jobId: 'a', status: 'processing', progress: 92, shots: [] }} />);
    expect(html).toContain('Adding the final touches');
    expect(html).toContain('aria-valuenow="92"');
    expect(html).toContain('92% complete');
    expect(html).toContain('Stop waiting');
  });
  it('keeps unknown and simulated progress indeterminate without inventing a percentage', () => {
    for (const demo of [false, true]) {
      const html = renderToStaticMarkup(<JourneyLoading demo={demo} onStop={() => {}} job={{ jobId: 'a', status: 'queued', ...(demo ? { progress: 80 } : {}), shots: [] }} />);
      expect(html).toContain('Waiting for a render slot');
      expect(html).not.toContain('aria-valuenow=');
      expect(html).not.toContain('% complete');
    }
  });
});
