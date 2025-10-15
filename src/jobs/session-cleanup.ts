// jobs/session-cleanup
import { EntryService } from '../services/entry-service';
import { CLEANUP_INTERVAL } from '../constants/timings';

export function startSessionCleanup(): void {
  setInterval(() => {
    EntryService.cleanupExpiredSessions();
  }, CLEANUP_INTERVAL);
}