const banner = document.getElementById("rocketBanner");
const rocket = document.getElementById("rocket");
const canvas = document.getElementById("rocketCanvas");

const ctx = canvas.getContext("2d");


const CONFIG = {

    // Rocket movement
    followSpeed: 7,

    // Rocket rotation
    rotationSpeed: 9,

    // Rocket size
    rocketOffset: 25,

    // Projectile settings
    projectileSpeed: 550,
    projectileLength: 17,
    projectileWidth: 3,

    // Firing spread
    spreadAngle: 0.10,

    // Number of projectiles per click
    burstCount: 3,

    // Maximum projectile bounces
    maxBounces: 6,

    // Projectile lifetime
    projectileLifetime: 5,

    // Particle settings
    impactParticles: 8,

    // Maximum active projectiles
    maxProjectiles: 80
};

let width = 0;
let height = 0;
let pixelRatio = 1;

function resizeCanvas() {

    const rect = banner.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);

    ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );
}

const resizeObserver = new ResizeObserver(resizeCanvas);

resizeObserver.observe(banner);

resizeCanvas();

const rocketState = {

    x: width * 0.5,
    y: height * 0.5,

    vx: 0,
    vy: 0,

    angle: 0,

    targetX: width * 0.5,
    targetY: height * 0.5,

    pointerInside: false
};

banner.addEventListener("pointerenter", () => {

    rocketState.pointerInside = true;

});

banner.addEventListener("pointerleave", () => {

    rocketState.pointerInside = false;

});

banner.addEventListener("pointermove", (event) => {

    const rect = banner.getBoundingClientRect();

    rocketState.targetX = event.clientX - rect.left;
    rocketState.targetY = event.clientY - rect.top;

});

const projectiles = [];

const particles = [];


// Get the shortest angular difference.

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


// Smoothly interpolate an angle.

function smoothAngle(current, target, factor) {

    return current + angleDifference(target, current) * factor;

}


function updateRocket(dt) {

    const previousX = rocketState.x;
    const previousY = rocketState.y;

    // Time-based smoothing factor.

    const movementFactor =
        1 - Math.exp(-CONFIG.followSpeed * dt);

    // Move towards cursor.

    rocketState.x +=
        (rocketState.targetX - rocketState.x) * movementFactor;

    rocketState.y +=
        (rocketState.targetY - rocketState.y) * movementFactor;


    // Calculate actual rocket velocity.

    rocketState.vx = (rocketState.x - previousX) / dt;
    rocketState.vy = (rocketState.y - previousY) / dt;


    // Determine direction of movement.

    const speed = Math.hypot(
        rocketState.vx,
        rocketState.vy
    );

    let targetAngle = rocketState.angle;

    if (speed > 12) {

        targetAngle = Math.atan2(
            rocketState.vy,
            rocketState.vx
        );

    } else {

        // When nearly stationary, face towards cursor.

        const dx = rocketState.targetX - rocketState.x;
        const dy = rocketState.targetY - rocketState.y;

        if (Math.hypot(dx, dy) > 2) {

            targetAngle = Math.atan2(dy, dx);

        }

    }


    // Smooth rocket rotation.

    const rotationFactor =
        1 - Math.exp(-CONFIG.rotationSpeed * dt);

    rocketState.angle = smoothAngle(
        rocketState.angle,
        targetAngle,
        rotationFactor
    );


    // Render rocket.

    rocket.style.transform = `
        translate(-50%, -50%)
        rotate(${rocketState.angle}rad)
    `;

    rocket.style.left = `${rocketState.x}px`;
    rocket.style.top = `${rocketState.y}px`;

}



function fireProjectiles() {

    if (projectiles.length >= CONFIG.maxProjectiles) {
        return;
    }

    const angle = rocketState.angle;

    // Spawn position: rocket nose.

    const spawnX =
        rocketState.x +
        Math.cos(angle) * CONFIG.rocketOffset;

    const spawnY =
        rocketState.y +
        Math.sin(angle) * CONFIG.rocketOffset;


    // Fire a spread of bolts.

    for (let i = 0; i < CONFIG.burstCount; i++) {

        if (projectiles.length >= CONFIG.maxProjectiles) {
            break;
        }

        const spread =
            (i - (CONFIG.burstCount - 1) / 2) *
            CONFIG.spreadAngle;

        const shotAngle = angle + spread;

        const speed = CONFIG.projectileSpeed;

        projectiles.push({

            x: spawnX,
            y: spawnY,

            vx: Math.cos(shotAngle) * speed,
            vy: Math.sin(shotAngle) * speed,

            age: 0,

            bounces: 0,

            alive: true

        });

    }

}


// Clicking fires.

banner.addEventListener("click", () => {

    fireProjectiles();

});

function updateProjectiles(dt) {

    for (const bolt of projectiles) {

        if (!bolt.alive) continue;

        // Move projectile.

        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;

        bolt.age += dt;


        // Lifetime check.

        if (bolt.age >= CONFIG.projectileLifetime) {

            bolt.alive = false;

            continue;

        }


        // Check left/right collision.

        if (bolt.x <= 2 || bolt.x >= width - 2) {

            bolt.vx *= -1;

            bolt.x = Math.max(2, Math.min(width - 2, bolt.x));

            bolt.bounces++;

            createImpact(bolt.x, bolt.y, "horizontal");

        }


        // Check top/bottom collision.

        if (bolt.y <= 2 || bolt.y >= height - 2) {

            bolt.vy *= -1;

            bolt.y = Math.max(2, Math.min(height - 2, bolt.y));

            bolt.bounces++;

            createImpact(bolt.x, bolt.y, "vertical");

        }


        // Remove after too many bounces.

        if (bolt.bounces >= CONFIG.maxBounces) {

            bolt.alive = false;

        }

    }


    // Remove dead projectiles.

    for (let i = projectiles.length - 1; i >= 0; i--) {

        if (!projectiles[i].alive) {

            projectiles.splice(i, 1);

        }

    }

}

function drawProjectiles() {

    for (const bolt of projectiles) {

        if (!bolt.alive) continue;

        const angle = Math.atan2(bolt.vy, bolt.vx);

        const length = CONFIG.projectileLength;

        const tailX = bolt.x - Math.cos(angle) * length;
        const tailY = bolt.y - Math.sin(angle) * length;


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

function createImpact(x, y, wall) {

    for (let i = 0; i < CONFIG.impactParticles; i++) {

        const angle = Math.random() * Math.PI * 2;

        const speed = 50 + Math.random() * 140;

        particles.push({

            x,
            y,

            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            life: 0.35 + Math.random() * 0.3,

            maxLife: 0.65,

            size: 1 + Math.random() * 2

        });

    }


    // Trigger a border flash.

    const side =
        wall === "horizontal"
            ? (x < width / 2 ? "left" : "right")
            : (y < height / 2 ? "top" : "bottom");

    banner.style.setProperty(
        "--impact-" + side,
        "1"
    );

    setTimeout(() => {

        banner.style.setProperty(
            "--impact-" + side,
            "0"
        );

    }, 100);

}

function updateParticles(dt) {

    for (const particle of particles) {

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        particle.life -= dt;

        // Friction.

        particle.vx *= Math.exp(-3 * dt);
        particle.vy *= Math.exp(-3 * dt);

    }


    // Remove expired particles.

    for (let i = particles.length - 1; i >= 0; i--) {

        if (particles[i].life <= 0) {

            particles.splice(i, 1);

        }

    }

}

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

function drawBorderGlow() {

    const style = getComputedStyle(banner);

    const sides = [
        {
            value: parseFloat(style.getPropertyValue("--impact-top")) || 0,
            x: 0, y: 0, w: width, h: 2
        },
        {
            value: parseFloat(style.getPropertyValue("--impact-bottom")) || 0,
            x: 0, y: height - 2, w: width, h: 2
        },
        {
            value: parseFloat(style.getPropertyValue("--impact-left")) || 0,
            x: 0, y: 0, w: 2, h: height
        },
        {
            value: parseFloat(style.getPropertyValue("--impact-right")) || 0,
            x: width - 2, y: 0, w: 2, h: height
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

let previousTime = 0;

function animate(timestamp) {

    const dt = Math.min(
        (timestamp - previousTime) / 1000 || 0,
        0.033
    );

    previousTime = timestamp;


    // Clear previous frame.

    ctx.clearRect(0, 0, width, height);


    // Update simulation.

    if (rocketState.pointerInside) {

        updateRocket(dt);

    }

    updateProjectiles(dt);

    updateParticles(dt);


    // Draw simulation.

    drawProjectiles();

    drawParticles();

    drawBorderGlow();


    // Continue animation.

    requestAnimationFrame(animate);

}


// Start animation.

requestAnimationFrame(animate);
