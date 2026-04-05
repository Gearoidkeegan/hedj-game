// Setup Screen — industry selection, name entry, policy assignment, start game

import { gameState } from '../engine/GameState.js';
import { gameLoop } from '../engine/GameLoop.js';
import { marketEngine } from '../engine/MarketEngine.js';
import { bankEngine } from '../engine/BankEngine.js';
import { eventEngine } from '../engine/EventEngine.js';
import { boardAI } from '../engine/BoardAI.js';
import { careerEngine } from '../engine/CareerEngine.js';
import { HEDGING_POLICY_TYPES } from '../utils/constants.js';
import { formatCurrency } from '../utils/formatters.js';
import { SeededRandom, generateSeed } from '../utils/random.js';

export class SetupScreen {
    constructor(app) {
        this.app = app;
        this.el = null;
        this.selectedIndustry = null;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'screen active setup-screen';

        const industries = this.app.industriesData?.industries || [];

        // Career mode header
        const isCareer = this.app.gameMode === 'career' && careerEngine.careerActive;
        const careerLevel = isCareer ? careerEngine.getCurrentLevel() : null;
        const careerHeader = careerLevel ? `
            <div class="panel" style="margin-bottom:8px;text-align:center;border-color:var(--gold-dark);">
                <span style="font-size:16px;margin-right:6px;">${careerLevel.icon}</span>
                <span class="pixel-text" style="font-size:9px;color:var(--gold);">CAREER LEVEL ${careerLevel.level}: ${careerLevel.name.toUpperCase()}</span>
                <div class="readable-text" style="font-size:14px;color:var(--text-secondary);margin-top:4px;">${careerLevel.flavourText?.intro || careerLevel.description}</div>
            </div>
        ` : '';

        this.el.innerHTML = `
            ${careerHeader}
            <h2 class="pixel-text">CHOOSE YOUR INDUSTRY</h2>

            <div class="industry-grid" id="industry-grid">
                ${industries.map(ind => this.renderIndustryCard(ind)).join('')}
                <div class="industry-card" id="random-industry" title="Let fate decide!">
                    <div class="industry-icon">?</div>
                    <div class="industry-name">RANDOM</div>
                    <div class="industry-company">Surprise Me</div>
                </div>
            </div>

            <!-- Selected industry detail panel -->
            <div class="industry-detail-panel panel-inset" id="industry-detail" style="display:none;">
                <div id="industry-detail-content"></div>
            </div>

            <div class="setup-bottom">
                <div class="setup-fields">
                    <div class="setup-field">
                        <label>YOUR NAME</label>
                        <input type="text" id="player-name" placeholder="Treasury Manager" maxlength="20">
                    </div>
                    <div class="setup-field">
                        <label>CHARACTER</label>
                        <div class="character-select" id="character-select">
                            <button class="char-btn selected" data-gender="male" title="Male">
                                <span class="char-icon">👔</span>
                                <span class="char-label">Male</span>
                            </button>
                            <button class="char-btn" data-gender="female" title="Female">
                                <span class="char-icon">👩‍💼</span>
                                <span class="char-label">Female</span>
                            </button>
                        </div>
                    </div>
                    <div class="setup-field">
                        <label>COMPANY NAME</label>
                        <input type="text" id="company-name" placeholder="(optional)" maxlength="30">
                    </div>
                    <div class="setup-field">
                        <label>CONTACT EMAIL</label>
                        <input type="email" id="contact-email" placeholder="(for prizes)" maxlength="50">
                    </div>
                </div>
                <div class="setup-actions">
                    <button class="btn" id="btn-back">BACK</button>
                    <button class="btn btn-gold" id="btn-start" disabled>START GAME</button>
                </div>
            </div>
        `;

        return this.el;
    }

    renderIndustryCard(industry) {
        const exposureTags = industry.exposures.slice(0, 4).map(exp => {
            return `<span class="exposure-tag">${exp.underlying}</span>`;
        }).join('');
        const moreCount = industry.exposures.length > 4 ? `<span class="exposure-tag">+${industry.exposures.length - 4}</span>` : '';

        return `
            <div class="industry-card" data-industry-id="${industry.id}">
                <div class="industry-name">${industry.id.toUpperCase().replace('AGRIFOODS', 'AGRI-FOODS')}</div>
                <div class="industry-company">${industry.name}</div>
                <div class="industry-exposures">${exposureTags}${moreCount}</div>
            </div>
        `;
    }

    showIndustryDetail(industry) {
        const detailPanel = this.el.querySelector('#industry-detail');
        const detailContent = this.el.querySelector('#industry-detail-content');

        if (!industry) {
            detailPanel.style.display = 'none';
            return;
        }

        const exposureList = industry.exposures.map(exp => {
            return `<span class="exposure-type-badge ${exp.type}" style="margin-right:2px">${exp.type}</span><span class="readable-text" style="font-size:14px;margin-right:8px;">${exp.underlying}</span>`;
        }).join('');

        const boardList = industry.boardMembers.map(m => {
            return `<span class="readable-text" style="font-size:13px;color:var(--text-muted);">${m.name} (${m.role})</span>`;
        }).join(' · ');

        detailContent.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                <div>
                    <span class="pixel-text" style="font-size:10px;color:var(--gold);">${industry.id.toUpperCase().replace('AGRIFOODS', 'AGRI-FOODS')}</span>
                    <span class="readable-text" style="font-size:17px;color:var(--text-primary);margin-left:8px;">${industry.name}</span>
                </div>
                <div class="readable-text" style="font-size:13px;color:var(--text-muted);">
                    Revenue: ${formatCurrency(industry.annualRevenue, industry.baseCurrency, true)}/yr
                </div>
            </div>
            <div class="readable-text" style="font-size:15px;color:var(--text-secondary);margin-bottom:8px;">
                ${industry.description}
            </div>
            <div style="margin-bottom:4px;">
                <span class="pixel-text" style="font-size:7px;color:var(--text-muted);">EXPOSURES: </span>
                ${exposureList}
            </div>
            <div>
                <span class="pixel-text" style="font-size:7px;color:var(--text-muted);">BOARD: </span>
                ${boardList}
            </div>
        `;

        detailPanel.style.display = 'block';
    }

    mount() {
        const grid = this.el.querySelector('#industry-grid');
        const startBtn = this.el.querySelector('#btn-start');
        const backBtn = this.el.querySelector('#btn-back');
        const nameInput = this.el.querySelector('#player-name');

        // Industry selection
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.industry-card');
            if (!card) return;

            // Deselect all
            grid.querySelectorAll('.industry-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const industryId = card.dataset.industryId;
            if (industryId) {
                this.selectedIndustry = this.app.industriesData.industries.find(i => i.id === industryId);
                this.showIndustryDetail(this.selectedIndustry);
            } else {
                // Random selection
                this.selectedIndustry = 'random';
                this.showIndustryDetail(null);
            }

            startBtn.disabled = false;
        });

        // Start game
        startBtn.addEventListener('click', () => {
            this.startGame(nameInput.value.trim());
        });

        // Back to title
        backBtn.addEventListener('click', () => {
            this.app.showScreen('title');
        });

        // Character gender selection
        this.el.querySelector('#character-select').addEventListener('click', (e) => {
            const btn = e.target.closest('.char-btn');
            if (!btn) return;
            this.el.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });

        // Allow Enter key to start
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.selectedIndustry) {
                this.startGame(nameInput.value.trim());
            }
        });
    }

    unmount() {}

    startGame(playerName) {
        const industries = this.app.industriesData.industries;
        const seed = generateSeed();

        let industry = this.selectedIndustry;
        if (industry === 'random') {
            const rng = new SeededRandom(seed);
            industry = rng.pick(industries);
        }

        // Capture extra fields
        const companyName = this.el.querySelector('#company-name')?.value.trim() || '';
        const contactEmail = this.el.querySelector('#contact-email')?.value.trim() || '';

        const rng = new SeededRandom(seed + 1);

        // Career mode: apply level parameters to the industry
        const isCareer = this.app.gameMode === 'career' && careerEngine.careerActive;
        if (isCareer) {
            industry = careerEngine.applyLevelParameters(industry, rng);
        }

        // Assign random hedging policy
        const hedgingPolicy = rng.pick(HEDGING_POLICY_TYPES);

        gameLoop.startGame({
            playerName: playerName || 'Treasury Manager',
            industry,
            hedgingPolicy,
            seed
        });

        // Store extra fields in state
        const selectedGender = this.el.querySelector('.char-btn.selected')?.dataset.gender || 'male';
        gameState.update({
            companyName,
            contactEmail,
            playerGender: selectedGender
        });

        if (isCareer) {
            // Career mode: let CareerEngine set up banks, events, board, and state overrides
            careerEngine.initLevel(industry, rng);
        } else {
            // Quick play: standard setup
            const numBanks = rng.intRange(1, 3);
            const creditLimit = Math.round(industry.annualRevenue * 0.15);
            bankEngine.init(numBanks, creditLimit, rng);
            eventEngine.reset();
            boardAI.assignCEOPersona(gameState.getRng());
        }

        // Set market rates — prefer real data, fall back to placeholders
        this.setMarketRates(industry, rng);
    }

    setMarketRates(industry, rng) {
        const state = gameState.get();

        // Try to use real historical data
        if (marketEngine.isLoaded()) {
            const year = state.startYear;
            const quarter = 1;
            const spotRates = marketEngine.getRatesForQuarter(state.exposures, year, quarter);
            const budgetRates = marketEngine.getBudgetRates(state.exposures, year, quarter);

            if (Object.keys(spotRates).length > 0) {
                gameState.update({
                    currentRates: spotRates,
                    previousRates: { ...spotRates },
                    budgetRates
                });
                return;
            }
        }

        // Fallback: placeholder rates
        const placeholderRates = {
            'EURUSD': 1.10 + rng.floatRange(-0.10, 0.10),
            'EURGBP': 0.86 + rng.floatRange(-0.05, 0.05),
            'EURBRL': 5.50 + rng.floatRange(-0.50, 0.50),
            'EURCHF': 0.96 + rng.floatRange(-0.05, 0.05),
            'EURJPY': 155 + rng.floatRange(-10, 10),
            'USDJPY': 140 + rng.floatRange(-10, 10),
            'GBPUSD': 1.27 + rng.floatRange(-0.08, 0.08),
            'BRENT': 75 + rng.floatRange(-15, 15),
            'NATGAS': 3.0 + rng.floatRange(-1.0, 1.0),
            'COPPER': 4.0 + rng.floatRange(-0.5, 0.5),
            'STEEL': 600 + rng.floatRange(-100, 100),
            'DAIRY': 18 + rng.floatRange(-3, 3),
            'WHEAT': 6.0 + rng.floatRange(-1.0, 1.0),
            'CORN': 4.5 + rng.floatRange(-0.8, 0.8),
            'GOLD': 1900 + rng.floatRange(-200, 200),
            'EURIBOR': 0.035 + rng.floatRange(-0.015, 0.015),
            'SOFR': 0.05 + rng.floatRange(-0.02, 0.02),
            'SONIA': 0.05 + rng.floatRange(-0.02, 0.02)
        };

        const budgetRates = {};
        const currentRates = {};

        for (const exp of state.exposures) {
            const baseRate = placeholderRates[exp.underlying] || 1.0;
            currentRates[exp.underlying] = baseRate;
            // Budget rate = current rate + spread (favorable to company)
            const spread = exp.budgetRateSpread || 0.02;
            if (exp.direction === 'buy') {
                budgetRates[exp.underlying] = baseRate * (1 - spread);
            } else {
                budgetRates[exp.underlying] = baseRate * (1 + spread);
            }
        }

        gameState.update({
            currentRates,
            previousRates: { ...currentRates },
            budgetRates
        });
    }
}
