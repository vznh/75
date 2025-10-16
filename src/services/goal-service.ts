// services/goal-service

import {
	getAllGoalDefinitions,
	getAllWeeklyGoalDefinitions,
	getGoalDefinition,
	getUserGoals,
	getUserWeeklyGoals,
} from "../lib/goals";
import type { GoalDefinition } from "../models/goal";

export class GoalService {
	static getGoalDefinition(roleName: string): GoalDefinition | null {
		return getGoalDefinition(roleName);
	}

	static getAllGoalDefinitions(): GoalDefinition[] {
		return getAllGoalDefinitions();
	}

	static getAllWeeklyGoalDefinitions(): GoalDefinition[] {
		return getAllWeeklyGoalDefinitions();
	}

	static getUserGoals(memberRoles: string[]): GoalDefinition[] {
		return getUserGoals(memberRoles);
	}

	static getUserWeeklyGoals(memberRoles: string[]): GoalDefinition[] {
		return getUserWeeklyGoals(memberRoles);
	}
}
