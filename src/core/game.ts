import { cloneDeep } from 'lodash';
import { CommandManager } from './command/command-manager';
import { CommandProcessor } from './command/command-processor';
import { Command } from './command/commands';
import { Input, LocalInputManager } from './local-input-manager';
import { Socket } from './network';
import { Renderer } from './renderer';
import { Entity, EntityId } from './state/entity';

export interface GameState {
  entities: Record<EntityId, Entity>;
}

/**
 * A Frame object is passed to the update method of each entity and allows it to read current
 * user input and enqueue commands.
 */
export interface Frame {
  tick: number;
  input: Input;
  enqueueCommand: (command: Command) => void;
}

export interface GameConstructor {
  playerId: number;
  tickRate: number;
  otherPlayerIds: number[];
  state: GameState;
  renderer: Renderer;
  localInputManager: LocalInputManager;
  socket: Socket;
  commandDelay: number;
}

export class Game {
  public readonly _playerId: number;
  private readonly _tickRate: number;
  private _state: GameState;
  private _renderer: Renderer;
  private _localInputManager: LocalInputManager;
  private _commandManager: CommandManager;
  private _commandProcessor: CommandProcessor;
  private _tick: number = 0;

  constructor({
    playerId,
    tickRate,
    otherPlayerIds,
    state,
    renderer,
    localInputManager,
    socket,
    commandDelay,
  }: GameConstructor) {
    this._playerId = playerId;
    this._tickRate = tickRate;
    this._commandManager = new CommandManager({
      playerId,
      otherPlayerIds,
      commandDelay,
      socket,
      tick: this._tick,
    });
    this._state = state;
    this._renderer = renderer;
    this._localInputManager = localInputManager;
    this._commandProcessor = new CommandProcessor();
  }

  /**
   * Start the game loop.
   *
   * More info here: https://gafferongames.com/post/fix_your_timestep/
   */
  async start(): Promise<void> {
    const tickDuration = 1000 / this._tickRate;
    let lastFrameStart = Date.now();
    let accumulator = 0;
    let oldState = cloneDeep(this._state); // for interpolation

    const gameLoop = async () => {
      const lastFrameTime = Math.min(Date.now() - lastFrameStart, 250); // cap at 250ms
      accumulator += lastFrameTime;
      while (accumulator >= tickDuration) {
        await this._commandManager.waitForTick(this._tick);
        oldState = cloneDeep(this._state);
        this._commandProcessor.processCommands(
          this._commandManager.getAllCommands(this._tick),
          this._state,
        );
        this.update(this.getFrame());
        this.nextTick();
        accumulator -= tickDuration;
      }
      lastFrameStart = Date.now();
      this._renderer.draw(oldState, this._state, this._tick, accumulator / tickDuration);
      requestAnimationFrame(gameLoop);
    };
    await gameLoop();
  }

  /**
   * Enqueue a command for future execution.
   *
   * @param {Command} command - The command to enqueue.
   */
  enqueueCommand(command: Command): void {
    this._commandManager.enqueueCommand(command);
  }

  private getFrame(): Frame {
    return {
      tick: this._tick,
      input: this._localInputManager.inputs,
      enqueueCommand: (command: Command) => this.enqueueCommand(command),
    };
  }

  private nextTick(): void {
    this._localInputManager.nextTick();
    this._commandManager.nextTick();
    this._tick++;
  }

  private update(frame: Frame): void {
    for (const entity of Object.values(this._state.entities)) {
      entity.update(frame);
    }
  }
}
