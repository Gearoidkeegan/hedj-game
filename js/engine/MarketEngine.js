// MarketEngine — loads historical market data and replays rates quarter-by-quarter

import { GAME_CONFIG } from '../utils/constants.js';

class MarketEngineController {
    constructor() {
        this.fxData = null;
        this.ratesData = null;
        this.commoditiesData = null;
        this.loaded = false;
    }

    /**
     * Load all market data JSON files.
     * Call once at app startup.
     */
    async loadData(basePath = 'data/market') {
        try {
            const [fxRes, ratesRes, commoditiesRes] = await Promise.all([
                fetch(`${basePath}/fx-monthly.json`).then(r => r.json()),
                fetch(`${basePath}/rates-monthly.json`).then(r => r.json()),
                fetch(`${basePath}/commodities-monthly.json`).then(r => r.json())
            ]);

            this.fxData = this.stripMeta(fxRes);
            this.ratesData = this.stripMeta(ratesRes);
            this.commoditiesData = this.stripMeta(commoditiesRes);
            this.loaded = true;
            console.log('MarketEngine: data loaded', {
                fx: Object.keys(this.fxData).length,
                rates: Object.keys(this.ratesData).length,
                commodities: Object.keys(this.commoditiesData).length
            });
        } catch (e) {
            console.warn('MarketEngine: could not load market data, will use placeholders', e);
            this.loaded = false;
        }
    }

    stripMeta(data) {
        const { _meta, ...rest } = data;
        return rest;
    }

    /**
     * Get the dataset for a given underlying.
     */
    getDataset(underlying) {
        if (!this.loaded) return null;

        // Check each data source
        if (this.fxData[underlying]) return this.fxData[underlying];
        if (this.ratesData[underlying]) return this.ratesData[underlying];
        if (this.commoditiesData[underlying]) return this.commoditiesData[underlying];

        // Try mapping common names
        const aliases = {
            'EURIBOR': 'EURIBOR',
            'SOFR': 'SOFR',
            'SONIA': 'SONIA'
        };
        const alias = aliases[underlying];
        if (alias && this.ratesData[alias]) return this.ratesData[alias];

        return null;
    }

    /**
     * Get all available dates (sorted) for an underlying.
     */
    getDates(underlying) {
        const dataset = this.getDataset(underlying);
        if (!dataset) return [];
        return Object.keys(dataset).sort();
    }

    /**
     * Find the valid start year range for a game.
     * The game needs GAME_WINDOW_YEARS of forward data.
     */
    getValidStartYears() {
        if (!this.loaded) return { min: 1994, max: 2020 };

        // Find the overlap of all datasets
        let globalMin = 1900;
        let globalMax = 2100;

        const allDatasets = [
            ...Object.values(this.fxData),
            ...Object.values(this.ratesData),
            ...Object.values(this.commoditiesData)
        ];

        for (const dataset of allDatasets) {
            const dates = Object.keys(dataset).sort();
            if (dates.length === 0) continue;
            const minYear = parseInt(dates[0].slice(0, 4));
            const maxYear = parseInt(dates[dates.length - 1].slice(0, 4));
            globalMin = Math.max(globalMin, minYear);
            globalMax = Math.min(globalMax, maxYear);
        }

        // Leave room for game duration
        return {
            min: globalMin,
            max: globalMax - GAME_CONFIG.GAME_WINDOW_YEARS
        };
    }

    /**
     * Get the rate for a specific underlying at a given date.
     * Uses the nearest available date if exact match not found.
     * @param {string} underlying - e.g. 'EURUSD', 'BRENT', 'SOFR'
     * @param {number} year
     * @param {number} quarter - 1-4
     * @returns {number|null}
     */
    getRate(underlying, year, quarter) {
        const dataset = this.getDataset(underlying);
        if (!dataset) return null;

        // Quarter to month: Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
        const months = [1, 4, 7, 10];
        const month = months[quarter - 1];
        const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;

        // Exact match
        if (dataset[dateStr] !== undefined) {
            return dataset[dateStr];
        }

        // Nearest date within ±3 months
        const dates = Object.keys(dataset).sort();
        let closest = null;
        let closestDist = Infinity;

        for (const d of dates) {
            const dist = Math.abs(new Date(d) - new Date(dateStr));
            if (dist < closestDist) {
                closestDist = dist;
                closest = d;
            }
        }

        if (closest && closestDist < 100 * 24 * 3600 * 1000) {
            return dataset[closest];
        }

        return null;
    }

    /**
     * Get rates for all exposures at a given quarter.
     * @param {Array} exposures - array of exposure objects with .underlying
     * @param {number} year - calendar year
     * @param {number} quarter - 1-4
     * @returns {Object} { underlying: rate }
     */
    getRatesForQuarter(exposures, year, quarter) {
        const rates = {};
        for (const exp of exposures) {
            const rate = this.getRate(exp.underlying, year, quarter);
            if (rate !== null) {
                rates[exp.underlying] = rate;
            }
        }
        return rates;
    }

    /**
     * Get budget rates — the rates at the start of the game.
     * Budget rates include a small spread favorable to the company.
     * @param {Array} exposures
     * @param {number} startYear
     * @param {number} startQuarter
     * @returns {Object} { underlying: budgetRate }
     */
    getBudgetRates(exposures, startYear, startQuarter) {
        const spotRates = this.getRatesForQuarter(exposures, startYear, startQuarter);
        const budgetRates = {};

        for (const exp of exposures) {
            const spot = spotRates[exp.underlying];
            if (spot === undefined) continue;

            const spread = exp.budgetRateSpread || 0.02;
            if (exp.direction === 'buy') {
                // Buying: budget assumes lower cost
                budgetRates[exp.underlying] = spot * (1 - spread);
            } else {
                // Selling: budget assumes higher revenue
                budgetRates[exp.underlying] = spot * (1 + spread);
            }
        }

        return budgetRates;
    }

    /**
     * Get intra-quarter price ticks for the Bloomberg terminal.
     * Interpolates between two quarterly rates with realistic noise.
     * @param {string} underlying
     * @param {number} year
     * @param {number} quarter
     * @param {object} rng - SeededRandom instance
     * @param {number} numTicks - number of ticks to generate
     * @returns {{ startRate: number, endRate: number, ticks: number[] }}
     */
    getIntraQuarterTicks(underlying, year, quarter, rng, numTicks = 60) {
        const startRate = this.getRate(underlying, year, quarter);

        // End rate = next quarter
        let nextYear = year;
        let nextQuarter = quarter + 1;
        if (nextQuarter > 4) { nextQuarter = 1; nextYear++; }
        const endRate = this.getRate(underlying, nextYear, nextQuarter);

        if (startRate === null || endRate === null) {
            return null;
        }

        // Brownian bridge interpolation
        const ticks = [startRate];
        const totalReturn = endRate / startRate - 1;
        const dailyVol = Math.abs(totalReturn) * 0.4 + 0.002;
        let price = startRate;

        for (let i = 1; i < numTicks; i++) {
            const t = i / numTicks;
            const target = startRate + (endRate - startRate) * t;
            const pullStrength = 0.15 + 0.35 * t;
            const noise = rng.floatRange(-1, 1) * dailyVol * startRate;
            price = price * (1 - pullStrength) + target * pullStrength + noise;
            price = Math.max(startRate * 0.85, Math.min(startRate * 1.15, price));
            ticks.push(price);
        }
        ticks.push(endRate);

        return { startRate, endRate, ticks };
    }

    /**
     * Check if real market data is available.
     */
    isLoaded() {
        return this.loaded;
    }
}

// Singleton
export const marketEngine = new MarketEngineController();
