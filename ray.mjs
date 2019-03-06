class Ray {
  constructor(opts) {
    this.gl = opts.gl || null;
    this.origin = opts ? (opts.origin || vec3.create()) : null;
    this.direction = opts ? (opts.direction || vec3.create()) : null;
  }
};

Ray.prototype.fromMousePosition = function(x, y) {
  let {gl} = this;
  let {camera} = gl;
  let deviceCoords = this.getDeviceCoords(x, y);
  let clipCoords = this.getClipCoords(deviceCoords);
  let cameraCoords = this.getCameraCoords(clipCoords);
  let direction = this.getRayCoords(cameraCoords);
  let origin = camera.transforms.translation;
  this.origin = origin;
  this.direction = direction;
  return this;
};

Ray.prototype.getDeviceCoords = function(x, y) {
  let {gl} = this;
  let {camera} = gl;
  let deviceCoords = vec2.create();
  let rx = (2.0 * x) / camera.width - 1.0;
  let ry = (2.0 * y) / camera.height - 1.0;
  vec2.set(deviceCoords, rx, ry);
  return deviceCoords;
};

Ray.prototype.getClipCoords = function(deviceCoords) {
  let clipCoords = vec4.create();
  vec4.set(clipCoords, deviceCoords[0], -deviceCoords[1], -1.0, 1.0);
  return clipCoords;
};

Ray.prototype.getCameraCoords = function(clipCoords) {
  let {gl} = this;
  let {camera} = gl;
  let cameraCoords = vec4.create();
  let mProjectionInverse = camera.projectionInverseMatrix;
  let eyeCoords = vec4.create();
  vec4.transformMat4(eyeCoords, clipCoords, mProjectionInverse);
  vec4.set(cameraCoords, eyeCoords[0], eyeCoords[1], -1.0, 0.0);
  return cameraCoords;
};

Ray.prototype.getRayCoords = function(cameraCoords) {
  let {gl} = this;
  let {camera} = gl;
  let worldCoords = vec3.create();
  let rayCoords = vec3.create();
  let mViewInverse = camera.viewInverseMatrix;
  vec4.transformMat4(worldCoords, cameraCoords, mViewInverse);
  vec3.copy(rayCoords, worldCoords);
  vec3.normalize(rayCoords, rayCoords);
  return rayCoords;
};

export default Ray;
