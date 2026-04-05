// Central game state store with event-bus pattern
// Every state mutation goes through dispatch() to notify subscribers

import { GAME_CONFIG, PHASE } from '../utils/constants.js';
import { SeededRandom, generateSeed } from '../utils/random.js';

class GameStateManager {
    constructor() {
        this.state = this.createInitialState();
        this.listeners = new Map();
        this.rng = null;
    }

    createInitialState() {
        return {
            // Meta
            gameId: null,
            seed: 0,
            startedAt: null,

            // Setup
            playerName: '',
            playerGender: 'male',     // 'male' or 'female' — affects stress face sprite
            companyName: '',
            contactEmail: '',
            industry: null,           // Full industry template object
            industryId: '',
            startYear: 0,             // Hidden actual calendar year
            hedgingPolicy: null,      // Policy template object
            difficulty: 'normal',

            // Time
            currentYearOffset: 0,     // 0-based (Year 1 = 0)
            currentQuarter: 1,        // 1-4
            totalQuartersPlayed: 0,
            maxQuarters: GAME_CONFIG.DEFAULT_QUARTERS,
            extensionsUsed: 0,
            phase: PHASE.SETUP,

            // Financial
            exposures: [],            // Current active exposures
            hedgePortfolio: [],       // Active hedge trades
            cashBalance: 0,
            startingCash: 0,
            marginPosted: 0,
            cumulativePnL: 0,
            quarterlyResults: [],     // { quarter, exposurePnL, hedgePnL, netPnL, cashBalance, events }
            budgetRates: {},          // { underlying: rate }

            // Market
            currentRates: {},         // { underlying: rate }
            previousRates: {},
            rateHistory: [],          // [{ quarter, rates: {} }]

            // Scoring
            boardSatisfaction: GAME_CONFIG.STARTING_SATISFACTION,
            satisfactionHistory: [],
            policyViolations: 0,
            totalQuartersInCompliance: 0,
            marginCallCount: 0,
            cashWentNegative: false,

            // Events
            activeEvents: [],
            eventHistory: [],
            eventCooldowns: {},       // { eventId: quartersRemaining }

            // Trading
            tradesThisQuarter: 0,
            tradingCostsThisQuarter: 0,
            totalTradingCosts: 0,
            tradeDirectionErrors: 0,

            // Career mode
            careerMode: false,
            careerLevel: 0,
            careerLevelName: '',
            satisfactionLossMultiplier: 1.0,
            satisfactionGainMultiplier: 1.0,

            // Flags
            firedByBoard: false,
            promotedToCEO: false,
            perfectCompliance: true,
            peAcquired: false,        // Private equity acquisition flag

            // UI state
            selectedExposureIndex: 0
        };
    }

    // Initialize a new game
    initGame({ playerName, industry, hedgingPolicy, seed, playerGender, companyName, contactEmail }) {
        const gameSeed = seed || generateSeed();
        this.rng = new SeededRandom(gameSeed);

        // Pick random start year ensuring enough forward data
        const maxStart = GAME_CONFIG.MAX_DATA_YEAR - GAME_CONFIG.GAME_WINDOW_YEARS;
        const startYear = this.rng.intRange(GAME_CONFIG.MIN_DATA_YEAR, maxStart);

        // Set budget rates from market data at start + small random spread
        const budgetRates = {};
        if (industry.exposures) {
            for (const exp of industry.exposures) {
                // Budget rates will be set by MarketEngine when data loads
                budgetRates[exp.underlying] = 0;
            }
        }

        this.state = {
            ...this.createInitialState(),
            gameId: `game_${gameSeed}`,
            seed: gameSeed,
            startedAt: Date.now(),
            playerName,
            playerGender: playerGender || 'male',
            companyName: companyName || '',
            contactEmail: contactEmail || '',
            industry,
            industryId: industry.id,
            startYear,
            hedgingPolicy,
            cashBalance: industry.startingCash,
            startingCash: industry.startingCash,
            budgetRates,
            phase: PHASE.DECISION,
            currentYearOffset: 0,
            currentQuarter: 1,
            totalQuartersPlayed: 0,
            boardSatisfaction: GAME_CONFIG.STARTING_SATISFACTION,
            exposures: JSON.parse(JSON.stringify(industry.exposures))
        };

        this.emit('gameInit', this.state);
        this.emit('stateChange', this.state);
    }

    // Get current state (read-only copy would be ideal but for perf we return direct ref)
    get() {
        return this.state;
    }

    // Get the seeded RNG
    getRng() {
        return this.rng;
    }

    // Update state fields and notify
    update(changes) {
        Object.assign(this.state, changes);
        this.emit('stateChange', this.state);
    }

    // Subscribe to events
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => this.off(event, callback);
    }

    // Unsubscribe
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const idx = callbacks.indexOf(callback);
            if (idx >= 0) callbacks.splice(idx, 1);
        }
    }

    // Emit event to all listeners
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const cb of callbacks) {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Error in ${event} listener:`, e);
                }
            }
        }
    }

    // Add a hedge trade to the portfolio
    addHedge(hedge) {
        this.state.hedgePortfolio.push(hedge);
        this.emit('hedgeAdded', hedge);
        this.emit('stateChange', this.state);
    }

    // Remove a hedge (early unwind)
    removeHedge(hedgeId) {
        const idx = this.state.hedgePortfolio.findIndex(h => h.id === hedgeId);
        if (idx >= 0) {
            const removed = this.state.hedgePortfolio.splice(idx, 1)[0];
            this.emit('hedgeRemoved', removed);
            this.emit('stateChange', this.state);
            return removed;
        }
        return null;
    }

    // Record quarterly result
    addQuarterlyResult(result) {
        this.state.quarterlyResults.push(result);
        this.state.cumulativePnL += result.netPnL;
        this.emit('quarterComplete', result);
    }

    // Adjust board satisfaction (clamped 0-100)
    adjustSatisfaction(delta) {
        const prev = this.state.boardSatisfaction;
        this.state.boardSatisfaction = Math.max(0, Math.min(
            GAME_CONFIG.MAX_SATISFACTION,
            this.state.boardSatisfaction + delta
        ));
        this.state.satisfactionHistory.push({
            quarter: this.state.totalQuartersPlayed,
            value: this.state.boardSatisfaction,
            delta
        });

        // Check for special outcomes
        if (this.state.boardSatisfaction <= GAME_CONFIG.FIRE_THRESHOLD && !this.state.perfectCompliance) {
            this.state.firedByBoard = true;
            this.emit('fired', this.state);
        }
        if (this.state.boardSatisfaction >= GAME_CONFIG.MAX_SATISFACTION) {
            this.state.promotedToCEO = true;
            this.emit('promoted', this.state);
        }

        this.emit('stateChange', this.state);
    }

    // Advance to next quarter
    advanceQuarter() {
        this.state.totalQuartersPlayed++;
        this.state.currentQuarter++;

        if (this.state.currentQuarter > GAME_CONFIG.QUARTERS_PER_YEAR) {
            this.state.currentQuarter = 1;
            this.state.currentYearOffset++;
        }

        // Tick event cooldowns
        for (const eventId of Object.keys(this.state.eventCooldowns)) {
            this.state.eventCooldowns[eventId]--;
            if (this.state.eventCooldowns[eventId] <= 0) {
                delete this.state.eventCooldowns[eventId];
            }
        }

        this.emit('quarterAdvanced', this.state);
        this.emit('stateChange', this.state);
    }

    // Check if game should end
    isGameOver() {
        if (this.state.firedByBoard) return true;
        if (this.state.totalQuartersPlayed >= this.state.maxQuarters) return true;
        return false;
    }

    // Check if extension is available
    canExtend() {
        return (
            this.state.extensionsUsed < GAME_CONFIG.MAX_EXTENSIONS &&
            this.state.totalQuartersPlayed >= this.state.maxQuarters &&
            !this.state.firedByBoard
        );
    }

    // Apply extension
    extendGame() {
        if (!this.canExtend()) return false;
        this.state.extensionsUsed++;
        this.state.maxQuarters += GAME_CONFIG.EXTENSION_QUARTERS;
        this.emit('gameExtended', this.state);
        this.emit('stateChange', this.state);
        return true;
    }

    // Get current calendar quarter string (hidden year + quarter)
    getCalendarQuarter() {
        const year = this.state.startYear + this.state.currentYearOffset;
        const q = this.state.currentQuarter;
        // Map quarter to month: Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
        const months = ['01', '04', '07', '10'];
        return `${year}-${months[q - 1]}`;
    }

    // Get era for communication styling
    getEra() {
        const year = this.state.startYear + this.state.currentYearOffset;
        if (year < 2000) return 'fax';
        if (year < 2006) return 'outlook';
        if (year < 2012) return 'blackberry';
        if (year < 2018) return 'slack-early';
        return 'teams';
    }

    // Serialize for save
    toJSON() {
        return {
            ...this.state,
            _rngState: this.rng ? this.rng.state : null,
            _version: 1
        };
    }

    // Restore from save
    fromJSON(data) {
        if (!data || data._version !== 1) return false;
        this.state = { ...this.createInitialState(), ...data };
        if (data._rngState !== null) {
            this.rng = new SeededRandom(data.seed);
            this.rng.state = data._rngState;
        }
        delete this.state._rngState;
        delete this.state._version;
        this.emit('stateChange', this.state);
        return true;
    }

    // Reset everything
    reset() {
        this.state = this.createInitialState();
        this.rng = null;
        this.emit('stateChange', this.state);
    }
}

// Singleton
export const gameState = new GameStateManager();
