// jobs/daily-reset
import { StatusService } from '../services/status-service';
import { logInfo } from '../middleware/logging';

export function scheduleDailyReset(): void {
  function scheduleNextReset() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    const timeUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        await StatusService.resetDailyStatus();
        logInfo('Daily accountability status reset completed');
      } catch (error) {
        console.error('Error during daily reset:', error);
      }

      scheduleNextReset();
    }, timeUntilMidnight);
  }

  scheduleNextReset();
}