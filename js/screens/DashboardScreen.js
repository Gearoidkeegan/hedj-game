// Dashboard Screen — main gameplay view
// Phase 2: Real market data, multi-product hedging, intra-quarter live trading,
//          trade direction test, bank counterparties, BEGIN QUARTER flow

import { gameState } from '../engine/GameState.js';
import { gameLoop } from '../engine/GameLoop.js';
import { marketEngine } from '../engine/MarketEngine.js';
import { hedgingEngine } from '../engine/HedgingEngine.js';
import { bankEngine } from '../engine/BankEngine.js';
import { GAME_CONFIG } from '../utils/constants.js';
import { formatCurrency, formatRate, formatPercent, formatQuarter, formatPnL, pnlClass } from '../utils/formatters.js';
import { IsometricScene } from '../ui/IsometricScene.js';
import { BloombergTerminal } from '../ui/BloombergTerminal.js';
import { HedgeLadder } from '../ui/HedgeLadder.js';
import { StressFace } from '../ui/StressFace.js';
import { soundFX } from '../ui/SoundFX.js';

export class DashboardScreen {
    constructor(app) {
        this.app = app;
        this.el = null;
        this.selectedExposure = null;
        this.selectedProductId = null;
        this.selectedBankId = null;
        this.isoScene = null;
        this.bloombergTerminal = null;
        this.hedgeLadder = null;
        this.stressFace = null;

        // Quarter state
        this.quarterStarted = false;     // Has BEGIN QUARTER been pressed?
        this.tradesThisQuarter = 0;      // Trading cost tracker
        this.tradingCostsThisQuarter = 0;
        this.tradeDirectionConfirmed = false; // Has user passed the direction test?

        // Rate state for end-of-quarter resolution
        this.endOfQuarterRates = null;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'screen active dashboard-screen';

        const state = gameState.get();
        const quarterLabel = formatQuarter(state.currentYearOffset, state.currentQuarter);

        this.el.innerHTML = `
            <!-- Quarter Bar -->
            <div class="quarter-bar">
                <span class="company-name">${state.industry?.name || 'Company'}</span>
                <span class="quarter-label">${quarterLabel}</span>
                <div class="quarter-pips" id="quarter-pips"></div>
                <span>
                    <span class="pixel-text" style="font-size:8px;color:var(--text-secondary)">CASH</span>
                    <span class="pixel-text" style="font-size:9px;color:${state.cashBalance >= state.startingCash * 0.2 ? 'var(--pnl-positive)' : 'var(--pnl-negative)'}">${formatCurrency(state.cashBalance, state.industry?.baseCurrency, true)}</span>
                </span>
                <span>
                    <span class="pixel-text" style="font-size:8px;color:var(--text-secondary)">P&L</span>
                    <span class="pixel-text ${pnlClass(state.cumulativePnL)}" style="font-size:9px">${formatPnL(state.cumulativePnL, state.industry?.baseCurrency)}</span>
                </span>
                <span>
                    <span class="pixel-text" style="font-size:8px;color:var(--text-secondary)">BOARD SATISFACTION</span>
                    <span class="pixel-text" style="font-size:9px;color:${state.boardSatisfaction >= 50 ? 'var(--satisfaction-high)' : state.boardSatisfaction >= 25 ? 'var(--satisfaction-mid)' : 'var(--satisfaction-low)'}">
                        ${state.boardSatisfaction}%
                    </span>
                </span>
                <span id="stress-face-slot"></span>
                <span id="trade-count-badge" class="pixel-text" style="font-size:7px;color:var(--text-muted)"></span>
            </div>

            <!-- Main area -->
            <div class="dashboard-main">
                <!-- Left: Scene + Exposures -->
                <div class="dashboard-left">
                    <!-- Isometric viewport with Bloomberg terminal overlay -->
                    <div class="isometric-viewport" id="iso-viewport" style="position:relative;">
                        <canvas id="iso-canvas" width="620" height="200"></canvas>
                    </div>

                    <!-- Tabs -->
                    <div class="tab-bar">
                        <div class="tab active" data-tab="exposures">EXPOSURES</div>
                        <div class="tab" data-tab="market">MARKET</div>
                        <div class="tab" data-tab="portfolio">PORTFOLIO</div>
                        <div class="tab" data-tab="banks">BANKS</div>
                    </div>

                    <div class="tab-content active" data-tab-content="exposures" id="exposures-tab">
                        <div class="panel-inset exposure-list" id="exposure-list"></div>
                    </div>
                    <div class="tab-content" data-tab-content="market" id="market-tab">
                        <div class="panel-inset overflow-auto flex-1" id="market-view"></div>
                    </div>
                    <div class="tab-content" data-tab-content="portfolio" id="portfolio-tab">
                        <div class="panel-inset overflow-auto flex-1" id="portfolio-view"></div>
                    </div>
                    <div class="tab-content" data-tab-content="banks" id="banks-tab">
                        <div class="panel-inset overflow-auto flex-1" id="banks-view"></div>
                    </div>
                </div>

                <!-- Right: Hedging controls -->
                <div class="dashboard-right">
                    <div class="panel hedge-panel">
                        <div class="panel-title">
                            HEDGING DESK
                            <span id="policy-badge" class="badge" style="font-size:6px"></span>
                        </div>

                        <!-- Bloomberg terminal chart — selected exposure price -->
                        <div id="bloomberg-right" style="margin-bottom:8px;">
                            <canvas id="bloomberg-canvas-right" width="280" height="130" style="width:100%;border-radius:2px;box-shadow:0 0 8px rgba(0,140,255,0.3), inset 0 0 2px rgba(0,140,255,0.2);display:none;"></canvas>
                        </div>

                        <!-- Selected exposure info -->
                        <div class="panel-inset mb-8" id="selected-exposure-info">
                            <div class="readable-text" style="color:var(--text-muted);text-align:center;padding:16px;">
                                Select an exposure to hedge
                            </div>
                        </div>

                        <!-- Trade direction test (shown when exposure selected) -->
                        <div id="direction-test" style="display:none;"></div>

                        <!-- Product selector (shown after direction confirmed) -->
                        <div class="hedge-product-selector" id="product-selector" style="display:none;"></div>

                        <!-- Bank selector -->
                        <div id="bank-selector" style="display:none;"></div>

                        <!-- Hedge ladder (replaces old slider) -->
                        <div id="hedge-ladder-container" style="display:none;"></div>

                        <!-- Trade preview + execute -->
                        <div id="trade-execution" style="display:none;">
                            <div class="panel-inset mt-8" id="trade-preview"></div>
                            <button class="btn btn-primary w-full mt-8" id="btn-execute-hedge">
                                EXECUTE HEDGE
                            </button>
                        </div>

                        <!-- Active hedges summary -->
                        <div class="mt-8" style="flex:1;overflow-y:auto;">
                            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-secondary);padding:4px 8px;">ACTIVE HEDGES</div>
                            <div id="active-hedges-list" class="panel-inset"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="dashboard-footer">
                <div>
                    <span class="pixel-text" style="font-size:8px;color:var(--text-muted)">POLICY: </span>
                    <span class="pixel-text" style="font-size:8px;color:var(--cyan)" id="policy-name"></span>
                </div>
                <button class="btn btn-gold" id="btn-begin-quarter" style="display:inline-block;">
                    BEGIN QUARTER ▶
                </button>
                <button class="btn btn-gold" id="btn-end-quarter" style="display:inline-block;">
                    END QUARTER ■
                </button>
            </div>
        `;

        return this.el;
    }

    mount() {
        // Reset quarter state
        this.quarterStarted = false;
        this.tradesThisQuarter = 0;
        this.tradingCostsThisQuarter = 0;
        this.tradeDirectionConfirmed = false;
        this.endOfQuarterRates = null;
        this.selectedExposure = null;
        this.selectedProductId = null;
        this.selectedBankId = null;

        // Initialize stress face
        this.stressFace = new StressFace(48);
        const stressSlot = this.el.querySelector('#stress-face-slot');
        if (stressSlot) {
            stressSlot.appendChild(this.stressFace.createWidget());
            this.stressFace.start();
            this.stressFace.updateWidget();
        }

        this.renderQuarterPips();
        this.renderExposures();
        this.renderMarketView();
        this.renderPortfolio();
        this.renderBanksView();
        this.renderActiveHedges();
        this.renderPolicy();
        this.drawIsometricScene();
        this.updateTradeCountBadge();

        // Tab switching
        this.el.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.el.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                this.el.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                tab.classList.add('active');
                this.el.querySelector(`[data-tab-content="${tabId}"]`).classList.add('active');
            });
        });

        // BEGIN QUARTER — starts Bloomberg animation + live trading
        this.el.querySelector('#btn-begin-quarter').addEventListener('click', () => {
            this.beginQuarter();
        });

        // END QUARTER — resolves the quarter
        this.el.querySelector('#btn-end-quarter').addEventListener('click', () => {
            this.endQuarter();
        });

        // Execute hedge
        this.el.querySelector('#btn-execute-hedge')?.addEventListener('click', () => {
            this.executeHedge();
        });
    }

    unmount() {
        if (this.isoScene) { this.isoScene.stop(); this.isoScene = null; }
        if (this.bloombergTerminal) { this.bloombergTerminal.stop(); this.bloombergTerminal = null; }
        if (this.stressFace) { this.stressFace.stop(); this.stressFace = null; }
        if (this.priceRefreshTimer) { clearInterval(this.priceRefreshTimer); this.priceRefreshTimer = null; }
    }

    // -----------------------------------------------------------------------
    // Quarter flow
    // -----------------------------------------------------------------------

    beginQuarter() {
        this.quarterStarted = true;
        soundFX.quarterStart();

        // Hide BEGIN button once quarter started
        this.el.querySelector('#btn-begin-quarter').style.display = 'none';

        // Calculate end-of-quarter rates (from MarketEngine or random walk)
        this.calculateEndOfQuarterRates();

        // Start Bloomberg terminal for currently selected exposure (or first)
        this.startBloombergForExposure();

        // Periodically refresh trade preview with live pricing
        this.priceRefreshTimer = setInterval(() => {
            if (this.selectedExposure && this.hedgeLadder) {
                this.renderTradePreview();
            }
        }, 500);

        this.app.showToast('Quarter started — markets are live!', 'info');
    }

    calculateEndOfQuarterRates() {
        const state = gameState.get();
        const rng = gameState.getRng();

        if (marketEngine.isLoaded()) {
            // Use real historical rates
            const year = state.startYear + state.currentYearOffset;
            let nextQ = state.currentQuarter + 1;
            let nextY = year;
            if (nextQ > 4) { nextQ = 1; nextY++; }

            this.endOfQuarterRates = {};
            for (const exp of state.exposures) {
                const nextRate = marketEngine.getRate(exp.underlying, nextY, nextQ);
                if (nextRate !== null) {
                    this.endOfQuarterRates[exp.underlying] = nextRate;
                } else {
                    // Fallback: random walk
                    const current = state.currentRates[exp.underlying] || 1;
                    this.endOfQuarterRates[exp.underlying] = current * (1 + rng.floatRange(-0.05, 0.05));
                }
            }
        } else {
            // Placeholder random walk
            this.endOfQuarterRates = {};
            for (const [key, rate] of Object.entries(state.currentRates)) {
                this.endOfQuarterRates[key] = rate * (1 + rng.floatRange(-0.05, 0.05));
            }
        }
    }

    endQuarter() {
        // Stop price refresh timer
        if (this.priceRefreshTimer) { clearInterval(this.priceRefreshTimer); this.priceRefreshTimer = null; }

        // If quarter wasn't started with BEGIN, run it silently
        if (!this.quarterStarted) {
            this.calculateEndOfQuarterRates();
        }

        if (!this.endOfQuarterRates) {
            this.calculateEndOfQuarterRates();
        }

        const state = gameState.get();
        const previousRates = { ...state.currentRates };

        // Store trading costs in state for scoring
        gameState.update({
            previousRates,
            currentRates: this.endOfQuarterRates,
            tradesThisQuarter: this.tradesThisQuarter,
            tradingCostsThisQuarter: this.tradingCostsThisQuarter
        });

        // Trigger the game loop resolution
        gameLoop.endDecisionPhase();
    }

    // -----------------------------------------------------------------------
    // Trade direction test
    // -----------------------------------------------------------------------

    showDirectionTest(exposure) {
        const container = this.el.querySelector('#direction-test');
        const state = gameState.get();
        const rate = state.currentRates[exposure.underlying] || 0;

        // Calculate bid/offer with spread
        const spreadBps = exposure.type === 'fx' ? 5 : exposure.type === 'commodity' ? 10 : 3;
        const halfSpread = rate * (spreadBps / 10000);
        const bid = rate - halfSpread;
        const ask = rate + halfSpread;

        container.style.display = 'block';
        container.innerHTML = `
            <div class="panel-inset mb-8" style="border-color:var(--gold);">
                <div class="pixel-text" style="font-size:8px;color:var(--gold);margin-bottom:6px;">TRADE DIRECTION</div>
                <div class="readable-text" style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">
                    ${exposure.description}
                </div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button class="btn" id="btn-direction-buy" style="min-width:100px;">
                        BUY @ ${formatRate(ask, 4)}
                    </button>
                    <button class="btn" id="btn-direction-sell" style="min-width:100px;">
                        SELL @ ${formatRate(bid, 4)}
                    </button>
                </div>
            </div>
        `;

        // Determine correct direction
        // If exposure is "buy" (company needs to buy), hedge by buying forward = BUY
        // If exposure is "sell" (company will receive), hedge by selling forward = SELL
        const correctDirection = exposure.direction;

        container.querySelector('#btn-direction-buy').addEventListener('click', () => {
            if (correctDirection === 'buy' || correctDirection === 'pay') {
                this.onDirectionCorrect(exposure);
            } else {
                this.onDirectionWrong(exposure);
            }
        });

        container.querySelector('#btn-direction-sell').addEventListener('click', () => {
            if (correctDirection === 'sell') {
                this.onDirectionCorrect(exposure);
            } else {
                this.onDirectionWrong(exposure);
            }
        });
    }

    onDirectionCorrect(exposure) {
        this.tradeDirectionConfirmed = true;
        const container = this.el.querySelector('#direction-test');
        container.innerHTML = `
            <div class="panel-inset mb-8" style="border-color:var(--pnl-positive);">
                <div class="readable-text" style="font-size:14px;color:var(--pnl-positive);text-align:center;padding:4px;">
                    ✓ Correct direction
                </div>
            </div>
        `;
        setTimeout(() => { container.style.display = 'none'; }, 1500);

        // Show product selector and controls
        this.renderProductsForExposure(exposure);
        this.el.querySelector('#product-selector').style.display = 'flex';
        this.el.querySelector('#bank-selector').style.display = 'block';
        this.el.querySelector('#hedge-ladder-container').style.display = 'block';
        this.el.querySelector('#trade-execution').style.display = 'block';

        this.initHedgeLadder(exposure);
        this.renderBankSelector();
        this.renderTradePreview();
    }

    onDirectionWrong(exposure) {
        this.tradeDirectionConfirmed = false;
        const container = this.el.querySelector('#direction-test');
        container.innerHTML = `
            <div class="panel-inset mb-8" style="border-color:var(--pnl-negative);">
                <div class="readable-text" style="font-size:14px;color:var(--pnl-negative);text-align:center;padding:4px;">
                    ✗ TRADING ERROR — Wrong direction!
                </div>
                <div class="readable-text" style="font-size:12px;color:var(--text-muted);text-align:center;">
                    The board has been notified.
                </div>
            </div>
        `;

        // Major board penalty
        soundFX.tradeError();
        gameState.update({ tradeDirectionErrors: (gameState.get().tradeDirectionErrors || 0) + 1 });
        gameState.adjustSatisfaction(-8);
        this.app.showToast('Trading error! Board satisfaction -8', 'danger');

        // Allow retry after a pause
        setTimeout(() => {
            this.showDirectionTest(exposure);
        }, 2000);
    }

    // -----------------------------------------------------------------------
    // Product selector — 2 products per asset class
    // -----------------------------------------------------------------------

    renderProductsForExposure(exposure) {
        const products = hedgingEngine.getProductsForAssetClass(exposure.type);
        const container = this.el.querySelector('#product-selector');

        let html = '';
        for (const product of products) {
            const selected = this.selectedProductId === product.id ? 'selected' : '';
            const costNote = product.hasUpfrontCost ? '(premium)' : '(no upfront)';
            html += `
                <div class="hedge-product-btn ${selected}" data-product-id="${product.id}">
                    <div>${product.name}</div>
                    <div style="font-size:6px;color:var(--text-muted);font-family:var(--font-pixel);">${costNote}</div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Default to first product
        if (!this.selectedProductId) {
            this.selectedProductId = products[0]?.id;
            container.querySelector('.hedge-product-btn')?.classList.add('selected');
        }

        container.querySelectorAll('.hedge-product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.hedge-product-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedProductId = btn.dataset.productId;
                this.renderTradePreview();
            });
        });
    }

    // -----------------------------------------------------------------------
    // Bank selector
    // -----------------------------------------------------------------------

    renderBankSelector() {
        const container = this.el.querySelector('#bank-selector');
        const banks = bankEngine.getActiveBanks();

        if (banks.length === 0) {
            container.style.display = 'none';
            return;
        }

        let html = '<div style="font-family:var(--font-pixel);font-size:7px;color:var(--text-secondary);margin-bottom:4px;">COUNTERPARTY</div><div style="display:flex;gap:4px;flex-wrap:wrap;">';

        for (const bank of banks) {
            const avail = bankEngine.getAvailableCredit(bank.id);
            const selected = this.selectedBankId === bank.id ? 'selected' : '';
            html += `
                <div class="hedge-product-btn ${selected}" data-bank-id="${bank.id}" style="min-width:60px;font-size:8px;">
                    <div>${bank.shortName}</div>
                    <div style="font-size:6px;color:var(--text-muted);font-family:var(--font-pixel);">${formatCurrency(avail, '', true)}</div>
                </div>
            `;
        }

        html += '</div>';

        // Request more banks button
        if (banks.length < 5) {
            html += `<button class="btn" id="btn-request-bank" style="font-size:7px;padding:4px 8px;margin-top:4px;">+ REQUEST BANK</button>`;
        }

        container.innerHTML = html;

        // Default to first bank
        if (!this.selectedBankId) {
            this.selectedBankId = banks[0]?.id;
            container.querySelector('.hedge-product-btn')?.classList.add('selected');
        }

        container.querySelectorAll('.hedge-product-btn[data-bank-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.hedge-product-btn[data-bank-id]').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedBankId = btn.dataset.bankId;
                this.renderTradePreview();
            });
        });

        const reqBtn = container.querySelector('#btn-request-bank');
        if (reqBtn) {
            reqBtn.addEventListener('click', () => {
                const rng = gameState.getRng();
                const result = bankEngine.requestFromBoard('new_bank', rng);
                if (result.success) {
                    gameState.adjustSatisfaction(-result.satisfactionCost);
                    this.app.showToast(result.message, 'info');
                } else {
                    this.app.showToast(result.message, 'warning');
                }
                this.renderBankSelector();
                this.renderBanksView();
            });
        }
    }

    // -----------------------------------------------------------------------
    // Hedge ladder
    // -----------------------------------------------------------------------

    initHedgeLadder(exposure) {
        const container = this.el.querySelector('#hedge-ladder-container');
        this.hedgeLadder = new HedgeLadder(container, {
            exposure,
            maxTenor: 8,
            onChange: () => this.renderTradePreview()
        });
        this.hedgeLadder.render();
    }

    // -----------------------------------------------------------------------
    // Trade preview & execution
    // -----------------------------------------------------------------------

    renderTradePreview() {
        if (!this.selectedExposure || !this.hedgeLadder) return;
        const state = gameState.get();
        const exp = this.selectedExposure;
        const { tenor, pct } = this.hedgeLadder.getSelection();
        const notional = exp.quarterlyNotional * pct;

        // Use live Bloomberg price if quarter is active, otherwise static rate
        const livePrice = (this.quarterStarted && this.bloombergTerminal && this.bloombergTerminal.underlying === exp.underlying)
            ? this.bloombergTerminal.getCurrentPrice()
            : 0;
        const currentRate = (livePrice > 0) ? livePrice : (state.currentRates[exp.underlying] || 0);

        if (notional === 0) {
            const preview = this.el.querySelector('#trade-preview');
            if (preview) preview.innerHTML = '<div class="readable-text" style="font-size:13px;color:var(--text-muted);text-align:center;padding:8px;">Adjust Q+' + tenor + ' coverage to preview</div>';
            return;
        }

        // Price the trade using HedgingEngine
        let contractRate = currentRate;
        let premiumInfo = '';

        if (this.selectedProductId) {
            if (this.selectedProductId.includes('forward') || this.selectedProductId.includes('future')) {
                if (exp.type === 'fx') {
                    contractRate = hedgingEngine.priceFXForward(currentRate, 0.03, 0.04, tenor);
                } else {
                    contractRate = hedgingEngine.priceCommodityFuture(currentRate, 0.04, tenor);
                }
            } else if (this.selectedProductId.includes('option')) {
                const opt = hedgingEngine.priceOption(currentRate, null, tenor, exp.type);
                contractRate = opt.strike;
                const premiumAmt = opt.premiumPct * notional;
                premiumInfo = `
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:var(--pnl-negative)">Premium:</span>
                        <span style="color:var(--pnl-negative)">${formatCurrency(premiumAmt, '', true)}</span>
                    </div>
                `;
            } else if (this.selectedProductId === 'ir_swap') {
                contractRate = hedgingEngine.priceIRSwap(currentRate, tenor);
            } else if (this.selectedProductId === 'ir_cap') {
                const cap = hedgingEngine.priceIRCap(currentRate, tenor);
                contractRate = cap.strike;
                const premiumAmt = cap.premium * notional;
                premiumInfo = `
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:var(--pnl-negative)">Premium:</span>
                        <span style="color:var(--pnl-negative)">${formatCurrency(premiumAmt, '', true)}</span>
                    </div>
                `;
            }
        }

        // Trading cost
        const productType = this.selectedProductId?.split('_').pop() || 'forward';
        const tradingCost = hedgingEngine.getTradingCost(productType, notional);

        // Credit usage depends on product: options/caps = 0, swaps = notional/4, forwards/futures = full
        let previewCreditUsage = notional;
        if (productType === 'option' || productType === 'cap') {
            previewCreditUsage = 0;
        } else if (productType === 'swap') {
            previewCreditUsage = notional / 4;
        }

        // Bank credit check
        let bankWarning = '';
        if (this.selectedBankId && previewCreditUsage > 0) {
            const avail = bankEngine.getAvailableCredit(this.selectedBankId);
            if (previewCreditUsage > avail) {
                bankWarning = `<div style="color:var(--pnl-negative);font-size:12px;margin-top:4px;">⚠ Exceeds credit limit</div>`;
            }
        }

        const preview = this.el.querySelector('#trade-preview');
        preview.innerHTML = `
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-secondary);margin-bottom:4px;">TRADE PREVIEW</div>
            <div class="readable-text" style="font-size:14px;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:var(--text-muted)">Notional:</span>
                    <span>${formatCurrency(notional, exp.unit, true)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:var(--text-muted)">Rate:</span>
                    <span style="color:var(--cyan)">${formatRate(contractRate, 4)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:var(--text-muted)">Tenor:</span>
                    <span>Q+${tenor}</span>
                </div>
                ${premiumInfo}
                <div style="display:flex;justify-content:space-between;color:var(--text-muted);">
                    <span>Bid-offer cost:</span>
                    <span>${formatCurrency(tradingCost, '', true)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;color:var(--text-muted);">
                    <span>Credit usage:</span>
                    <span>${previewCreditUsage === 0 ? 'None' : formatCurrency(previewCreditUsage, '', true)}</span>
                </div>
                ${bankWarning}
            </div>
        `;
    }

    executeHedge() {
        if (!this.selectedExposure || !this.hedgeLadder || !this.tradeDirectionConfirmed) {
            this.app.showToast('Select an exposure and confirm direction first', 'warning');
            return;
        }

        const state = gameState.get();
        const exp = this.selectedExposure;
        const { tenor, pct } = this.hedgeLadder.getSelection();
        const notional = exp.quarterlyNotional * pct;

        if (notional <= 0) {
            this.app.showToast('Set a hedge amount first', 'warning');
            return;
        }

        // Use live Bloomberg price if quarter is active
        const livePrice = (this.quarterStarted && this.bloombergTerminal && this.bloombergTerminal.underlying === exp.underlying)
            ? this.bloombergTerminal.getCurrentPrice()
            : 0;
        const currentRate = (livePrice > 0) ? livePrice : (state.currentRates[exp.underlying] || 0);

        // Check hedge limits
        const currentHedgeRatio = gameLoop.getHedgeRatio(exp.underlying);
        if (currentHedgeRatio + pct > GAME_CONFIG.MAX_HEDGE_RATIO) {
            this.app.showToast(`Cannot exceed ${GAME_CONFIG.MAX_HEDGE_RATIO * 100}% hedge ratio`, 'warning');
            return;
        }

        // Calculate credit usage based on product type
        // Caps/Options: no credit limit usage
        // Swaps: notional / 4 (quarterly approximation)
        // Forwards/Futures: full notional
        const productType = this.selectedProductId?.split('_').pop() || 'forward';
        let creditUsage = notional;
        if (productType === 'option' || productType === 'cap') {
            creditUsage = 0;
        } else if (productType === 'swap') {
            creditUsage = notional / 4;
        }

        // Check bank credit
        if (this.selectedBankId && creditUsage > 0) {
            const avail = bankEngine.getAvailableCredit(this.selectedBankId);
            if (creditUsage > avail) {
                this.app.showToast('Exceeds bank credit limit', 'warning');
                return;
            }
        }

        // Create trade via HedgingEngine
        const hedge = hedgingEngine.createTrade({
            exposure: exp,
            productId: this.selectedProductId || 'fx_forward',
            notional,
            tenorQuarters: tenor,
            spotRate: currentRate,
            rBase: 0.03,
            rQuote: 0.04,
            currentQuarter: state.totalQuartersPlayed,
            bankId: this.selectedBankId
        });

        // Deduct premium if applicable
        if (hedge.premiumPaid > 0) {
            gameState.update({ cashBalance: state.cashBalance - hedge.premiumPaid });
        }

        // Trading cost
        const tradingCost = hedgingEngine.getTradingCost(hedge.productType, notional);
        this.tradesThisQuarter++;
        this.tradingCostsThisQuarter += tradingCost;

        // Allocate to bank (using credit usage, not full notional)
        if (this.selectedBankId && creditUsage > 0) {
            bankEngine.allocateTrade(this.selectedBankId, hedge.id, creditUsage);
        }

        gameState.addHedge(hedge);
        soundFX.tradeExecute();

        // Warn if over-trading
        if (this.tradesThisQuarter > 3) {
            this.app.showToast('Excessive trading! Costs are mounting.', 'warning');
        } else {
            const premNote = hedge.premiumPaid > 0 ? ` (premium: ${formatCurrency(hedge.premiumPaid, '', true)})` : '';
            this.app.showToast(`${exp.underlying} ${hedge.productType} executed: ${formatCurrency(notional, '', true)}${premNote}`, 'success');
        }

        // Refresh
        this.renderExposures();
        this.renderActiveHedges();
        this.renderPortfolio();
        this.renderBanksView();
        this.updateTradeCountBadge();

        // Re-select to refresh hedge ratio
        this.selectExposure(exp.underlying);
    }

    updateTradeCountBadge() {
        const badge = this.el.querySelector('#trade-count-badge');
        if (badge) {
            if (this.tradesThisQuarter > 0) {
                const color = this.tradesThisQuarter > 3 ? 'var(--pnl-negative)' : 'var(--text-muted)';
                badge.style.color = color;
                badge.textContent = `TRADES: ${this.tradesThisQuarter}`;
            } else {
                badge.textContent = '';
            }
        }
    }

    // -----------------------------------------------------------------------
    // Rendering helpers
    // -----------------------------------------------------------------------

    renderQuarterPips() {
        const state = gameState.get();
        const container = this.el.querySelector('#quarter-pips');
        const total = state.maxQuarters;
        let html = '';
        for (let i = 0; i < total; i++) {
            if (i > 0 && i % 4 === 0) html += '<div class="quarter-pip-divider"></div>';
            let cls = 'future';
            if (i < state.totalQuartersPlayed) cls = 'completed';
            else if (i === state.totalQuartersPlayed) cls = 'current';
            html += `<div class="quarter-pip ${cls}"></div>`;
        }
        container.innerHTML = html;
    }

    renderExposures() {
        const state = gameState.get();
        const container = this.el.querySelector('#exposure-list');

        if (!state.exposures || state.exposures.length === 0) {
            container.innerHTML = '<div class="readable-text p-8" style="color:var(--text-muted)">No exposures</div>';
            return;
        }

        let html = '';
        for (const exp of state.exposures) {
            const currentRate = state.currentRates[exp.underlying] || 0;
            const budgetRate = state.budgetRates[exp.underlying] || 0;
            const hedgeRatio = gameLoop.getHedgeRatio(exp.underlying);
            const rateClass = exp.direction === 'buy'
                ? (currentRate <= budgetRate ? 'pnl-positive' : 'pnl-negative')
                : (currentRate >= budgetRate ? 'pnl-positive' : 'pnl-negative');
            const decimals = exp.type === 'ir' ? 4 : (exp.underlying.includes('JPY') ? 2 : 4);

            html += `
                <div class="exposure-row" data-underlying="${exp.underlying}" style="cursor:pointer">
                    <span class="exposure-type-badge ${exp.type}">${exp.type}</span>
                    <span class="exposure-underlying">${exp.underlying}</span>
                    <span class="exposure-detail">${exp.description}</span>
                    <span class="readable-text" style="min-width:70px;text-align:right">
                        <span class="${rateClass}">${formatRate(currentRate, decimals)}</span>
                    </span>
                    <span class="exposure-hedge-ratio">
                        <span class="pixel-text" style="font-size:8px;color:${hedgeRatio >= 0.3 ? 'var(--pnl-positive)' : 'var(--text-muted)'}">${formatPercent(hedgeRatio, 0)}</span>
                    </span>
                </div>
            `;
        }

        container.innerHTML = html;

        container.querySelectorAll('.exposure-row').forEach(row => {
            row.addEventListener('click', () => {
                const underlying = row.dataset.underlying;
                this.selectExposure(underlying);
                container.querySelectorAll('.exposure-row').forEach(r => r.style.background = '');
                row.style.background = 'rgba(68, 204, 221, 0.1)';
            });
        });
    }

    selectExposure(underlying) {
        const state = gameState.get();
        this.selectedExposure = state.exposures.find(e => e.underlying === underlying);
        if (!this.selectedExposure) return;

        const exp = this.selectedExposure;
        const currentRate = state.currentRates[exp.underlying] || 0;
        const hedgeRatio = gameLoop.getHedgeRatio(exp.underlying);

        // Reset trade flow state
        this.tradeDirectionConfirmed = false;
        this.selectedProductId = null;

        // Hide downstream controls
        this.el.querySelector('#product-selector').style.display = 'none';
        this.el.querySelector('#bank-selector').style.display = 'none';
        this.el.querySelector('#hedge-ladder-container').style.display = 'none';
        this.el.querySelector('#trade-execution').style.display = 'none';

        // Calculate existing hedge notional for this exposure
        const existingHedgeNotional = state.hedgePortfolio
            .filter(h => h.underlying === exp.underlying && h.status === 'active')
            .reduce((sum, h) => sum + h.notional, 0);

        // Show exposure info
        const infoContainer = this.el.querySelector('#selected-exposure-info');
        infoContainer.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span class="exposure-type-badge ${exp.type}">${exp.type}</span>
                    <span class="pixel-text" style="font-size:10px;color:var(--gold)">${exp.underlying}</span>
                </div>
                <div class="readable-text" style="font-size:14px;color:var(--text-muted)">${exp.direction.toUpperCase()}</div>
            </div>
            <div class="readable-text" style="font-size:15px;margin-top:4px;">${exp.description}</div>
            <div style="display:flex;justify-content:space-between;margin-top:6px;">
                <span class="readable-text" style="font-size:14px;color:var(--text-muted)">Quarterly: ${formatCurrency(exp.quarterlyNotional, '', true)}</span>
                <span class="readable-text" style="font-size:14px;color:var(--text-muted)">Hedged: ${formatPercent(hedgeRatio, 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
                <span class="readable-text" style="font-size:14px;color:var(--cyan)">Existing cover: ${formatCurrency(existingHedgeNotional, '', true)}</span>
                <span class="readable-text" style="font-size:14px;color:var(--text-muted)">Unhedged: ${formatCurrency(Math.max(0, exp.quarterlyNotional - existingHedgeNotional), '', true)}</span>
            </div>
        `;

        // Show direction test
        this.showDirectionTest(exp);

        // Update Bloomberg terminal for this exposure (if quarter started)
        if (this.quarterStarted && this.endOfQuarterRates) {
            this.startBloombergForExposure(exp);
        }
    }

    renderMarketView() {
        const state = gameState.get();
        const container = this.el.querySelector('#market-view');

        let html = '<table class="data-table"><thead><tr><th>UNDERLYING</th><th>RATE</th><th>BUDGET</th><th>VS BUDGET</th></tr></thead><tbody>';
        for (const exp of state.exposures) {
            const current = state.currentRates[exp.underlying] || 0;
            const budget = state.budgetRates[exp.underlying] || 0;
            const diff = budget > 0 ? (current - budget) / budget : 0;
            const decimals = exp.type === 'ir' ? 4 : (exp.underlying.includes('JPY') ? 2 : 4);
            html += `<tr>
                <td><span class="exposure-type-badge ${exp.type}" style="margin-right:4px">${exp.type}</span>${exp.underlying}</td>
                <td>${formatRate(current, decimals)}</td>
                <td style="color:var(--text-muted)">${formatRate(budget, decimals)}</td>
                <td class="${diff >= 0 ? 'pnl-positive' : 'pnl-negative'}">${(diff * 100).toFixed(2)}%</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderPortfolio() {
        const state = gameState.get();
        const container = this.el.querySelector('#portfolio-view');
        const activeHedges = (state.hedgePortfolio || []).filter(h => h.status === 'active');

        if (activeHedges.length === 0) {
            container.innerHTML = '<div class="readable-text p-8" style="color:var(--text-muted);text-align:center">No active hedges</div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>TYPE</th><th>UNDERLYING</th><th>NOTIONAL</th><th>RATE</th><th>MTM</th><th>BANK</th><th>EXPIRY</th></tr></thead><tbody>';
        for (const hedge of activeHedges) {
            const mtm = hedge.currentMtm || 0;
            const bank = bankEngine.getActiveBanks().find(b => b.id === hedge.bankId);
            html += `<tr>
                <td><span class="badge badge-${hedge.assetClass || 'fx'}">${hedge.productType}</span></td>
                <td>${hedge.underlying}</td>
                <td>${formatCurrency(hedge.notional, '', true)}</td>
                <td>${formatRate(hedge.contractRate, 4)}</td>
                <td class="${pnlClass(mtm)}">${formatPnL(mtm)}</td>
                <td style="color:var(--text-muted);font-size:12px;">${bank?.shortName || '—'}</td>
                <td>Q+${Math.max(0, hedge.maturityQuarter - state.totalQuartersPlayed)}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    renderBanksView() {
        const container = this.el.querySelector('#banks-view');
        const summary = bankEngine.getSummary();
        const divScore = bankEngine.getDiversificationScore();

        if (summary.length === 0) {
            container.innerHTML = '<div class="readable-text p-8" style="color:var(--text-muted);text-align:center">No bank counterparties</div>';
            return;
        }

        let html = `
            <div style="display:flex;justify-content:space-between;padding:4px 8px;">
                <span class="pixel-text" style="font-size:8px;color:var(--text-secondary)">COUNTERPARTIES</span>
                <span class="pixel-text" style="font-size:8px;color:${divScore > 0.5 ? 'var(--pnl-positive)' : 'var(--gold)'}">DIVERSIFICATION: ${Math.round(divScore * 100)}%</span>
            </div>
        `;

        for (const bank of summary) {
            const utilPct = Math.round(bank.utilization * 100);
            const barColor = utilPct > 80 ? 'var(--pnl-negative)' : utilPct > 50 ? 'var(--gold)' : 'var(--pnl-positive)';
            html += `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;">
                    <span class="readable-text" style="font-size:14px;min-width:40px;">${bank.shortName}</span>
                    <div style="flex:1;height:10px;background:var(--bg-input);border:1px solid var(--border-inner);border-radius:2px;overflow:hidden;">
                        <div style="height:100%;width:${utilPct}%;background:${barColor};transition:width 0.2s;"></div>
                    </div>
                    <span class="readable-text" style="font-size:12px;color:var(--text-muted);min-width:80px;text-align:right;">
                        ${formatCurrency(bank.usedLimit, '', true)} / ${formatCurrency(bank.creditLimit, '', true)}
                    </span>
                    <span class="pixel-text" style="font-size:7px;color:var(--text-muted);">${bank.tradeCount} trades</span>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderActiveHedges() {
        const state = gameState.get();
        const container = this.el.querySelector('#active-hedges-list');
        const activeHedges = (state.hedgePortfolio || []).filter(h => h.status === 'active');

        if (activeHedges.length === 0) {
            container.innerHTML = '<div class="readable-text p-8" style="color:var(--text-muted);text-align:center;font-size:14px;">No active hedges</div>';
            return;
        }

        // Summary totals
        const totalNotional = activeHedges.reduce((sum, h) => sum + h.notional, 0);
        const totalMtm = activeHedges.reduce((sum, h) => sum + (h.currentMtm || 0), 0);

        // Bank usage summary
        const bankSummary = bankEngine.getSummary();
        const totalCredit = bankSummary.reduce((sum, b) => sum + b.creditLimit, 0);
        const totalUsed = bankSummary.reduce((sum, b) => sum + b.usedLimit, 0);
        const utilPct = totalCredit > 0 ? Math.round((totalUsed / totalCredit) * 100) : 0;

        let html = `
            <div style="display:flex;justify-content:space-between;padding:4px 6px;border-bottom:1px solid var(--border-inner);margin-bottom:4px;">
                <span class="pixel-text" style="font-size:7px;color:var(--text-muted)">${activeHedges.length} HEDGES</span>
                <span class="pixel-text" style="font-size:7px;color:var(--text-muted)">TOTAL: ${formatCurrency(totalNotional, '', true)}</span>
                <span class="pixel-text ${pnlClass(totalMtm)}" style="font-size:7px">MTM: ${formatPnL(totalMtm)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:2px 6px;margin-bottom:4px;">
                <span class="pixel-text" style="font-size:7px;color:var(--text-muted)">CREDIT: ${formatCurrency(totalUsed, '', true)} / ${formatCurrency(totalCredit, '', true)}</span>
                <span class="pixel-text" style="font-size:7px;color:${utilPct > 80 ? 'var(--pnl-negative)' : utilPct > 50 ? 'var(--gold)' : 'var(--pnl-positive)'}">${utilPct}% USED</span>
            </div>
        `;

        for (const hedge of activeHedges) {
            const mtm = hedge.currentMtm || 0;
            const bank = bankEngine.getActiveBanks().find(b => b.id === hedge.bankId);
            const expiryQ = Math.max(0, hedge.maturityQuarter - state.totalQuartersPlayed);
            html += `
                <div class="active-hedge">
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span class="hedge-type">${hedge.productType.toUpperCase()}</span>
                        <span class="readable-text" style="font-size:14px;">${hedge.underlying}</span>
                        <span class="pixel-text" style="font-size:6px;color:var(--text-muted)">Q+${expiryQ}</span>
                    </div>
                    <span class="readable-text" style="font-size:13px;color:var(--text-muted)">${formatCurrency(hedge.notional, '', true)}</span>
                    <span class="readable-text" style="font-size:12px;color:var(--text-muted)">${bank?.shortName || ''}</span>
                    <span class="hedge-mtm ${pnlClass(mtm)}">${formatPnL(mtm)}</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    renderPolicy() {
        const state = gameState.get();
        const policy = state.hedgingPolicy;
        if (policy) {
            this.el.querySelector('#policy-name').textContent = policy.name;
            const badge = this.el.querySelector('#policy-badge');
            badge.textContent = `${formatPercent(policy.minHedgeRatio, 0)}-${formatPercent(policy.maxHedgeRatio, 0)}`;
            badge.title = policy.detail || policy.description;
            badge.style.cursor = 'pointer';

            // Click badge to show full policy detail
            badge.addEventListener('click', () => this.showPolicyDetail());
        }

        // Also add click handler to the policy label text
        const policyLabel = this.el.querySelector('#policy-name');
        if (policyLabel) {
            policyLabel.style.cursor = 'pointer';
            policyLabel.addEventListener('click', () => this.showPolicyDetail());
        }
    }

    showPolicyDetail() {
        const state = gameState.get();
        const policy = state.hedgingPolicy;
        if (!policy) return;

        const rulesHtml = (policy.rules && policy.rules.length > 0)
            ? policy.rules.map(r => `<li style="margin-bottom:4px;">${r}</li>`).join('')
            : '<li>No specific rules — full discretion</li>';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="min-width:380px;max-width:500px;">
                <div class="modal-header">
                    HEDGING POLICY
                    <button class="modal-close" id="close-policy">X</button>
                </div>
                <div class="modal-body">
                    <div class="pixel-text" style="font-size:10px;color:var(--gold);margin-bottom:8px;">${policy.name}</div>
                    <div class="readable-text" style="font-size:15px;color:var(--text-primary);margin-bottom:12px;">
                        ${policy.detail || policy.description}
                    </div>
                    <div class="pixel-text" style="font-size:8px;color:var(--text-secondary);margin-bottom:4px;">POLICY RULES</div>
                    <ul class="readable-text" style="font-size:14px;color:var(--text-secondary);padding-left:20px;margin:0;">
                        ${rulesHtml}
                    </ul>
                    <div style="margin-top:12px;display:flex;justify-content:space-between;">
                        <span class="pixel-text" style="font-size:8px;color:var(--text-muted)">MIN HEDGE</span>
                        <span class="pixel-text" style="font-size:9px;color:var(--cyan)">${formatPercent(policy.minHedgeRatio, 0)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span class="pixel-text" style="font-size:8px;color:var(--text-muted)">MAX HEDGE</span>
                        <span class="pixel-text" style="font-size:9px;color:var(--cyan)">${formatPercent(policy.maxHedgeRatio, 0)}</span>
                    </div>
                </div>
            </div>
        `;

        const viewport = document.getElementById('game-viewport');
        viewport.appendChild(overlay);
        overlay.querySelector('#close-policy').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    drawIsometricScene() {
        const canvas = this.el.querySelector('#iso-canvas');
        if (!canvas) return;
        const state = gameState.get();
        if (this.isoScene) this.isoScene.stop();
        this.isoScene = new IsometricScene(canvas);
        this.isoScene.start(state.industry?.scene || 'airport', state.currentYearOffset, state.currentQuarter);
    }

    startBloombergForExposure(exposure) {
        const canvas = this.el.querySelector('#bloomberg-canvas-right');
        if (!canvas) return;

        const state = gameState.get();
        if (!state.exposures || state.exposures.length === 0) return;

        // Use selected exposure or fall back to first
        const exp = exposure || this.selectedExposure || state.exposures[0];
        const underlying = exp.underlying;
        const exposureType = exp.type;
        const currentRate = state.currentRates[underlying] || 0;
        const targetRate = this.endOfQuarterRates?.[underlying] || currentRate;
        const rng = gameState.getRng();

        canvas.style.display = 'block';

        if (this.bloombergTerminal) this.bloombergTerminal.stop();
        this.bloombergTerminal = new BloombergTerminal(canvas);
        this.bloombergTerminal.start(underlying, exposureType, currentRate, targetRate, rng);
    }
}
