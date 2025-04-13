import Decimal from 'decimal.js';

export const PLAYERS = ['#FF0000', '#FFBB00', '#0000FF', '#00DDFF'];
export const PLAYER_SPEED = Decimal(5);
export const PLAYER_SIZE = 18;
export const DEFAULT_SETTINGS = {
  global: {
    commandDelay: 2,
    tickRate: 15,
  },
  players: PLAYERS.map(() => ({
    delay: { min: 60, max: 80 },
    packetLoss: 0.0,
    renderer: { interpolate: true },
  })),
};
