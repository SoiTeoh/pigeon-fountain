import { tuning, type Tuning } from '../config/tuning';

export interface TuneOverrides {
  joystickDeadzonePx: number;
  joystickMaxRadiusPx: number;
  playerMaxSpeed: number;
  playerMoveAccel: number;
}

const TUNE_STORAGE_KEY = 'pigeon_fountain_tune_overrides_v1';

export function getDefaultTuneOverrides(): TuneOverrides {
  return {
    joystickDeadzonePx: tuning.ui.controls.joystickDeadzonePx,
    joystickMaxRadiusPx: tuning.ui.controls.joystickMaxRadiusPx,
    playerMaxSpeed: tuning.pigeon.playerMaxSpeed,
    playerMoveAccel: tuning.pigeon.playerMoveAccel,
  };
}

export function loadTuneOverrides(): TuneOverrides {
  const defaults = getDefaultTuneOverrides();
  try {
    const raw = window.localStorage.getItem(TUNE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TuneOverrides>;
    return {
      joystickDeadzonePx: Number.isFinite(parsed.joystickDeadzonePx)
        ? Number(parsed.joystickDeadzonePx)
        : defaults.joystickDeadzonePx,
      joystickMaxRadiusPx: Number.isFinite(parsed.joystickMaxRadiusPx)
        ? Number(parsed.joystickMaxRadiusPx)
        : defaults.joystickMaxRadiusPx,
      playerMaxSpeed: Number.isFinite(parsed.playerMaxSpeed)
        ? Number(parsed.playerMaxSpeed)
        : defaults.playerMaxSpeed,
      playerMoveAccel: Number.isFinite(parsed.playerMoveAccel)
        ? Number(parsed.playerMoveAccel)
        : defaults.playerMoveAccel,
    };
  } catch {
    return defaults;
  }
}

export function createRuntimeTuning(overrides: TuneOverrides): Tuning {
  return {
    ...tuning,
    ui: {
      ...tuning.ui,
      controls: {
        ...tuning.ui.controls,
        joystickDeadzonePx: overrides.joystickDeadzonePx as Tuning['ui']['controls']['joystickDeadzonePx'],
        joystickMaxRadiusPx: overrides.joystickMaxRadiusPx as Tuning['ui']['controls']['joystickMaxRadiusPx'],
      },
    },
    pigeon: {
      ...tuning.pigeon,
      playerMaxSpeed: overrides.playerMaxSpeed as Tuning['pigeon']['playerMaxSpeed'],
      playerMoveAccel: overrides.playerMoveAccel as Tuning['pigeon']['playerMoveAccel'],
    },
  };
}

export function applyTuneOverridesToTarget(target: Tuning, overrides: TuneOverrides): void {
  const ctrl = target.ui.controls as unknown as {
    joystickDeadzonePx: number;
    joystickMaxRadiusPx: number;
  };
  const pig = target.pigeon as unknown as {
    playerMaxSpeed: number;
    playerMoveAccel: number;
  };
  ctrl.joystickDeadzonePx = overrides.joystickDeadzonePx;
  ctrl.joystickMaxRadiusPx = overrides.joystickMaxRadiusPx;
  pig.playerMaxSpeed = overrides.playerMaxSpeed;
  pig.playerMoveAccel = overrides.playerMoveAccel;
}

export function mountTunePanel(runtimeTuning: Tuning): void {
  const state = loadTuneOverrides();
  applyTuneOverridesToTarget(runtimeTuning, state);

  const panel = document.createElement('div');
  panel.id = 'tune-panel';
  panel.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:9999;width:236px;padding:10px 12px;' +
    'background:rgba(15,23,42,0.92);color:#f8fafc;border:1.5px solid #38bdf8;' +
    'border-radius:12px;font:12px/1.4 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.45);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:800;color:#38bdf8;';
  header.innerHTML = '<span>🎛️ 手机手感调参 (?tune=1)</span>';
  panel.appendChild(header);

  const rows: { key: keyof TuneOverrides; label: string; min: number; max: number; step: number }[] = [
    { key: 'joystickDeadzonePx', label: '死区 (px)', min: 0, max: 20, step: 1 },
    { key: 'joystickMaxRadiusPx', label: '满速距离 (px)', min: 14, max: 70, step: 1 },
    { key: 'playerMaxSpeed', label: '最高速度', min: 150, max: 420, step: 5 },
    { key: 'playerMoveAccel', label: '加速度', min: 800, max: 4500, step: 50 },
  ];

  const inputs: Record<string, { slider: HTMLInputElement; valEl: HTMLSpanElement }> = {};

  const save = () => {
    try {
      window.localStorage.setItem(TUNE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
    applyTuneOverridesToTarget(runtimeTuning, state);
  };

  for (const r of rows) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;';
    const lbl = document.createElement('span');
    lbl.textContent = r.label;
    const valEl = document.createElement('span');
    valEl.textContent = String(state[r.key]);
    valEl.style.color = '#fde047';
    top.append(lbl, valEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(r.min);
    slider.max = String(r.max);
    slider.step = String(r.step);
    slider.value = String(state[r.key]);
    slider.style.cssText = 'width:100%;accent-color:#38bdf8;margin:2px 0 0;';
    slider.addEventListener('input', () => {
      state[r.key] = Number(slider.value);
      valEl.textContent = slider.value;
      save();
    });
    wrap.append(top, slider);
    panel.appendChild(wrap);
    inputs[r.key] = { slider, valEl };
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = '复制 JSON';
  copyBtn.style.cssText =
    'flex:1;padding:6px 8px;border:0;border-radius:8px;background:#0ea5e9;color:#fff;font-weight:700;cursor:pointer;';
  copyBtn.addEventListener('click', async () => {
    const json = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      copyBtn.textContent = '已复制!';
      setTimeout(() => {
        copyBtn.textContent = '复制 JSON';
      }, 1500);
    } catch {
      window.prompt('复制以下 JSON 参数：', json);
    }
  });

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '重置';
  resetBtn.style.cssText =
    'padding:6px 10px;border:0;border-radius:8px;background:#334155;color:#e2e8f0;font-weight:700;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    const def = getDefaultTuneOverrides();
    Object.assign(state, def);
    for (const r of rows) {
      inputs[r.key].slider.value = String(def[r.key]);
      inputs[r.key].valEl.textContent = String(def[r.key]);
    }
    save();
  });

  actions.append(copyBtn, resetBtn);
  panel.appendChild(actions);
  document.body.appendChild(panel);
}
