// Game loop controller — manages the quarterly cycle and phase transitions

import { gameState } from './GameState.js';
import { eventEngine } from './EventEngine.js';
import { careerEngine } from './CareerEngine.js';
import { PHASE, GAME_CONFIG } from '../utils/constants.js';

class GameLoopController {
    constructor() {
        this.onPhaseChange = null; // Callback set by main.js to trigger screen transitions
    }

    // Start a new game
    startGame({ playerName, industry, hedgingPolicy, seed, playerGender, companyName, contactEmail }) {
        gameState.initGame({ playerName, industry, hedgingPolicy, seed, playerGender, companyName, contactEmail });
        this.setPhase(PHASE.DECISION);
    }

    // Set current phase and notify
    setPhase(phase) {
        const prevPhase = gameState.get().phase;
        gameState.update({ phase });
        if (this.onPhaseChange) {
            this.onPhaseChange(phase, prevPhase);
        }
    }

    // Player has finished making decisions — advance the quarter
    endDecisionPhase() {
        this.setPhase(PHASE.RESOLUTION);
        // Resolution is processed, then we check for events
        this.resolveQuarter();
    }

    // Process quarter resolution: advance rates, calculate P&L, check margins
    resolveQuarter() {
        const state = gameState.get();

        // MarketEngine will have already updated rates before this is called
        // Calculate P&L for this quarter
        const result = this.calculateQuarterlyPnL();

        // Check margin calls
        if (result.marginCallAmount > 0) {
            gameState.update({
                cashBalance: state.cashBalance - result.marginCallAmount,
                marginPosted: state.marginPosted + result.marginCallAmount,
                marginCallCount: state.marginCallCount + 1
            });
            if (state.cashBalance - result.marginCallAmount < 0) {
                gameState.update({ cashWentNegative: true });
            }
        }

        // Update cash from settlements
        gameState.update({
            cashBalance: gameState.get().cashBalance + result.cashImpact
        });

        // Check policy compliance
        const inCompliance = this.checkPolicyCompliance();
        if (inCompliance) {
            gameState.update({
                totalQuartersInCompliance: state.totalQuartersInCompliance + 1
            });
        } else {
            gameState.update({
                policyViolations: state.policyViolations + 1,
                perfectCompliance: false
            });
        }

        // Record result
        gameState.addQuarterlyResult(result);

        // Store rate history
        const rateHistory = [...state.rateHistory, {
            quarter: state.totalQuartersPlayed,
            rates: { ...state.currentRates }
        }];
        gameState.update({ rateHistory });

        // Check for events, then summary (results), then board (feedback)
        if (eventEngine.shouldFireEvent()) {
            const event = eventEngine.selectEvent();
            if (event) {
                gameState.update({ activeEvents: [event] });
                this.setPhase(PHASE.EVENT);
            } else {
                this.setPhase(PHASE.SUMMARY);
            }
        } else {
            this.setPhase(PHASE.SUMMARY);
        }
    }

    // Calculate P&L for the current quarter
    calculateQuarterlyPnL() {
        const state = gameState.get();
        let exposurePnL = 0;
        let hedgePnL = 0;
        let marginCallAmount = 0;
        let cashImpact = 0;
        const details = [];

        // Exposure P&L: (budget_rate - actual_rate) * notional for each exposure
        for (const exposure of state.exposures) {
            const budgetRate = state.budgetRates[exposure.underlying] || 0;
            const currentRate = state.currentRates[exposure.underlying] || budgetRate;
            const notional = exposure.quarterlyNotional || 0;

            let expPnL = 0;
            if (exposure.direction === 'buy') {
                // Buying: benefit when price drops below budget
                expPnL = (budgetRate - currentRate) * notional;
            } else {
                // Selling: benefit when price rises above budget
                expPnL = (currentRate - budgetRate) * notional;
            }
            exposurePnL += expPnL;
            details.push({
                type: 'exposure',
                underlying: exposure.underlying,
                description: exposure.description,
                pnl: expPnL,
                budgetRate,
                currentRate
            });
        }

        // Hedge P&L: MTM changes on active hedges + settlements
        const settledHedges = [];
        for (const hedge of state.hedgePortfolio) {
            if (hedge.status !== 'active') continue;

            const currentRate = state.currentRates[hedge.underlying] || hedge.contractRate;
            let mtmChange = 0;

            if (hedge.productType === 'forward') {
                // Forward MTM = (market - contract) * notional * direction
                const direction = hedge.direction === 'buy' ? 1 : -1;
                const newMtm = (currentRate - hedge.contractRate) * hedge.notional * direction;
                mtmChange = newMtm - (hedge.currentMtm || 0);
                hedge.currentMtm = newMtm;
            } else if (hedge.productType === 'option') {
                // Simplified option: intrinsic value only
                const direction = hedge.direction === 'buy' ? 1 : -1;
                const intrinsic = Math.max(0, (currentRate - hedge.strikeRate) * direction);
                const newMtm = intrinsic * hedge.notional - (hedge.premiumPaid || 0);
                mtmChange = newMtm - (hedge.currentMtm || 0);
                hedge.currentMtm = newMtm;
            } else if (hedge.productType === 'swap') {
                // IR Swap: (floating - fixed) * notional * 0.25
                const floatingRate = currentRate;
                const fixedRate = hedge.contractRate;
                const quarterPnL = (floatingRate - fixedRate) * hedge.notional * 0.25;
                mtmChange = quarterPnL;
                hedge.currentMtm = (hedge.currentMtm || 0) + quarterPnL;
                cashImpact += quarterPnL; // Swaps settle quarterly
            }

            hedgePnL += mtmChange;

            // Check if hedge matures this quarter
            if (hedge.maturityQuarter <= state.totalQuartersPlayed + 1) {
                hedge.status = 'matured';
                cashImpact += hedge.currentMtm || 0;
                settledHedges.push(hedge);
            }

            // Margin call check for forwards
            if (hedge.productType === 'forward' && hedge.currentMtm < 0) {
                const requiredMargin = Math.abs(hedge.currentMtm) * GAME_CONFIG.MARGIN_REQUIREMENT;
                const additionalMargin = Math.max(0, requiredMargin - (hedge.marginPosted || 0));
                if (additionalMargin > 0) {
                    marginCallAmount += additionalMargin;
                    hedge.marginPosted = requiredMargin;
                }
            }

            details.push({
                type: 'hedge',
                underlying: hedge.underlying,
                productType: hedge.productType,
                pnl: mtmChange,
                contractRate: hedge.contractRate,
                currentRate,
                status: hedge.status
            });
        }

        // Remove matured hedges
        if (settledHedges.length > 0) {
            gameState.update({
                hedgePortfolio: state.hedgePortfolio.filter(h => h.status === 'active')
            });
        }

        const netPnL = exposurePnL + hedgePnL;

        return {
            quarter: state.totalQuartersPlayed,
            yearOffset: state.currentYearOffset,
            quarterNum: state.currentQuarter,
            exposurePnL,
            hedgePnL,
            netPnL,
            cashImpact,
            marginCallAmount,
            cashBalance: gameState.get().cashBalance,
            details
        };
    }

    // Check if current hedge ratios comply with policy
    // Uses total exposure (quarterly × remaining quarters) vs total hedge notional
    checkPolicyCompliance() {
        const state = gameState.get();
        const policy = state.hedgingPolicy;
        if (!policy || policy.id === 'none') return true;

        const remainingQuarters = Math.max(1, state.maxQuarters - state.totalQuartersPlayed);

        for (const exposure of state.exposures) {
            const totalExposure = exposure.quarterlyNotional * remainingQuarters;
            const hedgedAmount = state.hedgePortfolio
                .filter(h => h.underlying === exposure.underlying && h.status === 'active')
                .reduce((sum, h) => sum + h.notional, 0);

            const hedgeRatio = totalExposure > 0
                ? hedgedAmount / totalExposure
                : 0;

            if (hedgeRatio < policy.minHedgeRatio || hedgeRatio > policy.maxHedgeRatio) {
                return false;
            }
        }
        return true;
    }

    // Event phase complete — player has chosen, move to summary
    completeEvent(event, choiceId) {
        const result = eventEngine.processChoice(event, choiceId);
        // Store the event result for the board to reference
        gameState.update({
            activeEvents: [],
            lastEventResult: result
        });
        this.setPhase(PHASE.SUMMARY);
    }

    // Summary phase complete — move to board review
    completeSummary() {
        this.setPhase(PHASE.BOARD);
    }

    // Board review phase complete — advance or end game
    completeBoardReview() {
        // Clear event result now that board has seen it
        gameState.update({ lastEventResult: null });
        gameState.advanceQuarter();
        const state = gameState.get();

        if (state.firedByBoard) {
            if (state.careerMode) {
                this.setPhase(PHASE.LEVEL_COMPLETE);
            } else {
                this.setPhase(PHASE.GAMEOVER);
            }
        } else if (state.totalQuartersPlayed >= state.maxQuarters) {
            if (state.careerMode) {
                this.setPhase(PHASE.LEVEL_COMPLETE);
            } else if (gameState.canExtend()) {
                this.setPhase(PHASE.EXTEND);
            } else {
                this.setPhase(PHASE.GAMEOVER);
            }
        } else {
            this.setPhase(PHASE.DECISION);
        }
    }

    // Player chose to extend
    extendGame() {
        gameState.extendGame();
        this.setPhase(PHASE.DECISION);
    }

    // Player chose not to extend
    endGame() {
        this.setPhase(PHASE.GAMEOVER);
    }

    // Get current hedge ratio for an exposure
    // Compares total hedge notional across all tenors vs total remaining exposure
    getHedgeRatio(exposureUnderlying) {
        const state = gameState.get();
        const exposure = state.exposures.find(e => e.underlying === exposureUnderlying);
        if (!exposure || !exposure.quarterlyNotional) return 0;

        const remainingQuarters = Math.max(1, state.maxQuarters - state.totalQuartersPlayed);
        const totalExposure = exposure.quarterlyNotional * remainingQuarters;

        const totalHedged = state.hedgePortfolio
            .filter(h => h.underlying === exposureUnderlying && h.status === 'active')
            .reduce((sum, h) => sum + h.notional, 0);

        return totalHedged / totalExposure;
    }
}

export const gameLoop = new GameLoopController();
