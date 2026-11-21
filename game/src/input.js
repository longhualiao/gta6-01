// Keyboard and mouse input: a small action map the game polls each frame.
// WASD/arrows move, Shift runs, E enters/exits a car, Space handbrakes / punches,
// mouse aims, left click shoots, Q swaps weapon, M mutes, Esc pauses, Enter confirms.
export const ACTION = {
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
  RUN: 'run', ENTER: 'enter', BRAKE: 'brake', FIRE: 'fire',
  WEAPON: 'weapon', MUTE: 'mute', PAUSE: 'pause', CONFIRM: 'confirm',
};

const KEYMAP = {
  KeyW: ACTION.UP, ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN, ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT, ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT, ArrowRight: ACTION.RIGHT,
  ShiftLeft: ACTION.RUN, ShiftRight: ACTION.RUN,
  KeyE: ACTION.ENTER,
  Space: ACTION.BRAKE,
  KeyQ: ACTION.WEAPON,
  KeyM: ACTION.MUTE,
  Escape: ACTION.PAUSE,
  Enter: ACTION.CONFIRM,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let anyKey = false;

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (action) {
      event.preventDefault();
      if (!held.has(action)) pressed.add(action);
      held.add(action);
      anyKey = true;
    }
  }
  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
      onMouseMove(event);
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    isDown(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    consume(action) { pressed.delete(action); },
    /** Movement vector from held keys, normalised. */
    moveVector() {
      let x = 0; let y = 0;
      if (held.has(ACTION.LEFT)) x -= 1;
      if (held.has(ACTION.RIGHT)) x += 1;
      if (held.has(ACTION.UP)) y -= 1;
      if (held.has(ACTION.DOWN)) y += 1;
      if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    /** True when any key was pressed since the last frame (title screen wake-up). */
    anyKeyPressed() { return anyKey; },
    endFrame() { pressed.clear(); mouse.clicked = false; anyKey = false; },
  };
}
