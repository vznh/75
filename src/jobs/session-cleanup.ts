// jobs/session-cleanup

import { CLEANUP_INTERVAL } from "../constants/timings";
import { EntryService } from "../services/entry-service";

export function startSessionCleanup(): void {
	setInterval(() => {
		EntryService.cleanupExpiredSessions();
	}, CLEANUP_INTERVAL);
}
