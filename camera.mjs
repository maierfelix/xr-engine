import Ray from "./ray.mjs";

class Camera {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.viewMatrix = mat4.create();
    this.projectionMatrix = mat4.create();
    this.viewProjectionMatrix = mat4.create();
    this.viewInverseMatrix = mat4.create();
    this.projectionInverseMatrix = mat4.create();
    this.modelViewInverseMatrix = mat4.create();
    this.viewProjectionInverseMatrix = mat4.create();
    this.transforms = {
      translation: vec3.create(),
      rotation: vec3.create(),
      forward: vec3.create(),
      up: vec3.create()
    };
    this.velocity = {
      translation: vec3.fromValues(0.0, 0.0, 0.0),
      rotation: vec3.create()
    };
    this.settings = {
      aspect: 0.0,
      FOV: 45.0 * Math.PI / 180,
      zNear: 0.1,
      zFar: 2048.0
    };
    this.mode = Camera.MODE_FREE;
    this.needsUpdate = true;
  }
};

Camera.prototype.getViewMatrix = function() { return this.viewMatrix; };
Camera.prototype.getProjectionMatrix = function() { return this.projectionMatrix; };
Camera.prototype.getViewProjectionMatrix = function() { return this.viewProjectionMatrix; };

Camera.prototype.getViewInverseMatrix = function() { return this.viewInverseMatrix; };
Camera.prototype.getProjectionInverseMatrix = function() { return this.projectionInverseMatrix; };
Camera.prototype.getViewProjectionInverseMatrix = function() { return this.viewProjectionInverseMatrix; };

Camera.prototype.getModelViewInverseMatrix = function(object) {
  let mView = this.getViewMatrix();
  let mModel = object.getModelMatrix();
  let mModelViewInverse = this.modelViewInverseMatrix;
  mat4.identity(mModelViewInverse);
  mat4.multiply(mModelViewInverse, mView, mModel);
  mat4.invert(mModelViewInverse, mModelViewInverse);
  return mModelViewInverse;
};

Camera.prototype.resize = function(width, height) {
  let {settings} = this;
  let mProjection = this.getProjectionMatrix();
  this.width = width;
  this.height = height;
  settings.aspect = width / height;
  mat4.identity(mProjection);
  mat4.perspective(
    mProjection,
    settings.FOV,
    settings.aspect,
    settings.zNear,
    settings.zFar
  );
};

Camera.prototype.update = function(reset = false) {
  let {transforms} = this;
  let {rotation, translation} = transforms;
  let {up, forward} = transforms;
  let mView = this.getViewMatrix();
  let mProjection = this.getProjectionMatrix();
  let mProjectionInverse = this.getProjectionInverseMatrix();
  let mViewProjection = this.getViewProjectionMatrix();
  let mViewInverse = this.getViewInverseMatrix();
  let mViewProjectionInverse = this.getViewProjectionInverseMatrix();
  this.needsUpdate = false;
  // smooth translation
  if (!reset) {
    {
      let velocity = this.velocity.translation;
      if (vec3.length(velocity) <= 0.0001) vec3.set(velocity, 0.0, 0.0, 0.0);
      else this.needsUpdate = true;
      vec3.scale(velocity, velocity, 0.75);
      this.move(velocity);
    }
    // smooth rotation
    {
      let velocity = this.velocity.rotation;
      if (vec3.length(velocity) <= 0.0001) vec3.set(velocity, 0.0, 0.0, 0.0);
      else this.needsUpdate = true;
      vec3.scale(velocity, velocity, 0.6125);
      this.look(velocity);
    }
    // view matrix
    {
      mat4.identity(mView);
      mat4.rotateX(mView, mView, rotation[0]);
      mat4.rotateY(mView, mView, rotation[1]);
      mat4.rotateZ(mView, mView, rotation[2]);
      mat4.translate(mView, mView, vec3.negate(vec3.create(), translation));
    }
    // up, forward vector
    {
      vec3.set(up, mView[0], mView[4], mView[8]);
      vec3.set(forward, mView[2], mView[6], mView[10]);
      vec3.normalize(up, up);
      vec3.normalize(forward, forward);
    }
  }
  // projection inverse
  {
    mat4.invert(
      mProjectionInverse,
      mProjection
    );
  }
  // view inverse
  {
    mat4.invert(mViewInverse, mView);
  }
  // view projection
  {
    mat4.multiply(mViewProjection, mProjection, mView);
  }
  // projection view inverse
  {
    mat4.invert(mViewProjectionInverse, mViewProjection);
  }
};

Camera.prototype.control = function(move, dx, dy) {
  let dir = vec3.create();
  let speed = 4.0 * Time.delta;
  if (move[0]) dir[2] += speed;
  else if (move[1]) dir[2] -= speed;
  if (move[2]) dir[0] += speed * 1.0;
  else if (move[3]) dir[0] -= speed * 1.0;
  if (move[4]) dir[1] -= speed;
  else if (move[5]) dir[1] += speed;
  // accelerate
  {
    let {rotation, translation} = this.velocity;
    vec3.add(translation, translation, dir);
    vec3.add(rotation, rotation, vec3.fromValues(dx, dy, 0.0));
  }
};

Camera.prototype.move = function(direction) {
  let dir = vec3.clone(direction);
  let rotX = vec3.fromValues(1.0, 0.0, 0.0);
  let rotY = vec3.fromValues(0.0, 1.0, 0.0);
  let {rotation, translation} = this.transforms;
  vec3.rotateX(dir, dir, rotX, -rotation[0]);
  vec3.rotateY(dir, dir, rotY, -rotation[1]);
  vec3.add(translation, translation, vec3.negate(vec3.create(), dir));
};

Camera.prototype.look = function(rot) {
  let {rotation} = this.transforms;
  rotation[0] += rot[1] * Time.delta;
  rotation[1] += rot[0] * Time.delta;
  if (rotation[0] < -Math.PI * 0.5) rotation[0] = -Math.PI * 0.5;
  if (rotation[0] > Math.PI * 0.5) rotation[0] = Math.PI * 0.5;
};

Camera.prototype.screenToWorldPoint = function(pt) {
  let out = vec3.create();
  let mViewProjectionInverse = this.getViewProjectionInverseMatrix();
  let x = (2.0 * pt[0] / this.width) - 1.0;
  let y = (this.height - 2.0 * pt[1]) / this.height;
  let z = 2.0 * pt[2] - 1.0;
  vec3.set(out, x, y, z);
  vec3.transformMat4(out, out, mViewProjectionInverse);
  return out;
};

Camera.prototype.worldToScreenPoint = function(pt) {
  let mView = this.getViewMatrix();
  let mProjection = this.getProjectionMatrix();
  let out = vec2.create();
  let v = vec3.copy(vec3.create(), pt);
  vec3.transformMat4(v, v, mView);
  vec3.transformMat4(v, v, mProjection);
  out[0] = Math.round(((v[0] + 1.0) * 0.5) * this.width);
  out[1] = Math.round(((1.0 - v[1]) * 0.5) * this.height);
  return out;
};

{
  let uid = 0;
  Camera.MODE_FREE = uid++;
  Camera.MODE_CUSTOM = uid++;
}

export default Camera;
