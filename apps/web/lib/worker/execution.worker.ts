/// <reference lib="webworker" />
/**
 * Dedicated Web Worker entry for PseudoPilot execution.
 * The UI thread must never call runPseudocode directly.
 */

import type { WorkerCommand, WorkerEvent } from './protocol';
import {
  WorkerSessionRunner,
  handleWorkerCommand,
} from './workerSession';

declare const self: DedicatedWorkerGlobalScope;

const post = (event: WorkerEvent): void => {
  self.postMessage(event);
};

const runner = new WorkerSessionRunner(post);

post({ type: 'ready' });

self.onmessage = (ev: MessageEvent<WorkerCommand>) => {
  const cmd = ev.data;
  if (!cmd || typeof cmd !== 'object' || !('type' in cmd)) return;
  handleWorkerCommand(runner, cmd, post);
};
