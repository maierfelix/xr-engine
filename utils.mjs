let uiid = 0;

/**
 * Context options for webgl
 * @return {Object}
 */
export const RenderingContextOptions = {
  alpha: true,
  antialias: true,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance"
};

/**
 * Returns a unique number
 * @return {Number}
 */
export function uid() {
  return uiid++;
};

/**
 * Indicates if a number is power of two
 * @param {Number} v
 * @return {Boolean}
 */
export function isPowerOf2(v) {
  return (v & (v - 1)) === 0;
};

/**
 * Clamps number into given range
 * @param {Number} value
 * @param {Number} min
 * @param {Number} max
 * @return {Number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
};

/**
 * Loads and resolves a text
 * @param {String} path - Path to the text
 * @return {Promise}
 */
export function loadText(path) {
  return new Promise(resolve => {
    fetch(path + "?" + Date.now())
    .then(resp => resp.text())
    .then(text => resolve(text));
  });
};

/**
 * Loads and resolves a model
 * @param {String} path - Path to the model
 * @return {Promise}
 */
export function loadObjectFile(path) {
  return new Promise(resolve => {
    loadText(path).then(data => {
      let mesh = new OBJ.Mesh(data);
      let model = {
        positions: new Float32Array(mesh.vertices),
        indices: new Uint16Array(mesh.indices),
        normals: new Float32Array(mesh.vertexNormals),
        uvs: new Float32Array(mesh.textures)
      };
      resolve(model);
    });
  });
};

/**
 * Loads and resolves a binary file
 * @param {String} path - Path to the text
 * @return {Promise}
 */
export function loadBinaryFile(path) {
  return new Promise(resolve => {
    fetch(path + "?" + Date.now())
    .then(resp => resp.arrayBuffer())
    .then(buffer => resolve(new Uint8Array(buffer)));
  });
};

/**
 * Loads and resolves an image
 * @param {String} path - Path to the image
 * @return {Promise}
 */
export function loadImage(path) {
  return new Promise(resolve => {
    let img = new Image();
    img.onload = () => resolve(img);
    img.src = path + "?" + Date.now();
  });
};

/**
 * Loads an image and resolves it as a canvas
 * @param {String} path - Path to the image
 * @return {Promise}
 */
export function loadImageAsCanvas(path) {
  return new Promise(resolve => {
    loadImage(path + "?" + Date.now()).then(img => {
      let width = img.width;
      let height = img.height;
      let buffer = createCanvasBuffer(width, height);
      let canvas = buffer.canvas;
      buffer.drawImage(img, 0, 0);
      resolve(canvas);
    });
  });
};

/**
 * Creates a canvas with the given dimensions
 * @param {Number} width
 * @param {Number} height
 * @return {Canvas2DRenderingContext}
 */
export function createCanvasBuffer(width, height) {
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  return ctx;
};

/**
 * Returns the binary data representation of an image
 * @param {HTMLImageElement}
 * @return {Uint8Array}
 */
export function getImageBinaryData(img) {
  let {width, height} = img;
  let ctx = createCanvasBuffer(width, height);
  let {canvas} = ctx;
  ctx.drawImage(
    img,
    0, 0
  );
  let data = ctx.getImageData(0, 0, width, height).data;
  return new Uint8Array(data);
};

/**
 * CLones a mouse event
 * @param {MouseEvent} e
 * @return {Object}
 */
export function cloneMouseEvent(e) {
  let clone = {};
  for (let key in e) {
    clone[key] = e[key];
  };
  return clone;
};

/**
 * Returns ray-triangle intersection and face
 * @param {Ray} ray
 * @param {Float32Array} v0
 * @param {Float32Array} v1
 * @param {Float32Array} v2
 * @return {Object}
 */
export function rayTriangleIntersection(ray, v0, v1, v2) {
  let e1 = vec3.sub(vec3.create(), v1, v0);
  let e2 = vec3.sub(vec3.create(), v2, v0);
  let r = vec3.cross(vec3.create(), ray.direction, e2);

  let s = vec3.sub(vec3.create(), ray.origin, v0);
  let a = vec3.dot(e1, r);
  let f = 1.0 / a;
  let q = vec3.cross(vec3.create(), s, e1);

  let u = vec3.dot(s, r);
  let v = vec3.dot(ray.direction, q);
  let w = 1.0 - (u + v);

  // front-facing
  if (a > 0.000001) {
    if (u < 0.0 || u > a) return null;
    if (v < 0.0 || u + v > a) return null;
  }
  // back-facing
  else if (a < -0.000001) {
    if (u > 0.0 || u < a) return null;
    if (v > 0.0 || u + v < a) return null;
  }
  // parallel
  else {
    return null;
  }

  let t = vec3.dot(e2, q) / a;
  let position = vec3.scaleAndAdd(vec3.create(), ray.origin, ray.direction, t);
  let frontFacing = a > 0.000001;

  return {
    position,
    frontFacing
  };
};

/**
 * Calculates normals given a indexed mesh
 * @param {Float32Array} vertices
 * @param {Float32Array} indices
 * @param {Boolean} smoothen normals
 * @return {Float32Array} normals
 */
export function calculateNormals(vertices, indices, smooth = true) {
  let normals = new Float32Array(vertices.length);
  for (let ii = 0; ii < indices.length; ii += 3) {
    let i0 = indices[ii + 0] * 3;
    let i1 = indices[ii + 1] * 3;
    let i2 = indices[ii + 2] * 3;
    let v0 = vertices.subarray(i0, i0 + 3);
    let v1 = vertices.subarray(i1, i1 + 3);
    let v2 = vertices.subarray(i2, i2 + 3);
    let n0 = normals.subarray(i0, i0 + 3);
    let n1 = normals.subarray(i1, i1 + 3);
    let n2 = normals.subarray(i2, i2 + 3);
    let a = vec3.sub(vec3.create(), v1, v0);
    let b = vec3.sub(vec3.create(), v2, v0);
    let n = vec3.cross(vec3.create(), b, a);
    let a1 = vec3.angle(
      vec3.sub(vec3.create(), v1, v0),
      vec3.sub(vec3.create(), v2, v0)
    );
    let a2 = vec3.angle(
      vec3.sub(vec3.create(), v2, v1),
      vec3.sub(vec3.create(), v0, v1)
    );
    let a3 = vec3.angle(
      vec3.sub(vec3.create(), v0, v2),
      vec3.sub(vec3.create(), v1, v2)
    );
    if (!smooth) a1 = a2 = a3 = 1.0;
    vec3.add(n0, n0, vec3.scale(vec3.create(), n, a1));
    vec3.add(n1, n1, vec3.scale(vec3.create(), n, a2));
    vec3.add(n2, n2, vec3.scale(vec3.create(), n, a3));
  };
  // normalize
  for (let ii = 0; ii < indices.length; ii += 3) {
    let n0 = normals.subarray(ii + 0, ii + 3);
    vec3.normalize(n0, n0);
  };
  return normals;
};

/**
 * Calculates the tangents and bitangents
 * @return {Object} tangents, bitangents
 */
export function calculateTangentsBitangents(data) {
  let {
    uvs,
    normals,
    indices,
    positions
  } = data;
  let tangents = new Float32Array(positions.length);
  let bitangents = new Float32Array(positions.length);
  for (let ii = 0; ii < indices.length; ii += 3) {
    let i0 = indices[ii + 0];
    let i1 = indices[ii + 1];
    let i2 = indices[ii + 2];

    let x_v0 = positions[i0 * 3 + 0];
    let y_v0 = positions[i0 * 3 + 1];
    let z_v0 = positions[i0 * 3 + 2];

    let x_uv0 = uvs[i0 * 2 + 0];
    let y_uv0 = uvs[i0 * 2 + 1];

    let x_v1 = positions[i1 * 3 + 0];
    let y_v1 = positions[i1 * 3 + 1];
    let z_v1 = positions[i1 * 3 + 2];

    let x_uv1 = uvs[i1 * 2 + 0];
    let y_uv1 = uvs[i1 * 2 + 1];

    let x_v2 = positions[i2 * 3 + 0];
    let y_v2 = positions[i2 * 3 + 1];
    let z_v2 = positions[i2 * 3 + 2];

    let x_uv2 = uvs[i2 * 2 + 0];
    let y_uv2 = uvs[i2 * 2 + 1];

    let x_deltaPos1 = x_v1 - x_v0;
    let y_deltaPos1 = y_v1 - y_v0;
    let z_deltaPos1 = z_v1 - z_v0;

    let x_deltaPos2 = x_v2 - x_v0;
    let y_deltaPos2 = y_v2 - y_v0;
    let z_deltaPos2 = z_v2 - z_v0;

    let x_uvDeltaPos1 = x_uv1 - x_uv0;
    let y_uvDeltaPos1 = y_uv1 - y_uv0;

    let x_uvDeltaPos2 = x_uv2 - x_uv0;
    let y_uvDeltaPos2 = y_uv2 - y_uv0;

    let rInv = x_uvDeltaPos1 * y_uvDeltaPos2 - y_uvDeltaPos1 * x_uvDeltaPos2;
    let r = 1.0 / (Math.abs(rInv < 0.0001) ? 1.0 : rInv);

    // tangent
    let x_tangent = (x_deltaPos1 * y_uvDeltaPos2 - x_deltaPos2 * y_uvDeltaPos1) * r;
    let y_tangent = (y_deltaPos1 * y_uvDeltaPos2 - y_deltaPos2 * y_uvDeltaPos1) * r;
    let z_tangent = (z_deltaPos1 * y_uvDeltaPos2 - z_deltaPos2 * y_uvDeltaPos1) * r;

    // bitangent
    let x_bitangent = (x_deltaPos2 * x_uvDeltaPos1 - x_deltaPos1 * x_uvDeltaPos2) * r;
    let y_bitangent = (y_deltaPos2 * x_uvDeltaPos1 - y_deltaPos1 * x_uvDeltaPos2) * r;
    let z_bitangent = (z_deltaPos2 * x_uvDeltaPos1 - z_deltaPos1 * x_uvDeltaPos2) * r;

    // Gram-Schmidt orthogonalize
    //t = glm::normalize(t - n * glm:: dot(n, t));
    let x_n0 = normals[i0 * 3 + 0];
    let y_n0 = normals[i0 * 3 + 1];
    let z_n0 = normals[i0 * 3 + 2];

    let x_n1 = normals[i1 * 3 + 0];
    let y_n1 = normals[i1 * 3 + 1];
    let z_n1 = normals[i1 * 3 + 2];

    let x_n2 = normals[i2 * 3 + 0];
    let y_n2 = normals[i2 * 3 + 1];
    let z_n2 = normals[i2 * 3 + 2];

    // tangent
    let n0_dot_t = x_tangent * x_n0 + y_tangent * y_n0 + z_tangent * z_n0;
    let n1_dot_t = x_tangent * x_n1 + y_tangent * y_n1 + z_tangent * z_n1;
    let n2_dot_t = x_tangent * x_n2 + y_tangent * y_n2 + z_tangent * z_n2;

    let x_resTangent0 = x_tangent - x_n0 * n0_dot_t;
    let y_resTangent0 = y_tangent - y_n0 * n0_dot_t;
    let z_resTangent0 = z_tangent - z_n0 * n0_dot_t;

    let x_resTangent1 = x_tangent - x_n1 * n1_dot_t;
    let y_resTangent1 = y_tangent - y_n1 * n1_dot_t;
    let z_resTangent1 = z_tangent - z_n1 * n1_dot_t;

    let x_resTangent2 = x_tangent - x_n2 * n2_dot_t;
    let y_resTangent2 = y_tangent - y_n2 * n2_dot_t;
    let z_resTangent2 = z_tangent - z_n2 * n2_dot_t;

    let magTangent0 = Math.sqrt(
      x_resTangent0 * x_resTangent0 + y_resTangent0 * y_resTangent0 + z_resTangent0 * z_resTangent0
    );
    let magTangent1 = Math.sqrt(
      x_resTangent1 * x_resTangent1 + y_resTangent1 * y_resTangent1 + z_resTangent1 * z_resTangent1
    );
    let magTangent2 = Math.sqrt(
      x_resTangent2 * x_resTangent2 + y_resTangent2 * y_resTangent2 + z_resTangent2 * z_resTangent2
    );

    // bitangent
    let n0_dot_bt = x_bitangent * x_n0 + y_bitangent * y_n0 + z_bitangent * z_n0;
    let n1_dot_bt = x_bitangent * x_n1 + y_bitangent * y_n1 + z_bitangent * z_n1;
    let n2_dot_bt = x_bitangent * x_n2 + y_bitangent * y_n2 + z_bitangent * z_n2;

    let x_resBitangent0 = x_bitangent - x_n0 * n0_dot_bt;
    let y_resBitangent0 = y_bitangent - y_n0 * n0_dot_bt;
    let z_resBitangent0 = z_bitangent - z_n0 * n0_dot_bt;

    let x_resBitangent1 = x_bitangent - x_n1 * n1_dot_bt;
    let y_resBitangent1 = y_bitangent - y_n1 * n1_dot_bt;
    let z_resBitangent1 = z_bitangent - z_n1 * n1_dot_bt;

    let x_resBitangent2 = x_bitangent - x_n2 * n2_dot_bt;
    let y_resBitangent2 = y_bitangent - y_n2 * n2_dot_bt;
    let z_resBitangent2 = z_bitangent - z_n2 * n2_dot_bt;

    let magBitangent0 = Math.sqrt(
      x_resBitangent0 * x_resBitangent0 +
      y_resBitangent0 * y_resBitangent0 +
      z_resBitangent0 * z_resBitangent0
    );
    let magBitangent1 = Math.sqrt(
      x_resBitangent1 * x_resBitangent1 +
      y_resBitangent1 * y_resBitangent1 +
      z_resBitangent1 * z_resBitangent1
    );
    let magBitangent2 = Math.sqrt(
      x_resBitangent2 * x_resBitangent2 +
      y_resBitangent2 * y_resBitangent2 +
      z_resBitangent2 * z_resBitangent2
    );

    tangents[i0 * 3 + 0] += x_resTangent0 / magTangent0;
    tangents[i0 * 3 + 1] += y_resTangent0 / magTangent0;
    tangents[i0 * 3 + 2] += z_resTangent0 / magTangent0;

    tangents[i1 * 3 + 0] += x_resTangent1 / magTangent1;
    tangents[i1 * 3 + 1] += y_resTangent1 / magTangent1;
    tangents[i1 * 3 + 2] += z_resTangent1 / magTangent1;

    tangents[i2 * 3 + 0] += x_resTangent2 / magTangent2;
    tangents[i2 * 3 + 1] += y_resTangent2 / magTangent2;
    tangents[i2 * 3 + 2] += z_resTangent2 / magTangent2;

    bitangents[i0 * 3 + 0] += x_resBitangent0 / magBitangent0;
    bitangents[i0 * 3 + 1] += y_resBitangent0 / magBitangent0;
    bitangents[i0 * 3 + 2] += z_resBitangent0 / magBitangent0;

    bitangents[i1 * 3 + 0] += x_resBitangent1 / magBitangent1;
    bitangents[i1 * 3 + 1] += y_resBitangent1 / magBitangent1;
    bitangents[i1 * 3 + 2] += z_resBitangent1 / magBitangent1;

    bitangents[i2 * 3 + 0] += x_resBitangent2 / magBitangent2;
    bitangents[i2 * 3 + 1] += y_resBitangent2 / magBitangent2;
    bitangents[i2 * 3 + 2] += z_resBitangent2 / magBitangent2;
  };

  return { tangents, bitangents };
};
