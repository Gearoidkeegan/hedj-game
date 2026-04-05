// Isometric Scene Renderer — Hedj industry map style
// Clean vector-like illustrations with light blue ground, white roads,
// dark outlines, muted blue/grey palette with orange/red accents

export class IsometricScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.frame = 0;
        this.animHandle = null;
        this.scene = 'airport';
        this.quarter = 0;
        this.yearOffset = 0;

        // Isometric grid
        this.tileW = 28;
        this.tileH = 14;
        this.originX = this.width / 2 - 20;
        this.originY = 40;

        // Hedj palette
        this.colors = {
            sky: '#eef3f8',
            ground: '#b8cfe0',
            groundDark: '#a0b8cc',
            road: '#ffffff',
            roadDash: '#8898a8',
            outline: '#2a3a5a',
            outlineLight: '#5a7090',
            building: '#d8e0e8',
            buildingMid: '#b0bcc8',
            buildingDark: '#8898a8',
            roof: '#e0e8f0',
            window: '#90a8c0',
            windowLit: '#f0d888',
            accent: '#d85030',
            accentDark: '#b04020',
            crane: '#e87040',
            craneDark: '#c05830',
            metal: '#788898',
            metalDark: '#607080',
            grass: '#88b870',
            grassDark: '#70a058',
            tree: '#608850',
            treeDark: '#487038',
            trunk: '#6a5040',
            water: '#88b8d8',
            wheat: '#d8c070',
            wheatDark: '#c0a858',
            dirt: '#c0a880',
            smoke: '#c8d0d8',
        };
    }

    start(sceneType, yearOffset = 0, quarter = 1) {
        this.scene = sceneType;
        this.yearOffset = yearOffset;
        this.quarter = quarter;
        this.frame = 0;
        this.animate();
    }

    stop() {
        if (this.animHandle) {
            cancelAnimationFrame(this.animHandle);
            this.animHandle = null;
        }
    }

    animate() {
        this.draw();
        this.frame++;
        this.animHandle = requestAnimationFrame(() => this.animate());
    }

    draw() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, this.width, this.height);

        switch (this.scene) {
            case 'airport': this.drawAirport(ctx); break;
            case 'roastery': this.drawRoastery(ctx); break;
            case 'factory': this.drawFactory(ctx); break;
            case 'lab': this.drawLab(ctx); break;
            case 'building_site': this.drawBuildingSite(ctx); break;
            case 'energy_grid': this.drawEnergyGrid(ctx); break;
            case 'shopping_centre': this.drawShoppingCentre(ctx); break;
            default: this.drawAirport(ctx); break;
        }
    }

    // =========== SHARED DRAWING PRIMITIVES ===========

    iso(ix, iy) {
        return {
            x: this.originX + (ix - iy) * (this.tileW / 2),
            y: this.originY + (ix + iy) * (this.tileH / 2)
        };
    }

    // Draw isometric box with clean outlines
    box(ctx, ix, iy, w, h, d, colors, outline = true) {
        const tw = this.tileW / 2;
        const th = this.tileH / 2;
        const base = this.iso(ix, iy);

        // Right face (darkest)
        ctx.fillStyle = colors[2];
        ctx.beginPath();
        ctx.moveTo(base.x + w * tw, base.y + w * th - d * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th - d * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th);
        ctx.lineTo(base.x + w * tw, base.y + w * th);
        ctx.closePath();
        ctx.fill();

        // Left face (medium)
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.moveTo(base.x - h * tw, base.y + h * th - d * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th - d * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th);
        ctx.lineTo(base.x - h * tw, base.y + h * th);
        ctx.closePath();
        ctx.fill();

        // Top face (lightest)
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(base.x, base.y - d * th);
        ctx.lineTo(base.x + w * tw, base.y + w * th - d * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th - d * th);
        ctx.lineTo(base.x - h * tw, base.y + h * th - d * th);
        ctx.closePath();
        ctx.fill();

        if (outline) {
            ctx.strokeStyle = this.colors.outline;
            ctx.lineWidth = 1.2;
            // Top outline
            ctx.beginPath();
            ctx.moveTo(base.x, base.y - d * th);
            ctx.lineTo(base.x + w * tw, base.y + w * th - d * th);
            ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th - d * th);
            ctx.lineTo(base.x - h * tw, base.y + h * th - d * th);
            ctx.closePath();
            ctx.stroke();
            // Left vertical
            ctx.beginPath();
            ctx.moveTo(base.x - h * tw, base.y + h * th - d * th);
            ctx.lineTo(base.x - h * tw, base.y + h * th);
            ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th);
            ctx.stroke();
            // Right vertical
            ctx.beginPath();
            ctx.moveTo(base.x + w * tw, base.y + w * th - d * th);
            ctx.lineTo(base.x + w * tw, base.y + w * th);
            ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th);
            ctx.stroke();
        }
    }

    // Flat isometric tile
    tile(ctx, ix, iy, w, h, color, outline = false) {
        const tw = this.tileW / 2;
        const th = this.tileH / 2;
        const base = this.iso(ix, iy);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x + w * tw, base.y + w * th);
        ctx.lineTo(base.x + (w - h) * tw, base.y + (w + h) * th);
        ctx.lineTo(base.x - h * tw, base.y + h * th);
        ctx.closePath();
        ctx.fill();
        if (outline) {
            ctx.strokeStyle = this.colors.outlineLight;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
    }

    // Light sky background
    sky(ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, this.height * 0.5);
        grad.addColorStop(0, '#f0f5fa');
        grad.addColorStop(1, '#dde8f0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    // Light blue ground plane
    ground(ctx) {
        const c = this.colors;
        const corners = [this.iso(-10, -10), this.iso(14, -10), this.iso(14, 14), this.iso(-10, 14)];
        ctx.fillStyle = c.ground;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = c.outlineLight;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // White road with dashed center line
    road(ctx, ix1, iy1, ix2, iy2, width = 2) {
        const a = this.iso(ix1, iy1);
        const b = this.iso(ix2, iy2);
        const c = this.colors;

        // Road surface
        ctx.strokeStyle = c.road;
        ctx.lineWidth = width * this.tileH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Road outline
        ctx.strokeStyle = c.outlineLight;
        ctx.lineWidth = 1;
        // Top edge and bottom edge approximated
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Dashed center line
        ctx.strokeStyle = c.roadDash;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Clean vector-style tree (round canopy like in the Hedj map)
    tree(ctx, x, y, size = 1) {
        const s = size;
        const c = this.colors;
        // Shadow
        ctx.fillStyle = 'rgba(40,60,80,0.12)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 1, 6 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        // Trunk
        ctx.fillStyle = c.trunk;
        ctx.fillRect(x - 1, y - 8 * s, 2, 8 * s);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x - 1, y - 8 * s, 2, 8 * s);
        // Canopy (single round shape)
        ctx.fillStyle = c.tree;
        ctx.beginPath();
        ctx.arc(x, y - 14 * s, 7 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Highlight
        ctx.fillStyle = c.grass;
        ctx.beginPath();
        ctx.arc(x - 2 * s, y - 16 * s, 3 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    // Small person (simplified)
    person(ctx, x, y, color = '#4070a0', walking = false) {
        const bob = walking ? Math.sin(this.frame * 0.12 + x) * 1 : 0;
        ctx.fillStyle = 'rgba(40,60,80,0.15)';
        ctx.fillRect(x - 1, y + 1, 4, 2);
        ctx.fillStyle = '#404858';
        ctx.fillRect(x, y - 3 + bob, 1, 3);
        ctx.fillRect(x + 2, y - 3 - bob, 1, 3);
        ctx.fillStyle = color;
        ctx.fillRect(x - 1, y - 6 + bob, 4, 4);
        ctx.fillStyle = '#e8d0b8';
        ctx.fillRect(x, y - 8 + bob, 2, 2);
    }

    // Vehicle
    vehicle(ctx, x, y, bodyColor, direction = 'right', length = 20) {
        const c = this.colors;
        ctx.fillStyle = 'rgba(40,60,80,0.12)';
        ctx.beginPath();
        ctx.ellipse(x, y + 3, length * 0.6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        const hw = length / 2;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - hw, y - 7, length, 7);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - hw, y - 7, length, 7);
        // Cabin
        ctx.fillStyle = '#d0dce8';
        if (direction === 'right') {
            ctx.fillRect(x + hw - 7, y - 6, 5, 3);
        } else {
            ctx.fillRect(x - hw + 2, y - 6, 5, 3);
        }
        // Wheels
        ctx.fillStyle = '#303840';
        ctx.fillRect(x - hw + 3, y, 3, 2);
        ctx.fillRect(x + hw - 6, y, 3, 2);
    }

    // Smoke puffs
    smoke(ctx, x, y, count = 4, spread = 12) {
        const t = this.frame;
        for (let i = 0; i < count; i++) {
            const age = ((t * 0.6 + i * 35) % 100) / 100;
            const px = x + Math.sin(t * 0.015 + i * 1.5) * spread * age;
            const py = y - age * 30;
            const size = 2 + age * 6;
            const alpha = 0.25 * (1 - age);
            ctx.fillStyle = `rgba(180,190,200,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Chimney/smokestack
    chimney(ctx, x, y, height, width = 6) {
        const c = this.colors;
        ctx.fillStyle = c.buildingMid;
        ctx.fillRect(x - width / 2, y - height, width, height);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - width / 2, y - height, width, height);
        // Red/white stripes
        for (let i = 0; i < height; i += 8) {
            ctx.fillStyle = i % 16 < 8 ? c.accent : '#e8e0d8';
            ctx.fillRect(x - width / 2, y - height + i, width, Math.min(8, height - i));
        }
        ctx.strokeRect(x - width / 2, y - height, width, height);
    }

    // Cooling tower
    coolingTower(ctx, x, y, height = 30, topR = 10, botR = 14) {
        const c = this.colors;
        ctx.fillStyle = c.building;
        ctx.beginPath();
        ctx.moveTo(x - botR, y);
        ctx.quadraticCurveTo(x - topR + 2, y - height * 0.6, x - topR, y - height);
        ctx.lineTo(x + topR, y - height);
        ctx.quadraticCurveTo(x + topR - 2, y - height * 0.6, x + botR, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Opening at top
        ctx.fillStyle = c.buildingDark;
        ctx.beginPath();
        ctx.ellipse(x, y - height, topR, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // Wind turbine
    windTurbine(ctx, x, y, height = 40) {
        const c = this.colors;
        // Tower
        ctx.fillStyle = '#e0e4e8';
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.lineTo(x - 1, y - height);
        ctx.lineTo(x + 1, y - height);
        ctx.lineTo(x + 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Hub
        ctx.fillStyle = '#d0d4d8';
        ctx.beginPath();
        ctx.arc(x, y - height, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();
        // Blades (rotating)
        const angle = this.frame * 0.03;
        ctx.strokeStyle = '#c0c8d0';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const a = angle + i * (Math.PI * 2 / 3);
            const bx = x + Math.cos(a) * 18;
            const by = y - height + Math.sin(a) * 18;
            ctx.beginPath();
            ctx.moveTo(x, y - height);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
            const a = angle + i * (Math.PI * 2 / 3);
            const bx = x + Math.cos(a) * 18;
            const by = y - height + Math.sin(a) * 18;
            ctx.beginPath();
            ctx.moveTo(x, y - height);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }
    }

    // Crane
    crane(ctx, x, y, height = 50, armLen = 40) {
        const c = this.colors;
        // Vertical mast
        ctx.fillStyle = c.crane;
        ctx.fillRect(x - 2, y - height, 4, height);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - 2, y - height, 4, height);
        // Cross-bracing on mast
        ctx.strokeStyle = c.craneDark;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < height; i += 8) {
            ctx.beginPath();
            ctx.moveTo(x - 2, y - i);
            ctx.lineTo(x + 2, y - i - 8);
            ctx.stroke();
        }
        // Horizontal arm
        ctx.fillStyle = c.crane;
        ctx.fillRect(x - 5, y - height - 2, armLen, 3);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - 5, y - height - 2, armLen, 3);
        // Counter-weight arm
        ctx.fillRect(x - 15, y - height - 2, 12, 3);
        ctx.strokeRect(x - 15, y - height - 2, 12, 3);
        // Counter-weight
        ctx.fillStyle = c.metalDark;
        ctx.fillRect(x - 14, y - height + 1, 6, 5);
        // Cable + hook (animated)
        const hookX = x + armLen * 0.6;
        const hookY = y - height + 15 + Math.sin(this.frame * 0.02) * 3;
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(hookX, y - height);
        ctx.lineTo(hookX, hookY);
        ctx.stroke();
        // Hook
        ctx.fillStyle = c.metal;
        ctx.fillRect(hookX - 2, hookY, 4, 3);
    }

    // Cargo ship
    ship(ctx, x, y, length = 50) {
        const c = this.colors;
        // Hull
        ctx.fillStyle = c.metalDark;
        ctx.beginPath();
        ctx.moveTo(x - length / 2, y - 6);
        ctx.lineTo(x + length / 2, y - 6);
        ctx.lineTo(x + length / 2 + 5, y);
        ctx.lineTo(x - length / 2 - 3, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Red bottom stripe
        ctx.fillStyle = c.accent;
        ctx.beginPath();
        ctx.moveTo(x - length / 2, y - 2);
        ctx.lineTo(x + length / 2, y - 2);
        ctx.lineTo(x + length / 2 + 3, y);
        ctx.lineTo(x - length / 2 - 2, y);
        ctx.closePath();
        ctx.fill();
        // Deck containers
        const containerColors = ['#4080b0', '#c05030', '#40a060', '#d0a030'];
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = containerColors[i];
            ctx.fillRect(x - 16 + i * 9, y - 12, 8, 5);
            ctx.strokeStyle = c.outline;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x - 16 + i * 9, y - 12, 8, 5);
        }
        // Bridge
        ctx.fillStyle = '#e0e4e8';
        ctx.fillRect(x + length / 2 - 10, y - 18, 8, 12);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + length / 2 - 10, y - 18, 8, 12);
    }

    // Airplane
    airplane(ctx, x, y, scale = 1, angle = 0) {
        const c = this.colors;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        // Fuselage
        ctx.fillStyle = '#e8ecf0';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
        // Wings
        ctx.fillStyle = '#d0d8e0';
        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.lineTo(5, -15);
        ctx.lineTo(8, -15);
        ctx.lineTo(2, -3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, 3);
        ctx.lineTo(5, 15);
        ctx.lineTo(8, 15);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Tail
        ctx.fillStyle = '#c8d0d8';
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-22, -6);
        ctx.lineTo(-16, -6);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Nose
        ctx.fillStyle = c.outline;
        ctx.beginPath();
        ctx.arc(19, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Windows on building face
    windowsOnFace(ctx, x, y, w, h, cols, rows) {
        const c = this.colors;
        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                const wx = x + (col + 0.5) * (w / cols) - 2;
                const wy = y + (r + 0.3) * (h / rows) - 1;
                const lit = Math.sin(this.frame * 0.008 + col * 3.1 + r * 2.3) > -0.2;
                ctx.fillStyle = lit ? c.windowLit : c.window;
                ctx.fillRect(wx, wy, 4, 3);
                ctx.strokeStyle = c.outlineLight;
                ctx.lineWidth = 0.4;
                ctx.strokeRect(wx, wy, 4, 3);
            }
        }
    }

    // Tractor (for agriculture)
    tractor(ctx, x, y) {
        const c = this.colors;
        // Body
        ctx.fillStyle = '#d04020';
        ctx.fillRect(x - 6, y - 8, 12, 6);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - 6, y - 8, 12, 6);
        // Cabin
        ctx.fillStyle = '#d0dce8';
        ctx.fillRect(x - 4, y - 14, 6, 6);
        ctx.strokeRect(x - 4, y - 14, 6, 6);
        // Big rear wheels
        ctx.fillStyle = '#303840';
        ctx.beginPath();
        ctx.arc(x - 3, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();
        // Small front wheel
        ctx.beginPath();
        ctx.arc(x + 5, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // =========== AIRPORT SCENE ===========
    drawAirport(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Runway
        this.tile(ctx, -2, -6, 12, 2, '#707880', true);
        // Runway markings
        const rStart = this.iso(-1, -5);
        const rEnd = this.iso(10, -5);
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(rStart.x, rStart.y);
        ctx.lineTo(rEnd.x, rEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Taxiway
        this.road(ctx, 6, -4, 6, 2);

        // Terminal building
        this.box(ctx, 3, 1, 6, 3, 4, [c.roof, c.buildingMid, c.buildingDark]);
        // Terminal windows
        const tb = this.iso(3, 1);
        this.windowsOnFace(ctx, tb.x - 20, tb.y - 15, 50, 20, 6, 2);

        // Control tower
        this.box(ctx, 8, 2, 1, 1, 8, [c.roof, c.buildingMid, c.buildingDark]);
        const ct = this.iso(8, 2);
        // Tower top (wider observation deck)
        ctx.fillStyle = '#a0b8c8';
        ctx.fillRect(ct.x - 8, ct.y - 62, 16, 4);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(ct.x - 8, ct.y - 62, 16, 4);
        // Tower glass
        ctx.fillStyle = '#88c8e8';
        ctx.fillRect(ct.x - 6, ct.y - 58, 12, 8);
        ctx.strokeRect(ct.x - 6, ct.y - 58, 12, 8);

        // Airplane on runway (animated taxiing)
        const planeX = this.iso(-1 + (this.frame * 0.02) % 10, -5);
        this.airplane(ctx, planeX.x, planeX.y - 4, 0.8, -0.3);

        // Airplane taking off (animated)
        const flyPhase = (this.frame * 0.005) % 1;
        const flyX = 100 + flyPhase * (this.width - 200);
        const flyY = 60 - flyPhase * 30;
        this.airplane(ctx, flyX, flyY, 0.5 + flyPhase * 0.3, -0.15);

        // Trees along edge
        for (let i = 0; i < 4; i++) {
            const tp = this.iso(-3, 4 + i * 2);
            this.tree(ctx, tp.x, tp.y, 0.8);
        }

        // Vehicles on taxiway
        const v1 = this.iso(6, 0);
        this.vehicle(ctx, v1.x, v1.y, '#e8e080', 'right', 12);
    }

    // =========== AGRI-FOODS / ROASTERY ===========
    drawRoastery(ctx) {
        this.sky(ctx);
        const c = this.colors;

        // Ground — mix of farm and facility
        const corners = [this.iso(-10, -10), this.iso(14, -10), this.iso(14, 14), this.iso(-10, 14)];
        ctx.fillStyle = c.ground;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();

        // Wheat field (right side)
        this.tile(ctx, 6, -6, 6, 6, c.wheat, true);
        // Wheat texture lines
        ctx.strokeStyle = c.wheatDark;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 10; i++) {
            const a = this.iso(7 + i * 0.5, -5);
            const b = this.iso(7 + i * 0.5, 0);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }

        // Dirt area
        this.tile(ctx, 4, -6, 2, 6, c.dirt, true);

        // Roads
        this.road(ctx, 0, -2, 6, -2);
        this.road(ctx, 0, -2, 0, 5);

        // Processing facility
        this.box(ctx, -4, 0, 4, 3, 5, [c.roof, c.buildingMid, c.buildingDark]);
        // Silos
        for (let i = 0; i < 2; i++) {
            const sp = this.iso(-6 + i * 2, -3);
            ctx.fillStyle = '#c8d0d8';
            ctx.beginPath();
            ctx.ellipse(sp.x, sp.y - 20, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(sp.x - 8, sp.y - 20, 16, 20);
            ctx.strokeStyle = c.outline;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.ellipse(sp.x, sp.y - 20, 8, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeRect(sp.x - 8, sp.y - 20, 16, 20);
        }

        // Smoke from processing
        const sm = this.iso(-3, 1);
        this.chimney(ctx, sm.x + 20, sm.y - 30, 18, 5);
        this.smoke(ctx, sm.x + 20, sm.y - 48, 3);

        // Tractor in field (animated)
        const tractorPos = this.iso(8 + Math.sin(this.frame * 0.01) * 2, -3);
        this.tractor(ctx, tractorPos.x, tractorPos.y);

        // Warehouse
        this.box(ctx, 1, 3, 3, 2, 3, [c.metal, c.metalDark, '#506070']);

        // Delivery truck
        const trk = this.iso(3, -2);
        this.vehicle(ctx, trk.x, trk.y, '#e0e4e8', 'left', 18);

        // Trees around facility
        for (let i = 0; i < 3; i++) {
            const tp = this.iso(-8, 2 + i * 2);
            this.tree(ctx, tp.x, tp.y, 0.7);
        }

        // Fence along field
        ctx.strokeStyle = c.outlineLight;
        ctx.lineWidth = 0.6;
        const fa = this.iso(12, -6);
        const fb = this.iso(12, 0);
        ctx.beginPath();
        ctx.moveTo(fa.x, fa.y);
        ctx.lineTo(fb.x, fb.y);
        ctx.stroke();
        // Fence posts
        for (let i = 0; i < 4; i++) {
            const fp = this.iso(12, -5 + i * 1.5);
            ctx.fillStyle = c.trunk;
            ctx.fillRect(fp.x - 1, fp.y - 6, 2, 6);
        }
    }

    // =========== CONSTRUCTION SITE ===========
    drawBuildingSite(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Roads
        this.road(ctx, -4, 2, 8, 2);
        this.road(ctx, 2, -4, 2, 6);

        // Building under construction (partial floors)
        const floors = 3 + Math.floor(this.yearOffset);
        for (let f = 0; f < Math.min(floors, 6); f++) {
            const alpha = f < floors - 1 ? 1 : 0.6;
            ctx.globalAlpha = alpha;
            this.box(ctx, 0, -2, 3, 3, 2 + f * 2, ['#c8d8e8', '#a0b0c0', '#8090a0']);
            ctx.globalAlpha = 1;
        }
        // Steel beams showing on top floor
        const topP = this.iso(0, -2);
        const topH = (floors * 2 + 2) * (this.tileH / 2);
        ctx.strokeStyle = c.metal;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(topP.x - 15 + i * 12, topP.y - topH);
            ctx.lineTo(topP.x - 15 + i * 12, topP.y - topH - 10);
            ctx.stroke();
        }

        // Crane (animated, slight swing)
        this.crane(ctx, topP.x + 30, topP.y + 20, 70, 50);

        // Scaffolding (simple lines)
        ctx.strokeStyle = c.crane;
        ctx.lineWidth = 0.6;
        const scaffX = topP.x - 30;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(scaffX, topP.y - i * 14);
            ctx.lineTo(scaffX + 20, topP.y - i * 14);
            ctx.stroke();
        }

        // Cement mixer truck
        const mx = this.iso(4, 3);
        this.vehicle(ctx, mx.x, mx.y, '#e0e070', 'left', 16);

        // Piles of materials
        const mp = this.iso(-3, 4);
        ctx.fillStyle = c.dirt;
        ctx.beginPath();
        ctx.moveTo(mp.x - 10, mp.y);
        ctx.lineTo(mp.x, mp.y - 8);
        ctx.lineTo(mp.x + 10, mp.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Workers
        for (let i = 0; i < 3; i++) {
            const wp = this.iso(1 + i, 4);
            this.person(ctx, wp.x, wp.y, '#e07030', true);
        }

        // Trees
        const tp1 = this.iso(-6, 0);
        this.tree(ctx, tp1.x, tp1.y, 0.8);
        const tp2 = this.iso(7, 5);
        this.tree(ctx, tp2.x, tp2.y, 0.6);
    }

    // =========== ENERGY GRID ===========
    drawEnergyGrid(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Roads
        this.road(ctx, -2, 2, 8, 2);
        this.road(ctx, 4, -4, 4, 6);

        // Wind turbines (right side)
        for (let i = 0; i < 3; i++) {
            const wp = this.iso(8 + i * 2, -2 + i);
            this.windTurbine(ctx, wp.x, wp.y, 45);
        }

        // Power plant building
        this.box(ctx, -4, -2, 4, 3, 4, [c.buildingMid, c.buildingDark, '#606870']);
        // Chimneys
        const pp = this.iso(-3, -1);
        this.chimney(ctx, pp.x, pp.y - 28, 25, 6);
        this.chimney(ctx, pp.x + 18, pp.y - 24, 22, 5);
        this.smoke(ctx, pp.x, pp.y - 53, 4, 10);
        this.smoke(ctx, pp.x + 18, pp.y - 46, 3, 8);

        // Cooling towers
        const ct1 = this.iso(-1, -4);
        this.coolingTower(ctx, ct1.x, ct1.y, 35, 12, 16);
        const ct2 = this.iso(1, -4);
        this.coolingTower(ctx, ct2.x, ct2.y, 30, 10, 14);
        this.smoke(ctx, ct1.x, ct1.y - 35, 3, 8);

        // Oil tanker / storage
        const tank = this.iso(1, 4);
        ctx.fillStyle = c.metal;
        ctx.beginPath();
        ctx.ellipse(tank.x, tank.y - 8, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(tank.x - 14, tank.y - 8, 28, 8);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(tank.x, tank.y - 8, 14, 8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Power lines
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
            const pylonP = this.iso(2 + i * 2, 0);
            // Pylon (simplified)
            ctx.strokeStyle = c.metalDark;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pylonP.x - 3, pylonP.y);
            ctx.lineTo(pylonP.x, pylonP.y - 20);
            ctx.lineTo(pylonP.x + 3, pylonP.y);
            ctx.stroke();
            // Cross arm
            ctx.beginPath();
            ctx.moveTo(pylonP.x - 6, pylonP.y - 16);
            ctx.lineTo(pylonP.x + 6, pylonP.y - 16);
            ctx.stroke();
        }
        // Wire between pylons
        ctx.strokeStyle = '#808890';
        ctx.lineWidth = 0.4;
        for (let i = 0; i < 3; i++) {
            const a = this.iso(2 + i * 2, 0);
            const b = this.iso(4 + i * 2, 0);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y - 16);
            ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 12, b.x, b.y - 16);
            ctx.stroke();
        }

        // Tanker truck
        const tt = this.iso(6, 3);
        this.vehicle(ctx, tt.x, tt.y, '#607080', 'right', 22);
    }

    // =========== SHOPPING CENTRE / RETAIL ===========
    drawShoppingCentre(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Roads
        this.road(ctx, -6, 2, 10, 2);
        this.road(ctx, 2, -4, 2, 8);

        // Main shopping building
        this.box(ctx, -2, -2, 5, 4, 4, [c.roof, c.buildingMid, c.buildingDark]);
        // Storefront windows
        const sf = this.iso(-2, -2);
        this.windowsOnFace(ctx, sf.x - 25, sf.y - 15, 55, 22, 6, 2);

        // Entrance canopy
        const ent = this.iso(1, 2);
        ctx.fillStyle = c.accent;
        ctx.fillRect(ent.x - 12, ent.y - 30, 24, 3);
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(ent.x - 12, ent.y - 30, 24, 3);

        // Car park (grid of small vehicles)
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                const cp = this.iso(5 + i, -2 + j * 2);
                const carColors = ['#4070a0', '#a04040', '#606870', '#e0e0e0', '#3a8050', '#a07020'];
                this.vehicle(ctx, cp.x, cp.y, carColors[(i + j * 3) % carColors.length], 'right', 10);
            }
        }

        // Loading dock (back)
        this.box(ctx, -4, -1, 2, 2, 3, [c.metal, c.metalDark, '#506068']);
        // Delivery truck at dock
        const dock = this.iso(-5, 0);
        this.vehicle(ctx, dock.x, dock.y, '#e0e4e8', 'left', 20);

        // People walking (animated)
        for (let i = 0; i < 5; i++) {
            const px = this.iso(0 + i, 3 + Math.sin(this.frame * 0.02 + i) * 0.5);
            this.person(ctx, px.x, px.y, ['#4070a0', '#a05030', '#508060', '#806030', '#6050a0'][i], true);
        }

        // Lamp posts along road
        for (let i = 0; i < 3; i++) {
            const lp = this.iso(-4 + i * 3, 3);
            ctx.fillStyle = c.metalDark;
            ctx.fillRect(lp.x, lp.y - 16, 2, 16);
            ctx.fillStyle = '#f0e0a0';
            ctx.beginPath();
            ctx.arc(lp.x + 1, lp.y - 18, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Trees in car park
        const tp1 = this.iso(6, 1);
        this.tree(ctx, tp1.x, tp1.y, 0.7);
        const tp2 = this.iso(8, 3);
        this.tree(ctx, tp2.x, tp2.y, 0.6);
    }

    // =========== TECH FACTORY ===========
    drawFactory(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Roads
        this.road(ctx, -2, 3, 10, 3);
        this.road(ctx, 4, -4, 4, 8);

        // Main factory building
        this.box(ctx, -2, -2, 6, 4, 4, [c.buildingMid, c.buildingDark, '#606870']);
        // Factory windows (large)
        const fb = this.iso(-2, -2);
        this.windowsOnFace(ctx, fb.x - 22, fb.y - 12, 55, 22, 5, 2);

        // Assembly wing
        this.box(ctx, 4, -3, 3, 3, 3, [c.roof, c.building, c.buildingMid]);

        // Roof vents
        const rv = this.iso(0, -1);
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = c.metal;
            ctx.fillRect(rv.x + i * 16 - 10, rv.y - 32, 6, 4);
            ctx.strokeStyle = c.outline;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(rv.x + i * 16 - 10, rv.y - 32, 6, 4);
        }

        // Conveyor belt (animated dots)
        const convStart = this.iso(5, -1);
        const convEnd = this.iso(8, -1);
        ctx.strokeStyle = c.metalDark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(convStart.x, convStart.y - 4);
        ctx.lineTo(convEnd.x, convEnd.y - 4);
        ctx.stroke();
        // Moving items on conveyor
        for (let i = 0; i < 4; i++) {
            const phase = ((this.frame * 0.5 + i * 20) % 80) / 80;
            const cx = convStart.x + (convEnd.x - convStart.x) * phase;
            const cy = convStart.y + (convEnd.y - convStart.y) * phase - 6;
            ctx.fillStyle = '#4080b0';
            ctx.fillRect(cx - 3, cy, 6, 4);
            ctx.strokeStyle = c.outline;
            ctx.lineWidth = 0.4;
            ctx.strokeRect(cx - 3, cy, 6, 4);
        }

        // Loading bay with trucks
        const lb = this.iso(8, 4);
        this.vehicle(ctx, lb.x, lb.y, '#e0e4e8', 'left', 20);
        const lb2 = this.iso(6, 5);
        this.vehicle(ctx, lb2.x, lb2.y, '#4080b0', 'left', 18);

        // Satellite dish on roof
        const sd = this.iso(5, -3);
        ctx.fillStyle = c.metal;
        ctx.beginPath();
        ctx.arc(sd.x, sd.y - 28, 6, Math.PI * 0.8, Math.PI * 2.2);
        ctx.lineTo(sd.x, sd.y - 28);
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Trees
        for (let i = 0; i < 3; i++) {
            const tp = this.iso(-5, 0 + i * 2);
            this.tree(ctx, tp.x, tp.y, 0.7);
        }
    }

    // =========== PHARMA LAB ===========
    drawLab(ctx) {
        this.sky(ctx);
        this.ground(ctx);
        const c = this.colors;

        // Roads
        this.road(ctx, -4, 3, 10, 3);
        this.road(ctx, 3, -4, 3, 8);

        // Main research building (modern glass)
        this.box(ctx, -2, -2, 5, 3, 5, ['#c0d8e8', '#90b0c8', '#6888a0']);
        // Glass facade
        const lb = this.iso(-2, -2);
        this.windowsOnFace(ctx, lb.x - 18, lb.y - 20, 48, 28, 5, 3);

        // Secondary lab building
        this.box(ctx, 3, -3, 3, 2, 3, [c.roof, c.building, c.buildingMid]);

        // Clean room annex (low, white)
        this.box(ctx, -4, 2, 2, 3, 2, ['#e8ecf0', '#d0d8e0', '#b8c0c8']);

        // Ventilation units on roof
        const vp = this.iso(0, -1);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = '#b0b8c0';
            ctx.fillRect(vp.x + i * 10 - 15, vp.y - 38, 5, 5);
            ctx.strokeStyle = c.outline;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(vp.x + i * 10 - 15, vp.y - 38, 5, 5);
        }

        // Delivery van
        const dv = this.iso(6, 4);
        this.vehicle(ctx, dv.x, dv.y, '#e0e4e8', 'left', 16);

        // Scientists walking
        for (let i = 0; i < 3; i++) {
            const sp = this.iso(0 + i * 2, 4 + Math.sin(this.frame * 0.015 + i * 2) * 0.3);
            this.person(ctx, sp.x, sp.y, '#e0e8f0', true);
        }

        // Garden / green area
        const gp = this.iso(6, -1);
        ctx.fillStyle = c.grass;
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outlineLight;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Pond
        ctx.fillStyle = c.water;
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y + 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.outlineLight;
        ctx.stroke();

        // Trees around campus
        for (let i = 0; i < 4; i++) {
            const tp = this.iso(-6, -2 + i * 2);
            this.tree(ctx, tp.x, tp.y, 0.7);
        }
        this.tree(ctx, gp.x - 12, gp.y - 6, 0.6);
        this.tree(ctx, gp.x + 10, gp.y - 4, 0.5);
    }
}
