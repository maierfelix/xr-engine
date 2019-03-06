import {
  uid
} from "./utils.mjs";

import Texture from "./texture.mjs";

/**
 * A basic texture collection
 * @class TextureCollection
 */
export default class TextureCollection {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    this.uid = uid();
    this.gl = opts.gl;
    this.onload = opts.onload || null;
    this.basePath = opts.basePath || "";
    this.settings = opts.textureSettings || {};
    this.settings.gl = this.gl;
    this._albedo = this.loadTexture([0, 0, 0]);
    this._normal = this.loadTexture([127, 127, 255]);
    this._roughness = this.loadTexture([128, 128, 128]);
    this._metallness = this.loadTexture([128, 128, 128]);
    this._emissive = this.loadTexture([0, 0, 0]);
    this._specular = this.loadTexture([255, 255, 255]);
    this._ambientOcclusion = this.loadTexture([255, 255, 255]);
    if (opts.albedo) this.albedo = opts.albedo;
    if (opts.normal) this.normal = opts.normal;
    if (opts.roughness) this.roughness = opts.roughness;
    if (opts.metallness) this.metallness = opts.metallness;
    if (opts.emissive) this.emissive = opts.emissive;
    if (opts.specular) this.specular = opts.specular;
    if (opts.ambientOcclusion) this.ambientOcclusion = opts.ambientOcclusion;
  }
  // get texture
  get albedo() {           return this._albedo; }
  get normal() {           return this._normal; }
  get roughness() {        return this._roughness; }
  get metallness() {       return this._metallness; }
  get emissive() {         return this._emissive; }
  get specular() {         return this._specular; }
  get ambientOcclusion() { return this._ambientOcclusion; }
  // set texture
  set albedo(v) { this._albedo = this.loadTexture(v); }
  set normal(v) { this._normal = this.loadTexture(v); }
  set roughness(v) { this._roughness = this.loadTexture(v); }
  set metallness(v) { this._metallness = this.loadTexture(v); }
  set emissive(v) { this._emissive = this.loadTexture(v); }
  set specular(v) { this._specular = this.loadTexture(v); }
  set ambientOcclusion(v) { this._ambientOcclusion = this.loadTexture(v); }
  // everything loaded and ready?
  get loaded() {
    let {
      albedo,
      normal,
      roughness,
      metallness,
      emissive,
      specular,
      ambientOcclusion
    } = this;
    let _albedo = albedo !== null ? albedo.loaded : true;
    let _normal = normal !== null ? normal.loaded : true;
    let _roughness = roughness !== null ? roughness.loaded : true;
    let _metallness = metallness !== null ? metallness.loaded : true;
    let _emissive = emissive !== null ? emissive.loaded : true;
    let _specular = specular !== null ? specular.loaded : true;
    let _ambientOcclusion = ambientOcclusion !== null ? ambientOcclusion.loaded : true;
    return (_albedo && _normal && _roughness && _metallness && _emissive && _specular && _ambientOcclusion);
  }
};

TextureCollection.prototype.clone = function() {
  // TODO
};

TextureCollection.prototype.loadTexture = function(data) {
  let {
    settings,
    basePath
  } = this;
  if (typeof data === "string") {
    let path = basePath + data;
    return new Texture(settings).fromImagePath(path);
  }
  else if ((data instanceof Array) || (data.buffer instanceof ArrayBuffer)) {
    return new Texture(settings).fromColor(data);
  }
  else if (data instanceof HTMLImageElement) {
    return new Texture(settings).fromImage(data);
  }
  else if (data instanceof HTMLCanvasElement) {
    return new Texture(settings).fromCanvas(data);
  }
  else console.warn(`Cannot process texture data`, data);
  return null;
};
