import {
  uid
} from "./utils.mjs";

import FrameBuffer from "./framebuffer.mjs";
import RenderObject from "./render-object.mjs";

/**
 * A directional light
 * @class DirectionalLight
 */
export default class DirectionalLight {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    this.uid = uid();
    this.gl = opts.gl;
    this.camera = opts.camera;
    this.splits = [];
    this.direction = null;
    this.init();
  }
};

DirectionalLight.prototype.init = function() {
  this.initLight();
  this.initParallelSplitMaps();
};

DirectionalLight.prototype.initLight = function() {
  this.lightViewMatrix = mat4.create();
  this.shadowSpaceMatrix = mat4.create();
};

DirectionalLight.prototype.initParallelSplitMaps = function() {
  let {gl} = this;
  let {camera} = this;
  let splits = [...Array(DirectionalLight.PSSM_SPLITS)].map((v, index) => {
    let buffer = new FrameBuffer({
      gl,
      width: DirectionalLight.PSSM_DIMENSION,
      height: DirectionalLight.PSSM_DIMENSION,
      attachments: [{ format: gl.RGBA16F }]
    });
    let zNear = DirectionalLight.PSSM_SCHEMAS[(index * 2) + 0] * camera.settings.zNear;
    let zFar = DirectionalLight.PSSM_SCHEMAS[(index * 2) + 1] * camera.settings.zFar;
    let frustumCorners = [
      vec3.create(),
      vec3.create(),
      vec3.create(),
      vec3.create(),
      vec3.create(),
      vec3.create(),
      vec3.create(),
      vec3.create()
    ];
    let orthoMatrix = mat4.create();
    return { buffer, zNear, zFar, frustumCorners, orthoMatrix };
  });
  this.splits = splits;
};

DirectionalLight.prototype.update = function() {
  let {splits} = this;
  for (let ii = 0; ii < splits.length; ++ii) {
    let split = splits[ii];
    this.updateFrustum(split);
  };
};

DirectionalLight.prototype.updateFrustum = function(split) {
  let {camera} = this;
  let {FOV, aspect} = camera.settings;
  let {up, forward, translation} = camera.transforms;
  let {zNear, zFar, frustumCorners, orthoMatrix} = split;

  let right = vec3.cross(vec3.create(), up, forward);

  let tanFOV = Math.tan((FOV / 2.0) * Math.PI / 180);

  let heightNear = 2.0 * tanFOV * zNear;
  let widthNear = heightNear * aspect;
  let heightFar = 2.0 * tanFOV * zFar;
  let widthFar = heightFar * aspect;

  let centerNear = vec3.add(vec3.create(), translation, vec3.scale(vec3.create(), forward, zNear));
  let centerFar = vec3.add(vec3.create(), translation, vec3.scale(vec3.create(), forward, zFar));

  // near
  let cornerNL =  vec3.scale(vec3.create(), up, heightNear * 0.5);
  let cornerNR = vec3.scale(vec3.create(), right, widthNear * 0.5);
  let centerNL = vec3.sub(vec3.create(), cornerNL, cornerNR);
  let centerNR = vec3.add(vec3.create(), cornerNL, cornerNR);
  // far
  let cornerFL =  vec3.scale(vec3.create(), up, heightFar * 0.5);
  let cornerFR = vec3.scale(vec3.create(), right, widthFar * 0.5);
  let centerFL = vec3.sub(vec3.create(), cornerFL, cornerFR);
  let centerFR = vec3.add(vec3.create(), cornerFL, cornerFR);

  // near
  vec3.copy(frustumCorners[0], vec3.add(vec3.create(), centerNear, centerNL));
  vec3.copy(frustumCorners[1], vec3.add(vec3.create(), centerNear, centerNR));
  vec3.copy(frustumCorners[2], vec3.sub(vec3.create(), centerNear, centerNL));
  vec3.copy(frustumCorners[3], vec3.sub(vec3.create(), centerNear, centerNR));
  // far
  vec3.copy(frustumCorners[4], vec3.add(vec3.create(), centerFar, centerFL));
  vec3.copy(frustumCorners[5], vec3.add(vec3.create(), centerFar, centerFR));
  vec3.copy(frustumCorners[6], vec3.sub(vec3.create(), centerFar, centerFL));
  vec3.copy(frustumCorners[7], vec3.sub(vec3.create(), centerFar, centerFR));

  // to view space
  let mView = this.lightViewMatrix;
  vec3.transformMat4(frustumCorners[0], frustumCorners[0], mView);
  vec3.transformMat4(frustumCorners[1], frustumCorners[1], mView);
  vec3.transformMat4(frustumCorners[2], frustumCorners[2], mView);
  vec3.transformMat4(frustumCorners[3], frustumCorners[3], mView);
  vec3.transformMat4(frustumCorners[4], frustumCorners[4], mView);
  vec3.transformMat4(frustumCorners[5], frustumCorners[5], mView);
  vec3.transformMat4(frustumCorners[6], frustumCorners[6], mView);
  vec3.transformMat4(frustumCorners[7], frustumCorners[7], mView);

  // orthographic boundings
  {
    let {left, right, bottom, top, near, far} = this.getFrustumBoundings(frustumCorners);
    mat4.identity(orthoMatrix);
    let d = 15;
    let mOrtho = mat4.ortho(orthoMatrix, -d, d, -d, d, 0.5, 1000);

    let mLightView = this.lightViewMatrix;
    let position = [
      20,
      80,
      60
    ];
    let view = [0, 1, 0];
    let up = [0, 1, 0];
    mat4.identity(mLightView);
    mat4.lookAt(mLightView, position, view, up);
    mat4.translate(mLightView, mLightView, vec3.negate(vec3.create(), [
      camera.transforms.translation[0],
      0,
      camera.transforms.translation[2]
    ]));

    mat4.multiply(
      this.shadowSpaceMatrix,
      mOrtho,
      mLightView
    );

  }
};

DirectionalLight.prototype.getFrustumBoundings = function(frustumCorners) {
  let minX = 999999999, maxX = -999999999;
  let minY = 999999999, maxY = -999999999;
  let minZ = 999999999, maxZ = -999999999;
  for (let ii = 0; ii < frustumCorners.length; ++ii) {
    let corner = frustumCorners[ii];
    if (corner[0] < minX) minX = corner[0];
    if (corner[0] > maxX) maxX = corner[0];
    if (corner[1] < minY) minY = corner[1];
    if (corner[1] > maxY) maxY = corner[1];
    if (corner[2] < minZ) minZ = corner[2];
    if (corner[2] > maxZ) maxZ = corner[2];
  };
  return {
    left:   minX, right: maxX,
    bottom: minY, top:   maxY,
    near:   minZ, far:   maxZ
  };
};

DirectionalLight.prototype.drawObjectShadows = function() {
  let {gl} = this;
  let objects = RenderObject.find("*");
  let map = this.splits[0];
  let vp = gl.getParameter(gl.VIEWPORT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, map.buffer.buffer);
  gl.viewport(0, 0, DirectionalLight.PSSM_DIMENSION, DirectionalLight.PSSM_DIMENSION);
  gl.clearColor(1,1,1,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  for (let ii = 0; ii < objects.length; ++ii) {
    let object = objects[ii];
    object.drawShadow(this);
  };
  // revert viewport
  gl.viewport(vp[0], vp[1], vp[2], vp[3]);
};

DirectionalLight.PSSM_SPLITS = 6;
DirectionalLight.PSSM_DIMENSION = 4096.0;
DirectionalLight.PSSM_SCHEMAS = new Float32Array([
  -0.005, 0.005,
  -0.005, 0.01, 
   0.0,   0.02,
   0.01,  0.04,
   0.02,  0.06,
   0.05,  0.16
]);
