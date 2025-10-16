// constants/timings
export const REMINDER_TIMES = {
	REGULAR_REMINDER: { hour: 23, minute: 0 },
	LAST_CALL_REMINDER: { hour: 23, minute: 30 },
} as const;

export const CLEANUP_INTERVAL = 5 * 60 * 1000;
export const THREAD_LOCK_DELAY = 5000;
export const MAX_RETRIES = 3;
export const SESSION_EXPIRY_CHECK = 0.01;
