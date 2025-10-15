// controllers/reaction-controller
import { RoleService } from '../services/role-service';

export class ReactionController {
  static async handleMessageReactionAdd(messageReaction: any, user: any): Promise<void> {
    await RoleService.handleMessageReactionAdd(messageReaction, user);
  }
}