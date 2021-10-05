const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const img = document.createElement("img");

const controlRadius = 150;
const maxVelocityInPixels = controlRadius;
const maxRotationalVelocityInPixels = controlRadius;

export const state = {
  maxVelocity: 1, // m/s
  maxRotationalVelocity: 3, // rad/s
  input: { x: 0, y: 0, w: 0 },
  touches: {},
};

function getVelocityTouch() {
  for (const identifier in state.touches) {
    if (state.touches[identifier].x0 >= canvas.width / 2) {
      return state.touches[identifier];
    }
  }
}

function getRotationTouch() {
  for (const identifier in state.touches) {
    if (state.touches[identifier].x0 < canvas.width / 2) {
      return state.touches[identifier];
    }
  }
}

function drawControl(x, y, radius) {
  ctx.strokeStyle = "rgba(0, 0, 0, 1)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

function drawTouch(touch) {
  const minDistance = 25;

  drawControl(touch.x0, touch.y0, controlRadius);

  const angle = Math.atan2(touch.y1 - touch.y0, touch.x1 - touch.x0);
  const distance = Math.sqrt(
    Math.pow(touch.y1 - touch.y0, 2) + Math.pow(touch.x1 - touch.x0, 2)
  );

  if (distance > minDistance) {
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(distance / controlRadius, 1)})`;

    ctx.beginPath();
    ctx.arc(touch.x0, touch.y0, controlRadius, angle - 0.5, angle + 0.5);
    ctx.fill();
  }
}

function getMagnitude(x, y) {
  return Math.sqrt(x * x + y * y);
}

function drawInput() {
  ctx.strokeStyle = "rgba(255, 255, 255, 1)";

  // Direction
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2);
  const x = (state.input.x / state.maxVelocity) * maxVelocityInPixels;
  const y = (state.input.y / state.maxVelocity) * maxVelocityInPixels;
  ctx.lineTo(canvas.width / 2 + x, canvas.height / 2 + y);
  ctx.stroke();
  // Rotation
  const startAngle = Math.atan2(state.input.y, state.input.x);
  ctx.beginPath();
  ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    getMagnitude(x, y) || controlRadius,
    startAngle,
    startAngle + state.input.w,
    state.input.w < 0
  );
  ctx.fill();
  ctx.stroke();
  console.log(state.input);
}

function render() {
  // Resize canvas if needed
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  // Draw camera frame onto bg
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Draw touches
  for (const identifier in state.touches) {
    drawTouch(state.touches[identifier]);
  }

  // Draw input
  drawInput();
}

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();

  for (const touch of event.touches) {
    if (touch.clientX >= canvas.width / 2 && getVelocityTouch()) {
      continue;
    }

    if (touch.clientX < canvas.width / 2 && getRotationTouch()) {
      continue;
    }

    state.touches[touch.identifier] = {
      x0: touch.clientX,
      y0: touch.clientY,
      x1: touch.clientX,
      y1: touch.clientY,
    };
  }

  render();
});

function updateInput() {
  const velocityTouch = getVelocityTouch();
  const rotationTouch = getRotationTouch();

  if (velocityTouch) {
    let vx = (velocityTouch.x1 - velocityTouch.x0) / maxVelocityInPixels;
    let vy = (velocityTouch.y1 - velocityTouch.y0) / maxVelocityInPixels;
    const v = Math.sqrt(vx * vx + vy * vy);

    if (v > 1) {
      vx = vx / v;
      vy = vy / v;
    }

    state.input.x = vx * state.maxVelocity;
    state.input.y = vy * state.maxVelocity;
  } else {
    state.input.x = 0;
    state.input.y = 0;
  }

  if (rotationTouch) {
    const w =
      ((rotationTouch.x1 - rotationTouch.x0) / maxRotationalVelocityInPixels) *
      state.maxRotationalVelocity;
    state.input.w =
      Math.sign(w) * Math.min(Math.abs(w), state.maxRotationalVelocity);
  } else {
    state.input.w = 0;
  }

  // wsManager.send(state.input);
}

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();

  for (const touch of event.changedTouches) {
    if (!touch.identifier in state.touches) {
      continue;
    }

    state.touches[touch.identifier] = {
      ...state.touches[touch.identifier],
      x1: touch.clientX,
      y1: touch.clientY,
    };
  }

  updateInput();
  render();
});

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();

  for (const touch of event.changedTouches) {
    if (!touch.identifier in state.touches) {
      continue;
    }

    delete state.touches[touch.identifier];
  }

  updateInput();
  render();
});

let wsManager;

export function runGui(_wsManager) {
  wsManager = _wsManager;

  img.src = "bg.jpeg";
  img.onload = () => render();
  window.onresize = () => render();
}
