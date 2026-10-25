export const PRESETS = {
  lobotomy(H) { for (const l of [0, 1]) for (let h = 0; h < 16; h++) H.ablated.add(l * 16 + h); H.rebuild(); },
  mirror(H) { H.add({ type: 'layer', l: 5, op: 'invert', amt: -1 }); },
  dragon(H) { H.steer.a = ' dragon'; H.steer.b = ' dog'; H.steer.layer = 2; H.steer.alpha = 4; H.computeSteer(); },
  salad(H) { H.chaos = 45; H.rebuild(); },
  sad(H) { H.steer.a = ' sad'; H.steer.b = ' happy'; H.steer.layer = 3; H.steer.alpha = 5; H.computeSteer(); },
  stutter(H) { H.add({ type: 'wpe', op: 'zero', amt: 0 }); H.order = [0, 1, 2, 3, 6, 5, 4, 7]; },
};
