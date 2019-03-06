import {
  uid
} from "./utils.mjs";

import RenderQuad from "./render-quad.mjs";

let sharedQuad = null;

/**
 * A framebuffer
 * @class FrameBuffer
 */
class FrameBuffer {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts) {
    this.uid = uid();
    this.gl = opts.gl;
    this.width = (opts.width | 0) || 128.0;
    this.height = (opts.height | 0) || 128.0;
    // wrap settings
    {
      if (!opts.wrap) opts.wrap = {};
      this.wrap = {
        s: opts.wrap.s || this.gl.CLAMP_TO_EDGE,
        t: opts.wrap.t || this.gl.CLAMP_TO_EDGE,
        r: opts.wrap.r || this.gl.CLAMP_TO_EDGE
      };
    }
    this.native = null;
    this.buffer = null;
    this.texture = null;
    this.textures = [];
    this.attachmentList = [];
    this.resolution = new Float32Array([this.width, this.height]);
    this.textureUnitFlushId = -1;
    this.init(this.width, this.height, opts.attachments || null);
  }
};

/**
 * Creates a new framebuffer
 * @param {Number} width
 * @param {Number} height
 * @param {Number} attachments - The amount of color attachments to use
 * @return {Object}
 */
FrameBuffer.prototype.init = function(width, height, attachments) {
  let {gl} = this;
  if (sharedQuad === null) sharedQuad = new RenderQuad({ gl: gl });
  this.buffer = this.createBuffer(attachments);
  if (Number.isInteger(attachments)) {
    for (let ii = 0; ii < attachments; ++ii) {
      this.createAttachement(ii, null);
    };
  } else if (Array.isArray(attachments)) {
    for (let ii = 0; ii < attachments.length; ++ii) {
      this.createAttachement(ii, attachments[ii]);
    };
  } else {
    this.texture = this.createColorAttachement(0, null);
    this.textures.push(this.texture);
    this.native = this.texture;
  }
  this.textureUnitFlushId = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

FrameBuffer.prototype.createAttachement = function(index, opts = null) {
  let texture = null;
  // we want to create a custom attachments with opts
  if (opts !== null) {
    let format = opts.format;
    // depth component
    if (this.isDepthComponent(format)) {
      texture = this.createDepthAttachement(format, opts);
    // color component
    } else if (this.isColorComponent(format)) {
      texture = this.createColorAttachement(index, opts);
    // unknown component
    } else {
      console.warn(`Invalid or unsupported attachement format!`);
    }
  // non-custom attachments default to color attachments
  } else {
    texture = this.createColorAttachement(index, null);
  }
  this.textures.push(texture);
  if (!this.native) this.native = texture;
};

/**
 * Returns the gl id of passed in numeric color attachment id
 * @param {Number} id
 * @return {Number}
 */
FrameBuffer.prototype.getColorAttachementUnitById = function(id) {
  let gl = this.gl;
  return gl.COLOR_ATTACHMENT0 + id;
};

/**
 * Returns the native texture
 * @return {WebGLTexture}
 */
FrameBuffer.prototype.getNativeTexture = function() {
  return this.native;
};

/**
 * Indicates if it's a depth component
 * @param {Number} comp
 * @return {Boolean}
 */
FrameBuffer.prototype.isDepthComponent = function(comp) {
  let gl = this.gl;
  return (
    (comp === gl.DEPTH_COMPONENT) ||
    (comp === gl.DEPTH_COMPONENT16) ||
    (comp === gl.DEPTH_COMPONENT24) ||
    (comp === gl.DEPTH_COMPONENT32F) ||
    (this.isDepthStencilComponent(comp))
  );
};

/**
 * Indicates if it's a depth-stencil component
 * @param {Number} comp
 * @return {Boolean}
 */
FrameBuffer.prototype.isDepthStencilComponent = function(comp) {
  let gl = this.gl;
  return (
    (comp === gl.DEPTH24_STENCIL8) ||
    (comp === gl.DEPTH32F_STENCIL8)
  );
};

/**
 * Returns the given unsized format of a format
 * @param {Number} comp
 * @return {Number}
 */
FrameBuffer.prototype.getUnsizedDepthFormat = function(format) {
  let gl = this.gl;
  if (this.isDepthStencilComponent(format)) return gl.DEPTH_STENCIL;
  return gl.DEPTH_COMPONENT;
};

/**
 * Indicates if it's a color component
 * @param {Number} comp
 * @return {Boolean}
 */
FrameBuffer.prototype.isColorComponent = function(comp) {
  let gl = this.gl;
  // make sure it's a valid component
  if (!(comp >= 0)) return false;
  return (
    (comp === gl.RED) ||
    (comp === gl.RGB8) ||
    (comp === gl.RGBA8) ||
    (comp === gl.RGB10_A2) ||
    (comp === gl.SRGB) ||
    (comp === gl.SRGB8) ||
    (comp === gl.SRGB8_ALPHA8) ||
    (comp === gl.RGBA32F) ||
    (comp === gl.RGB32F) ||
    (comp === gl.RGBA16F) ||
    (comp === gl.RGB16F) ||
    (comp === gl.R11F_G11F_B10F) ||
    (comp === gl.RGB9_E5) ||
    (comp === gl.RGBA32UI) ||
    (comp === gl.RGB32UI) ||
    (comp === gl.RGBA16UI) ||
    (comp === gl.RGB16UI) ||
    (comp === gl.RGBA8UI) ||
    (comp === gl.RGB8UI) ||
    (comp === gl.RGBA32I) ||
    (comp === gl.RGB32I) ||
    (comp === gl.RGBA16I) ||
    (comp === gl.RGB16I) ||
    (comp === gl.RGBA8I) ||
    (comp === gl.RGB8I) ||
    (comp === gl.RED_INTEGER) ||
    (comp === gl.RGB_INTEGER) ||
    (comp === gl.RGBA_INTEGER) ||
    (comp === gl.R8) ||
    (comp === gl.RG8) ||
    (comp === gl.R16F) ||
    (comp === gl.R32F) ||
    (comp === gl.RG16F) ||
    (comp === gl.RG32F) ||
    (comp === gl.R8I) ||
    (comp === gl.R8UI) ||
    (comp === gl.R16I) ||
    (comp === gl.R16UI) ||
    (comp === gl.R32I) ||
    (comp === gl.R32UI) ||
    (comp === gl.RG8I) ||
    (comp === gl.RG8UI) ||
    (comp === gl.RG16I) ||
    (comp === gl.RG16UI) ||
    (comp === gl.RG32I) ||
    (comp === gl.RG32UI) ||
    (comp === gl.R8_SNORM) ||
    (comp === gl.RG8_SNORM) ||
    (comp === gl.RGB8_SNORM) ||
    (comp === gl.RGBA8_SNORM) ||
    (comp === gl.RGB10_A2UI)
  );
};

/**
 * Indicates if the attachment is a color attachment
 * @param {Number} attachment
 * @return {Boolean}
 */
FrameBuffer.prototype.isColorAttachment = function(attachment) {
  let gl = this.gl;
  return (
    (attachment >= gl.COLOR_ATTACHMENT0) &&
    (attachment <= gl.COLOR_ATTACHMENT15)
  );
};

/**
 * Indicates if the attachment is a depth attachment
 * @param {Number} attachment
 * @return {Boolean}
 */
FrameBuffer.prototype.isDepthAttachment = function(attachment) {
  let gl = this.gl;
  return (
    attachment === gl.DEPTH_ATTACHMENT
  );
};

/**
 * Creates a new framebuffer texture
 * @param {Number} attachments
 * @return {WebGLFramebuffer}
 */
FrameBuffer.prototype.createBuffer = function(attachments) {
  let gl = this.gl;
  let buffer = gl.createFramebuffer();
  let {
    colorAttachments,
    depthAttachments
  } = this.getAttachmentList(attachments);
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  // empty fbo, what's wrong with u?
  if (
    (colorAttachments.length <= 0) &&
    (depthAttachments.length <= 0)
  ) {
    console.warn(`Expected at least one color or depth attachment!`);
  }
  // if this fbo is depth-only then we don't need a draw buffer
  if (
    (colorAttachments.length <= 0) &&
    (depthAttachments.length > 0)
  ) gl.drawBuffers([gl.NONE]);
  // do we have a combination of color and depth attachments?
  else if (
    (colorAttachments.length > 0) &&
    (depthAttachments.length > 0)
  ) {
    gl.drawBuffers(colorAttachments);
  }
  // we have an fbo with color attachments only
  else gl.drawBuffers(colorAttachments);
  this.attachmentList = { colorAttachments, depthAttachments };
  return buffer;
};

/**
 * Generates attachment list
 * @param {Number} attachments - Amount of attachments
 * @return {Array}
 */
FrameBuffer.prototype.getAttachmentList = function(attachments) {
  let colorAttachments = [];
  let depthAttachments = [];
  if (attachments === null) {
    let id = this.getColorAttachementUnitById(0);
    colorAttachments.push(id);
  }
  else if (attachments > 0) {
    for (let ii = 0; ii < attachments; ++ii) {
      let id = this.getColorAttachementUnitById(ii);
      colorAttachments.push(id);
    };
  }
  else if (Array.isArray(attachments)) {
    for (let ii = 0; ii < attachments.length; ++ii) {
      let attachment = attachments[ii];
      let format = attachment.format;
      if (this.isColorComponent(format)) {
        let id = this.getColorAttachementUnitById(ii);
        colorAttachments.push(id);
      } else if (this.isDepthComponent(format)) {
        depthAttachments.push(format);
      }
    };
  }
  return { colorAttachments, depthAttachments };
};

/**
 * Creates a new framebuffer texture
 * @param {Object} opts
 * @return {Object}
 */
FrameBuffer.prototype.createTexture = function(opts) {
  let gl = this.gl;
  let wrap = this.wrap;
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (opts !== null) {
    if (this.isDepthComponent(opts.format)) {
      let unsizedFormat = this.getUnsizedDepthFormat(opts.format);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap.s);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, wrap.r);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, opts.format, this.width, this.height, 0, unsizedFormat, opts.size || gl.FLOAT, null);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap.s);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, wrap.r);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texStorage2D(gl.TEXTURE_2D, 1, opts.format, this.width, this.height);
    }
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap.s);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap.t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, wrap.r);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.width, this.height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};

/**
 * @param {Number} format
 * @return {WebGLRenderbuffer}
 */
FrameBuffer.prototype.createColorBuffer = function(format) {
  let gl = this.gl;
  let buffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, format, gl.RENDERBUFFER, buffer);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return buffer;
};

/**
 * Creates a new render buffer
 * @param {Number} format
 * @param {WebGLTexture} texture
 * @param {Object} opts
 * @return {Object}
 */
FrameBuffer.prototype.createRenderBuffer = function(format, texture, opts) {
  let gl = this.gl;
  let buffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
  // color buffer
  if (this.isColorAttachment(format)) {
    if (format === gl.COLOR_ATTACHMENT0) gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.width, this.height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, format, gl.TEXTURE_2D, texture, 0);
  }
  // depth buffer
  else if (this.isDepthComponent(format)) {
    gl.renderbufferStorage(gl.RENDERBUFFER, opts.format, this.width, this.height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
  }
  if (format === gl.COLOR_ATTACHMENT0) {
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, buffer);
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  return buffer;
};

/**
 * @param {Number} index - The color attachment index
 * @param {Object} opts
 * @return {WebGLTexture}
 */
FrameBuffer.prototype.createColorAttachement = function(index, opts = null) {
  let gl = this.gl;
  let format = this.getColorAttachementUnitById(index);
  let texture = this.createTexture(opts);
  let renderBuffer = this.createRenderBuffer(format, texture, opts || {});
  // also assign the color attachment id
  texture.id = format - gl.COLOR_ATTACHMENT0;
  texture.unitId = format;
  return texture;
};

/**
 * @param {Number} format
 * @param {Object} opts
 * @return {WebGLTexture}
 */
FrameBuffer.prototype.createDepthAttachement = function(format, opts = null) {
  let texture = this.createTexture(opts);
  let renderBuffer = this.createRenderBuffer(format, texture, opts || {});
  return texture;
};

/**
 * Returns the active framebuffer
 * @return {WebGLFrameBuffer}
 */
FrameBuffer.prototype.getActiveFrameBuffer = function() {
  let gl = this.gl;
  return gl.getParameter(gl.FRAMEBUFFER_BINDING);
};

FrameBuffer.prototype.useTexture = function(id, texture, location) {
  let {gl} = this;
  gl.activeTexture(gl.TEXTURE0 + id);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(location, id);
};

FrameBuffer.prototype.bind = function() {
  let {gl, buffer} = this;
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
};

FrameBuffer.prototype.unbind = function() {
  let {gl} = this;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

/**
 * Clears this framebuffer
 */
FrameBuffer.prototype.clear = function() {
  let {gl, buffer} = this;
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

FrameBuffer.prototype.flush = function(texture, program) {
  let {gl, buffer} = this;
  let {textureUnitFlushId} = this;
  gl.useProgram(program.native);
  this.useTexture(textureUnitFlushId, texture, program.variables.uTexture.location);
  gl.depthMask(false);
  gl.bindVertexArray(sharedQuad.mesh.vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.depthMask(true);
  gl.useProgram(null);
};

/**
 * Writes this fbo's content to another fbo
 * @param {FrameBuffer} fbo
 * @param {Number} attachment
 */
FrameBuffer.prototype.blitToFrameBuffer = function(fbo, attachment, maskBit) {
  let gl = this.gl;
  let mask = maskBit ? maskBit : gl.COLOR_BUFFER_BIT;
  let srcWidth = this.width;
  let srcHeight = this.height;
  let dstWidth = fbo ? fbo.width : srcWidth;
  let dstHeight = fbo ? fbo.height : srcHeight;
  let readBuffer = this.buffer;
  let drawBuffer = fbo ? fbo.buffer : null;
  let previous = this.getActiveFrameBuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readBuffer);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBuffer);
  // set read buffer
  if (this.isColorAttachment(attachment)) gl.readBuffer(attachment);
  else gl.readBuffer(gl.NONE);
  // blit fbos
  let dims = gl.getParameter(gl.VIEWPORT);
  gl.blitFramebuffer(
    0, 0, srcWidth, srcHeight,
    0, 0, dstWidth, dstHeight,
    mask, gl.NEAREST
  );
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previous);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
};

export default FrameBuffer;
