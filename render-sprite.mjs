import RenderObject from "./render-object.mjs";

const mesh = {
  positions: new Float32Array([
    -1, 0, -1,
     1, 0, -1,
     1, 0,  1,
    -1, 0,  1
  ]),
  normals: new Float32Array([
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0
  ]),
  uvs: new Float32Array([
    1, 1,
    1, 0,
    0, 0,
    0, 1
  ]),
  indices: new Uint16Array([
    0, 1, 2,
    2, 3, 0
  ])
};

export default class RenderSprite extends RenderObject {
  constructor(opts) {
    opts.mesh = mesh;
    super(opts);
  }
};

RenderSprite.prototype.getTexturePixelFromRay = function(texture, ray) {
  let worldRay = vec3.create();
  let mModelInverse = this.getModelInverseMatrix();
  vec3.transformMat4(worldRay, ray, mModelInverse);
  let x = Math.floor((0.5 + -worldRay[2] / 2) * texture.width);
  let y = Math.floor((0.5 + -worldRay[0] / 2) * texture.height);
  let index = y * texture.width + x;
  let start = index * 4 + 0;
  let end = index * 4 + 4;
  let pixel = texture.data.subarray(start, end);
  return pixel;
};
