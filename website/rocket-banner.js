.rocket-banner {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

#rocketCanvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

#rocket {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 55px;
  height: auto;
  pointer-events: none;
  z-index: 3;
  transform-origin: center center;
  will-change: left, top, transform;
}
