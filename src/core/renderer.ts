import { GameState } from './game';
import { EntityType } from './state/entity';
import { toUnsafePoint2D, UnsafePoint2D } from './state/point';
import { Unit } from './state/unit';

export interface RendererOptions {
  /** Whether to interpolate between game states for smoother rendering */
  interpolate?: boolean;
}

/**
 * Render the game state to an HTML Canvas.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _options: RendererOptions;

  constructor(canvasId: string, options: RendererOptions = {}) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this._ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this._options = options;
  }

  /**
   * Draw the game state to the canvas.
   *
   * @param {GameState} oldState - The previous game state (used when interpolation is enabled)
   * @param {GameState} newState - The new game state
   * @param {number} tick - The current tick
   * @param {number} alpha - The interpolation blending factor (0 = old state, 1 = new state)
   */
  public draw(oldState: GameState, newState: GameState, tick: number, alpha: number): void {
    if (!oldState || !newState) {
      return;
    }
    this.clear();
    this.drawEntities(oldState, newState, alpha);
    this.drawTick(tick);
  }

  private drawEntities(oldState: GameState, newState: GameState, alpha: number): void {
    Object.values(newState.entities).forEach((entity) => {
      if (entity.type === EntityType.Unit) {
        this.drawUnit(
          entity as Unit,
          this.interpolate(
            toUnsafePoint2D((oldState.entities[entity.id] as Unit).position),
            toUnsafePoint2D((newState.entities[entity.id] as Unit).position),
            alpha,
          ),
        );
      }
    });
  }

  private drawUnit(unit: Unit, { x, y }: UnsafePoint2D): void {
    // Draw a green dot at target position
    const target = unit.target && toUnsafePoint2D(unit.target);
    if (target) {
      this._ctx.fillStyle = unit.color;
      this._ctx.beginPath();
      this._ctx.arc(target.x, target.y, 2, 0, Math.PI * 2);
      this._ctx.fill();
      // Draw a line from unit center to target
      this._ctx.strokeStyle = unit.color;
      this._ctx.lineWidth = 1;
      this._ctx.beginPath();
      this._ctx.moveTo(x, y);
      this._ctx.lineTo(target.x, target.y);
      this._ctx.stroke();
    }

    if (unit.isMine) {
      // Draw a green circle around the unit to mimic selection
      this._ctx.strokeStyle = '#00FF00';
      this._ctx.lineWidth = 6;
      this._ctx.beginPath();
      const radius = unit.size / 2;
      this._ctx.arc(x, y, radius, 0, Math.PI * 2);
      this._ctx.stroke();
    }

    // Draw the unit as a circle
    this._ctx.fillStyle = unit.color;
    this._ctx.beginPath();
    const unitRadius = unit.size / 2;
    this._ctx.arc(x, y, unitRadius, 0, Math.PI * 2);
    this._ctx.fill();
  }

  private drawTick(tick: number): void {
    this._ctx.fillStyle = '#000000';
    this._ctx.font = '12px Arial';
    this._ctx.textAlign = 'right';
    this._ctx.fillText(`Tick: ${tick}`, this.canvas.width - 10, 20);
  }

  /**
   * If enabled, interpolate entity position between old and new state, using alpha as a blending factor.
   */
  private interpolate(
    { x: oldX, y: oldY }: UnsafePoint2D,
    { x: newX, y: newY }: UnsafePoint2D,
    alpha: number,
  ): UnsafePoint2D {
    if (!this._options.interpolate) {
      return { x: newX, y: newY };
    }
    return {
      x: oldX + (newX - oldX) * alpha,
      y: oldY + (newY - oldY) * alpha,
    };
  }

  private clear(): void {
    this._ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
