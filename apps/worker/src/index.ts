import { PLATFORM_NAME } from '@pseudopilot/shared-types';

/**
 * Foundation stub for worker.
 * Product features are intentionally not implemented yet.
 */
export function bootstrap(): string {
  return `${PLATFORM_NAME}:worker foundation ready`;
}
