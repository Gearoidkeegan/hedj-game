// Title Screen — animated intro with start/continue/leaderboard options
// Includes attract mode demo loop for conventions

import { hasSavedGame, getLeaderboard, exportLeaderboardCSV } from '../utils/storage.js';
import { careerEngine } from '../engine/CareerEngine.js';
import { soundFX } from '../ui/SoundFX.js';

export class TitleScreen {
    constructor(app) {
        this.app = app;
        this.el = null;
        this.attractTimer = null;
        this.attractScene = 0;
        this.idleTimer = null;
        this.attractActive = false;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'screen active title-screen';

        const hasSave = hasSavedGame();

        this.el.innerHTML = `
            <div class="title-version">v0.1</div>

            <div class="title-logo">
                <canvas id="hedj-logo-canvas" width="180" height="110" style="margin:0 auto 6px;display:block;"></canvas>
                <h1>TREASURY<br>MANAGER<br>SIMULATOR</h1>
                <div class="subtitle">Can you survive the boardroom?</div>
            </div>

            <div class="title-menu">
                <button class="btn btn-gold" id="btn-quick-play">QUICK PLAY</button>
                <button class="btn btn-primary" id="btn-career-mode">CAREER MODE</button>
                <button class="btn" id="btn-leaderboard">LEADERBOARD</button>
            </div>

            <div class="title-mode-info" id="mode-info">
                <div class="pixel-text" style="font-size:7px;color:var(--text-muted);margin-top:8px;">
                    QUICK PLAY: ~5 minutes, single industry, 8 quarters
                    <br>CAREER MODE: 5 levels, startup to listed company
                </div>
            </div>

            <!-- Attract mode overlay (hidden until idle timeout) -->
            <div class="attract-overlay" id="attract-overlay" style="display:none;">
                <div class="attract-content" id="attract-content"></div>
                <div class="attract-cta pixel-text" style="font-size:8px;color:var(--gold);margin-top:12px;animation:blink-text 1.2s step-end infinite;">
                    PRESS ANY KEY OR TAP TO PLAY
                </div>
            </div>

            <div class="title-footer">
                <button class="btn" id="btn-sound" style="font-size:16px;padding:4px 10px;min-height:24px;">🔊</button>
                <span style="margin-left:8px;">POWERED BY HEDJ &bull; TREASURY RISK MANAGEMENT</span>
            </div>

            <canvas id="title-bg-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:-1;opacity:0.15;"></canvas>
        `;

        return this.el;
    }

    mount() {
        // Quick play
        this.el.querySelector('#btn-quick-play').addEventListener('click', () => {
            careerEngine.reset();
            this.app.gameMode = 'quickplay';
            this.app.showScreen('setup');
        });

        // Career mode
        this.el.querySelector('#btn-career-mode').addEventListener('click', () => {
            careerEngine.startCareer();
            this.app.gameMode = 'career';
            this.app.showScreen('setup');
        });

        // Sound toggle
        this.el.querySelector('#btn-sound').addEventListener('click', () => {
            const enabled = soundFX.toggle();
            this.el.querySelector('#btn-sound').textContent = enabled ? '🔊' : '🔇';
            if (enabled) soundFX.click();
        });

        this.el.querySelector('#btn-leaderboard').addEventListener('click', () => {
            this.showLeaderboard();
        });

        // Draw Hedj logo
        this.drawHedjLogo();

        // Animate background
        this.animateBackground();

        // Start idle timer for attract mode (30 seconds of no interaction)
        this.resetIdleTimer();
        this.interactionHandler = () => {
            if (this.attractActive) {
                this.exitAttractMode();
            }
            this.resetIdleTimer();
        };
        this.el.addEventListener('mousemove', this.interactionHandler);
        this.el.addEventListener('keydown', this.interactionHandler);
        this.el.addEventListener('touchstart', this.interactionHandler);

        // Click on attract overlay dismisses it
        const overlay = this.el.querySelector('#attract-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.interactionHandler());
        }
    }

    unmount() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
        }
        this.stopAttractMode();
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.interactionHandler) {
            this.el.removeEventListener('mousemove', this.interactionHandler);
            this.el.removeEventListener('keydown', this.interactionHandler);
            this.el.removeEventListener('touchstart', this.interactionHandler);
        }
    }

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.enterAttractMode(), 30000);
    }

    enterAttractMode() {
        this.attractActive = true;
        this.attractScene = 0;

        const overlay = this.el.querySelector('#attract-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        requestAnimationFrame(() => {
            overlay.style.transition = 'opacity 0.8s ease';
            overlay.style.opacity = '1';
        });

        this.runAttractScene();
        this.attractTimer = setInterval(() => this.runAttractScene(), 5000);
    }

    exitAttractMode() {
        this.attractActive = false;
        this.stopAttractMode();

        const overlay = this.el.querySelector('#attract-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.3s ease';
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
    }

    stopAttractMode() {
        if (this.attractTimer) {
            clearInterval(this.attractTimer);
            this.attractTimer = null;
        }
    }

    runAttractScene() {
        const content = this.el.querySelector('#attract-content');
        if (!content) return;

        const scenes = [
            () => this.attractSceneTicker(),
            () => this.attractSceneGrades(),
            () => this.attractSceneIndustries(),
            () => this.attractSceneLeaderboard(),
            () => this.attractSceneStats(),
        ];

        content.style.opacity = '0';
        content.style.transition = 'opacity 0.4s ease';

        setTimeout(() => {
            content.innerHTML = scenes[this.attractScene % scenes.length]();
            content.style.opacity = '1';
            this.attractScene++;
        }, 400);
    }

    attractSceneTicker() {
        const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD'];
        const rates = [1.0842, 1.2631, 149.32, 0.8581, 0.6534];
        const changes = [+0.0023, -0.0041, +1.24, -0.0012, +0.0018];

        const rows = pairs.map((p, i) => {
            const chg = changes[i];
            const color = chg >= 0 ? 'var(--pnl-positive)' : 'var(--pnl-negative)';
            const arrow = chg >= 0 ? '▲' : '▼';
            return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(136,170,204,0.15);">
                <span class="pixel-text" style="font-size:9px;color:var(--cyan);">${p}</span>
                <span class="pixel-text" style="font-size:9px;color:var(--text-primary);">${rates[i].toFixed(4)}</span>
                <span class="pixel-text" style="font-size:8px;color:${color};">${arrow} ${Math.abs(chg).toFixed(4)}</span>
            </div>`;
        }).join('');

        return `
            <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:2px;">LIVE MARKET DATA</div>
            <div style="max-width:320px;margin:0 auto;background:rgba(10,20,40,0.8);padding:8px 12px;border:1px solid var(--border);">
                ${rows}
            </div>
            <div class="pixel-text" style="font-size:7px;color:var(--text-muted);margin-top:8px;">30 YEARS OF HISTORICAL DATA • 7 INDUSTRIES</div>
        `;
    }

    attractSceneGrades() {
        const grades = [
            { grade: 'A+', title: 'Chief Risk Officer Material', color: 'var(--gold)' },
            { grade: 'A', title: 'Contract Extended', color: 'var(--pnl-positive)' },
            { grade: 'B', title: 'Solid Management', color: 'var(--cyan)' },
            { grade: 'C', title: 'Room for Improvement', color: 'var(--text-secondary)' },
            { grade: 'F', title: 'LinkedIn Updated', color: 'var(--pnl-negative)' },
        ];

        const items = grades.map(g => `
            <div style="display:flex;align-items:center;gap:12px;padding:4px 0;">
                <span class="pixel-text" style="font-size:14px;color:${g.color};min-width:30px;">${g.grade}</span>
                <span class="pixel-text" style="font-size:7px;color:var(--text-secondary);">${g.title}</span>
            </div>
        `).join('');

        return `
            <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:2px;">CAN YOU GET AN A+?</div>
            <div style="max-width:280px;margin:0 auto;">
                ${items}
            </div>
        `;
    }

    attractSceneIndustries() {
        const industries = [
            { name: 'SkyBridge Airlines', icon: '✈' },
            { name: 'NexGen Electronics', icon: '💻' },
            { name: 'Roasters Plc', icon: '🌾' },
            { name: 'MedGlobal Labs', icon: '💊' },
            { name: 'Momentum Construction', icon: '🏗' },
            { name: 'TerraEnergy', icon: '⚡' },
            { name: 'MainStreet Retail', icon: '🛒' },
        ];

        const items = industries.map(ind => `
            <div style="display:flex;align-items:center;gap:8px;padding:2px 0;">
                <span style="font-size:16px;">${ind.icon}</span>
                <span class="pixel-text" style="font-size:8px;color:var(--text-primary);">${ind.name}</span>
            </div>
        `).join('');

        return `
            <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:2px;">CHOOSE YOUR INDUSTRY</div>
            <div style="max-width:240px;margin:0 auto;">
                ${items}
            </div>
        `;
    }

    attractSceneLeaderboard() {
        const board = getLeaderboard();
        if (board.length === 0) {
            return `
                <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:2px;">LEADERBOARD</div>
                <div class="pixel-text" style="font-size:9px;color:var(--text-secondary);">No scores yet — be the first!</div>
                <div class="pixel-text" style="font-size:7px;color:var(--text-muted);margin-top:12px;">PLAY NOW AND SET THE HIGH SCORE</div>
            `;
        }

        const top5 = board.slice(0, 5);
        const rows = top5.map((e, i) => `
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(136,170,204,0.15);">
                <span class="pixel-text" style="font-size:8px;color:${i < 3 ? 'var(--gold)' : 'var(--text-muted)'};">${i + 1}.</span>
                <span class="pixel-text" style="font-size:8px;color:var(--text-primary);flex:1;margin-left:6px;">${e.playerName}</span>
                <span class="pixel-text" style="font-size:8px;color:var(--cyan);">${e.score}</span>
                <span class="pixel-text" style="font-size:8px;color:var(--gold);margin-left:6px;">${e.grade}</span>
            </div>
        `).join('');

        return `
            <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:2px;">TOP SCORES</div>
            <div style="max-width:300px;margin:0 auto;background:rgba(10,20,40,0.8);padding:8px 12px;border:1px solid var(--border);">
                ${rows}
            </div>
            <div class="pixel-text" style="font-size:7px;color:var(--text-muted);margin-top:8px;">CAN YOU BEAT THEM?</div>
        `;
    }

    attractSceneStats() {
        const facts = [
            'Manage FX, commodity & interest rate risk',
            'Survive boardroom reviews with dry humour',
            'Navigate market crashes from 1994-2024',
            'Build a career from startup to listed company',
            'Real historical data, real hedging instruments',
        ];
        const fact = facts[Math.floor(Math.random() * facts.length)];

        return `
            <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:12px;letter-spacing:2px;">DID YOU KNOW?</div>
            <div class="readable-text" style="font-size:18px;color:var(--text-primary);max-width:360px;margin:0 auto;text-align:center;">
                ${fact}
            </div>
            <div style="margin-top:16px;">
                <div class="pixel-text" style="font-size:7px;color:var(--cyan);letter-spacing:1px;">POWERED BY HEDJ</div>
                <div class="pixel-text" style="font-size:6px;color:var(--text-muted);margin-top:4px;">TREASURY RISK MANAGEMENT SOLUTIONS</div>
            </div>
        `;
    }

    showLeaderboard() {
        const board = getLeaderboard();
        if (board.length === 0) {
            this.app.showToast('Leaderboard coming after first game!', 'info');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="min-width:400px;">
                <div class="modal-header">
                    LEADERBOARD
                    <button class="modal-close" id="close-lb">X</button>
                </div>
                <div class="modal-body" style="max-height:400px;overflow-y:auto;">
                    <table class="data-table">
                        <thead><tr><th>#</th><th>NAME</th><th>INDUSTRY</th><th>SCORE</th><th>GRADE</th></tr></thead>
                        <tbody>
                            ${board.map((e, i) => `
                                <tr>
                                    <td style="color:${i < 3 ? 'var(--gold)' : 'var(--text-muted)'}">${i + 1}</td>
                                    <td>${e.playerName}</td>
                                    <td style="color:var(--text-muted)">${e.industry}</td>
                                    <td style="color:var(--cyan)">${e.score}</td>
                                    <td style="color:var(--gold)">${e.grade}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="padding:8px;text-align:center;border-top:1px solid var(--border);">
                    <button class="btn" id="btn-export-lb" style="font-size:12px;min-height:24px;padding:4px 12px;">EXPORT CSV</button>
                </div>
            </div>
        `;

        const viewport = document.getElementById('game-viewport');
        viewport.appendChild(overlay);
        overlay.querySelector('#close-lb').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#btn-export-lb').addEventListener('click', () => {
            const csv = exportLeaderboardCSV();
            if (!csv) return;
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hedj-game-leaderboard.csv';
            a.click();
            URL.revokeObjectURL(url);
            this.app.showToast('Leaderboard exported!', 'success');
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    drawHedjLogo() {
        const canvas = this.el.querySelector('#hedj-logo-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const px = 3; // pixel size for retro feel

        ctx.clearRect(0, 0, w, h);

        // === Hedj brand logo ===
        // Green upright rounded rect + orange same-size rect pivoted from shared
        // bottom-left corner, tilting right. Overlap area is grey/blue.
        // Yellow dot bisects the lower long edge of the orange rect.

        const s = 0.85;
        const rectW = 26 * s;
        const rectH = 56 * s;
        const r = 5 * s;
        const pivotX = w / 2 - 8 * s;   // bottom-left corner (shared)
        const pivotY = 4 + rectH;        // bottom of the green rect
        const angle = 0.38;              // orange tilt angle (radians, ~22°)

        // 1. Draw green rect (upright)
        this.drawRoundedRect(ctx, pivotX - rectW, pivotY - rectH, rectW, rectH, r, '#3cb88c');

        // 2. Draw orange rect (rotated from bottom-left corner)
        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(angle);
        this.drawRoundedRect(ctx, 0, -rectH, rectW, rectH, r, '#e8923e');
        ctx.restore();

        // 3. Draw grey/blue overlap: clip to green rect, then fill orange rect shape
        ctx.save();
        // Clip to green rect region
        this.buildRoundedRectPath(ctx, pivotX - rectW, pivotY - rectH, rectW, rectH, r);
        ctx.clip();
        // Draw the orange rect shape again, but in grey/blue — only visible in overlap
        ctx.translate(pivotX, pivotY);
        ctx.rotate(angle);
        this.drawRoundedRect(ctx, 0, -rectH, rectW, rectH, r, '#94a3b8');
        ctx.restore();

        // 4. Yellow dot — bisects the lower long side of orange rect
        // The midpoint of orange rect's right edge (long side), in rotated coords:
        // right edge midpoint = (rectW, -rectH/2), rotated by angle around pivot
        const dotLocalX = rectW;
        const dotLocalY = -rectH * 0.08; // near bottom of the right edge
        const dotX = pivotX + dotLocalX * Math.cos(angle) - dotLocalY * Math.sin(angle);
        const dotY = pivotY + dotLocalX * Math.sin(angle) + dotLocalY * Math.cos(angle);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8 * s, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        // === Draw "HEDJ" in pixel-art block letters below the icon ===
        const primary = '#00b894';
        const primaryDark = '#009874';

        const letters = {
            H: [
                [1,0,0,1],
                [1,0,0,1],
                [1,1,1,1],
                [1,0,0,1],
                [1,0,0,1],
            ],
            E: [
                [1,1,1,1],
                [1,0,0,0],
                [1,1,1,0],
                [1,0,0,0],
                [1,1,1,1],
            ],
            D: [
                [1,1,1,0],
                [1,0,0,1],
                [1,0,0,1],
                [1,0,0,1],
                [1,1,1,0],
            ],
            J: [
                [0,0,0,1],
                [0,0,0,1],
                [0,0,0,1],
                [1,0,0,1],
                [0,1,1,0],
            ],
        };

        const word = ['H', 'E', 'D', 'J'];
        const letterW = 4;
        const letterH = 5;
        const gap = 1;
        const totalW = word.length * (letterW + gap) - gap;
        const startX = Math.floor((w - totalW * px) / 2);
        const startY = 72; // below the icon

        // Shadow pass
        for (let li = 0; li < word.length; li++) {
            const grid = letters[word[li]];
            const ox = startX + li * (letterW + gap) * px;
            for (let r = 0; r < letterH; r++) {
                for (let c = 0; c < letterW; c++) {
                    if (grid[r][c]) {
                        ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        ctx.fillRect(ox + c * px + 1, startY + r * px + 1, px, px);
                    }
                }
            }
        }

        // Main pass
        for (let li = 0; li < word.length; li++) {
            const grid = letters[word[li]];
            const ox = startX + li * (letterW + gap) * px;
            for (let r = 0; r < letterH; r++) {
                for (let c = 0; c < letterW; c++) {
                    if (grid[r][c]) {
                        ctx.fillStyle = r === 0 ? '#33ddb0' : primary;
                        ctx.fillRect(ox + c * px, startY + r * px, px, px);
                        if (r === letterH - 1 || (r < letterH - 1 && !grid[r + 1][c])) {
                            ctx.fillStyle = primaryDark;
                            ctx.fillRect(ox + c * px, startY + r * px + px - 1, px, 1);
                        }
                    }
                }
            }
        }

        // Yellow dot over the J — replicating the logo's circle motif
        // J starts at li=3, the dot sits above the rightmost column of J
        const jStartX = startX + 3 * (letterW + gap) * px;
        const jDotX = jStartX + 3 * px + Math.floor(px / 2); // center of J's right column
        const jDotY = startY - 5; // above the J
        ctx.beginPath();
        ctx.arc(jDotX, jDotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        // Underline accent bar
        const barY = startY + letterH * px + 3;
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(startX, barY, totalW * px, 2);

        // "FINANCIAL SERVICES" subtitle
        ctx.font = '7px monospace';
        ctx.fillStyle = '#88aacc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('FINANCIAL SERVICES', w / 2, barY + 5);
        ctx.textAlign = 'left';
    }

    buildRoundedRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    drawRoundedRect(ctx, x, y, w, h, r, color) {
        this.buildRoundedRectPath(ctx, x, y, w, h, r);
        ctx.fillStyle = color;
        ctx.fill();
    }

    animateBackground() {
        const canvas = this.el.querySelector('#title-bg-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = 960;
        canvas.height = 640;

        const chars = '0123456789.+-$€£¥%';
        const cols = 48;
        const rows = 32;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;
        let frame = 0;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px monospace';

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (Math.random() < 0.02) {
                        const char = chars[Math.floor(Math.random() * chars.length)];
                        const brightness = 40 + Math.random() * 60;
                        const green = Math.random() > 0.5;
                        ctx.fillStyle = green
                            ? `rgba(51, ${brightness + 150}, 102, 0.6)`
                            : `rgba(${brightness + 150}, 68, 68, 0.6)`;
                        ctx.fillText(char, x * cellW + 4, y * cellH + 14);
                    }
                }
            }

            frame++;
            this.animFrame = requestAnimationFrame(draw);
        };

        draw();
    }
}
