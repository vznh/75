// utils/time-utils
export function getCurrentDayNumber(): number {
	const startDate = new Date("2025-10-06T00:00:00-07:00");

	const now = new Date();
	const pdtNow = new Date(
		now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
	);

	const diffTime = pdtNow.getTime() - startDate.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

	return Math.max(1, diffDays);
}

export function getCurrentWeekNumber(): number {
	const startDate = new Date("2025-10-06T00:00:00-07:00");
	const now = new Date();
	const pdtNow = new Date(
		now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
	);

	const diffTime = pdtNow.getTime() - startDate.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	const weekNumber = Math.floor(diffDays / 7) + 1;

	return Math.max(1, weekNumber);
}

export function isLastDayOfWeek(dayNumber: number): boolean {
	return dayNumber % 7 === 0;
}

export function getPDTTime(): Date {
	const now = new Date();
	return new Date(
		now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
	);
}
