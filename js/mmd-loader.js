import * as THREE from 'three';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { MMDPhysics } from 'three/addons/animation/MMDPhysics.js';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

let mmdRenderer, mmdScene, mmdCamera, mmdModel, mmdMixer, mmdPhysics, mmdSolver;
let mmdAnimId = null;
// VRM state
let vrmData = null; // {model, scene, vrm}
let vrmAnimId = null;
let activeMode = 'mmd'; // 'mmd' | 'vrm'

export function initMMD(canvas) {
  mmdRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  mmdRenderer.setPixelRatio(devicePixelRatio || 1);
  mmdRenderer.setClearColor(0x000000, 0);
  mmdRenderer.shadowMap.enabled = false;
  mmdRenderer.outputColorSpace = THREE.SRGBColorSpace;

  mmdScene = new THREE.Scene();
  mmdScene.background = null;

  // lighting
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  mmdScene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(1, 1, 1);
  mmdScene.add(dir);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
  rim.position.set(-1, 0.5, 1);
  mmdScene.add(rim);

  mmdCamera = new THREE.PerspectiveCamera(35, 1, 1, 100);
  mmdCamera.position.set(0, 10, 28);
  mmdCamera.lookAt(0, 10, 0);
}

export function loadMMDModel(url) {
  if (vrmData) { clearVRM(); }
  if (mmdModel) {
    mmdScene.remove(mmdModel);
    if (mmdPhysics) mmdPhysics.dispose();
    mmdModel = null; mmdPhysics = null; mmdSolver = null; mmdMixer = null;
  }
  const loader = new MMDLoader();
  loader.load(url, (result) => {
    mmdModel = result.mesh;
    const anim = result.animation || null;
    mmdModel.position.set(0, 5, 0);
    mmdModel.scale.set(1, 1, 1);
    mmdScene.add(mmdModel);

    if (anim) {
      mmdMixer = new THREE.AnimationMixer(mmdModel);
      mmdMixer.clipAction(anim).play();
    }

    mmdSolver = new CCDIKSolver(mmdModel, result.ikBones);
    mmdPhysics = new MMDPhysics(mmdModel, { unitStep: true });
  }, undefined, (err) => { console.error('MMD load error:', err); });
}

function mmdLoop(width, height) {
  if (!mmdRenderer || !mmdModel) return;
  mmdRenderer.setSize(width, height, false);

  // apply face tracking
  if (mmdModel && window.__mmdFace) {
    const f = window.__mmdFace;
    const bones = mmdModel.skeleton?.bones;
    if (bones) {
      // head bone
      const headBone = bones.find(b => b.name?.includes('頭') || b.name === 'head');
      if (headBone) {
        headBone.rotation.x = f.pitch || 0;
        headBone.rotation.y = f.yaw || 0;
      }
    }
  }

  if (mmdSolver) mmdSolver.update();
  if (mmdPhysics) mmdPhysics.update();
  if (mmdMixer) mmdMixer.update(1/60);

  mmdRenderer.render(mmdScene, mmdCamera);
  mmdAnimId = requestAnimationFrame(() => mmdLoop(width, height));
}

export function resizeMMD(w, h) {
  if (mmdRenderer) {
    mmdRenderer.setSize(w, h, false);
    if (mmdCamera) {
      mmdCamera.aspect = w / h;
      mmdCamera.updateProjectionMatrix();
    }
  }
}

export function destroyMMD() {
  clearMMD();
  clearVRM();
  if (mmdRenderer) {
    mmdRenderer.dispose();
    mmdRenderer = null;
  }
  mmdScene = null; mmdCamera = null;
}

// ─── VRM ──────────────────────────────────────────
export function loadVRMModel(url) {
  if (mmdModel) { clearMMD(); }
  if (vrmData) { clearVRM(); }
  activeMode = 'vrm';

  const loader = new GLTFLoader();
  loader.registerPlugin(new VRMLoaderPlugin());
  loader.load(url, (gltf) => {
    const vrm = gltf.userData.vrm;
    if (!vrm) { console.error('VRM: no vrm in gltf'); return; }
    const scene = gltf.scene;
    scene.position.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    mmdScene.add(scene);
    vrmData = { scene, vrm };
    vrmLoop(mmdRenderer.domElement.width, mmdRenderer.domElement.height);
  }, undefined, (err) => { console.error('VRM load error:', err); });
}

function clearVRM() {
  if (vrmAnimId) cancelAnimationFrame(vrmAnimId);
  if (vrmData) {
    mmdScene.remove(vrmData.scene);
    VRMUtils.deepDispose(vrmData.scene);
    vrmData = null;
  }
  vrmAnimId = null;
}

function vrmLoop(w, h) {
  if (!vrmData) return;
  mmdRenderer.setSize(w, h, false);

  // Apply face tracking via VRM blendshapes
  if (vrmData.vrm && window.__mmdFace) {
    const f = window.__mmdFace;
    const exp = vrmData.vrm.expressionManager;
    if (exp) {
      exp.setValue('blink', f.blink || 0);
      exp.setValue('joy', f.joy || 0);
      exp.setValue('angry', f.angry || 0);
      exp.setValue('sorrow', f.sorrow || 0);
      exp.setValue('surprise', f.surprise || 0);
      exp.setValue('aa', f.aa || 0);
      exp.setValue('ee', f.ee || 0);
      exp.setValue('oh', f.oh || 0);
    }
    // Head rotation
    const head = vrmData.vrm.humanoid?.getRawBone('head');
    if (head) {
      head.rotation.x = f.pitch || 0;
      head.rotation.y = f.yaw || 0;
    }
  }

  vrmData.vrm.update(1/60);
  mmdRenderer.render(mmdScene, mmdCamera);
  vrmAnimId = requestAnimationFrame(() => vrmLoop(w, h));
}

function clearMMD() {
  if (mmdAnimId) cancelAnimationFrame(mmdAnimId);
  if (mmdPhysics) mmdPhysics.dispose();
  if (mmdModel) {
    mmdScene.remove(mmdModel);
    mmdModel = null;
  }
  mmdPhysics = null; mmdSolver = null; mmdMixer = null;
}

// Expose for main script
window.__mmd = { initMMD, loadMMDModel, resizeMMD, destroyMMD, mmdLoop, loadVRMModel };
