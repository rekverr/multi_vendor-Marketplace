export const DOMAIN_EVENTS_QUEUE = 'domain-events';
export const REALTIME_EVENTS_QUEUE = 'realtime-events';

export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 86400,
    count: 10000,
  },
  removeOnFail: {
    age: 604800,
    count: 50000,
  },
};
