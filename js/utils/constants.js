// Game balance constants and configuration

export const GAME_CONFIG = {
    DEFAULT_QUARTERS: 8,        // 2 years = ~5 minute game
    EXTENSION_QUARTERS: 4,      // Each extension adds 1 year
    MAX_EXTENSIONS: 2,          // Up to 16 quarters total
    QUARTERS_PER_YEAR: 4,

    // Board satisfaction
    STARTING_SATISFACTION: 60,
    MAX_SATISFACTION: 100,
    FIRE_THRESHOLD: 10,
    SATISFACTION_GAIN_MAX: 5,
    SATISFACTION_LOSS_MAX: -15,

    // Hedging limits
    MAX_HEDGE_RATIO: 2.0,       // 200% - over-hedging allowed but board criticises heavily
    OVERHEDGE_PENALTY_RATE: 0.02, // 2% penalty per quarter on overhedged amount
    EARLY_UNWIND_COST: 0.005,   // 0.5% breakage cost on notional

    // Cash / margin
    MARGIN_CALL_THRESHOLD: 0.05, // MTM loss > 5% of notional triggers margin
    MARGIN_REQUIREMENT: 0.10,    // 10% of notional posted as margin
    LOW_CASH_THRESHOLD: 0.10,    // Warning below 10% of starting cash

    // Events
    MAX_EVENTS_PER_QUARTER: 1,
    MIN_EVENTS_PER_YEAR: 2,

    // Scoring weights
    SCORE_WEIGHTS: {
        pnl: 0.30,
        boardSatisfaction: 0.25,
        cashManagement: 0.20,
        policyCompliance: 0.15,
        riskAdjusted: 0.10
    },

    // Option pricing (simplified)
    OPTION_PREMIUM_ATM: 0.03,   // 3% of notional for ATM option
    OPTION_PREMIUM_SCALE: 1.5,  // Vol multiplier for premium

    // Data window
    MIN_DATA_YEAR: 1994,
    MAX_DATA_YEAR: 2024,
    GAME_WINDOW_YEARS: 4         // Max years of data needed per game
};

export const GRADES = [
    { min: 90, grade: 'A+', title: 'Chief Risk Officer Material', description: 'A headhunter is on the line for you.' },
    { min: 80, grade: 'A',  title: 'Contract Extended', description: 'The board wants to extend your contract.' },
    { min: 70, grade: 'B',  title: 'Solid Treasury Management', description: 'Steady hands on the wheel.' },
    { min: 60, grade: 'C',  title: 'Adequate Performance', description: 'Room for improvement, but you kept the lights on.' },
    { min: 50, grade: 'D',  title: 'Under Review', description: 'The board is reviewing your performance.' },
    { min: 0,  grade: 'F',  title: 'Looking for Work', description: 'Your LinkedIn profile has been updated.' }
];

export const HEDGING_POLICY_TYPES = [
    {
        id: 'none',
        name: 'No Formal Policy',
        description: 'No hedging requirements. Full discretion.',
        detail: 'The board has not set a formal hedging policy. You may hedge as much or as little as you like, using any product available.',
        minHedgeRatio: 0,
        maxHedgeRatio: 1.0,
        requiredProducts: [],
        rules: [],
        difficulty: 'easy'
    },
    {
        id: 'basic',
        name: 'Basic Policy',
        description: 'Hedge 25-75% of FX exposures. No product restrictions.',
        detail: 'The board requires a minimum 25% and maximum 75% hedge ratio on all FX exposures. No restrictions on product choice. Compliance is reviewed quarterly.',
        minHedgeRatio: 0.25,
        maxHedgeRatio: 0.75,
        requiredProducts: [],
        rules: ['Minimum 25% hedge ratio on all FX exposures', 'Maximum 75% hedge ratio'],
        difficulty: 'easy'
    },
    {
        id: 'conservative',
        name: 'Conservative Policy',
        description: 'Hedge 50-80% of all exposures using forwards only.',
        detail: 'The board requires between 50% and 80% of all exposures to be hedged using forwards only. Options are not permitted under this policy. Quarterly compliance reporting required.',
        minHedgeRatio: 0.50,
        maxHedgeRatio: 0.80,
        requiredProducts: ['forward'],
        rules: ['Forwards only — no options permitted', 'Hedge ratio must be 50-80%', 'Quarterly compliance report to CFO'],
        difficulty: 'normal'
    },
    {
        id: 'moderate',
        name: 'Moderate Policy',
        description: 'Hedge 30-70% using forwards or options.',
        detail: 'The board permits both forwards and options but requires hedge ratios between 30% and 70%. Option premiums must not exceed 3% of notional per quarter. Bank diversification required for trades over €5M.',
        minHedgeRatio: 0.30,
        maxHedgeRatio: 0.70,
        requiredProducts: ['forward', 'option'],
        rules: ['Forwards and options permitted', 'Hedge ratio must be 30-70%', 'Option premiums capped at 3% of notional', 'Diversify banks for large trades'],
        difficulty: 'normal'
    },
    {
        id: 'rigorous',
        name: 'Rigorous Policy',
        description: 'Hedge 70-100% of exposures. Quarterly rolling programme mandatory.',
        detail: 'Strict rolling hedging programme. All exposures must be hedged between 70-100%. Forwards required for core hedging. Options only permitted for tail risk (max 20% of total hedge book). Minimum 2 bank counterparties. No single bank to exceed 60% of total exposure.',
        minHedgeRatio: 0.70,
        maxHedgeRatio: 1.00,
        requiredProducts: ['forward'],
        rules: ['Hedge ratio must be 70-100%', 'Forwards required for core programme', 'Options max 20% of total hedge book', 'Minimum 2 bank counterparties', 'No single bank >60% of exposure', 'Monthly compliance reporting'],
        difficulty: 'hard'
    },
    {
        id: 'pe_mandate',
        name: 'PE Board Mandate',
        description: 'Hedge 80-100%. No options. Minimise premium spend. Zero tolerance.',
        detail: 'The PE partners mandate maximum hedging with minimum cost. All exposures must be hedged 80-100% using forwards or swaps only. Option premiums are explicitly prohibited. No speculation. Any deviation requires prior board approval.',
        minHedgeRatio: 0.80,
        maxHedgeRatio: 1.00,
        requiredProducts: ['forward', 'swap'],
        rules: ['Hedge ratio must be 80-100%', 'Forwards and swaps only — options prohibited', 'Zero premium spend tolerance', 'No speculative positions', 'Prior board approval for any deviation', 'Weekly reporting to PE partners'],
        difficulty: 'very_hard'
    }
];

export const QUARTER_NAMES = ['Q1', 'Q2', 'Q3', 'Q4'];

export const PHASE = {
    SETUP: 'setup',
    DECISION: 'decision',
    RESOLUTION: 'resolution',
    EVENT: 'event',
    BOARD: 'board',
    SUMMARY: 'summary',
    EXTEND: 'extend',
    LEVEL_COMPLETE: 'level_complete',
    GAMEOVER: 'gameover'
};
