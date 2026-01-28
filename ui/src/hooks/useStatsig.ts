import { StatsigClient } from '@statsig/js-client';

let statsigClient: StatsigClient | null = null;
let initPromise: Promise<void> | null = null;

const STATSIG_CLIENT_KEY = import.meta.env.VITE_STATSIG_CLIENT_KEY || '';

export async function initStatsig(userId: string): Promise<void> {
  if (!STATSIG_CLIENT_KEY) {
    console.warn('Statsig client key not configured');
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    statsigClient = new StatsigClient(STATSIG_CLIENT_KEY, { userID: userId });
    await statsigClient.initializeAsync();
  })();

  return initPromise;
}

export function logEvent(
  name: string,
  value?: string | number,
  metadata?: Record<string, string>
): void {
  if (!statsigClient) {
    console.debug(`[Statsig] Event: ${name}`, { value, metadata });
    return;
  }
  statsigClient.logEvent(name, value, metadata);
}

export function checkGate(gateName: string): boolean {
  if (!statsigClient) {
    return false;
  }
  return statsigClient.checkGate(gateName);
}

export function getConfig(configName: string): Record<string, unknown> {
  if (!statsigClient) {
    return {};
  }
  return statsigClient.getDynamicConfig(configName).value;
}
