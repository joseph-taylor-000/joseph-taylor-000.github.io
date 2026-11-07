
/* =========================================
   ROCKET BANNER SYSTEM
   Nose-anchored cursor tracking
========================================= */

const banner = document.getElementById("rocketBanner");
const rocket = document.getElementById("rocket");
const canvas = document.getElementById("rocketCanvas");

if (!banner || !rocket || !canvas) {
    throw new Error("Rocket banner: required HTML elements not found.");
}

const ctx = canvas.getContext("2d");


/* =========================================
   CONFIGURATION
========================================= */

const CONFIG = {

    // Rocket movement
    followSpeed: 4,

    // Rotation
    rotationSpeed: 9,

    // SVG points UP by default
    svgRotationOffset: Math.PI / 2,

    // Actual distance from rocket centre to visible nose.
    // Adjust this if the SVG has transparent padding.
    noseLength: 102,

    // Momentum
    coastDrag: 0.9,
    minimumCoastSpeed: 2,

    // Projectiles
    projectileSpeed: 900,
    projectileLength: 5,
    projectileWidth: 2,
    spreadAngle: 0.10,
    burstCount: 3,
    maxBounces: 6,
    projectileLifetime: 5,
    maxProjectiles: 80,

    // Impact particles
    impactParticles: 8,
    maxParticles: 250,

    // Border effects
    borderFlashDecay: 5
};


/* =========================================
   CANVAS SETUP
========================================= */

let width = 0;
let height = 0;
let pixelRatio = 1;

function resizeCanvas() {

    const rect = banner.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2
    );

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(
        pixelRatio, 0,
        0, pixelRatio,
        0, 0
    );
}

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(banner);

resizeCanvas();


/* =========================================
   ROCKET STATE
========================================= */

const rocketState = {

    // Centre position of the rocket
    x: width * 0.5,
    y: height * 0.5,

    vx: 0,
    vy: 0,

    // Direction the rocket faces.
    // Movement angle: 0 = right, PI/2 = down.
    angle: -Math.PI / 2,

    // Cursor position = desired NOSE position
    targetX: width * 0.5,
    targetY: height * 0.5,

    pointerInside: false,

    // Cursor velocity for momentum
    pointerVX: 0,
    pointerVY: 0,

    lastPointerX: 0,
    lastPointerY: 0,
    lastPointerTime: 0

};


/* =========================================
   POINTER INPUT
========================================= */

function setPointerPosition(event) {

    const rect = banner.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const currentTime = event.timeStamp;

    if (rocketState.lastPointerTime > 0) {

        const elapsed =
            (currentTime - rocketState.lastPointerTime) / 1000;

        if (elapsed > 0.001) {

            const rawVX =
                (x - rocketState.lastPointerX) / elapsed;

            const rawVY =
                (y - rocketState.lastPointerY) / elapsed;

            // Smooth and limit cursor velocity.
            const maxSpeed = 1400;

            rocketState.pointerVX =
                rocketState.pointerVX * 0.65 +
                Math.max(-maxSpeed, Math.min(maxSpeed, rawVX)) * 0.35;

            rocketState.pointerVY =
                rocketState.pointerVY * 0.65 +
                Math.max(-maxSpeed, Math.min(maxSpeed, rawVY)) * 0.35;
        }
    }

    rocketState.targetX = x;
    rocketState.targetY = y;

    rocketState.lastPointerX = x;
    rocketState.lastPointerY = y;
    rocketState.lastPointerTime = currentTime;

    rocketState.pointerInside = true;
}

banner.addEventListener("pointerenter", (event) => {

    setPointerPosition(event);

});

banner.addEventListener("pointermove", setPointerPosition);

banner.addEventListener("pointerleave", () => {

    rocketState.pointerInside = false;

    // Transfer cursor momentum to the rocket.
    rocketState.vx = rocketState.pointerVX;
    rocketState.vy = rocketState.pointerVY;

    rocketState.lastPointerTime = 0;
    rocketState.pointerVX = 0;
    rocketState.pointerVY = 0;

});


/* =========================================
   SIMULATION STORAGE
========================================= */

const projectiles = [];
const particles = [];

const borderFlash = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
};


/* =========================================
   ANGLE UTILITIES
========================================= */

function angleDifference(target, current) {

    let difference = target - current;

    while (difference > Math.PI) {
        difference -= Math.PI * 2;
    }

    while (difference < -Math.PI) {
        difference += Math.PI * 2;
    }

    return difference;
}

function smoothAngle(current, target, factor) {

    return current +
        angleDifference(target, current) * factor;
}


/* =========================================
   ROCKET GEOMETRY
========================================= */

// Get the position of the rocket's nose
// from its centre and rotation.

function getRocketNose() {

    const displayAngle =
        rocketState.angle + CONFIG.svgRotationOffset;

    return {
        x: rocketState.x +
            Math.cos(displayAngle) * CONFIG.noseLength,

        y: rocketState.y +
            Math.sin(displayAngle) * CONFIG.noseLength
    };
}


/* =========================================
   ROCKET MOVEMENT
========================================= */

function updateRocket(dt) {

    if (dt <= 0) return;

    const oldX = rocketState.x;
    const oldY = rocketState.y;

    if (rocketState.pointerInside) {

        // First calculate the direction from the rocket's
        // current centre towards the cursor.
        const dx = rocketState.targetX - rocketState.x;
        const dy = rocketState.targetY - rocketState.y;

        // The desired nose direction.
        const desiredAngle = Math.atan2(dy, dx);

        // Rotate smoothly towards the cursor.
        const rotationFactor =
            1 - Math.exp(-CONFIG.rotationSpeed * dt);

        rocketState.angle = smoothAngle(
            rocketState.angle,
            desiredAngle,
            rotationFactor
        );

        // Calculate where the centre needs to be
        // so that the nose reaches the cursor.
        const displayAngle =
            rocketState.angle + CONFIG.svgRotationOffset;

        const desiredCentreX =
            rocketState.targetX -
            Math.cos(displayAngle) * CONFIG.noseLength;

        const desiredCentreY =
            rocketState.targetY -
            Math.sin(displayAngle) * CONFIG.noseLength;

        // Smoothly move the rocket centre towards that position.
        const movementFactor =
            1 - Math.exp(-CONFIG.followSpeed * dt);

        rocketState.x +=
            (desiredCentreX - rocketState.x) * movementFactor;

        rocketState.y +=
            (desiredCentreY - rocketState.y) * movementFactor;

        // Actual rocket velocity.
        rocketState.vx = (rocketState.x - oldX) / dt;
        rocketState.vy = (rocketState.y - oldY) / dt;

    } else {

        // Continue travelling with momentum.
        rocketState.x += rocketState.vx * dt;
        rocketState.y += rocketState.vy * dt;

        // Gradual space-like friction.
        const friction = Math.exp(-CONFIG.coastDrag * dt);

        rocketState.vx *= friction;
        rocketState.vy *= friction;

        if (
            Math.hypot(rocketState.vx, rocketState.vy) <
            CONFIG.minimumCoastSpeed
        ) {
            rocketState.vx = 0;
            rocketState.vy = 0;
        }

        // Face direction of travel when coasting.
        const speed = Math.hypot(
            rocketState.vx,
            rocketState.vy
        );

        if (speed > 5) {

            const targetAngle = Math.atan2(
                rocketState.vy,
                rocketState.vx
            );

            const rotationFactor =
                1 - Math.exp(-CONFIG.rotationSpeed * dt);

            rocketState.angle = smoothAngle(
                rocketState.angle,
                targetAngle,
                rotationFactor
            );
        }
    }

    // Keep the rocket within the banner.
    const margin = CONFIG.noseLength;

    rocketState.x = Math.max(
        -margin,
        Math.min(width + margin, rocketState.x)
    );

    rocketState.y = Math.max(
        -margin,
        Math.min(height + margin, rocketState.y)
    );

    // Render rocket.
    rocket.style.left = `${rocketState.x}px`;
    rocket.style.top = `${rocketState.y}px`;

    rocket.style.transform = `
        translate(-50%, -50%)
        rotate(${rocketState.angle + CONFIG.svgRotationOffset}rad)
    `;
}


/* =========================================
   FIRE PROJECTILES
========================================= */

function fireProjectiles() {

    if (projectiles.length >= CONFIG.maxProjectiles) {
        return;
    }

    // Spawn directly at the calculated rocket nose.
    const nose = getRocketNose();

    const angle = rocketState.angle;

    for (let i = 0; i < CONFIG.burstCount; i++) {

        if (projectiles.length >= CONFIG.maxProjectiles) {
            break;
        }

        const spread =
            (i - (CONFIG.burstCount - 1) / 2) *
            CONFIG.spreadAngle;

        const shotAngle = angle + spread;

        projectiles.push({

            x: nose.x,
            y: nose.y,

            vx: Math.cos(shotAngle) * CONFIG.projectileSpeed,
            vy: Math.sin(shotAngle) * CONFIG.projectileSpeed,

            age: 0,
            bounces: 0,
            alive: true

        });
    }
}


// Click to fire.
banner.addEventListener("click", fireProjectiles);


/* =========================================
   PROJECTILE COLLISION EFFECTS
========================================= */

function createImpact(x, y, wall) {

    for (
        let i = 0;
        i < CONFIG.impactParticles;
        i++
    ) {

        if (particles.length >= CONFIG.maxParticles) {
            break;
        }

        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 140;
        const life = 0.35 + Math.random() * 0.3;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            life,
            maxLife: life,

            size: 1 + Math.random() * 2

        });
    }

    const side = wall === "horizontal"
        ? (x < width / 2 ? "left" : "right")
        : (y < height / 2 ? "top" : "bottom");

    borderFlash[side] = 1;
}


/* =========================================
   UPDATE PROJECTILES
========================================= */

function updateProjectiles(dt) {

    for (const bolt of projectiles) {

        if (!bolt.alive) continue;

        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;

        bolt.age += dt;

        if (bolt.age >= CONFIG.projectileLifetime) {
            bolt.alive = false;
            continue;
        }

        // LEFT / RIGHT WALLS
        if (bolt.x <= 2 || bolt.x >= width - 2) {

            bolt.vx *= -1;

            bolt.x = Math.max(
                2,
                Math.min(width - 2, bolt.x)
            );

            bolt.bounces++;

            createImpact(
                bolt.x,
                bolt.y,
                "horizontal"
            );
        }

        // TOP / BOTTOM WALLS
        if (bolt.y <= 2 || bolt.y >= height - 2) {

            bolt.vy *= -1;

            bolt.y = Math.max(
                2,
                Math.min(height - 2, bolt.y)
            );

            bolt.bounces++;

            createImpact(
                bolt.x,
                bolt.y,
                "vertical"
            );
        }

        if (bolt.bounces >= CONFIG.maxBounces) {
            bolt.alive = false;
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {

        if (!projectiles[i].alive) {
            projectiles.splice(i, 1);
        }
    }
}


/* =========================================
   DRAW PROJECTILES
========================================= */

function drawProjectiles() {

    for (const bolt of projectiles) {

        if (!bolt.alive) continue;

        const angle = Math.atan2(
            bolt.vy,
            bolt.vx
        );

        const length = CONFIG.projectileLength;

        const tailX =
            bolt.x - Math.cos(angle) * length;

        const tailY =
            bolt.y - Math.sin(angle) * length;

        ctx.save();

        ctx.lineCap = "round";

        // Outer glow.
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#43cfff";

        ctx.strokeStyle = "rgba(45, 180, 255, 0.35)";
        ctx.lineWidth = 7;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();

        // Main laser.
        ctx.shadowBlur = 8;
        ctx.strokeStyle = "#49d8ff";
        ctx.lineWidth = CONFIG.projectileWidth;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();

        // Bright centre.
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();

        ctx.restore();
    }
}


/* =========================================
   UPDATE PARTICLES
========================================= */

function updateParticles(dt) {

    for (const particle of particles) {

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        particle.life -= dt;

        const friction = Math.exp(-3 * dt);

        particle.vx *= friction;
        particle.vy *= friction;
    }

    for (let i = particles.length - 1; i >= 0; i--) {

        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}


/* =========================================
   DRAW PARTICLES
========================================= */

function drawParticles() {

    for (const particle of particles) {

        const opacity = Math.max(
            0,
            particle.life / particle.maxLife
        );

        ctx.save();

        ctx.globalAlpha = opacity;
        ctx.fillStyle = "#75ddff";

        ctx.shadowBlur = 10;
        ctx.shadowColor = "#42bfff";

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
        ctx.restore();
    }
}


/* =========================================
   UPDATE BORDER FLASHES
========================================= */

function updateBorderFlash(dt) {

    const decay = Math.exp(
        -CONFIG.borderFlashDecay * dt
    );

    for (const side in borderFlash) {

        borderFlash[side] *= decay;

        if (borderFlash[side] < 0.01) {
            borderFlash[side] = 0;
        }
    }
}


/* =========================================
   DRAW BORDER GLOW
========================================= */

function drawBorderGlow() {

    const sides = [

        {
            value: borderFlash.top,
            x: 0,
            y: 0,
            w: width,
            h: 2
        },

        {
            value: borderFlash.bottom,
            x: 0,
            y: height - 2,
            w: width,
            h: 2
        },

        {
            value: borderFlash.left,
            x: 0,
            y: 0,
            w: 2,
            h: height
        },

        {
            value: borderFlash.right,
            x: width - 2,
            y: 0,
            w: 2,
            h: height
        }

    ];

    for (const side of sides) {

        if (side.value <= 0) continue;

        ctx.save();

        ctx.globalAlpha = side.value;

        ctx.shadowBlur = 18;
        ctx.shadowColor = "#45d8ff";

        ctx.fillStyle = "#7eeaff";

        ctx.fillRect(
            side.x,
            side.y,
            side.w,
            side.h
        );

        ctx.restore();
    }
}


/* =========================================
   MAIN ANIMATION LOOP
========================================= */

let previousTime = 0;

function animate(timestamp) {

    const dt = Math.min(
        (timestamp - previousTime) / 1000 || 0,
        0.033
    );

    previousTime = timestamp;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    updateRocket(dt);

    updateProjectiles(dt);
    updateParticles(dt);
    updateBorderFlash(dt);

    drawProjectiles();
    drawParticles();
    drawBorderGlow();

    requestAnimationFrame(animate);
}


/* =========================================
   INITIALISE
========================================= */

// Position rocket.
rocket.style.left = `${rocketState.x}px`;
rocket.style.top = `${rocketState.y}px`;

rocket.style.transform = `
    translate(-50%, -50%)
    rotate(${rocketState.angle + CONFIG.svgRotationOffset}rad)
`;

// Start animation.
requestAnimationFrame(animate);
