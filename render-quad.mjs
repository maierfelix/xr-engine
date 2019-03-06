import RenderObject from "./render-object.mjs";

const mesh = {
  positions: new Float32Array([
    -1, +1,
    -1, -1,
    +1, +1,
    +1, -1
  ])
};

mesh.positions.stride = 2.0;

export default class RenderQuad extends RenderObject {
  constructor(opts) {
    opts.mesh = mesh;
    super(opts);
  }
};
