import { GameState } from '../game';
import { Command, CommandType } from './commands';

/**
 * Central hub for executing commands in the game system.
 * It receives commands, validates them, and dispatches them to the appropriate entities.
 */
export class CommandProcessor {
  /**
   * Processes an array of commands in sequence.
   *
   * Currently supports Move commands, which are forwarded to the appropriate entity
   * for processing.
   *
   * @param {Command[]} commands - The commands to process.
   */
  processCommands(commands: Command[], state: GameState): void {
    for (const command of commands) {
      if (command && command.type === CommandType.Move) {
        const entity = state.entities[command.entityId];
        if (entity) {
          entity.processCommand(command);
        } else {
          console.error(`Entity ${command.entityId} not found`);
          console.error(state.entities);
        }
      }
    }
  }
}
