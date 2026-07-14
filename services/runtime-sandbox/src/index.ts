import { PACKAGE_NAME as SANDBOX } from '@pseudopilot/sandbox';
import { PLATFORM_NAME } from '@pseudopilot/shared-types';

/** Foundation stub — scales separately from apps/api under high execute load. */
export function bootstrap(): string {
  return `${PLATFORM_NAME}:runtime-sandbox ready (via ${SANDBOX})`;
}
