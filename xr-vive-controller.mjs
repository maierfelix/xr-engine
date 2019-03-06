import {
  uid,
  loadObjectFile
} from "./utils.mjs";

import RenderObject from "./render-object.mjs";
import TextureCollection from "./texture-collection.mjs";
import RenderObjectCollection from "./render-object-collection.mjs";

/**
 * A XR HTC Vive controller button
 * @class XRViveControllerButton
 */
export class XRViveControllerButton {
  /**
   * @param {Number} index
   * @constructor
   */
  constructor(index = -1) {
    this.index = index;
    this.axis = new Float32Array(2);
    this.pressed = false;
    this.touched = false;
    this.value = 0.0;
  }
};

{
  XRViveControllerButton.TOUCHPAD = 0x0;
  XRViveControllerButton.TRIGGER = 0x1;
  XRViveControllerButton.GRIP = 0x2;
  XRViveControllerButton.APPLICATION_MENU = 0x3;
}

XRViveControllerButton.prototype.updateState = function(state) {
  this.pressed = !!state.pressed;
  this.touched = !!state.touched;
  this.value = state.value;
};

XRViveControllerButton.prototype.updateAxisState = function(axis) {
  this.axis[0] = axis[0];
  this.axis[1] = axis[1];
};

/**
 * A XR HTC Vive controller
 * @class XRViveController
 */
export class XRViveController extends RenderObjectCollection {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    super(opts);
    this.uid = uid();
    this.gl = opts.gl;
    this.hand = opts.hand || XRViveController.NO_HAND;
    this.type = XRViveController.CONTROLLER_TYPE;
    this.buttons = [
      new XRViveControllerButton(XRViveControllerButton.TOUCHPAD),
      new XRViveControllerButton(XRViveControllerButton.TRIGGER),
      new XRViveControllerButton(XRViveControllerButton.GRIP),
      new XRViveControllerButton(XRViveControllerButton.APPLICATION_MENU)
    ];
    this.isActive = false;
    this.laser = null;
    this.loadTextures();
    this.loadModel();
    this.loadLaser();
  }
  draw(program) {
    if (this.isActive) {
      super.draw(program);
      this.drawLaser();
    }
  }
};

XRViveController.prototype.getChildComponentByName = function(name) {
  let {children} = this;
  for (let ii = 0; ii < children.length; ++ii) {
    let child = children[ii];
    if (child.name === name) return child;
  };
  return null;
};

XRViveController.prototype.loadTextures = function() {
  let {gl} = this;
  let textures = new TextureCollection({
    gl,
    basePath: XRViveController.BASE_PATH_TEXTURE,
    albedo: "albedo.png",
    specular: "specular.png",
    normal: [127, 127, 255],
    roughness: [128, 128, 128],
    metallness: [64, 64, 64],
    ambientOcclusion: "occ.png"
  });
  this.textures = textures;
};

XRViveController.prototype.loadModel = function() {
  this.transforms.translation = new Float32Array([0.0, -0.001, -0.081]);
  this.transforms.scaling = new Float32Array([0.975, 0.975, 0.975]);
  XRViveController.CHILD_MODEL_NAMES.map(name => {
    let child = this.addChild();
    child.useTransforms(this.transforms);
    child.name = name;
    child.fromObjectFile(XRViveController.BASE_PATH_MODEL + name + `.obj`);
  });
};

XRViveController.prototype.loadLaser = function() {
  let {gl} = this;
  loadObjectFile("assets/models/Vive/laser/laser.obj").then(mesh => {
    let collection = new TextureCollection({
      gl,
      basePath: "assets/textures/Vive/laser/",
      albedo: [3, 169, 244],
      roughness: [250, 0, 0],
      metallness: [16, 0, 0]
    });
    let obj = new RenderObject({ gl, mesh, textures: collection });
    obj.transforms.scaling[0] = obj.transforms.scaling[1] = 0.0025;
    obj.transforms.scaling[2] = 100.0;
    obj.transform();
    this.laser = obj;
  });
};

XRViveController.prototype.drawLaser = function() {
  let laser = null;
  if (!laser) return;
  quat.copy(laser.transforms.rotation, this.transforms.rotation);
  vec3.copy(laser.transforms.translation, this.transforms.translation);
  laser.transform();
};

XRViveController.prototype.update = function(frameXR, frameRefXR) {
  this.updateButtonStates();
  if (!frameXR) return;
  let {session} = frameXR;
  let inputSources = session.getInputSources();
  let handSource = inputSources.filter(inp => {
    if (inp.targetRayMode === this.type) {
      return (
        (inp.handedness === "left" && this.hand === XRViveController.LEFT_HAND) ||
        (inp.handedness === "right" && this.hand === XRViveController.RIGHT_HAND)
      );
    }
    return false;
  })[0] || null;
  this.isActive = false;
  if (handSource) {
    let inputPose = frameXR.getInputPose(handSource, frameRefXR);
    if (inputPose) {
      let {gripMatrix} = inputPose;
      mat4.getRotation(this.transforms.rotation, gripMatrix);
      mat4.getTranslation(this.transforms.translation, gripMatrix);
      this.isActive = true;
      this.transform();
    }
  }
  /*{
    let trigger = this.getButton(XRViveControllerButton.TRIGGER);
    if (trigger.pressed || trigger.touched) {
      let child = this.getChildComponentByName("trigger");
      quat.rotateX(child.transforms.rotation, child.transforms.rotation, -trigger.value * 0.1);
      let axis = vec3.create();
      let angle = quat.getAxisAngle(axis, child.transforms.rotation);
      console.log(axis, angle);
    }
  }*/
};

XRViveController.prototype.getButton = function(index) {
  if (
    (index >= XRViveControllerButton.TOUCHPAD) &&
    (index < XRViveControllerButton.APPLICATION_MENU)
  ) {
    let button = this.buttons[index];
    if (button.index === index) return button;
  }
  return null;
};

XRViveController.prototype.updateButtonStates = function() {
  // api not available
  if (!navigator.getGamepads) return;
  let gamepads = Array.from(navigator.getGamepads());
  let gamepad = gamepads.filter(pad => {
    if (pad && pad.pose) {
      return (
        (pad.hand === "left" && this.hand === XRViveController.LEFT_HAND) ||
        (pad.hand === "right" && this.hand === XRViveController.RIGHT_HAND)
      );
    }
    return false;
  })[0] || null;
  if (gamepad && gamepad.buttons) {
    // touchpad coordinates
    if (gamepad.axes) {
      let touchpad = gamepad.buttons[XRViveControllerButton.TOUCHPAD];
      if (touchpad && touchpad.touched) {
        this.buttons[XRViveControllerButton.TOUCHPAD].updateAxisState(gamepad.axes);
      }
    }
    for (let ii = 0; ii < gamepad.buttons.length; ++ii) {
      this.buttons[ii].updateState(gamepad.buttons[ii]);
    };
  }
};

{
  let idx = 0;
  XRViveController.NO_HAND = idx++;
  XRViveController.LEFT_HAND = idx++;
  XRViveController.RIGHT_HAND = idx++;
  XRViveController.BASE_PATH_MODEL = `assets/models/Vive/controller/`;
  XRViveController.BASE_PATH_TEXTURE = `assets/textures/Vive/controller/`;
  XRViveController.CONTROLLER_TYPE = `tracked-pointer`;
  XRViveController.CHILD_MODEL_NAMES = [
    "body",
    "button",
    "l_grip",
    "led",
    "r_grip",
    "scroll_wheel",
    "sys_button",
    "trackpad",
    "trackpad_scroll_cut",
    "trackpad_touch",
    "trigger"
  ];
}
