import {
  uid,
  loadObjectFile,
  rayTriangleIntersection,
  calculateTangentsBitangents 
} from "./utils.mjs";

class RenderObject {
  constructor({ gl, mesh, textures } = _) {
    this.uid = uid();
    this.name = "";
    this.shader = programs["object"];
    this.gl = gl;
    this.mesh = {
      positions: null,
      normals: null,
      uvs: null,
      indices: null,
      opacity: null,
      vao: null,
      buffers: null
    };
    this.textures = textures || null;
    this.cullingMode = RenderObject.CULL_BACK;
    this.isTransparent = false;
    this.parent = null;
    this.transforms = {
      translation: vec3.create(),
      rotation: quat.create(),
      scaling: vec3.fromValues(1.0, 1.0, 1.0),
      texture: {
        translation: vec2.fromValues(0.0, 0.0),
        scaling: vec2.fromValues(1.0, 1.0)
      }
    };
    this.boundings = {
      min: vec3.create(),
      max: vec3.create()
    };
    this.matrices = {
      rotationMatrix: mat4.create(),
      modelMatrix: mat4.create(),
      normalMatrix: mat4.create(),
      modelViewMatrix: mat4.create(),
      modelInverseMatrix: mat4.create()
    };
    if (mesh) this.useMesh(mesh);
    RenderObject.objects.push(this);
  }
};

RenderObject.find = function(search) {
  let objects = RenderObject.objects;
  // return all objects
  if (typeof search === "string" && search === "*") {
    let out = [];
    for (let ii = 0; ii < objects.length; ++ii) {
      let object = objects[ii];
      if (object.parent) continue;
      out.push(object);
    };
    return out;
  }
  // search by name
  else if (typeof search === "string") {
    for (let ii = 0; ii < objects.length; ++ii) {
      let object = objects[ii];
      if (object.parent) continue;
      if (object.name === search) return object;
    };
    return null;
  }
  // search by class
  else if (typeof search === "function") {
    let out = [];
    let ctor = search.name;
    for (let ii = 0; ii < objects.length; ++ii) {
      let object = objects[ii];
      if (object.parent) continue;
      if (object.constructor.name === ctor) out.push(object);
    };
    return out;
  }
  console.warn(`Invalid search condition in ${this.constructor.name}.find`);
  return null;
};

RenderObject.prototype.getRotationMatrix = function() { return this.matrices.rotationMatrix; };

RenderObject.prototype.getModelMatrix = function() { return this.matrices.modelMatrix; };
RenderObject.prototype.getNormalMatrix = function() { return this.matrices.normalMatrix; };
RenderObject.prototype.getModelViewMatrix = function() { return this.matrices.modelViewMatrix; };

RenderObject.prototype.getModelInverseMatrix = function() { return this.matrices.modelInverseMatrix; };
RenderObject.prototype.getModelViewInverseMatrix = function() {
  let {gl} = this;
  let {camera} = gl;
  return camera.getModelViewInverseMatrix(this);
};

RenderObject.prototype.update = function() {
  this.transform();
};

RenderObject.prototype.fromObjectFile = function(path, resolve) {
  let {parent} = this;
  let loadPath = "";
  if (parent && parent.basePath) loadPath += parent.basePath;
  loadPath += path;
  loadObjectFile(loadPath).then(mesh => {
    this.useMesh(mesh);
    if (resolve instanceof Function) resolve(mesh);
  });
  return this;
};

RenderObject.prototype.useTransforms = function(target) {
  let local = this.transforms;
  // object
  vec3.copy(local.translation, target.translation);
  quat.copy(local.rotation, target.rotation);
  vec3.copy(local.scaling, target.scaling);
  // texture
  vec3.copy(local.texture.translation, target.texture.translation);
  vec3.copy(local.texture.scaling, target.texture.scaling);
};

RenderObject.prototype.transform = function(parent = null) {
  let mModel = this.getModelMatrix();
  let mNormal = this.getNormalMatrix();
  let mModelInverse = this.getModelInverseMatrix();
  let mRotation = this.getRotationMatrix();
  let {translation, rotation, scaling} = this.transforms;
  // reset
  mat4.identity(mModel);
  mat4.identity(mNormal);
  mat4.identity(mRotation);
  mat4.translate(
    mModel,
    mModel,
    translation
  );
  quat.normalize(rotation, rotation);
  mat4.fromQuat(mRotation, rotation);
  mat4.multiply(mModel, mModel, mRotation);
  mat4.scale(
    mModel,
    mModel,
    scaling
  );
  // transform relative to parent if necessary
  if (parent) {
    let mModelParent = parent.getModelMatrix();
    mat4.multiply(mModel, mModelParent, mModel);
  }
  mat4.invert(mNormal, mModel);
  // sneaky steal the inverse model matrix from here
  mat4.copy(mModelInverse, mNormal);
  mat4.transpose(mNormal, mNormal);
  //this.transformAABB();
};

RenderObject.prototype.transformAABB = function() {
  let {positions} = this.mesh;
  if (!positions) return;
  let {min, max} = this.boundings;
  let mModel = this.getModelMatrix();
  let vertex = vec4.create();
  let mm = Number.MAX_SAFE_INTEGER;
  let length = (positions.length / 3) | 0;
  vec3.set(min, +mm, +mm, +mm);
  vec3.set(max, -mm, -mm, -mm);
  for (let ii = 0; ii < length; ++ii) {
    let index = (ii * 3) | 0;
    vec4.set(
      vertex,
      positions[index + 0],
      positions[index + 1],
      positions[index + 2],
      1.0
    );
    vec4.transformMat4(vertex, vertex, mModel);
    let x = vertex[0];
    let y = vertex[1];
    let z = vertex[2];
    // min
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    // max
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  };
};

RenderObject.prototype.draw = function(program, shadow = false) {
  let {gl} = this;
  let {mesh} = this;
  if (!mesh.vao) return;
  if (!mesh.indices) return;
  // init
  this.useCullFaceState();
  if (this.isTransparent) {
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  program.set("uTextureScale", this.transforms.texture.scaling);
  program.set("uModelMatrix", this.getModelMatrix());
  program.set("uNormalMatrix", this.getNormalMatrix());
  gl.bindVertexArray(mesh.vao);
  // draw
  gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  // reset
  gl.bindVertexArray(null);
  this.resetCullFaceState();
  if (this.isTransparent) {
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }
};

RenderObject.prototype.drawShadow = function(light) {
  let {gl} = this;
  let {cullingMode} = this;
  // e.g. plane
  if (this.cullingMode === RenderObject.CULL_NONE) {
    this.cullingMode = RenderObject.CULL_NONE;
    let program = programs["depth-textured"];
    gl.useProgram(program.native);
    program.set("uShadowMatrix", light.shadowSpaceMatrix);
    this.draw(program, true);
  } else {
    this.cullingMode = RenderObject.CULL_FRONT;
    let program = programs["depth"];
    gl.useProgram(program.native);
    program.set("uShadowMatrix", light.shadowSpaceMatrix);
    this.draw(program, true);
  }
  this.cullingMode = cullingMode;
};

RenderObject.prototype.useCullFaceState = function() {
  let {gl} = this;
  let {cullingMode} = this;
  switch (cullingMode) {
    case RenderObject.CULL_NONE:
      gl.disable(gl.CULL_FACE);
    break;
    case RenderObject.CULL_FRONT:
      gl.cullFace(gl.FRONT);
    break;
    case RenderObject.CULL_BACK:
      gl.cullFace(gl.BACK);
    break;
    case RenderObject.CULL_FRONT_AND_BACK:
      gl.cullFace(gl.FRONT_AND_BACK);
    break;
  };
};

RenderObject.prototype.resetCullFaceState = function() {
  let {gl} = this;
  let {cullingMode} = this;
  switch (cullingMode) {
    case RenderObject.CULL_NONE:
      gl.enable(gl.CULL_FACE);
    break;
  };
  gl.cullFace(gl.BACK);
};

RenderObject.prototype.useMesh = function(mesh) {
  // save into local mesh
  for (let key in mesh) {
    if (this.mesh.hasOwnProperty(key)) {
      this.mesh[key] = mesh[key];
    }
  };
  let {positions, normals, uvs, indices, opacity} = mesh;
  let data = {positions, normals, uvs, indices, opacity};
  // tangents, bitangents
  if (data.positions && data.normals && data.uvs && data.indices) {
    let {tangents, bitangents} = calculateTangentsBitangents(data);
    data.tangents = tangents;
    data.bitangents = bitangents;
  }
  // barycentric
  if (data.positions) {
    let barycentric = new Float32Array(positions.length);
    for (let ii = 0; ii < barycentric.length; ++ii) {
      let index = ii * 9;
      // a
      barycentric[index + 0] = 1;
      barycentric[index + 1] = 0;
      barycentric[index + 2] = 0;
      // b
      barycentric[index + 3] = 0;
      barycentric[index + 4] = 1;
      barycentric[index + 5] = 0;
      // c
      barycentric[index + 6] = 0;
      barycentric[index + 7] = 0;
      barycentric[index + 8] = 1;
    };
    data.barycentric = barycentric;
  }
  let {vao, buffers} = this.upload(data);
  this.mesh.vao = vao;
  this.mesh.buffers = buffers;
};

RenderObject.prototype.clone = function() {
  let {
    gl,
    mesh,
    textures
  } = this;
  let clone = new RenderObject({ gl, textures });
  clone.mesh = mesh;
  clone.useTransforms(this.transforms);
  return clone;
};

RenderObject.prototype.intersect = function(ray) {
  let out = {
    intersects: false,
    normal: vec3.create(),
    intersection: vec3.create()
  };
  let {cullingMode} = this;
  let {transforms} = this;
  let {positions, normals, indices} = this.mesh;
  if (!positions || !normals || !indices) return out;
  let mModel = this.getModelMatrix();
  let mModelInverse = this.getModelInverseMatrix();
  let v0 = vec3.create();
  let v1 = vec3.create();
  let v2 = vec3.create();
  let normal = vec3.create();
  if (indices) {
    for (let ii = 0; ii < indices.length; ii += 3) {
      let i0 = indices[ii + 0] * 3;
      let i1 = indices[ii + 1] * 3;
      let i2 = indices[ii + 2] * 3;
      vec3.copy(v0, positions.subarray(i0 + 0, i0 + 3));
      vec3.copy(v1, positions.subarray(i1 + 0, i1 + 3));
      vec3.copy(v2, positions.subarray(i2 + 0, i2 + 3));
      vec3.transformMat4(v0, v0, mModel);
      vec3.transformMat4(v1, v1, mModel);
      vec3.transformMat4(v2, v2, mModel);
      // get the face normal
      vec3.copy(normal, normals.subarray(i0 + 0, i0 + 3));
      vec3.normalize(normal, normal);
      let intersection = rayTriangleIntersection(ray, v0, v1, v2);
      if (intersection !== null) {
        // hit on any intersection face
        if (cullingMode === RenderObject.CULL_NONE) {
          out.intersects = true;
          vec3.copy(out.intersection, intersection.position);
          vec3.transformMat4(out.intersection, out.intersection, mModelInverse);
          vec3.copy(out.normal, normal);
          return out;
        }
        // front culling enabled, ignore front face intersections
        else if (cullingMode === RenderObject.CULL_FRONT) {
          if (!intersection.frontFacing) {
            out.intersects = true;
            vec3.copy(out.intersection, intersection.position);
            vec3.transformMat4(out.intersection, out.intersection, mModelInverse);
            vec3.copy(out.normal, normal);
            return out;
          }
        }
        else if (intersection.frontFacing) {
          out.intersects = true;
          vec3.copy(out.intersection, intersection.position);
          vec3.transformMat4(out.intersection, out.intersection, mModelInverse);
          vec3.copy(out.normal, normal);
          return out;
        }
      }
    };
  } else {
    console.warn(`Ray intersection without indices not supported yet!`);
  }
  return out;
};

RenderObject.prototype.isFrontFaceVertex = function(position, normal) {
  let mModelViewInverse = this.getModelViewInverseMatrix(this);
  let camPos = mModelViewInverse.subarray(12, 12 + 3);
  let pos = vec3.sub(vec3.create(), position, camPos);
  let norm = vec3.create();
  vec3.normalize(norm, vec3.negate(norm, normal));
  return vec3.dot(pos, norm) <= 0.0;
};

RenderObject.prototype.isBackFaceVertex = function(position, normal) {
  return !this.isFrontFaceVertex(position, normal);
};

RenderObject.prototype.getCameraDistance = function(camera) {
  let mView = camera.getViewMatrix();
  let mModel = this.getModelMatrix();
  let mModelView = this.getModelViewMatrix();
  let {translation} = this.transforms;
  let distance = vec3.create();
  mat4.identity(mModelView);
  mat4.multiply(mModelView, mView, mModel);
  vec3.transformMat4(distance, translation, mModelView);
  return distance;
};

RenderObject.prototype.createBuffer = function({ target, data, usage } = _) {
  let {gl} = this;
  if (!target) target = gl.ARRAY_BUFFER;
  if (!usage) usage = gl.STATIC_DRAW;
  let buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  return buffer;
};

RenderObject.prototype.updateBuffer = function({ name, data, target, usage } = _) {
  let {gl} = this;
  let {mesh} = this;
  let buffer = mesh.buffers[name];
  if (!buffer) return console.warn(`Invalid buffer access: Buffer ${name} is invalid!`);
  if (!target) target = gl.ARRAY_BUFFER;
  if (!usage) usage = gl.STATIC_DRAW;
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  gl.bindBuffer(target, null);
};

RenderObject.prototype.upload = function({
  positions,
  normals,
  tangents,
  bitangents,
  uvs,
  barycentric,
  opacity,
  indices
} = _) {
  let {gl} = this;
  let vao = gl.createVertexArray();
  let buffers = {};
  let stride = 0;
  let offset = 0;
  gl.bindVertexArray(vao);
  if (positions) {
    let id = 0;
    let buffer = this.createBuffer({ data: positions });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, positions.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.positions = buffer;
  }
  if (normals) {
    let id = 1;
    let buffer = this.createBuffer({ data: normals });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, normals.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.normals = buffer;
  }
  if (tangents) {
    let id = 2;
    let buffer = this.createBuffer({ data: tangents });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, tangents.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.tangents = buffer;
  }
  if (bitangents) {
    let id = 3;
    let buffer = this.createBuffer({ data: bitangents });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, bitangents.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.bitangents = buffer;
  }
  if (uvs) {
    let id = 4;
    let buffer = this.createBuffer({ data: uvs });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, uvs.stride || 2, gl.FLOAT, false, stride, offset);
    buffers.uvs = buffer;
  }
  {
    let id = 5;
    let buffer = this.createBuffer({ data: barycentric });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, barycentric.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.barycentric = buffer;
  }
  if (opacity) {
    let id = 6;
    let buffer = this.createBuffer({ data: opacity });
    gl.enableVertexAttribArray(id);
    gl.vertexAttribPointer(id, opacity.stride || 3, gl.FLOAT, false, stride, offset);
    buffers.opacity = buffer;
  }
  if (indices) {
    let buffer = this.createBuffer({ target: gl.ELEMENT_ARRAY_BUFFER, data: indices });
    buffers.indices = buffer;
  }
  // reset
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  return { vao, buffers };
};

RenderObject.objects = [];

// face culling modes
{
  let idx = 0;
  RenderObject.CULL_NONE = idx++;
  RenderObject.CULL_FRONT = idx++;
  RenderObject.CULL_BACK = idx++;
  RenderObject.CULL_FRONT_AND_BACK = idx++;
}

export default RenderObject;
