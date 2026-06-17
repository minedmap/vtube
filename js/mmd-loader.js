import * as THREE from 'three';
import { MMDLoader } from 'three/addons/animation/MMDLoader.js';
import { MMDPhysics } from 'three/addons/animation/MMDPhysics.js';
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';

let mmdRenderer, mmdScene, mmdCamera, mmdModel, mmdMixer, mmdPhysics, mmdSolver;
let mmdAnimId = null;

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
  if (mmdAnimId) cancelAnimationFrame(mmdAnimId);
  if (mmdPhysics) mmdPhysics.dispose();
  if (mmdRenderer) {
    mmdRenderer.dispose();
    mmdRenderer = null;
  }
  mmdModel = null; mmdPhysics = null; mmdSolver = null; mmdMixer = null;
  mmdScene = null; mmdCamera = null;
}

// Expose for main script
window.__mmd = { initMMD, loadMMDModel, resizeMMD, destroyMMD, mmdLoop };
