// models/goal
export interface GoalDefinition {
  name: string;
  role: string;
  emoji: string;
  description: string;
  requiresImage: boolean;
  requiresText: boolean;
  validation?: (content?: string, hasImage?: boolean) => boolean;
}

