// utils/validation-utils
import { GoalDefinition } from '../models/goal';

export function validateSubmission(
  goalDef: GoalDefinition,
  content: string,
  hasImage: boolean
): { isValid: boolean; submissionContent?: string; mediaUrl?: string } {
  let isValid = false;
  let submissionContent: string | undefined;
  let mediaUrl: string | undefined;

  if (goalDef.role === 'dj') {
    if (hasImage) {
      isValid = true;
      mediaUrl = 'file';
      submissionContent = content;
    } else if (content) {
      isValid = true;
      submissionContent = content;
    }
  } else {
    if (goalDef.requiresText && content) {
      submissionContent = content;
      if (goalDef.validation) {
        isValid = goalDef.validation(content, hasImage);
      } else {
        isValid = content.length > 0;
      }
    }

    if (goalDef.requiresImage && hasImage) {
      mediaUrl = 'image';
      isValid = true;
    }

    if (!goalDef.requiresText && !goalDef.requiresImage) {
      if (content || hasImage) {
        isValid = true;
        submissionContent = content;
        if (hasImage) mediaUrl = 'image';
      }
    }
  }

  return { isValid, submissionContent, mediaUrl };
}

export function getValidationRequirements(goalDef: GoalDefinition): string[] {
  const requirements = [];
  if (goalDef.requiresText) requirements.push('text');
  if (goalDef.requiresImage) requirements.push('image');
  
  if (goalDef.role === 'dj') {
    requirements.push('file');
  }
  
  return requirements;
}