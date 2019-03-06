import {
  uid,
  clamp,
  cloneMouseEvent
} from "./utils.mjs";

import Ray from "./ray.mjs";
import Plane from "./geometry/plane.mjs";
import RenderObject from "./render-object.mjs";

import TextureCollection from "./texture-collection.mjs";

/**
 * A dat.GUI GL object
 * @class XRDatGUI
 */
export default class XRDatGUI extends RenderObject {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    super(opts);
    this.uid = uid();
    this.gl = opts.gl;
    this.ray = null;
    this.dat = null;
    this.datGL = null;
    this.onresize = null;
    this.onrasterize = null;
    this.hoveredElement = null;
    this.selectedElement = null;
    this.dynamicResolution = !!opts.dynamicResolution;
    this.initialWidth = opts.initialWidth !== void 0 ? opts.initialWidth : dat.GUI.DEFAULT_WIDTH;
    this.pixelReadCanvas = null;
    this.isTransparent = true;
    this.init();
  }
  draw(program) {
    super.draw(program);
    // used to increase quality the closer we are to the camera
    // this might lag in chrome, but helps on firefox
    if (this.dynamicResolution) this.updateTextureResolution();
  }
};

XRDatGUI.prototype.init = function() {
  let {gl} = this;
  this.cullingMode = RenderObject.CULL_NONE;
  this.ray = new Ray({ gl });
  this.createPixelReadCanvas();
  this.loadTextures();
  this.useMesh(Plane);
  quat.rotateX(this.transforms.rotation, this.transforms.rotation, 180 * Math.PI / 180);
  this.createDatGUI();
  if (!this.dynamicResolution) {
    this.datGL.scale = XRDatGUI.MAX_RESOLUTION;
  }
};

XRDatGUI.prototype.createPixelReadCanvas = function() {
  // This canvas is used to read back pixels from the main canvas:
  // Before calling getImageData we draw into this mini canvas
  // and then read the pixel from it instead of reading form the main canvas
  // this is a workaround for chrome (or other browers) to not put
  // the main canvas into software render mode
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  canvas.width = canvas.height = 1;
  this.pixelReadCanvas = ctx;
};

XRDatGUI.prototype.loadTextures = function() {
  let {gl} = this;
  let textures = new TextureCollection({
    gl,
    textureSettings: {
      mips: true,
      anisotropic: true,
      flip: {
        y: true
      },
      wrap: {
        s: gl.CLAMP_TO_EDGE,
        t: gl.CLAMP_TO_EDGE,
        r: gl.CLAMP_TO_EDGE
      }
    },
    albedo: [0, 0, 0],
    normal: [127, 127, 255]
  });
  this.textures = textures;
};

XRDatGUI.prototype.createDatGUI = function() {
  let datGUI = new dat.GUI({ autoPlace: false, resizable: true, width: this.initialWidth });
  let datGUIGL = new dat.GL({
    scale: 1.0,
    element: document.querySelector("[htmlgl='main']")
  });
  let {view} = datGUIGL;
  datGUIGL.onresize = () => {
    console.log("Resized:", view.width, view.height);
    this.textures.albedo.readImageIntoTexture(view);
    if (this.onresize instanceof Function) this.onresize();
  };
  let createTexture = true;
  datGUIGL.onrasterize = dirtyRects => {
    let {gl} = this;
    let {boundings} = datGUIGL;
    let {albedo} = this.textures;
    let scale = 0.75;
    this.transforms.scaling[0] = scale;
    this.transforms.scaling[2] = (boundings.aspect.x / boundings.aspect.y) * scale;
    albedo.readImageIntoTexture(view);
    return;
    if (createTexture) {
      albedo.readImageIntoTexture(view);
      createTexture = false;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, albedo.native);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, view.width);
      for (let ii = 0; ii < dirtyRects.length; ++ii) {
        let {x, y, width, height, scaleX, scaleY} = dirtyRects[ii];
        //console.log("x:", x / scaleX, "y:", y / scaleY, "width:", width / scaleX, "height:", height / scaleY);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0,
          x, y,
          width, height,
          gl.RGBA, gl.UNSIGNED_BYTE,
          view
        );
      };
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    if (this.onrasterize instanceof Function) this.onrasterize();
  };
  this.dat = datGUI;
  this.datGL = datGUIGL;
};

XRDatGUI.prototype.updateTextureResolution = function() {
  let {gl} = this;
  let {camera} = gl;
  let {datGL} = this;
  let min = XRDatGUI.MIN_RESOLUTION;
  let max = XRDatGUI.MAX_RESOLUTION;
  let distance = vec3.length(this.getCameraDistance(camera));
  let scale = Math.round(clamp(max - (((distance) * ((min / max) * 0.5)) * max), min, max));
  if (datGL.scale !== scale) datGL.scale = scale;
};

XRDatGUI.prototype.on = function(type, e) {
  let {gl} = this;
  let hit = null;
  switch (type) {
    case "click": {
      // this prevents mouseup from performing click event
      // happens when: pressing mouse, move mouse and then release it
      if (this.selectedElement) {
        //let element = this.getElementAt(e.clientX, e.clientY);
        //if (element !== this.selectedElement) break;
      }
      if (e.which === 1) hit = this.hit(e, "click");
      this.selectedElement = null;
    } break;
    case "mouseup": {
      if (this.selectedElement) {
        this.selectedElement.dispatchEvent(new MouseEvent("mouseup", e));
      }
      if (e.which === 1) hit = this.hit(e, "mouseup");
      this.selectedElement = null;
    } break;
    case "mousedown": {
      if (!this.selectedElement) {
        if (e.which === 1) hit = this.hit(e, "mousedown");
        this.selectedElement = hit;
      }
    } break;
    case "mousemove": {
      hit = this.hit(e, "mousemove");
    } break;
    case "mouseover": {
      if (this.hoveredElement) {
        this.hoveredElement.dispatchEvent(new MouseEvent("mouseout", e));
        this.hoveredElement = null;
      }
      hit = this.hit(e, "mouseover");
      if (hit) this.hoveredElement = hit;
    } break;
    case "mouseout": {
      hit = this.hit(e, "mouseout");
    } break;
  };
  return hit;
};

XRDatGUI.prototype.getRelativeWorldPosition = function(x, y) {
  let {gl, datGL} = this;
  let ray = this.ray.fromMousePosition(x, y);
  let hit = this.intersect(ray);
  if (hit.intersects) {
    let x = -(hit.intersection[2] * 0.5 + 0.5) + 1.0;
    let y = +((-hit.intersection[0]) * 0.5 + 0.5) + 0.0;
    x = x * datGL.boundings.width;
    y = y * datGL.boundings.height;
    return { x, y };
  }
  return null;
};

XRDatGUI.prototype.getRelativeScreenPosition = function(object) {
  let x = -1;
  let y = -1;
  let {gl} = this;
  let {camera} = gl;
  let origin = object.transforms.translation;
  let direction = vec3.fromValues(0.0, 0.0, -1.0);
  vec3.transformQuat(direction, direction, object.transforms.rotation);
  let ray = new Ray({ origin, direction });
  let hit = this.intersect(ray);
  if (hit.intersects) {
    camera.resize(window.innerWidth, window.innerHeight);
    camera.update(true);
    let world = vec3.transformMat4(vec3.create(), hit.intersection, this.getModelMatrix());
    let screen = camera.worldToScreenPoint(world);
    x = screen[0];
    y = screen[1];
  }
  return {x, y};
};

XRDatGUI.prototype.hit = function(e, type) {
  let {datGL} = this;
  if (e.clientX < 0 || e.clientY < 0) return null;
  let relative = this.getRelativeWorldPosition(e.clientX, e.clientY);
  if (!relative) return null;
  this.sortUIs();
  let element = document.elementFromPoint(e.clientX, e.clientY);
  // only continue if we hit an opaque pixel
  if (type === "click" || type === "mousedown") {
    // abort when clicked on something fully transparent
    let pixel = this.getPixelAt(relative.x, relative.y);
    if (pixel[3] <= 0) return;
  }
  // transform element position
  {
    let node = datGL.element;
    let {x, y} = relative;
    let translateX = Math.floor(e.clientX - x);
    let translateY = Math.floor(e.clientY - y);
    // translate relative to input offset to remain original events
    node.style.transform = `translate(${translateX}px, ${translateY}px)`;
  }
  // fake event
  {
    let event = null;
    if (element instanceof MouseEvent) {
      event = cloneMouseEvent(e);
    } else {
      let x = e.clientX;
      let y = e.clientY;
      event = {
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        which: 1,
        view: window,
        bubbles: true,
        cancelable: true
      };
    }
    element.dispatchEvent(new MouseEvent(type, event));
  }
  return element;
};

XRDatGUI.prototype.sortUIs = function() {
  // sort all UIs, so elementFromPoint returns the correct UI node
  let objects = RenderObject.find(XRDatGUI);
  for (let ii = 0; ii < objects.length; ++ii) {
    let object = objects[ii];
    let {datGL} = object;
    let zIndex = this.getHTMLZIndex();
    // HTML distance sorting - necessary if multiple UIs overlap
    if (parseInt(datGL.element.style.zIndex) !== zIndex) {
      datGL.element.style.zIndex = zIndex;
    }
  };
};

XRDatGUI.prototype.getHTMLZIndex = function() {
  let {gl} = this;
  let {camera} = gl;
  let cameraDistance = this.getCameraDistance(camera);
  let distance = vec3.length(cameraDistance);
  return (Math.floor(distance * 1e1));
};

XRDatGUI.prototype.getPixelAt = function(rx, ry) {
  let {datGL} = this;
  let {pixelReadCanvas} = this;
  let buffer = datGL.ctx;
  let x = Math.floor((rx / datGL.boundings.width) * datGL.view.width);
  let y = Math.floor((ry / datGL.boundings.height) * datGL.view.height);
  // first draw into pixelread canvas
  let source = buffer.canvas;
  let target = pixelReadCanvas;
  target.clearRect(0, 0, target.canvas.width, target.canvas.height);
  target.drawImage(
    source,
    x, y,
    1, 1,
    0, 0,
    1, 1
  );
  // now read from pixelread canvas
  let pixel = pixelReadCanvas.getImageData(0, 0, 1, 1);
  let rgba = new Uint8Array(pixel.data.buffer);
  pixel = null;
  return rgba;
};

XRDatGUI.MIN_RESOLUTION = 1.0;
XRDatGUI.MAX_RESOLUTION = 4.0;
