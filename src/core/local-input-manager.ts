import { cloneDeep } from 'lodash';
import { Renderer } from './renderer';
import { UnsafePoint2D } from './state/point';

export interface Input {
  leftMouseClick?: UnsafePoint2D;
}

/**
 * Manages and tracks user input.
 *
 * Entities can access input from the Frame object passed to their update method.
 * Input state is reset at each tick.
 */
export class LocalInputManager {
  /** Input state for the current tick */
  private _input: Input = {};

  constructor(renderer: Renderer) {
    renderer.canvas.addEventListener('mousedown', (event) =>
      this.onMouseDown(renderer.canvas, event),
    );
  }

  private onMouseDown(canvas: HTMLCanvasElement, event: MouseEvent): void {
    const rectBounds = canvas.getBoundingClientRect();
    const mouseX = Math.floor(event.clientX - rectBounds.left);
    const mouseY = Math.floor(event.clientY - rectBounds.top);
    this._input.leftMouseClick = { x: mouseX, y: mouseY };
  }

  /**
   * Reset input state for the next tick.
   * Should be called by Game at the end of each game loop iteration.
   */
  nextTick(): void {
    this._input = {};
  }

  get inputs(): Input {
    return cloneDeep(this._input);
  }
}
