// jobs/reminder-scheduler
import { ReminderService } from '../services/reminder-service';

export function startReminderScheduler(): void {
  ReminderService.scheduleGoalReminders();
}