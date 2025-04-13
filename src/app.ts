import Decimal from 'decimal.js';
import { PLAYER_SIZE, PLAYER_SPEED, PLAYERS } from './constants';
import { Game, GameState } from './core/game';
import { LocalInputManager } from './core/local-input-manager';
import { Network, Socket } from './core/network';
import { Renderer } from './core/renderer';
import { Unit } from './core/state/unit';
import { Settings, SettingsManager } from './settings-manager';
import './styles.css';

function initializeApp() {
  const settingsManager = new SettingsManager();
  const gameStates = initializeGameStates();
  const sockets = initializeSockets(settingsManager.settings);
  const games = initializeGames(gameStates, sockets, settingsManager.settings);
  games.forEach((game) => game.start());
}

function initializeGameStates(): GameState[] {
  return PLAYERS.map((_, ownerId) => ({
    entities: Object.fromEntries(
      PLAYERS.map((color, index) => [
        index,
        new Unit({
          entityId: index,
          playerId: index,
          isMine: index === ownerId,
          color,
          position: {
            x: Decimal(50 + index * 50),
            y: Decimal(50 + index * 50),
          },
          speed: PLAYER_SPEED,
          size: PLAYER_SIZE,
        }),
      ]),
    ),
  }));
}

function initializeSockets(settings: Settings): Socket[] {
  const network = new Network();
  return PLAYERS.map((_, playerId) => {
    return network.createSocket(playerId, settings.players[playerId]);
  });
}

function initializeGames(gameStates: GameState[], sockets: Socket[], settings: Settings): Game[] {
  return gameStates.map((gameState, playerId) => {
    const renderer = new Renderer(`canvas${playerId}`, settings.players[playerId].renderer);
    return new Game({
      playerId,
      otherPlayerIds: PLAYERS.map((_, index) => index).filter((id) => id !== playerId),
      state: gameState,
      renderer,
      localInputManager: new LocalInputManager(renderer),
      commandDelay: settings.global.commandDelay,
      tickRate: settings.global.tickRate,
      socket: sockets[playerId],
    });
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
