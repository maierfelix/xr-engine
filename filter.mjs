import {
  uid
} from "./utils.mjs";

import RenderQuad from "./render-quad.mjs";
import FrameBuffer from "./framebuffer.mjs";

let sharedQuad = null;

/**
 * A basic filter class
 * @class Filter
 */
class Filter {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    this.uid = uid();
    this.gl = opts.gl;
    this.width = (opts.width | 0) || 128.0;
    this.height = (opts.height | 0) || 128.0;
    this.resolution = new Float32Array([this.width, this.height]);
    this.program = null;
    this.input = null;
    this.output = null;
    this.appliedFilter = false;
    this.textureUnitFlushId = -1;
    this.init();
  }
};

/**
 * Initializes batch data and buffers
 */
Filter.prototype.init = function() {
  let {gl, width, height} = this;
  this.input = new FrameBuffer({
    gl,
    width,
    height,
    attachments: [
      { format: gl.RGBA16F }
    ]
  });
  this.output = new FrameBuffer({
    gl,
    width,
    height,
    attachments: [
      { format: gl.RGBA16F }
    ]
  });
  this.input.texture = this.input.textures[0];
  this.output.texture = this.output.textures[0];
  if (sharedQuad === null) sharedQuad = new RenderQuad({ gl });
  this.textureUnitFlushId = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
};

/**
 * Enables the filter's fbo
 * @param {Boolean} clear - Clear the fbo's content
 */
Filter.prototype.enable = function(clear = true) {
  let {gl} = this;
  let {input, output} = this;
  gl.bindFramebuffer(gl.FRAMEBUFFER, input.buffer);
  if (clear) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  this.appliedFilter = false;
};

/**
 * Disables the filter's fbo
 */
Filter.prototype.disable = function() {
  let {gl} = this;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

/**
 * Flips the filter's input fbo with it's output fbo
 */
Filter.prototype.flip = function() {
  let input = this.input;
  this.input = this.output;
  this.output = input;
};

/**
 * Uses the given filter
 * @param {Program} program
 * @return {Program}
 */
Filter.prototype.useProgram = function(program) {
  let {gl} = this;
  let {variables} = program;
  this.program = program;
  gl.useProgram(program.native);
  program.set("uResolution", this.resolution);
  return this.program;
};

/**
 * Uses the given texture
 * @param {Number} id
 * @param {WebGLTexture} texture
 * @param {Number} location
 */
Filter.prototype.useTexture = function(id, texture, location) {
  let {gl} = this;
  gl.activeTexture(gl.TEXTURE0 + id);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(location, id);
};

/**
 * Applies the given given filter
 * and write the result into the filter's input
 */
Filter.prototype.apply = function() {
  let {gl, program} = this;
  let {input, output} = this;
  let {textureUnitFlushId} = this;
  let {variables} = program;
  let previousBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  let previousViewport = gl.getParameter(gl.VIEWPORT);
  // bind texture
  this.useTexture(textureUnitFlushId, input.texture, variables.uTexture.location);
  // bind output
  gl.bindFramebuffer(gl.FRAMEBUFFER, output.buffer);
  // draw
  {
    gl.viewport(0, 0, this.width, this.height);
    gl.depthMask(false);
    gl.bindVertexArray(sharedQuad.mesh.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.viewport(0, 0, previousViewport[2], previousViewport[3]);
    gl.depthMask(true);
  }
  this.appliedFilter = true;
  gl.bindFramebuffer(gl.FRAMEBUFFER, previousBuffer);
};

/**
 * Reads the content of a framebuffer into the filter's input
 * @param {FrameBuffer} fbo - The framebuffer to read from
 */
Filter.prototype.readFrameBuffer = function(fbo, attachment) {
  let {gl} = this;
  let {input, output} = this;
  fbo.blitToFrameBuffer(input, attachment, gl.COLOR_BUFFER_BIT);
};

/**
 * Writes the filter's output into the given fbo
 * @param {FrameBuffer} fbo - The target fbo
 */
Filter.prototype.writeToFrameBuffer = function(fbo) {
  let {gl} = this;
  let {input, output} = this;
  if (!this.appliedFilter) console.warn(`No input!`);
  output.blitToFrameBuffer(fbo, gl.COLOR_ATTACHMENT0, gl.COLOR_BUFFER_BIT);
};

/**
 * Writes this filter's content into the target filter's input
 * @param {WebGLFilter} filter - The target filter
 */
Filter.prototype.writeToFilter = function(filter) {
  this.writeToFrameBuffer(filter.input);
};

/**
 * Blends this filter into another filter
 * @param {WebGLFilter} filter - The target filter
 */
Filter.prototype.blendToFilter = function(filter) {
  let {gl} = this;
  this.blendToFrameBuffer(filter.input);
};

/**
 * Blends this filter's output buffer into the target input buffer
 * External blend function is used, e.g. blendFunc(gl.ONE, gl.ONE)
 * @param {WebGLFramebuffer} fbo - The target fbo
 */
Filter.prototype.blendToFrameBuffer = function(fbo) {
  let {gl} = this;
  let previous = gl.getParameter(gl.VIEWPORT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.buffer);
  gl.enable(gl.BLEND);
  gl.viewport(0, 0, fbo.width, fbo.height);
  // Filter.flush uses the output as source texture,
  // so we manually flip the filter's input with it's output
  // after flushing we restore the original input/output order
  this.flip(); // input -> output
  this.flush();
  this.flip(); // output -> input
  gl.viewport(0, 0, previous[2], previous[3]);
  gl.disable(gl.BLEND);
};

Filter.prototype.flush = function() {
  let {gl, program} = this;
  let {input, output} = this;
  let {textureUnitFlushId} = this;
  let {variables} = program;
  gl.useProgram(program.native);
  this.useTexture(textureUnitFlushId, output.texture, variables.uTexture.location);
  gl.depthMask(false);
  gl.bindVertexArray(sharedQuad.mesh.vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.depthMask(true);
};

export default Filter;
