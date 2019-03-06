import {
  clamp,
  loadObjectFile,
  RenderingContextOptions
} from "./utils.mjs";

import Ray from "./ray.mjs";
import Filter from "./filter.mjs";
import Camera from "./camera.mjs";
import Program from "./program.mjs";
import Texture from "./texture.mjs";
import FrameBuffer from "./framebuffer.mjs";
import TextureCollection from "./texture-collection.mjs";
import RenderObjectCollection from "./render-object-collection.mjs";

import RenderSprite from "./render-sprite.mjs";
import RenderObject from "./render-object.mjs";

import Cube from "./geometry/cube.mjs";
import Plane from "./geometry/plane.mjs";

import XRDatGUI from "./xr-dat-gui.mjs";
import { XRViveController, XRViveControllerButton } from "./xr-vive-controller.mjs";

import DirectionalLight from "./pssm-camera.mjs";

let width = 0;
let height = 0;
let lastWidth = 0;
let lastHeight = 0;

let gl = null;

let scene = document.createElement("canvas");

let camera = new Camera();
camera.transforms.translation[2] = 8;

let deviceXR = null;
let sessionXR = null;
let xrImmersiveFrameOfRef = null;
let xrNonImmersiveFrameOfRef = null;

let gui = null;

let leftController = null;
let rightController = null;

let objects = [];
let selection = null;

let directionalLight = null;

function onSessionEnded(session) {
  if (session) {
    session.end();
    console.log("Session ended");
  }
};

function onFrameXR(time, frame) {
  sessionXR = frame.session;
  sessionXR.depthNear = camera.settings.zNear;
  sessionXR.depthFar = camera.settings.zFar;
  let frameOfRef = sessionXR.immersive ? xrImmersiveFrameOfRef : xrNonExclusiveFrameOfRef;
  sessionXR.requestAnimationFrame(onFrameXR);
  let layer = sessionXR.baseLayer;
  drawScene(time, frame, frameOfRef, layer);
};

function onSessionStarted(session) {
  session.addEventListener("end", onSessionEnded);
  let opts = {...RenderingContextOptions};
  opts.compatibleXRDevice = session.device;
  gl = scene.getContext("webgl2", opts);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  init();
  session.baseLayer = new XRWebGLLayer(session, gl);
  session.requestFrameOfReference("eye-level").then(frameOfRef => {
    if (session.immersive) {
      xrImmersiveFrameOfRef = frameOfRef;
    } else {
      xrNonImmersiveFrameOfRef = frameOfRef;
    }
    session.requestAnimationFrame(onFrameXR);
  });
};

let controllerLaser = null;

if (navigator.xr) {
  navigator.xr.requestDevice().then(device => {
    device.supportsSession({ immersive: true }).then(() => {
      deviceXR = device;
    });
    let output = document.createElement("canvas");
    output.id = "output";
    let ctx = output.getContext("xrpresent", RenderingContextOptions);
    device.supportsSession({ immersive: true }).then(() => {
      enterVR.innerHTML = `Enter VR`;
      enterVR.style.zIndex = "9999";
      enterVR.onclick = () => {
        if (enterVR.innerHTML === `Enter VR`) {
          enterVR.innerHTML = `Exit VR`;
          deviceXR.requestSession({ immersive: true }).then(onSessionStarted);
        } else {
          onSessionEnded(sessionXR);
        }
      };
    });
  }).catch(() => {
    initDesktop();
  });
} else {
  initDesktop();
}

function drawSceneXR(frameXR, frameRefXR, layerXR) {
  leftController.update(frameXR, frameRefXR);
  rightController.update(frameXR, frameRefXR);
  // attach laser
  let mainController = (
    leftController.isActive ? leftController :
    rightController.isActive ? rightController : null
  );
  if (mainController && controllerLaser) {
    quat.copy(controllerLaser.transforms.rotation, mainController.transforms.rotation);
    vec3.copy(controllerLaser.transforms.translation, mainController.transforms.translation);
    controllerLaser.transform();
  }
  let {baseLayer} = sessionXR;
  let leftView = frameXR.views.filter(view => view.eye === "left")[0] || null;
  let rightView = frameXR.views.filter(view => view.eye === "right")[0] || null;
  let devicePose = null;
  if (frameXR.getViewerPose) devicePose = frameXR.getViewerPose(frameRefXR);
  else if (frameXR.getDevicePose) devicePose = frameXR.getDevicePose(frameRefXR);
  if (!devicePose) return;
  let modelMatrix = devicePose.poseModelMatrix;
  mat4.getTranslation(camera.transforms.translation, modelMatrix);
  gl.enable(gl.SCISSOR_TEST);
  let vp = baseLayer.getViewport(leftView);
  // left
  {
    let viewMatrix = mat4.clone(devicePose.getViewMatrix(leftView));
    let projectionMatrix = mat4.clone(leftView.projectionMatrix);
    mat4.copy(camera.getViewMatrix(), viewMatrix);
    mat4.copy(camera.getProjectionMatrix(), projectionMatrix);
    gl.viewport(vp.x, vp.y, vp.width, vp.height);
    gl.scissor(vp.x, vp.y, vp.width, vp.height);
    camera.width = vp.width;
    camera.height = vp.height;
    camera.update(true);
    draw(baseLayer.framebuffer);
  }
  if (mainController) {
    let trigger = mainController.getButton(XRViveControllerButton.TRIGGER);
    let {x, y} = gui.getRelativeScreenPosition(mainController);
    if (trigger.value > 0.0) gui.on("click", { x, y });
    gui.on("mousemove", { x, y });
  }
  // right
  {
    let vp = baseLayer.getViewport(rightView);
    let viewMatrix = mat4.clone(devicePose.getViewMatrix(rightView));
    let projectionMatrix = mat4.clone(rightView.projectionMatrix);
    mat4.copy(camera.getViewMatrix(), viewMatrix);
    mat4.copy(camera.getProjectionMatrix(), projectionMatrix);
    gl.viewport(vp.x, vp.y, vp.width, vp.height);
    gl.scissor(vp.x, vp.y, vp.width, vp.height);
    camera.width = vp.width;
    camera.height = vp.height;
    camera.update(true);
    draw(baseLayer.framebuffer);
  }
  gl.disable(gl.SCISSOR_TEST);
};


// make global
window.camera = camera;
window.objects = objects;
window.programs = {};

function initDesktop() {
  gl = scene.getContext("webgl2", RenderingContextOptions);
  document.body.appendChild(scene);
  resize();
  init();
  requestAnimationFrame(drawLoop);
};

function resize() {
  width = arguments[0] || window.innerWidth;
  height = arguments[1] || window.innerHeight;
  if (lastWidth === width && lastHeight === height) return;
  if (scene.width !== width || scene.height !== height) {
    scene.width = width;
    scene.height = height;
  }
  lastWidth = width;
  lastHeight = height;
  gl.viewport(0, 0, width, height);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.cullFace(gl.BACK);
  camera.resize(width, height);
  clear();
  console.log("Resized window to width:", width, "height:", height);
};

function useTexture(object, vari, id) {
  if (!vari) return;
  let texture = null;
  let textureId = gl.TEXTURE0 + id;
  gl.activeTexture(textureId);
  // webgl texture
  if (object instanceof WebGLTexture) texture = object;
  // object texture
  else if (object instanceof Texture) texture = object.native;
  // invalid texture
  else {
    console.warn(`Invalid texture bound of type ${object.constructor.name}`);
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(vari.location, id);
};

window.Time = { delta: 0.0 };

let then = 0.0;
let frames = 0;
function drawScene(now, frameXR, frameRefXR, layerXR) {
  let delta = (now - then) / 1e3;
  Time.delta = delta;
  then = now;
  deltaX *= 0.375;
  deltaY *= 0.375;
  updateObjects();
  if (!gl || !gl.ready) return;
  if (layerXR) drawSceneXR(frameXR, frameRefXR, layerXR);
  else drawSceneGL();
  // reset
  frames++;
};

function drawLoop() {
  requestAnimationFrame(drawLoop);
  drawScene(performance.now());
};

function drawSceneGL() {
  camera.control(
    [
      isKeyPressed("W") | 0,
      isKeyPressed("S") | 0,
      isKeyPressed("A") | 0,
      isKeyPressed("D") | 0,
      isKeyPressed(" ") | 0,
      isKeyPressed("Shift") | 0,
      isKeyPressed("Q") | 0,
      isKeyPressed("E") | 0
    ],
    deltaX, deltaY
  );
  //camera.transforms.translation[1] = -0.85;
  camera.update();
  directionalLight.update();
  draw(null);
};

function clear() {
  gl.clearColor(38.0 / 255.0, 50.0 / 255.0, 56.0 / 255.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

function draw(mainFBO = null) {
  directionalLight.drawObjectShadows();
  gl.bindFramebuffer(gl.FRAMEBUFFER, mainFBO);
  clear();
  drawObjects();
};

function updateObjects() {
  for (let ii = 0; ii < objects.length; ++ii) {
    let object = objects[ii];
    object.transform();
    object.update();
  };
};

function drawObjects() {
  for (let ii = 0; ii < objects.length; ++ii) {
    let object = objects[ii];
    drawObject(object);
  };
};

function drawObject(object) {
  let program = object.shader;
  let {variables} = program;
  // enable program
  gl.useProgram(program.native);
  // globals
  program.set("uCameraPosition", camera.transforms.translation);
  program.set("uViewMatrix", camera.getViewMatrix());
  program.set("uProjectionMatrix", camera.getProjectionMatrix());
  program.set("uShadowMatrix", directionalLight.shadowSpaceMatrix);
  // flushes constant definitions
  program.flush();
  // lighting
  {
    program.set("uLightColor", new Float32Array([230, 210, 200]));
    program.set("uLightPosition", new Float32Array([20, 80, 60]));
    program.set("uLightIntensity", 100.0);
    program.set("uLightAttenuation", 3.5);
  }
  // textures
  if (object.textures) {
    let {textures} = object;
    useTexture(textures.albedo, variables.uAlbedoMap, 0);
    useTexture(textures.normal, variables.uNormalMap, 1);
    useTexture(textures.roughness, variables.uRoughnessMap, 2);
    useTexture(textures.metallness, variables.uMetallnessMap, 3);
    useTexture(textures.emissive, variables.uEmissiveMap, 4);
    useTexture(textures.specular, variables.uSpecularMap, 5);
    useTexture(textures.ambientOcclusion, variables.uAmbientOcclusionMap, 6);
  }
  // shadow map
  let map = directionalLight.splits[0];
  useTexture(map.buffer.textures[0], variables.uShadowMap, 9);
  object.draw(program);
};

function loadPrograms() {
  let names = [
    "object",
    "object-pbr",
    "deferred/object",
    "deferred/point-light",
    "quad",
    "blur",
    "SSAO",
    "FXAA",
    "grid",
    "sky",
    "depth",
    "depth-textured"
  ];
  let basePath = "./shaders/";
  let programPromises = names.map(name => {
    let program = new Program({ gl });
    program.name = name;
    return program.fromPath(basePath + name);
  });
  return new Promise(resolve => {
    Promise.all(programPromises).then(results => {
      results.map(program => programs[program.name] = program);
      resolve();
    });
  });
};

async function init() {
  gl.getExtension("EXT_color_buffer_float");
  gl.camera = camera;
  await loadPrograms();
  gl.ready = true;
  directionalLight = new DirectionalLight({ gl, camera });
  leftController = new XRViveController({ gl, hand: XRViveController.LEFT_HAND });
  rightController = new XRViveController({ gl, hand: XRViveController.RIGHT_HAND });
  leftController.shader = rightController.shader = programs["object-pbr"];
  objects.push(leftController, rightController);
  {
    let mesh = await loadObjectFile("assets/models/material_sphere.obj");
    let textures = new TextureCollection({
      gl,
      albedo: [94, 94, 94]
    });
    let obj = new RenderObject({ gl, mesh, textures });
    obj.name = "material_sphere";
    obj.shader = programs["object-pbr"];
    obj.transforms.scaling[0] = obj.transforms.scaling[1] = obj.transforms.scaling[2] = 0.5;
    obj.transforms.translation[1] = -1.45;
    obj.transforms.translation[2] = 2.0;
    objects.push(obj);
    setInterval(() => {
      quat.rotateY(obj.transforms.rotation, obj.transforms.rotation, 0.25 * Math.PI / 180);
    }, 1e3 / 60);
  }
  {
    let mesh = Plane;
    let obj = new RenderObject({ gl, mesh });
    obj.shader = programs["grid"];
    obj.shader.define({
      uMajor: 6.0,
      uMinor: 1.0,
      uWidth: 0.5,
      uGridColor: new Float32Array([225.0, 225.0, 225.0]),
      uGroundColor: new Float32Array([235.0, 235.0, 235.0])
    });
    quat.rotateX(obj.transforms.rotation, obj.transforms.rotation, 180 * Math.PI / 180);
    obj.transforms.translation[1] = -1.75;
    obj.transforms.scaling[0] = obj.transforms.scaling[1] = obj.transforms.scaling[2] = 64.0;
    objects.push(obj);
  }
  {
    let mesh = await loadObjectFile("assets/models/sphere.obj");
    let obj = new RenderObject({ gl, mesh });
    obj.shader = programs["sky"];
    obj.shader.define({
      uIntensity: 0.15,
      uColorTop: new Float32Array([255, 255, 255]),
      uColorBottom: new Float32Array([0, 0, 0])
    });
    obj.cullingMode = RenderObject.CULL_FRONT;
    obj.transforms.scaling[0] = obj.transforms.scaling[1] = obj.transforms.scaling[2] = 512.0;
    obj.transforms.translation = camera.transforms.translation;
    objects.push(obj);
  }
  addGUI();
};

function addGUI() {
  class Controller {
    constructor() {
      this.Message = "XR Engine";
      this.Scale = 1.5;
      this.Switcher = false;
      this.Speed = null;
      this.Metallness = 255.0;
      this.Roughness = 145.0;
      this.Volume = 0.0;
      this.Random = 0.0;
    }
  };
  // setup dat.gui
  let controller = new Controller();
  gui = new XRDatGUI({ gl, initialWidth: 325, dynamicResolution: false });
  gui.shader = programs["object"];
  gui.transforms.translation[1] = -0.1;
  gui.transforms.translation[2] = 2.0;
  //gui.lookAt(camera, { always: true });
  quat.rotateY(gui.transforms.rotation, gui.transforms.rotation, 90 * Math.PI / 180);
  quat.rotateZ(gui.transforms.rotation, gui.transforms.rotation, -90 * Math.PI / 180);
  quat.rotateX(gui.transforms.rotation, gui.transforms.rotation, 180 * Math.PI / 180);
  gui.dat.add(controller, "Message").listen();
  gui.dat.add(controller, "Scale", 0, 360).listen();
  gui.dat.add(controller, "Switcher").listen();
  gui.dat.add(controller, "Speed", { Stopped: 0, Slow: 0.1, Fast: 5 } ).listen();
  let metallness = gui.dat.add(controller, "Metallness", 0, 255).listen();
  let roughness = gui.dat.add(controller, "Roughness", 0, 255).listen();
  metallness.onChange(value => {
    let obj = RenderObject.find("material_sphere");
    if (!obj) return;
    obj.textures.metallness = [value, value, value];
  });
  roughness.onChange(value => {
    let obj = RenderObject.find("material_sphere");
    if (!obj) return;
    obj.textures.roughness = [value, value, value];
  });
  metallness.__onChange(controller.Metallness);
  roughness.__onChange(controller.Roughness);
  let f1 = gui.dat.addFolder('Flow Field');
  f1.add(controller, "Volume").listen();
  f1.add(controller, "Random").listen();
  document.querySelector("[htmlgl='content']").appendChild(gui.dat.domElement);
  objects.push(gui);
  console.log(gui.datGL);
};

// events
window.onresize = () => resize();

window.keys = {};
window.onkeydown = (e) => {
  let key = e.key.toUpperCase();
  keys[key] = 1;
  if (key === "3") {
    if (camera.mode === Camera.MODE_FREE) {
      camera.mode = Camera.MODE_CUSTOM;
      document.exitPointerLock();
    }
    else {
      camera.mode = Camera.MODE_FREE;
      scene.requestPointerLock();
    }
  }
}
window.onkeyup = (e) => {
  let key = e.key.toUpperCase();
  keys[key] = 0;
};
let isKeyPressed = (key) => !!(keys[key] || keys[key.toLowerCase()] || keys[key.toUpperCase()]);

let mouseX = 0;
let mouseY = 0;
let deltaX = 0;
let deltaY = 0;

window.onmousemove = e => {
  if (!e.isTrusted) return;
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (locked) {
    deltaX = e.movementX * 0.75;
    deltaY = e.movementY * 0.75;
  } else {
    deltaX = 0;
    deltaY = 0;
  }
  if (gui) gui.on("mousemove", e);
};

window.onmousedown = e => {
  if (!e.isTrusted) return;
  if (gui && gui.on("mousedown", e)) {
    //
  }
  else scene.requestPointerLock();
};

window.onmouseup = e => {
  if (!e.isTrusted) return;
  if (gui) gui.on("mouseup", e);
};

window.onclick = e => {
  if (!e.isTrusted) return;
  if (gui) gui.on("click", e);
};

let locked = false;
setInterval(() => {
  let x = 0;
  let y = 0;
  if (locked) {
    x = width / 2;
    y = height / 2;
    //cursor.style.display = "block";
  } else {
    x = mouseX;
    y = mouseY;
    //cursor.style.display = "none";
  }
}, 1e3 / 60);

setInterval(() => {
  locked = document.pointerLockElement === scene;
}, 1e3 / 30);
