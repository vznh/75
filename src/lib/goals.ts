// lib/goals.ts
import { GoalDefinition } from '../types';

export const GOAL_DEFINITIONS: Record<string, GoalDefinition> = {
  leetcode: {
    name: 'LeetCode',
    role: 'leetcode',
    emoji: '💻',
    description: 'Submit a screen of your LeetCode/HackerRank/... solution.',
    requiresImage: true,
    requiresText: false,
  },
  water: {
    name: 'Water',
    role: 'water',
    emoji: '💧',
    description: 'Submit proof of 1 gallon water intake from any water tracking log.',
    requiresImage: true,
    requiresText: false,
  },
  sleep: {
    name: 'Sleep',
    role: 'sleep',
    emoji: '💤',
    description: 'Submit your health tracking data for your sleep.',
    requiresImage: true,
    requiresText: false,
  },
  work: {
    name: 'Work',
    role: 'work',
    emoji: '💼',
    description: 'Submit number of work hours completed today. Example: 8.',
    requiresImage: false,
    requiresText: true,
    validation: (content?: string) => {
      if (!content) return false;
      const num = parseFloat(content.trim());
      return !isNaN(num) && num >= 0;
    },
  },
  food: {
    name: 'Food',
    role: 'food',
    emoji: '🍔',
    description: 'Submit what you ate for today, as an image from MyFitnessPal or as text.',
    requiresImage: false,
    requiresText: true,
  },
  'job applications': {
    name: 'Applications',
    role: 'job applications',
    emoji: '📄',
    description: 'Submit a screenshot of your entries for today from your spreadsheet.',
    requiresImage: true,
    requiresText: false,
  },
  exercise: {
    name: 'Exercise',
    role: 'exercise',
    emoji: '🏋',
    description: 'Submit what you did for exercise today, as an image or text.',
    requiresImage: false,
    requiresText: true,
  },
  djmix: {
    name: 'DJ',
    role: 'dj',
    emoji: '🎧',
    description: 'Submit your audio file of your DJ mix for today.',
    requiresImage: false,
    requiresText: true,
  },
  reading: {
    name: 'Reading',
    role: 'reading',
    emoji: '📕',
    description: 'Submit what book you read, and what chapter you completed. Optionally, you can summarize.',
    requiresImage: false,
    requiresText: true,
  },
  'late-eats': {
    name: 'Late Eating',
    role: 'late-eats',
    emoji: '🍽️',
    description: 'Did you eat anything after 10PM yesterday? Submit a photo of what you ate or text describing it.',
    requiresImage: false,
    requiresText: true,
  },
};

export const WEEKLY_GOAL_DEFINITIONS: Record<string, GoalDefinition> = {
  cafe: {
    name: 'Cafe',
    role: 'cafe',
    emoji: '☕',
    description: 'Submit a picture of your coffee/cafe that you went to for the week.',
    requiresImage: true,
    requiresText: false,
  },
  portfolio: {
    name: 'Portfolio',
    role: 'portfolio',
    emoji: '💼',
    description: 'Submit proof of portfolio work done this week. This could be a screenshot of code, a design mockup, or description of what you built.',
    requiresImage: false,
    requiresText: true,
  },
  ternship: {
    name: 'Internship',
    role: 'ternship',
    emoji: '🏢',
    description: 'Submit proof of work done on your internship project this week. This could be a screenshot of code, a document, or description of what you accomplished.',
    requiresImage: false,
    requiresText: true,
  },
};

export function getGoalDefinition(roleName: string): GoalDefinition | null {
  return GOAL_DEFINITIONS[roleName.toLowerCase()] || null;
}

export function getAllGoalDefinitions(): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS);
}

export function getAllWeeklyGoalDefinitions(): GoalDefinition[] {
  return Object.values(WEEKLY_GOAL_DEFINITIONS);
}

export function getWeeklyGoalDefinition(roleName: string): GoalDefinition | null {
  return WEEKLY_GOAL_DEFINITIONS[roleName.toLowerCase()] || null;
}

export function getUserGoals(memberRoles: string[]): GoalDefinition[] {
  const userGoals: GoalDefinition[] = [];

  for (const roleName of memberRoles) {
    const goalDef = getGoalDefinition(roleName);
    if (goalDef) {
      userGoals.push(goalDef);
    }
  }

  return userGoals;
}

export function getUserWeeklyGoals(memberRoles: string[]): GoalDefinition[] {
  const userWeeklyGoals: GoalDefinition[] = [];

  for (const roleName of memberRoles) {
    const goalDef = getWeeklyGoalDefinition(roleName);
    if (goalDef) {
      userWeeklyGoals.push(goalDef);
    }
  }

  return userWeeklyGoals;
}

export function getCurrentWeekNumber(): number {
  const startDate = new Date('2025-10-06T00:00:00-07:00'); // PDT is UTC-7
  const now = new Date();
  const pdtNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  
  const diffTime = pdtNow.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1; // +1 because week 1 starts on day 0
  
  return Math.max(1, weekNumber);
}

export function isLastDayOfWeek(dayNumber: number): boolean {
  return dayNumber % 7 === 0; // Days 7, 14, 21, etc. are the last day of each week
}
