import {
  uid
} from "./utils.mjs";

import RenderObject from "./render-object.mjs";

/**
 * A basic RenderObject collection
 * @class RenderObjectCollection
 */
export default class RenderObjectCollection extends RenderObject {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    super(opts);
    this.uid = uid();
    this.gl = opts.gl;
    this.children = [];
  }
  transform() {
    super.transform();
    this.transformChilds();
  }
};

RenderObjectCollection.prototype.clone = function() {
  let {
    gl,
    textures,
    children
  } = this;
  let clone = new RenderObjectCollection({ gl, textures });
  for (let ii = 0; ii < children.length; ++ii) {
    let child = children[ii];
    let childClone = child.clone();
    childClone.parent = clone;
    childClone.mesh = child.mesh;
    clone.children.push(childClone);
  };
  clone.useTransforms(this.transforms);
  return clone;
};

RenderObjectCollection.prototype.fromObjectFile = function(path) {
  throw new Error(`Calling 'fromObjectFile' from ${this.constructor.name} isn't allowed!`);
};

RenderObjectCollection.prototype.addChild = function() {
  let {children, transforms} = this;
  let child = new RenderObject({ gl: this.gl });
  child.parent = this;
  //child.transforms = this.transforms;
  children.push(child);
  return child;
};

RenderObjectCollection.prototype.transformChilds = function() {
  let {children} = this;
  for (let ii = 0; ii < children.length; ++ii) {
    let child = children[ii];
    child.transform(this);
  };
};

RenderObjectCollection.prototype.draw = function(program) {
  let {children} = this;
  for (let ii = 0; ii < children.length; ++ii) {
    let child = children[ii];
    child.draw(program);
  };
};
