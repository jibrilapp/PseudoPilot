import { describe, expect, it } from 'vitest';
import { MetricName, PACKAGE_NAME, ServiceName } from './index.js';

describe('observability foundation', () => {
  it('exports stable service and metric names', () => {
    expect(PACKAGE_NAME).toBe('@pseudopilot/observability');
    expect(ServiceName.Api).toBe('pseudopilot-api');
    expect(MetricName.SandboxQueueDepth).toContain('sandbox');
  });
});
