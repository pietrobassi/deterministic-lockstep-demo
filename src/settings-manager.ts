import { DEFAULT_SETTINGS, PLAYERS } from './constants';

export interface Settings {
  global: {
    commandDelay: number;
    tickRate: number;
  };
  players: {
    delay: { min: number; max: number };
    packetLoss: number;
    renderer: { interpolate: boolean };
  }[];
}

/**
 * Manages settings and settings UI for the game.
 */
export class SettingsManager {
  private readonly _settingsKey = 'gameSettings';
  private _settings: Settings;
  private _uiElements!: {
    applySettings: HTMLButtonElement;
    resetSettings: HTMLButtonElement;
    global: {
      commandDelay: HTMLInputElement;
      tickRate: HTMLInputElement;
    };
    player: {
      delayMin: HTMLInputElement;
      delayMax: HTMLInputElement;
      packetLoss: HTMLInputElement;
      interpolate: HTMLInputElement;
    }[];
    idealDelay: HTMLSpanElement;
  };

  constructor() {
    this._settings = this.getStoredSettings() || DEFAULT_SETTINGS;
    this.saveSettings();
    this.initUiElements();
    this.fromSettingsToUi(this._settings);
  }

  private getStoredSettings(): Settings | undefined {
    const storedSettings = localStorage.getItem(this._settingsKey);
    return storedSettings ? JSON.parse(storedSettings) : undefined;
  }

  private saveSettings(): void {
    localStorage.setItem(this._settingsKey, JSON.stringify(this._settings));
  }

  private initUiElements(): void {
    this._uiElements = {
      applySettings: document.getElementById('applySettings') as HTMLButtonElement,
      resetSettings: document.getElementById('resetSettings') as HTMLButtonElement,
      global: {
        commandDelay: document.getElementById('commandDelay') as HTMLInputElement,
        tickRate: document.getElementById('tickRate') as HTMLInputElement,
      },
      player: PLAYERS.map((_, i) => ({
        delayMin: document.getElementById(`delayMin${i}`) as HTMLInputElement,
        delayMax: document.getElementById(`delayMax${i}`) as HTMLInputElement,
        packetLoss: document.getElementById(`packetLoss${i}`) as HTMLInputElement,
        interpolate: document.getElementById(`interpolate${i}`) as HTMLInputElement,
      })),
      idealDelay: document.getElementById('idealDelay') as HTMLSpanElement,
    };

    this._uiElements.applySettings.addEventListener('click', () => {
      this._settings.global.commandDelay = parseInt(this._uiElements.global.commandDelay.value);
      this._settings.global.tickRate = parseInt(this._uiElements.global.tickRate.value);
      this.saveSettings();
      window.location.reload();
    });

    this._uiElements.resetSettings.addEventListener('click', () => {
      this.resetSettings();
      window.location.reload();
    });

    [this._uiElements.global.commandDelay, this._uiElements.global.tickRate].forEach((input) => {
      input?.addEventListener('input', () => {
        // Only update global tick settings when Apply button is clicked
        this.updateIdealDelay();
      });
    });

    this._uiElements.player.forEach((player, index) => {
      [player.delayMin, player.delayMax, player.packetLoss, player.interpolate].forEach((input) => {
        input?.addEventListener('input', () => {
          this._settings.players[index].delay.min = parseInt(player.delayMin.value);
          this._settings.players[index].delay.max = parseInt(player.delayMax.value);
          this._settings.players[index].packetLoss = parseFloat(player.packetLoss.value) / 100;
          this._settings.players[index].renderer.interpolate = player.interpolate.checked;
          this.updateIdealDelay();
          this.saveSettings();
        });
      });
    });
  }

  /**
   * Calculate and display raw estimate of ideal command delay based on players latency and tick rate.
   */
  private updateIdealDelay(): void {
    const sortedPlayers = [...this._settings.players].sort((a, b) => b.delay.max - a.delay.max);
    const maxDelay = sortedPlayers[0].delay.max / 2;
    const secondMaxDelay = sortedPlayers[1].delay.max / 2;
    const msPerTick = 1000 / parseInt(this._uiElements.global.tickRate.value);
    // Arbitrary 1.3 multiplier to account for lag spikes and jitter
    const idealDelay = Math.ceil(((maxDelay + secondMaxDelay) / msPerTick) * 1.3);
    this._uiElements.idealDelay.textContent = `${idealDelay} ticks`;
  }

  private resetSettings(): void {
    this._settings = DEFAULT_SETTINGS;
    this.saveSettings();
    this.fromSettingsToUi(this._settings);
  }

  private fromSettingsToUi(settings: Settings): void {
    this._uiElements.global.commandDelay.value = settings.global.commandDelay.toString();
    this._uiElements.global.tickRate.value = settings.global.tickRate.toString();
    this._uiElements.player.forEach((player, index) => {
      player.delayMin.value = settings.players[index].delay.min.toString();
      player.delayMax.value = settings.players[index].delay.max.toString();
      player.packetLoss.value = (settings.players[index].packetLoss * 100).toString();
      player.interpolate.checked = settings.players[index].renderer.interpolate;
    });
    this.updateIdealDelay();
  }

  get settings(): Settings {
    return this._settings;
  }
}
