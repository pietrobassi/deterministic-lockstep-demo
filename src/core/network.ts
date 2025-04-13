import { random } from 'lodash';
import { Command } from './command/commands';

/**
 * Represent a network message containing player commands and acknowledgments.
 * In a real scenario, this would be a UDP packet and a more compact format should be used
 * to reduce the amount of data sent.
 */
export interface NetworkMessage {
  /** The ID of the player sending the message */
  playerId: number;
  /** Commands for each tick */
  commands: Record<number, Command[]>;
  /** List of acknowledged ticks */
  acks: number[];
}

export interface SocketOptions {
  /** Min/max network delay (ping, RTT) configuration */
  delay?: {
    min: number;
    max: number;
  };
  /** Probability of packet loss (0-1) */
  packetLoss?: number;
}

/**
 * Simulate a UDP socket, with configurable delay and packet loss.
 * TCP is not a good solution - even for lockstep protocol games where messages order and delivery
 * is critical - and it's usually better to use UDP, implementing some TCP features at the application level.
 */
export class Socket {
  private _receive: AsyncGenerator<NetworkMessage, never, unknown>;
  private _send: (targetPlayerId: number, message: NetworkMessage) => Promise<void>;
  private _options: SocketOptions;

  constructor(
    receive: AsyncGenerator<NetworkMessage, never, unknown>,
    send: (targetPlayerId: number, message: NetworkMessage) => Promise<void>,
    networkOptions: SocketOptions,
  ) {
    this._receive = receive;
    this._send = send;
    this._options = networkOptions;
  }

  /**
   * Return the async generator for receiving messages.
   *
   * @returns {AsyncGenerator<NetworkMessage, never, unknown>} The receive generator
   */
  receive(): AsyncGenerator<NetworkMessage, never, unknown> {
    return this._receive;
  }

  /**
   * Sends a message to a specific player.
   *
   * @param {number} targetPlayerId - The ID of the player to send the message to
   * @param {NetworkMessage} message - The message to send
   * @returns {Promise<void>} A promise that resolves when the message is sent
   */
  async send(targetPlayerId: number, message: NetworkMessage): Promise<void> {
    return this._send(targetPlayerId, message);
  }

  get options(): SocketOptions {
    return this._options;
  }

  set options(options: SocketOptions) {
    this._options = options;
  }
}

/**
 * Simulate the network between players.
 */
export class Network {
  private _sockets: Record<number, Socket> = {};
  private _inboxes: Record<number, { newMessage: (value: NetworkMessage) => void }> = {};

  /**
   * Create a new socket for a player.
   *
   * @param {number} playerId - The ID of the player
   * @param {SocketOptions} options - Socket configuration options
   * @returns {Socket} The created socket
   * @throws {Error} If a socket for the player already exists
   */
  createSocket(playerId: number, options: SocketOptions): Socket {
    if (this._sockets[playerId]) {
      throw new Error(`Socket for player ${playerId} already exists`);
    }

    let trigger: ((value: NetworkMessage) => void) | null = null;

    const receive: AsyncGenerator<NetworkMessage, never, unknown> = (async function* () {
      while (true) {
        yield await new Promise<NetworkMessage>((resolve) => (trigger = resolve));
      }
    })();

    const newMessage = (value: NetworkMessage) => {
      if (trigger) {
        trigger(value);
        trigger = null;
      }
    };
    const socket = new Socket(receive, this.sendMessage.bind(this, playerId), options);
    this._sockets[playerId] = socket;
    this._inboxes[playerId] = { newMessage };
    return socket;
  }

  private async sendMessage(
    senderPlayerId: number,
    receiverPlayerId: number,
    message: NetworkMessage,
  ): Promise<void> {
    const senderSocket = this._sockets[senderPlayerId];
    const receiverSocket = this._sockets[receiverPlayerId];

    if (!receiverSocket) {
      throw new Error(`Socket for player ${receiverPlayerId} does not exist`);
    }

    await this.applyNetworkDelay(senderSocket, receiverSocket);
    if (this.isPacketLost(senderSocket, receiverSocket)) {
      return;
    }

    this._inboxes[receiverPlayerId].newMessage(message);
  }

  private async applyNetworkDelay(senderSocket: Socket, receiverSocket: Socket): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.calculateDelay(senderSocket, receiverSocket)),
    );
  }

  private isPacketLost(senderSocket: Socket, receiverSocket: Socket): boolean {
    const senderPacketLoss = senderSocket.options.packetLoss ?? 0;
    const receiverPacketLoss = receiverSocket.options.packetLoss ?? 0;
    // Apply packet loss to both inbound and outbound messages
    return Math.random() < senderPacketLoss || Math.random() < receiverPacketLoss;
  }

  private calculateDelay(senderSocket: Socket, receiverSocket: Socket): number {
    const senderDelay = senderSocket.options.delay ?? { min: 0, max: 0 };
    const receiverDelay = receiverSocket.options.delay ?? { min: 0, max: 0 };
    // Consider half ping/RTT for each player as delay introduced by the network
    return (
      random(senderDelay.min, senderDelay.max) / 2 +
      random(receiverDelay.min, receiverDelay.max) / 2
    );
  }
}
