let deviceXR = null;
let sessionXR = null;
let xrImmersiveFrameOfRef = null;
let xrNonImmersiveFrameOfRef = null;

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

if (navigator.xr && 0) {
  navigator.xr.requestDevice().then(device => {
    device.supportsSession({ immersive: true }).then(() => {
      deviceXR = device;
    });
    let output = document.createElement("canvas");
    output.id = "output";
    let ctx = output.getContext("xrpresent", RenderingContextOptions);
    device.supportsSession({ immersive: true }).then(() => {
      enterVR.innerHTML = `Enter VR`;
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
