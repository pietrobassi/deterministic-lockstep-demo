import { NetworkMessage, Socket } from '../network';
import { Command, CommandType } from './commands';

/**
 * For each tick, we store the commands for each player.
 * Game state can progress only after all players have submitted their commands for a given tick.
 */
interface TickCommandsMap {
  [tick: number]: {
    [playerId: number]: Command[];
  };
}

interface Acks {
  [playerId: number]: Set<number>;
}

interface CommandManagerConstructor {
  playerId: number;
  otherPlayerIds: number[];
  commandDelay: number;
  socket: Socket;
  tick: number;
}

export class CommandManager {
  private readonly _sortedPlayerIds: number[];
  private readonly _commandDelay: number;
  private readonly _playerId: number;
  private readonly _otherPlayerIds: number[];
  private _commandQueue: Command[] = [];
  private _tickCommandsMap: TickCommandsMap = {};

  private _socket: Socket;
  /** For every other player, keep the set of received ticks to be sent as acks in the next network message */
  private _acksToSend: Acks = {};
  /** Keep the numbers of sent ticks that have not yet been acknowledged by other players */
  private _pendingAcks: Acks = {};

  private _tick: number = 0;

  constructor({ playerId, otherPlayerIds, commandDelay, socket, tick }: CommandManagerConstructor) {
    // Sort player ids to ensure deterministic execution of commands
    this._sortedPlayerIds = [playerId, ...otherPlayerIds].sort();
    this._commandDelay = commandDelay;
    this._playerId = playerId;
    this._otherPlayerIds = otherPlayerIds;
    this._socket = socket;
    this._tick = tick;
    this.initTickCommandsMap();
    for (const playerId of this._otherPlayerIds) {
      this._acksToSend[playerId] = new Set();
      this._pendingAcks[playerId] = new Set();
    }
    this.startReceivingCommands();
  }

  /**
   * Increment the tick, schedule enqueued commands and send commands to other players.
   * This should be called once per tick by the game loop.
   * Commands are scheduled for a future tick (current tick + command delay) to avoid stalling the game
   * while waiting for input from other players.
   */
  nextTick(): void {
    this.scheduleEnqueuedCommands(this._tick + this._commandDelay);
    this.sendCommands(this._tick + this._commandDelay);
    // Clean up old commands that for sure have been already processed by all players
    delete this._tickCommandsMap[this._tick - this._commandDelay - 1];
    this._tick++;
  }

  /**
   * Wait for the tick to be ready (= all players have submitted their commands for the tick).
   * This is used to ensure that the game state is synchronized across all players.
   * If the tick is not ready, resend commands using exponential backoff. This is needed because
   * UDP is not reliable and some packets may be lost.
   */
  async waitForTick(tick: number): Promise<void> {
    let waitTime = 50;
    while (!this.isTickReady(tick)) {
      this.sendCommands(this._tick + this._commandDelay - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      waitTime = Math.min(waitTime * 1.5, 500);
    }
  }

  /**
   * Get all players' commands for a given tick.
   *
   * The commands are ordered by player id to ensure deterministic execution.
   *
   * @param {number} tick - The tick to get commands for
   * @returns {Command[]} All players' commands for the given tick
   */
  getAllCommands(tick: number): Command[] {
    const tickCommands = this._tickCommandsMap[tick];
    return tickCommands
      ? this._sortedPlayerIds.map((playerId) => tickCommands[playerId] ?? []).flat()
      : [];
  }

  /**
   * Append a command to the command queue for the current tick.
   *
   * @param {Command} command - The command to enqueue
   */
  enqueueCommand(command: Command): void {
    this._commandQueue.push(command);
  }

  /**
   * Returns true if the tick is ready to be processed.
   * This means that the tick has commands for all players.
   */
  private isTickReady(tick: number): boolean {
    const tickCommands = this._tickCommandsMap[tick];
    return !!tickCommands && Object.values(tickCommands).length === this._sortedPlayerIds.length;
  }

  /**
   * Send commands to other players.
   *
   * Since UDP is preferred over TCP for this use case, we compensate for potential packet loss by
   * re-sending commands for all ticks that have not yet been acknowledged.
   * This may introduce some redundancy, but ensures smoother gameplay by avoiding delays caused by
   * missing commands.
   */
  private async sendCommands(tick: number): Promise<void> {
    const tickCommands = this.getCommandsForPlayer(tick, this._playerId);

    for (const playerId of this._otherPlayerIds) {
      let networkMessage: NetworkMessage = {
        playerId: this._playerId,
        commands: {},
        acks: [],
      };
      // Add commands for the current tick
      networkMessage.commands[tick] = tickCommands;
      // Add commands for all ticks that have not been acknowledged yet
      for (const tickPendingAck of this._pendingAcks[playerId]) {
        const pendingAckCommands = this.getCommandsForPlayer(tickPendingAck, this._playerId);
        networkMessage.commands[tickPendingAck] = pendingAckCommands;
      }
      // Add this tick to pending acks, meaning the we expect ack for this tick from playerId
      this._pendingAcks[playerId].add(tick);
      // Include acks in the message and clear the set
      networkMessage.acks = [...this._acksToSend[playerId]];
      this._acksToSend[playerId] = new Set();

      this._socket.send(playerId, networkMessage);
    }
  }

  private addCommandsForPlayer(tick: number, playerId: number, commands: Command | Command[]) {
    if (Array.isArray(commands) ? commands.length === 0 : !commands) {
      return;
    }
    let tickCommands = this._tickCommandsMap[tick];
    if (!tickCommands) {
      tickCommands = {};
      this._tickCommandsMap[tick] = tickCommands;
    }
    if (!tickCommands[playerId]) {
      tickCommands[playerId] = Array.isArray(commands) ? commands : [commands];
    }
  }

  private getCommandsForPlayer(tick: number, playerId: number): Command[] {
    const tickCommands = this._tickCommandsMap[tick];
    if (!tickCommands) {
      return [];
    }
    return [...(tickCommands[playerId] ?? [])];
  }

  /**
   * Schedule current tick's enqueued commands to be executed on a specific tick and clear the queue.
   */
  private scheduleEnqueuedCommands(tick: number): void {
    this.addCommandsForPlayer(
      tick,
      this._playerId,
      this._commandQueue.length > 0
        ? this._commandQueue
        : [{ playerId: this._playerId, type: CommandType.Noop }],
    );
    this._commandQueue = [];
  }

  /**
   * Initialize the tick commands map with noop commands for all players for all ticks up to the command delay,
   * otherwise the first ticks will be empty and the game will hang forever.
   */
  private initTickCommandsMap(): void {
    for (let tick = 0; tick < this._commandDelay; tick++) {
      this._tickCommandsMap[tick] = {};
      for (const playerId of this._sortedPlayerIds) {
        this._tickCommandsMap[tick][playerId] = [{ playerId, type: CommandType.Noop }];
      }
    }
  }

  /**
   * Loop to receive commands from other players and update ack sets.
   */
  private async startReceivingCommands(): Promise<void> {
    for await (const msg of this._socket.receive()) {
      for (const [tickKey, commands] of Object.entries(msg.commands)) {
        const tick = Number(tickKey);
        if (tick >= this._tick) {
          this.addCommandsForPlayer(tick, msg.playerId, commands);
        }
        this._acksToSend[msg.playerId].add(Number(tick));
      }
      for (const tick of msg.acks) {
        this._pendingAcks[msg.playerId].delete(tick);
      }
    }
  }
}
