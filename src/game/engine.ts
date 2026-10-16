import * as THREE from 'three';
import {
  createInitialStats,
  clampPosition,
  checkSphereCollision,
  calculateTrackingVelocity,
  drainFuel,
  applyDamage,
  restoreFuel,
  collectScrap,
  evaluateGameState,
  GAME_CONSTANTS,
  GameStats,
} from './rules';
import { PooledObject, GameStateMode } from './types';
import { sound } from './audio';

export interface EngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onStateChange: (state: GameStateMode, reason?: string) => void;
  onScrapCollected: (scrap: number) => void;
  onDamageTaken: () => void;
}

export class SpaceExtractionEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number = 0;
  private isDestroyed: boolean = false;

  // Game state
  public state: GameStateMode = 'title';
  public stats: GameStats = createInitialStats();
  private callbacks: EngineCallbacks;

  // Viewport bounds in world units at z = 0
  private worldBounds = { minX: -14, maxX: 14, minY: -8.5, maxY: 8.5 };

  // Lighting (exactly 1 AmbientLight and 1 DirectionalLight as constrained)
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;

  // Player Entity
  private playerGroup!: THREE.Group;
  private playerPos = new THREE.Vector3(0, -5, 0);
  private playerVelocity = new THREE.Vector3(0, 0, 0);
  private playerInvulnerableTime = 0;
  private thrusterGlow!: THREE.Mesh;
  private thrusterLight!: THREE.PointLight;

  // Extraction Warp Gate
  private warpGateGroup!: THREE.Group;
  private warpGateMesh!: THREE.Mesh;
  private warpGateInnerMesh!: THREE.Mesh;
  private warpGateActive = false;

  // Starfield background
  private starfield!: THREE.Points;

  // Object Pools
  private asteroidPool: PooledObject[] = [];
  private dronePool: PooledObject[] = [];
  private fuelPool: PooledObject[] = [];
  private scrapPool: PooledObject[] = [];
  private projectilePool: PooledObject[] = [];
  private particlePool: PooledObject[] = [];

  // Pool Capacities
  private readonly ASTEROID_MAX = 30;
  private readonly DRONE_MAX = 12;
  private readonly FUEL_MAX = 10;
  private readonly SCRAP_MAX = 14;
  private readonly PROJECTILE_MAX = 40;
  private readonly PARTICLE_MAX = 80;

  // Geometries and Materials tracking for clean disposal
  private disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
    geometries: [],
    materials: [],
  };

  // Timers and Spawning
  private asteroidSpawnTimer = 0;
  private droneSpawnTimer = 0;
  private fuelSpawnTimer = 0;
  private scrapSpawnTimer = 0;
  private shootCooldown = 0;
  private hitstopTimer = 0;
  private cameraShakeIntensity = 0;
  private baseCameraPos = new THREE.Vector3(0, 0, 22);

  // Input states
  private keysHeld = new Set<string>();
  private touchMoveVector = new THREE.Vector2(0, 0);
  private touchFiring = false;

  // Scratch reusable vectors for zero-GC loop
  private readonly _vec3A = new THREE.Vector3();
  private readonly _vec3B = new THREE.Vector3();
  private lastTime = 0;
  private elapsedTime = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x030712, 0.015);

    // 2. Camera setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer setup - Shadows completely disabled for max performance
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false; // Constraint 3: Disabled completely
    container.appendChild(this.renderer.domElement);

    // 4. Calculate bounds based on FOV and camera distance
    this.recomputeWorldBounds();

    // 5. Build lighting (Constraint 3: 1 Ambient + 1 DirectionalLight)
    this.setupLighting();

    // 6. Build Starfield
    this.buildStarfield();

    // 7. Build Player ship
    this.buildPlayerShip();

    // 8. Build Extraction Warp Gate
    this.buildWarpGate();

    // 9. Initialize Object Pools (Constraint 1)
    this.initObjectPools();

    // 10. Bind Event Listeners
    this.bindEvents();

    // Start loop
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geom: T): T {
    this.disposables.geometries.push(geom);
    return geom;
  }

  private trackMaterial<T extends THREE.Material>(mat: T): T {
    this.disposables.materials.push(mat);
    return mat;
  }

  private recomputeWorldBounds() {
    const aspect = this.camera.aspect;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const width = height * aspect;
    // Keep player and items well within view
    this.worldBounds = {
      minX: -width * 0.44,
      maxX: width * 0.44,
      minY: -height * 0.44,
      maxY: height * 0.44,
    };
  }

  private setupLighting() {
    // Exactly one AmbientLight for baseline visibility
    this.ambientLight = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(this.ambientLight);

    // Exactly one low-intensity DirectionalLight
    this.dirLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    this.dirLight.position.set(5, 12, 15);
    this.dirLight.castShadow = false; // Disabled
    this.scene.add(this.dirLight);
  }

  private buildStarfield() {
    const starCount = 600;
    const starGeom = this.trackGeometry(new THREE.BufferGeometry());
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = -10 - Math.random() * 50;

      // Cyan, purple, white stars
      const r = Math.random();
      if (r < 0.4) {
        colors[i * 3] = 0.2;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
      } else if (r < 0.7) {
        colors[i * 3] = 0.8;
        colors[i * 3 + 1] = 0.3;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 0.9;
        colors[i * 3 + 1] = 0.95;
        colors[i * 3 + 2] = 1.0;
      }
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = this.trackMaterial(
      new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      })
    );

    this.starfield = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starfield);
  }

  private buildPlayerShip() {
    this.playerGroup = new THREE.Group();

    // 1. Primary Fuselage / Nose (Low-poly Cone)
    const hullGeom = this.trackGeometry(new THREE.ConeGeometry(0.85, 2.4, 5));
    hullGeom.rotateX(Math.PI / 2); // Point forward along Y axis
    const hullMat = this.trackMaterial(
      new THREE.MeshLambertMaterial({
        color: 0x9333ea, // Vibrant rogue purple
        flatShading: true,
      })
    );
    const hullMesh = new THREE.Mesh(hullGeom, hullMat);
    this.playerGroup.add(hullMesh);

    // 2. Wings (Low-poly angular wedges)
    const wingGeom = this.trackGeometry(new THREE.BoxGeometry(2.4, 0.12, 0.9));
    const wingMat = this.trackMaterial(
      new THREE.MeshLambertMaterial({
        color: 0x06b6d4, // Cyberpunk Cyan
        flatShading: true,
      })
    );
    const wingMesh = new THREE.Mesh(wingGeom, wingMat);
    wingMesh.position.set(0, -0.4, 0);
    this.playerGroup.add(wingMesh);

    // 3. Wingtip Laser Cannons
    const gunGeom = this.trackGeometry(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 4));
    gunGeom.rotateX(Math.PI / 2);
    const gunMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    const leftGun = new THREE.Mesh(gunGeom, gunMat);
    leftGun.position.set(-1.18, 0, 0);
    const rightGun = new THREE.Mesh(gunGeom, gunMat);
    rightGun.position.set(1.18, 0, 0);
    this.playerGroup.add(leftGun, rightGun);

    // 4. Cockpit Visor (Faceted Cyan Crystal)
    const visorGeom = this.trackGeometry(new THREE.ConeGeometry(0.35, 0.9, 4));
    visorGeom.rotateX(Math.PI / 2);
    const visorMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        wireframe: false,
      })
    );
    const visorMesh = new THREE.Mesh(visorGeom, visorMat);
    visorMesh.position.set(0, 0.35, 0.25);
    this.playerGroup.add(visorMesh);

    // 5. Thruster Engine Flame (Pulsating low-poly cylinder)
    const thrusterGeom = this.trackGeometry(new THREE.ConeGeometry(0.4, 1.2, 5));
    thrusterGeom.rotateX(-Math.PI / 2);
    const thrusterMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.thrusterGlow = new THREE.Mesh(thrusterGeom, thrusterMat);
    this.thrusterGlow.position.set(0, -1.5, 0);
    this.playerGroup.add(this.thrusterGlow);

    // Subtle local glow point light
    this.thrusterLight = new THREE.PointLight(0x06b6d4, 1.5, 5);
    this.thrusterLight.position.set(0, -1.2, 0);
    this.playerGroup.add(this.thrusterLight);

    // Add to scene
    this.playerGroup.position.copy(this.playerPos);
    this.scene.add(this.playerGroup);
  }

  private buildWarpGate() {
    this.warpGateGroup = new THREE.Group();

    // Massive glowing 3D Torus mesh representing "Extraction Warp Gate"
    const torusGeom = this.trackGeometry(new THREE.TorusGeometry(3.0, 0.65, 8, 24));
    const torusMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        wireframe: true,
      })
    );
    this.warpGateMesh = new THREE.Mesh(torusGeom, torusMat);
    this.warpGateGroup.add(this.warpGateMesh);

    // Inner glowing vortex ring
    const innerGeom = this.trackGeometry(new THREE.RingGeometry(0.5, 2.2, 16));
    const innerMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      })
    );
    this.warpGateInnerMesh = new THREE.Mesh(innerGeom, innerMat);
    this.warpGateGroup.add(this.warpGateInnerMesh);

    this.warpGateGroup.position.set(0, 0, 0);
    this.warpGateGroup.visible = false;
    this.scene.add(this.warpGateGroup);
  }

  private initObjectPools() {
    // 1. Asteroid Pool (Constraint 4: Icosahedrons for asteroids)
    const asteroidGeom = this.trackGeometry(new THREE.IcosahedronGeometry(1.2, 0));
    for (let i = 0; i < this.ASTEROID_MAX; i++) {
      // Clone geometry slightly for variety
      const mat = this.trackMaterial(
        new THREE.MeshLambertMaterial({
          color: 0x64748b,
          flatShading: true,
        })
      );
      const mesh = new THREE.Mesh(asteroidGeom, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.asteroidPool.push({
        mesh,
        active: false,
        type: 'asteroid',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: GAME_CONSTANTS.COLLISION_RADII.asteroid,
      });
    }

    // 2. Drone Pool (Constraint 4: Cubes for enemy tracking drones)
    const droneGeom = this.trackGeometry(new THREE.BoxGeometry(1.2, 1.2, 1.2));
    const droneCoreGeom = this.trackGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5));
    for (let i = 0; i < this.DRONE_MAX; i++) {
      const droneGroup = new THREE.Group();
      const bodyMat = this.trackMaterial(
        new THREE.MeshLambertMaterial({
          color: 0xd946ef, // Cyberpunk magenta
          flatShading: true,
        })
      );
      const bodyMesh = new THREE.Mesh(droneGeom, bodyMat);

      // Glowing red ocular sensor
      const eyeMat = this.trackMaterial(
        new THREE.MeshBasicMaterial({ color: 0xff0055 })
      );
      const eyeMesh = new THREE.Mesh(droneCoreGeom, eyeMat);
      eyeMesh.position.set(0, -0.4, 0.5);

      droneGroup.add(bodyMesh, eyeMesh);
      droneGroup.visible = false;
      this.scene.add(droneGroup);

      this.dronePool.push({
        mesh: droneGroup,
        active: false,
        type: 'drone',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: GAME_CONSTANTS.COLLISION_RADII.drone,
      });
    }

    // 3. Fuel Canisters (Glowing green cylinder primitives)
    const fuelGeom = this.trackGeometry(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 6));
    const fuelMat = this.trackMaterial(
      new THREE.MeshLambertMaterial({
        color: 0x10b981, // Emerald green
        flatShading: true,
        emissive: 0x059669,
      })
    );
    for (let i = 0; i < this.FUEL_MAX; i++) {
      const mesh = new THREE.Mesh(fuelGeom, fuelMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.fuelPool.push({
        mesh,
        active: false,
        type: 'fuel',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: GAME_CONSTANTS.COLLISION_RADII.fuel,
      });
    }

    // 4. Scrap Ore (Gold crystalline primitives)
    const scrapGeom = this.trackGeometry(new THREE.OctahedronGeometry(0.65, 0));
    const scrapMat = this.trackMaterial(
      new THREE.MeshLambertMaterial({
        color: 0xfbbf24, // Gold crystal
        flatShading: true,
        emissive: 0xd97706,
      })
    );
    for (let i = 0; i < this.SCRAP_MAX; i++) {
      const mesh = new THREE.Mesh(scrapGeom, scrapMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.scrapPool.push({
        mesh,
        active: false,
        type: 'scrap',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: GAME_CONSTANTS.COLLISION_RADII.scrap,
      });
    }

    // 5. Laser Projectiles
    const projGeom = this.trackGeometry(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 4));
    projGeom.rotateX(Math.PI / 2);
    const projMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    for (let i = 0; i < this.PROJECTILE_MAX; i++) {
      const mesh = new THREE.Mesh(projGeom, projMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectilePool.push({
        mesh,
        active: false,
        type: 'projectile',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: 0.4,
      });
    }

    // 6. Particle Debris Pool
    const particleGeom = this.trackGeometry(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    const particleMat = this.trackMaterial(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    for (let i = 0; i < this.PARTICLE_MAX; i++) {
      const mesh = new THREE.Mesh(particleGeom, particleMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        active: false,
        type: 'particle',
        velocity: new THREE.Vector3(),
        rotationalVelocity: new THREE.Vector3(),
        radius: 0.1,
        lifetime: 0,
        maxLifetime: 0.5,
      });
    }
  }

  private bindEvents() {
    // Window Resize listener (Constraint 5)
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // Keyboard controls (WASD, Arrows, Space, P, M, Enter)
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  private handleResize() {
    if (this.isDestroyed || !this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.recomputeWorldBounds();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    this.keysHeld.add(key);

    // Space / Enter shortcuts
    if (this.state === 'title' && (key === ' ' || key === 'enter')) {
      e.preventDefault();
      this.startMission();
      return;
    }

    // Space bar shoots lasers in playing state
    if (this.state === 'playing' && (key === ' ' || key === 'control')) {
      e.preventDefault();
      this.fireLaser();
    }

    // Escape or P triggers Pause
    if (key === 'escape' || key === 'p') {
      e.preventDefault();
      if (this.state === 'playing') {
        this.pauseMission();
      } else if (this.state === 'paused') {
        this.resumeMission();
      }
    }

    // M toggles audio mute
    if (key === 'm') {
      sound.toggleMute();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysHeld.delete(e.key.toLowerCase());
  }

  private handleBlur() {
    this.keysHeld.clear();
    this.touchMoveVector.set(0, 0);
    this.touchFiring = false;
  }

  /**
   * Mobile touch input updates
   */
  public setTouchMove(x: number, y: number) {
    this.touchMoveVector.set(x, y);
  }

  public setTouchFiring(firing: boolean) {
    this.touchFiring = firing;
  }

  /**
   * Spawns an explosion particle burst from the pre-allocated pool
   */
  public spawnExplosion(x: number, y: number, colorHex: number = 0x38bdf8, count: number = 10) {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y, 0);
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 5.0;
        p.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * 3);
        p.lifetime = 0;
        p.maxLifetime = 0.35 + Math.random() * 0.35;
        (p.mesh as THREE.Mesh).material = this.trackMaterial(
          new THREE.MeshBasicMaterial({ color: colorHex })
        );
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  /**
   * Fires twin laser projectiles from player ship
   */
  public fireLaser() {
    if (this.shootCooldown > 0 || this.state !== 'playing') return;
    this.shootCooldown = 0.22; // 4.5 shots/sec max
    sound.playLaser(this.playerPos.x / this.worldBounds.maxX);

    // Left cannon
    this.spawnProjectile(this.playerPos.x - 1.18, this.playerPos.y + 0.5);
    // Right cannon
    this.spawnProjectile(this.playerPos.x + 1.18, this.playerPos.y + 0.5);
  }

  private spawnProjectile(x: number, y: number) {
    for (const proj of this.projectilePool) {
      if (!proj.active) {
        proj.active = true;
        proj.mesh.visible = true;
        proj.mesh.position.set(x, y, 0);
        proj.velocity.set(0, 24, 0); // Fast upward projectile
        return;
      }
    }
  }

  /**
   * Spawns an asteroid floating down from top
   */
  private spawnAsteroid() {
    for (const item of this.asteroidPool) {
      if (!item.active) {
        item.active = true;
        item.mesh.visible = true;
        const startX = this.worldBounds.minX + Math.random() * (this.worldBounds.maxX - this.worldBounds.minX);
        item.mesh.position.set(startX, this.worldBounds.maxY + 2.5, 0);
        // Random downward float with slight drift
        item.velocity.set(
          (Math.random() - 0.5) * 2.5,
          -(3.2 + Math.random() * 2.8),
          0
        );
        item.rotationalVelocity.set(
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0,
          (Math.random() - 0.5) * 2.0
        );
        const scale = 0.8 + Math.random() * 0.6;
        item.mesh.scale.set(scale, scale, scale);
        item.radius = GAME_CONSTANTS.COLLISION_RADII.asteroid * scale;
        return;
      }
    }
  }

  /**
   * Spawns a tracking drone from corners
   */
  private spawnDrone() {
    for (const item of this.dronePool) {
      if (!item.active) {
        item.active = true;
        item.mesh.visible = true;
        // Choose one of 4 corners
        const cornerX = Math.random() < 0.5 ? this.worldBounds.minX - 1 : this.worldBounds.maxX + 1;
        const cornerY = Math.random() < 0.5 ? this.worldBounds.maxY + 1 : this.worldBounds.maxY - 4;
        item.mesh.position.set(cornerX, cornerY, 0);
        item.velocity.set(0, 0, 0);
        item.rotationalVelocity.set(0, 0, 1.5);
        sound.playDroneAlert(cornerX / this.worldBounds.maxX);
        return;
      }
    }
  }

  /**
   * Spawns glowing green Fuel canister
   */
  private spawnFuel() {
    for (const item of this.fuelPool) {
      if (!item.active) {
        item.active = true;
        item.mesh.visible = true;
        const startX = this.worldBounds.minX + 1.5 + Math.random() * (this.worldBounds.maxX - this.worldBounds.minX - 3);
        item.mesh.position.set(startX, this.worldBounds.maxY + 2, 0);
        item.velocity.set(0, -2.6, 0);
        item.rotationalVelocity.set(0, 2.5, 1.0);
        return;
      }
    }
  }

  /**
   * Spawns gold crystalline Scrap Ore
   */
  private spawnScrap() {
    for (const item of this.scrapPool) {
      if (!item.active) {
        item.active = true;
        item.mesh.visible = true;
        const startX = this.worldBounds.minX + 1.5 + Math.random() * (this.worldBounds.maxX - this.worldBounds.minX - 3);
        item.mesh.position.set(startX, this.worldBounds.maxY + 2, 0);
        item.velocity.set((Math.random() - 0.5) * 1.5, -2.4, 0);
        item.rotationalVelocity.set(2.0, 3.0, 1.5);
        return;
      }
    }
  }

  /**
   * Starts or restarts a game mission
   */
  public startMission() {
    this.resetAllEntities();
    this.stats = createInitialStats();
    this.state = 'playing';
    document.body.dataset.state = 'playing';
    this.warpGateActive = false;
    this.warpGateGroup.visible = false;
    this.playerPos.set(0, -5, 0);
    this.playerGroup.position.copy(this.playerPos);
    this.playerInvulnerableTime = 1.0; // 1s grace period on start

    this.callbacks.onStatsUpdate(this.stats);
    this.callbacks.onStateChange('playing');
  }

  public pauseMission() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.body.dataset.state = 'paused';
    this.callbacks.onStateChange('paused');
  }

  public resumeMission() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onStateChange('playing');
  }

  /**
   * Completely resets all object pools, arrays, scales, positions, and tickers
   */
  public resetAllEntities() {
    // Reset asteroids
    for (const item of this.asteroidPool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }
    // Reset drones
    for (const item of this.dronePool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }
    // Reset fuel
    for (const item of this.fuelPool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }
    // Reset scrap
    for (const item of this.scrapPool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }
    // Reset projectiles
    for (const item of this.projectilePool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }
    // Reset particles
    for (const item of this.particlePool) {
      item.active = false;
      item.mesh.visible = false;
      item.mesh.position.set(0, 100, 0);
    }

    this.asteroidSpawnTimer = 0;
    this.droneSpawnTimer = 1.0;
    this.fuelSpawnTimer = 2.0;
    this.scrapSpawnTimer = 0.5;
    this.hitstopTimer = 0;
    this.cameraShakeIntensity = 0;
    this.camera.position.copy(this.baseCameraPos);
  }

  /**
   * Main 60fps Animation Loop
   */
  private tick() {
    if (this.isDestroyed) return;

    this.animationFrameId = requestAnimationFrame(this.tick);

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Ultra mode: Clamp frame dt to <= 0.05s
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsedTime += dt;

    // Hitstop freeze handling
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      // Continue rendering camera shake and scene during hitstop
      this.updateCameraShake(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Update starfield drift
    if (this.starfield) {
      const positions = (this.starfield.geometry as THREE.BufferGeometry).attributes.position;
      const array = positions.array as Float32Array;
      const starSpeed = this.state === 'playing' ? 14 : 5;
      for (let i = 1; i < array.length; i += 3) {
        array[i] -= starSpeed * dt;
        if (array[i] < -45) {
          array[i] = 45;
        }
      }
      positions.needsUpdate = true;
    }

    // Camera shake decay
    this.updateCameraShake(dt);

    if (this.state === 'playing') {
      this.updateSimulation(dt);
    } else if (this.state === 'title') {
      // Gentle floating animation on title screen
      const time = this.elapsedTime;
      this.playerGroup.position.y = -5 + Math.sin(time * 2) * 0.3;
      this.playerGroup.rotation.z = Math.sin(time * 1.5) * 0.08;
      this.playerGroup.rotation.y = Math.cos(time * 1.2) * 0.12;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateCameraShake(dt: number) {
    if (this.cameraShakeIntensity > 0) {
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 3.5);
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.2;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity * 1.2;
      this.camera.position.set(
        this.baseCameraPos.x + shakeX,
        this.baseCameraPos.y + shakeY,
        this.baseCameraPos.z
      );
    } else {
      this.camera.position.copy(this.baseCameraPos);
    }
  }

  /**
   * Main gameplay simulation step
   */
  private updateSimulation(dt: number) {
    // 1. Drain fuel at constant steady rate per frame
    this.stats.fuel = drainFuel(this.stats.fuel, dt, GAME_CONSTANTS.FUEL_DRAIN_PER_SECOND);

    // Score ticks up with distance/time survived
    this.stats.score += dt * 35;

    // Invulnerability timer decay
    if (this.playerInvulnerableTime > 0) {
      this.playerInvulnerableTime -= dt;
      this.playerGroup.visible = Math.floor(this.playerInvulnerableTime * 15) % 2 === 0;
    } else {
      this.playerGroup.visible = true;
    }

    // Shoot cooldown decay
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }

    // Auto-fire if touchFiring is active
    if (this.touchFiring) {
      this.fireLaser();
    }

    // 2. Spaceship Movement Control (WASD / Arrows + Touch)
    let moveX = 0;
    let moveY = 0;

    if (this.keysHeld.has('a') || this.keysHeld.has('arrowleft')) moveX -= 1;
    if (this.keysHeld.has('d') || this.keysHeld.has('arrowright')) moveX += 1;
    if (this.keysHeld.has('w') || this.keysHeld.has('arrowup')) moveY += 1;
    if (this.keysHeld.has('s') || this.keysHeld.has('arrowdown')) moveY -= 1;

    // Blend touch vector
    moveX += this.touchMoveVector.x;
    moveY += this.touchMoveVector.y;

    // Normalize diagonal input
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const shipSpeed = 16.5;
    this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, moveX * shipSpeed, 12, dt);
    this.playerVelocity.y = THREE.MathUtils.damp(this.playerVelocity.y, moveY * shipSpeed, 12, dt);

    this.playerPos.x += this.playerVelocity.x * dt;
    this.playerPos.y += this.playerVelocity.y * dt;

    // Strict visible screen border clamping (Constraint 1)
    const clamped = clampPosition(this.playerPos, this.worldBounds);
    this.playerPos.x = clamped.x;
    this.playerPos.y = clamped.y;
    this.playerGroup.position.copy(this.playerPos);

    // Roll / tilt banking animation
    const targetRoll = -this.playerVelocity.x * 0.035;
    this.playerGroup.rotation.z = THREE.MathUtils.damp(this.playerGroup.rotation.z, targetRoll, 10, dt);

    // Engine thruster pulsing
    const pulse = 1.0 + Math.sin(this.elapsedTime * 30) * 0.2 + Math.abs(this.playerVelocity.y) * 0.05;
    this.thrusterGlow.scale.set(1.0, pulse, 1.0);
    this.thrusterLight.intensity = 1.5 * pulse;

    // 3. Spawning Matrix
    this.asteroidSpawnTimer += dt;
    if (this.asteroidSpawnTimer > 0.65) {
      this.asteroidSpawnTimer = 0;
      this.spawnAsteroid();
    }

    this.droneSpawnTimer += dt;
    if (this.droneSpawnTimer > 3.8) {
      this.droneSpawnTimer = 0;
      this.spawnDrone();
    }

    this.fuelSpawnTimer += dt;
    if (this.fuelSpawnTimer > 4.2) {
      this.fuelSpawnTimer = 0;
      this.spawnFuel();
    }

    this.scrapSpawnTimer += dt;
    if (this.scrapSpawnTimer > 1.8) {
      this.scrapSpawnTimer = 0;
      this.spawnScrap();
    }

    // 4. Update Asteroids
    for (const ast of this.asteroidPool) {
      if (!ast.active) continue;
      ast.mesh.position.addScaledVector(ast.velocity, dt);
      ast.mesh.rotation.x += ast.rotationalVelocity.x * dt;
      ast.mesh.rotation.y += ast.rotationalVelocity.y * dt;

      // Check bounds to deactivate (Constraint 2)
      if (ast.mesh.position.y < this.worldBounds.minY - 3) {
        ast.active = false;
        ast.mesh.visible = false;
      }
    }

    // 5. Update Tracking Drones (Constraint 2: Normalized velocity toward player's real-time position)
    for (const drone of this.dronePool) {
      if (!drone.active) continue;

      const tracking = calculateTrackingVelocity(
        { x: drone.mesh.position.x, y: drone.mesh.position.y },
        { x: this.playerPos.x, y: this.playerPos.y },
        7.2 // Drone speed
      );
      drone.velocity.set(tracking.x, tracking.y, 0);
      drone.mesh.position.addScaledVector(drone.velocity, dt);
      drone.mesh.rotation.z += 3.0 * dt;

      // Despawn if out of bounds
      if (
        drone.mesh.position.y < this.worldBounds.minY - 4 ||
        drone.mesh.position.y > this.worldBounds.maxY + 4 ||
        Math.abs(drone.mesh.position.x) > this.worldBounds.maxX + 4
      ) {
        drone.active = false;
        drone.mesh.visible = false;
      }
    }

    // 6. Update Fuel Pickups
    for (const item of this.fuelPool) {
      if (!item.active) continue;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.y += item.rotationalVelocity.y * dt;
      if (item.mesh.position.y < this.worldBounds.minY - 3) {
        item.active = false;
        item.mesh.visible = false;
      }
    }

    // 7. Update Scrap Ore Pickups
    for (const item of this.scrapPool) {
      if (!item.active) continue;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.x += item.rotationalVelocity.x * dt;
      item.mesh.rotation.y += item.rotationalVelocity.y * dt;
      if (item.mesh.position.y < this.worldBounds.minY - 3) {
        item.active = false;
        item.mesh.visible = false;
      }
    }

    // 8. Update Laser Projectiles
    for (const proj of this.projectilePool) {
      if (!proj.active) continue;
      proj.mesh.position.addScaledVector(proj.velocity, dt);
      if (proj.mesh.position.y > this.worldBounds.maxY + 3) {
        proj.active = false;
        proj.mesh.visible = false;
      }
    }

    // 9. Update Particles
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.lifetime = (p.lifetime || 0) + dt;
      const progress = p.lifetime / (p.maxLifetime || 0.5);
      const scale = Math.max(0.01, 1 - progress);
      p.mesh.scale.set(scale, scale, scale);
      if (progress >= 1) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // 10. Update Extraction Warp Gate (Once scrap reaches 20)
    if (this.stats.scrap >= GAME_CONSTANTS.TARGET_SCRAP) {
      if (!this.warpGateActive) {
        this.warpGateActive = true;
        this.warpGateGroup.visible = true;
        this.warpGateGroup.position.set(0, 2.5, 0);
        sound.playWarpSpawn();
      }
      this.warpGateMesh.rotation.x += 1.2 * dt;
      this.warpGateMesh.rotation.y += 1.8 * dt;
      this.warpGateInnerMesh.rotation.z -= 2.5 * dt;
      const pulse = 1.0 + Math.sin(this.elapsedTime * 4) * 0.15;
      this.warpGateGroup.scale.set(pulse, pulse, pulse);
    }

    // 11. Run Strict Collision Detection (Constraint 3)
    this.runCollisionChecks();

    // 12. Evaluate Win/Loss triggers (Constraint 4)
    const evaluated = evaluateGameState(this.stats);
    this.stats = evaluated;

    if (evaluated.isGameOver) {
      this.state = 'gameover';
      document.body.dataset.state = 'gameover';
      sound.playGameOver();
      this.callbacks.onStateChange('gameover', evaluated.gameOverReason || 'Mission Failed');
    }

    // Periodic UI updates
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  /**
   * Collision Detection Matrix: Projectiles vs Enemies/Asteroids, Player vs Pickups/Hazards/Warp
   */
  private runCollisionChecks() {
    const playerRadius = GAME_CONSTANTS.COLLISION_RADII.player;
    const canTakeDamage = this.playerInvulnerableTime <= 0;

    // A. Projectiles vs Asteroids & Drones
    for (const proj of this.projectilePool) {
      if (!proj.active) continue;

      // Projectile vs Asteroid
      for (const ast of this.asteroidPool) {
        if (!ast.active) continue;
        if (checkSphereCollision(proj.mesh.position, proj.radius, ast.mesh.position, ast.radius)) {
          // Hit asteroid!
          proj.active = false;
          proj.mesh.visible = false;
          ast.active = false;
          ast.mesh.visible = false;
          this.stats.score += 100;
          this.spawnExplosion(ast.mesh.position.x, ast.mesh.position.y, 0x94a3b8, 12);
          sound.playImpact(false, ast.mesh.position.x / this.worldBounds.maxX);
          break;
        }
      }

      // Projectile vs Drone
      if (!proj.active) continue;
      for (const drone of this.dronePool) {
        if (!drone.active) continue;
        if (checkSphereCollision(proj.mesh.position, proj.radius, drone.mesh.position, drone.radius)) {
          // Hit drone!
          proj.active = false;
          proj.mesh.visible = false;
          drone.active = false;
          drone.mesh.visible = false;
          this.stats.score += 250;
          this.spawnExplosion(drone.mesh.position.x, drone.mesh.position.y, 0xd946ef, 16);
          sound.playImpact(true, drone.mesh.position.x / this.worldBounds.maxX);
          break;
        }
      }
    }

    // B. Player vs Pickups (Fuel & Scrap Ore)
    // 1. Fuel canisters
    for (const fuel of this.fuelPool) {
      if (!fuel.active) continue;
      if (checkSphereCollision(this.playerPos, playerRadius, fuel.mesh.position, fuel.radius)) {
        fuel.active = false;
        fuel.mesh.visible = false;
        this.stats.fuel = restoreFuel(this.stats.fuel, GAME_CONSTANTS.FUEL_PICKUP_RESTORE);
        this.stats.score += 150;
        this.spawnExplosion(fuel.mesh.position.x, fuel.mesh.position.y, 0x10b981, 8);
        sound.playFuelPickup(fuel.mesh.position.x / this.worldBounds.maxX);
      }
    }

    // 2. Scrap Ore crystals
    for (const scrap of this.scrapPool) {
      if (!scrap.active) continue;
      if (checkSphereCollision(this.playerPos, playerRadius, scrap.mesh.position, scrap.radius)) {
        scrap.active = false;
        scrap.mesh.visible = false;
        this.stats = collectScrap(this.stats);
        this.spawnExplosion(scrap.mesh.position.x, scrap.mesh.position.y, 0xfbbf24, 10);
        sound.playScrapPickup(scrap.mesh.position.x / this.worldBounds.maxX);
        this.callbacks.onScrapCollected(this.stats.scrap);
      }
    }

    // C. Player vs Hazards (Diminishes Shields)
    if (canTakeDamage) {
      // 1. Asteroid collision
      for (const ast of this.asteroidPool) {
        if (!ast.active) continue;
        if (checkSphereCollision(this.playerPos, playerRadius, ast.mesh.position, ast.radius)) {
          ast.active = false;
          ast.mesh.visible = false;
          this.stats.shields = applyDamage(this.stats.shields, GAME_CONSTANTS.ASTEROID_SHIELD_DAMAGE);
          this.triggerPlayerHit(true, ast.mesh.position.x);
          break;
        }
      }

      // 2. Drone collision
      for (const drone of this.dronePool) {
        if (!drone.active) continue;
        if (checkSphereCollision(this.playerPos, playerRadius, drone.mesh.position, drone.radius)) {
          drone.active = false;
          drone.mesh.visible = false;
          this.stats.shields = applyDamage(this.stats.shields, GAME_CONSTANTS.DRONE_SHIELD_DAMAGE);
          this.triggerPlayerHit(true, drone.mesh.position.x);
          break;
        }
      }
    }

    // D. Player vs Extraction Warp Gate (Win Condition)
    if (this.warpGateActive && this.warpGateGroup.visible) {
      const warpRadius = GAME_CONSTANTS.COLLISION_RADII.warpGate;
      if (checkSphereCollision(this.playerPos, playerRadius, this.warpGateGroup.position, warpRadius)) {
        // Trigger Victory!
        this.state = 'victory';
        document.body.dataset.state = 'gameover';
        this.stats = evaluateGameState(this.stats, true);
        sound.playVictory();
        this.spawnExplosion(this.playerPos.x, this.playerPos.y, 0x22d3ee, 40);
        this.callbacks.onStateChange('victory');
      }
    }
  }

  private triggerPlayerHit(heavy: boolean, sourceX: number) {
    this.playerInvulnerableTime = 0.8;
    this.hitstopTimer = 0.05; // 50ms simulation hitstop
    this.cameraShakeIntensity = heavy ? 0.8 : 0.4;
    sound.playImpact(heavy, sourceX / this.worldBounds.maxX);
    this.spawnExplosion(this.playerPos.x, this.playerPos.y, 0xef4444, 15);
    this.callbacks.onDamageTaken();
  }

  /**
   * Complete lifecycle disposal: cleans up WebGL geometries and materials
   */
  public dispose() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animationFrameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);

    // Dispose all tracked geometries (Constraint 2)
    for (const geom of this.disposables.geometries) {
      geom.dispose();
    }
    // Dispose all tracked materials (Constraint 2)
    for (const mat of this.disposables.materials) {
      mat.dispose();
    }

    // Dispose renderer
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
