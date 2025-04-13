import { EntityId } from '../state/entity';
import { Point2D } from '../state/point';

interface BaseCommand {
  playerId: number;
  type: CommandType;
}

export enum CommandType {
  Noop = 'noop',
  Move = 'move',
}

/*
 * In a deterministic lockstep game, Noop commands are necessary and must be explicitly sent
 * for every tick to preserve synchronization and avoid desyncs.
 */
export interface NoopCommand extends BaseCommand {
  type: CommandType.Noop;
}

export interface MoveCommand extends BaseCommand {
  entityId: EntityId;
  type: CommandType.Move;
  point: Point2D;
}

export type Command = NoopCommand | MoveCommand;
