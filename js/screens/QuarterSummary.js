// Quarter Summary Screen — end-of-quarter P&L recap

import { gameState } from '../engine/GameState.js';
import { gameLoop } from '../engine/GameLoop.js';
import { formatPnL, formatCurrency, formatQuarter, formatPercent, pnlClass } from '../utils/formatters.js';
import { MiniChart } from '../ui/MiniChart.js';
import { soundFX } from '../ui/SoundFX.js';

export class QuarterSummaryScreen {
    constructor(app) {
        this.app = app;
        this.el = null;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'screen active summary-screen';

        const state = gameState.get();
        const result = state.quarterlyResults[state.quarterlyResults.length - 1];

        if (!result) {
            this.el.innerHTML = '<div class="flex-center flex-1 readable-text">No results to show</div>';
            return this.el;
        }

        const exposurePnL = result.exposurePnL || 0;
        const hedgePnL = result.hedgePnL || 0;
        const netPnL = result.netPnL || 0;

        this.el.innerHTML = `
            <div class="quarter-bar">
                <span class="company-name">${state.industry?.name || 'Company'}</span>
                <span class="quarter-label">QUARTER SUMMARY — ${formatQuarter(result.yearOffset, result.quarterNum)}</span>
                <span></span>
            </div>

            <div class="summary-header" style="margin-top:16px;">
                <h2>QUARTER ${result.quarterNum} RESULTS</h2>
            </div>

            <div style="flex:1;padding:0 16px;overflow-y:auto;">
                <!-- Main P&L summary -->
                <div class="panel" style="max-width:600px;margin:0 auto;">
                    <div class="panel-title">PROFIT & LOSS</div>

                    <div class="summary-stat">
                        <span class="summary-stat-label">Exposure P&L (unhedged impact)</span>
                        <span class="summary-stat-value ${pnlClass(exposurePnL)}">${formatPnL(exposurePnL)}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-label">Hedge P&L (hedging gain/loss)</span>
                        <span class="summary-stat-value ${pnlClass(hedgePnL)}">${formatPnL(hedgePnL)}</span>
                    </div>
                    <hr class="divider">
                    <div class="summary-stat">
                        <span class="summary-stat-label" style="color:var(--text-primary);font-size:20px;">Net P&L</span>
                        <span class="summary-stat-value ${pnlClass(netPnL)}" style="font-size:14px;">${formatPnL(netPnL)}</span>
                    </div>

                    ${result.marginCallAmount > 0 ? `
                        <div class="summary-stat" style="margin-top:8px;">
                            <span class="summary-stat-label" style="color:var(--warning)">⚠ Margin Call</span>
                            <span class="summary-stat-value pnl-negative">${formatPnL(-result.marginCallAmount)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Cumulative stats -->
                <div class="panel" style="max-width:600px;margin:8px auto;">
                    <div class="panel-title">RUNNING TOTALS</div>

                    <div class="summary-stat">
                        <span class="summary-stat-label">Cumulative P&L</span>
                        <span class="summary-stat-value ${pnlClass(state.cumulativePnL)}">${formatPnL(state.cumulativePnL)}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-label">Cash Balance</span>
                        <span class="summary-stat-value" style="color:${state.cashBalance >= state.startingCash * 0.2 ? 'var(--pnl-positive)' : 'var(--pnl-negative)'}">
                            ${formatCurrency(state.cashBalance, state.industry?.baseCurrency, true)}
                        </span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-label">Board Satisfaction</span>
                        <span class="summary-stat-value" style="color:${state.boardSatisfaction >= 50 ? 'var(--satisfaction-high)' : state.boardSatisfaction >= 25 ? 'var(--satisfaction-mid)' : 'var(--satisfaction-low)'}">
                            ${state.boardSatisfaction}%
                        </span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-label">Active Hedges</span>
                        <span class="summary-stat-value" style="color:var(--cyan)">
                            ${state.hedgePortfolio.filter(h => h.status === 'active').length}
                        </span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-stat-label">Quarters Remaining</span>
                        <span class="summary-stat-value" style="color:var(--gold)">
                            ${state.maxQuarters - state.totalQuartersPlayed - 1}
                        </span>
                    </div>

                    <!-- Sparklines -->
                    <div style="display:flex;gap:16px;margin-top:8px;justify-content:center;">
                        <div style="text-align:center;">
                            <div class="pixel-text" style="font-size:6px;color:var(--text-muted);margin-bottom:2px;">P&L HISTORY</div>
                            <div id="pnl-sparkline"></div>
                        </div>
                        <div style="text-align:center;">
                            <div class="pixel-text" style="font-size:6px;color:var(--text-muted);margin-bottom:2px;">SATISFACTION</div>
                            <div id="sat-sparkline"></div>
                        </div>
                    </div>
                </div>

                ${result.details && result.details.length > 0 ? `
                    <div class="panel" style="max-width:600px;margin:8px auto;">
                        <div class="panel-title">DETAILS</div>
                        ${result.details.map(d => `
                            <div class="summary-stat" style="font-size:16px;">
                                <span class="summary-stat-label" style="font-size:15px;">
                                    <span class="badge badge-${d.type === 'hedge' ? (d.assetClass || 'fx') : 'fx'}" style="margin-right:4px;">
                                        ${d.type}
                                    </span>
                                    ${d.underlying} ${d.description || d.productType || ''}
                                </span>
                                <span class="summary-stat-value ${pnlClass(d.pnl)}" style="font-size:9px;">
                                    ${formatPnL(d.pnl)}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="dashboard-footer">
                <div></div>
                <button class="btn btn-gold" id="btn-next-quarter">NEXT QUARTER ▶</button>
            </div>
        `;

        return this.el;
    }

    mount() {
        const state = gameState.get();
        const lastResult = state.quarterlyResults[state.quarterlyResults.length - 1];

        // Sound based on P&L
        if (lastResult?.netPnL > 0) {
            soundFX.positivePnL();
        } else if (lastResult?.netPnL < 0) {
            soundFX.negativePnL();
        }

        // Render sparklines
        const pnlData = state.quarterlyResults.map(r => r.netPnL || 0);
        const satData = state.satisfactionHistory.map(s => s.value);

        const pnlContainer = this.el.querySelector('#pnl-sparkline');
        const satContainer = this.el.querySelector('#sat-sparkline');

        if (pnlContainer && pnlData.length > 0) {
            MiniChart.bar(pnlContainer, pnlData, { width: 140, height: 28 });
        }
        if (satContainer && satData.length > 0) {
            MiniChart.satisfaction(satContainer, satData, { width: 140, height: 28 });
        }

        this.el.querySelector('#btn-next-quarter').addEventListener('click', () => {
            gameLoop.completeSummary();
        });
    }

    unmount() {}
}
