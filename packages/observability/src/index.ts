/**
 * Observability conventions for PseudoPilot at classroom and platform scale.
 * Concrete OTel SDK wiring comes later; metric/trace names are frozen early
 * so dashboards do not churn.
 */

export const PACKAGE_NAME = '@pseudopilot/observability' as const;
export const PACKAGE_VERSION = '0.0.0' as const;

/** Service names used in traces and dashboards. */
export const ServiceName = {
  Web: 'pseudopilot-web',
  Api: 'pseudopilot-api',
  Teacher: 'pseudopilot-teacher',
  Worker: 'pseudopilot-worker',
  RuntimeSandbox: 'pseudopilot-runtime-sandbox',
} as const;

/** High-cardinality-safe metric names (labels added at instrumentation time). */
export const MetricName = {
  HttpRequestDurationMs: 'pseudopilot.http.request_duration_ms',
  WsActiveConnections: 'pseudopilot.ws.active_connections',
  SandboxExecutions: 'pseudopilot.sandbox.executions',
  SandboxQueueDepth: 'pseudopilot.sandbox.queue_depth',
  AiJobDurationMs: 'pseudopilot.ai.job_duration_ms',
  RateLimitRejections: 'pseudopilot.ratelimit.rejections',
  DbPoolWaitMs: 'pseudopilot.db.pool_wait_ms',
} as const;

export const TraceAttribute = {
  OrgId: 'pseudopilot.org_id',
  UserId: 'pseudopilot.user_id',
  ExecutionMode: 'pseudopilot.execution_mode',
  RequestId: 'pseudopilot.request_id',
} as const;
