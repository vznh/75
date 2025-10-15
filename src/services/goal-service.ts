// services/goal-service
import { GoalDefinition } from '../models/goal';
import { 
  getGoalDefinition, 
  getAllGoalDefinitions, 
  getAllWeeklyGoalDefinitions, 
  getUserGoals, 
  getUserWeeklyGoals 
} from '../lib/goals';

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