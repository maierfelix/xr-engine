import {
  uid,
  loadImage,
  isPowerOf2,
  loadImageAsCanvas,
  getImageBinaryData
} from "./utils.mjs";

/**
 * A basic texture
 * @class Texture
 */
export default class Texture {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    this.uid = uid();
    this.gl = opts.gl;
    this.binary = !!opts.binary;
    this.pixelated = !!opts.pixelated;
    this.onload = opts.onload || null;
    // texture options
    {
      let {gl} = this;
      if (!opts.wrap) opts.wrap = {};
      if (!opts.flip) opts.flip = {};
      if (!opts.scale) opts.scale = {};
      this.wrap = {
        s: opts.wrap.s || gl.MIRRORED_REPEAT,
        t: opts.wrap.t || gl.MIRRORED_REPEAT,
        r: opts.wrap.r || gl.MIRRORED_REPEAT
      };
      this.flip = {
        x: !!opts.flip.x,
        y: !!opts.flip.y
      };
      this.scale = {
        x: opts.scale.x !== void 0 ? opts.scale.x : 1.0,
        y: opts.scale.y !== void 0 ? opts.scale.y : 1.0
      };
      this.mips = opts.mips !== void 0 ? opts.mips : true;
      this.anisotropic = opts.anisotropic !== void 0 ? opts.anisotropic : true;
    }
    this.width = 0;
    this.height = 0;
    this.data = null;
    this.native = null;
    this.sourcePath = null;
    this.sourceElement = null;
    // get/set
    this._loaded = false;
  }
  get loaded() {
    return this._loaded;
  }
  set loaded(value) {
    this._loaded = value;
    if (this.loaded) {
      // fire onload callback if necessary
      if (this.onload instanceof Function) this.onload(this);
    }
  }
};

/**
 * Sets the active/used texture
 * @param {WebGLTexture} texture
 */
Texture.prototype.setTexture = function(texture) {
  this.native = texture;
};

/**
 * Attaches the given binary data representation
 * @param {Uint8Array} data
 */
Texture.prototype.setBinaryData = function(data) {
  this.data = data;
};

/**
 * Returns the active texture
 * @return {WebGLFrameBuffer}
 */
Texture.prototype.getActiveTexture = function() {
  let {gl} = this;
  return gl.getParameter(gl.TEXTURE_BINDING_2D);
};

/**
 * Returns the native texture
 * @return {WebGLTexture}
 */
Texture.prototype.getNativeTexture = function() {
  return this.native;
};

/**
 * Creates a new empty texture
 * @return {WebGLTexture}
 */
Texture.prototype.createTexture = function() {
  let {gl} = this;
  let previous = this.getActiveTexture();
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.bindTexture(gl.TEXTURE_2D, previous);
  this.width = 1;
  this.height = 1;
  this.setTexture(texture);
  return texture;
};

/**
 * Writes image into this texture
 * @param {HTMLImageElement|HTMLCanvasElement} element
 */
Texture.prototype.readImageIntoTexture = function(element) {
  let {gl} = this;
  let texture = this.getNativeTexture();
  let previous = this.getActiveTexture();
  let pixelated = this.pixelated;
  let pot = isPowerOf2(element.width) && isPowerOf2(element.height);
  let wrap = this.wrap;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (this.flip.y) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  else gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, element.width, element.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, element);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap.s);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap.t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, wrap.r);
  {
    let ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext && this.anisotropic) {
      let max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
    } else {
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 1);
    }
  }
  if (pot && !pixelated) {
    if (this.mips) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  else {
    if (pixelated) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  }
  //gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_LOD, 0.0);
  //gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAX_LOD, 10.0);
  // enable mip mapping
  if (pot && !pixelated && this.mips) gl.generateMipmap(gl.TEXTURE_2D);
  // create binary data representation
  if (this.binary) {
    let data = null;
    if (element instanceof HTMLImageElement) {
      data = getImageBinaryData(element);
    }
    else if (element instanceof HTMLCanvasElement) {
      let ctx = element.getContext("2d");
      data = ctx.getImageData(0, 0, element.width, element.height).data;
    }
    else {
      console.warn(`Cannot resolve binary data for`, element.constructor.name);
    }
    this.setBinaryData(data);
  }
  this.width = element.width | 0;
  this.height = element.height | 0;
  gl.bindTexture(gl.TEXTURE_2D, previous);
};

/**
 * Creates a texture from a canvas element
 * @param {HTMLCanvasElement} canvas
 * @return {Texture}
 */
Texture.prototype.fromCanvas = function(canvas) {
  let {gl} = this;
  let texture = this.createTexture();
  this.wrap = {
    s: gl.CLAMP_TO_EDGE,
    t: gl.CLAMP_TO_EDGE,
    r: gl.REPEAT
  };
  this.readImageIntoTexture(canvas);
  this.loaded = true;
  this.sourceElement = canvas;
  return this;
};

/**
 * Creates a texture from a image element
 * @param {HTMLImageElement} img
 * @return {Texture}
 */
Texture.prototype.fromImage = function(img) {
  let {gl} = this;
  let texture = this.createTexture();
  this.readImageIntoTexture(img);
  this.loaded = true;
  this.sourceElement = img;
  return this;
};

/**
 * Creates a texture from an image path
 * @param {String} path
 * @return {Texture}
 */
Texture.prototype.fromImagePath = function(path) {
  let {gl} = this;
  let texture = this.createTexture();
  this.loaded = false;
  loadImage(path).then(img => {
    this.readImageIntoTexture(img);
    this.loaded = true;
    this.sourcePath = path;
    this.sourceElement = img;
  });
  return this;
};

/**
 * Creates a texture from the given color
 * @param {Array} color
 * @return {Texture}
 */
Texture.prototype.fromColor = function(color) {
  let {gl} = this;
  let texture = this.createTexture();
  let previous = this.getActiveTexture();
  let r = color[0];
  let g = color[1];
  let b = color[2];
  let a = color.length <= 3 ? 255 : color[3];
  let data = new Uint8Array([r, g, b, a]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindTexture(gl.TEXTURE_2D, previous);
  this.setTexture(texture);
  if (this.binary) this.setBinaryData(data);
  this.width = 1;
  this.height = 1;
  this.sourceElement = null;
  this.loaded = true;
  return this;
};
