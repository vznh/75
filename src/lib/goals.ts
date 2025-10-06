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
  gym: {
    name: 'Gym',
    role: 'gym',
    emoji: '🏋',
    description: 'Submit what you did in the gym for today, as an image or text.',
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
};

export function getGoalDefinition(roleName: string): GoalDefinition | null {
  return GOAL_DEFINITIONS[roleName.toLowerCase()] || null;
}

export function getAllGoalDefinitions(): GoalDefinition[] {
  return Object.values(GOAL_DEFINITIONS);
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
