import { Command } from '../command/commands';
import { Frame } from '../game';

export type EntityId = number;

export interface EntityConstructor {
  entityId: EntityId;
  playerId: number;
  isMine: boolean;
}

/**
 * Represents an entity in the game.
 *
 * This abstract class defines the common properties and methods for all entities in the game.
 * Some network information is stored here for convenience (playerId, isMine), although a better
 * design would move these fields to a separate component.
 */
export abstract class Entity {
  /** The player id that controls this entity */
  public readonly playerId: number;
  /** Whether this entity is controlled by the local player */
  public readonly isMine: boolean;
  /** The unique identifier for this entity */
  public readonly id: EntityId;
  /** The entity type */
  abstract readonly type: EntityType;

  constructor({ entityId, playerId, isMine }: EntityConstructor) {
    this.id = entityId;
    this.playerId = playerId;
    this.isMine = isMine;
  }

  update(_frame: Frame): void {}
  processCommand(_command: Command): void {}
}

export enum EntityType {
  Unit = 'unit',
}
