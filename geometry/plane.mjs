export default {
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
