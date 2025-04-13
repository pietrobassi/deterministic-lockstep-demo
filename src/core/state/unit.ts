import Decimal from 'decimal.js';
import { Command, CommandType } from '../command/commands';
import { Frame } from '../game';
import { Entity, EntityConstructor, EntityType } from './entity';
import { Point2D } from './point';

export interface UnitConstructor extends EntityConstructor {
  color: string;
  position: Point2D;
  speed: Decimal;
  size: number;
}

/**
 * Represents a movable unit in the game world.
 *
 * Units are entities that can be moved by player commands. They have physical
 * properties such as position, dimensions, and movement capabilities.
 * Units respond to Move commands and update their position each frame according to their current
 * target and speed.
 * All state is stored as Decimal objects to ensure consistent behavior across all players.
 */
export class Unit extends Entity {
  type = EntityType.Unit;

  private _speed: Decimal;
  private _size: number;
  private _color: string;
  private _position: Point2D;
  private _target: Point2D | undefined;

  constructor({ entityId, playerId, isMine, color, position, speed, size }: UnitConstructor) {
    super({ entityId, playerId, isMine });
    this._size = size;
    this._speed = Decimal(speed);
    this._position = position;
    this._color = color;
  }

  /**
   * Updates the unit's state for the current frame (= tick).
   * Notice how all operations affecting the unit's state are performed using deterministic (decimal.js)
   * operations to ensure consistent behavior across all players.
   *
   * @param {Frame} frame - The current game frame object
   */
  override update(frame: Frame): void {
    const leftMouseClick = frame.input.leftMouseClick;
    if (leftMouseClick && this.isMine) {
      frame.enqueueCommand({
        type: CommandType.Move,
        entityId: this.id,
        playerId: this.playerId,
        point: { x: Decimal(leftMouseClick.x), y: Decimal(leftMouseClick.y) },
      });
    }

    if (this._target) {
      const dx = this._target.x.minus(this._position.x);
      const dy = this._target.y.minus(this._position.y);
      const distance = Decimal.sqrt(dx.mul(dx).plus(dy.mul(dy)));
      // If we're close enough to the target (within one frame's movement distance),
      // snap directly to the target to avoid bouncing or overshooting.
      if (distance.lessThanOrEqualTo(this._speed)) {
        this._position.x = this._target.x;
        this._position.y = this._target.y;
        this.setTarget(undefined);
      } else {
        this._position.x = this._position.x.add(this._speed.mul(dx).div(distance));
        this._position.y = this._position.y.add(this._speed.mul(dy).div(distance));
      }
    }
  }

  /**
   * Processes commands directed to this unit.
   * Handles Move commands by setting the unit's target position.
   *
   * @param {Command} command - The command to process
   */
  override processCommand(command: Command): void {
    switch (command.type) {
      case CommandType.Move:
        this.setTarget(command.point);
        break;
    }
  }

  setTarget(target: Point2D | undefined): void {
    this._target = target;
  }

  get color(): string {
    return this._color;
  }

  get position(): Point2D {
    return { ...this._position };
  }

  get target(): Point2D | undefined {
    return this._target ? { ...this._target } : undefined;
  }

  get size(): number {
    return this._size;
  }
}
