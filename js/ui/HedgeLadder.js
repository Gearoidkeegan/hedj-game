// HedgeLadder — multi-quarter hedge tenor grid UI
// Shows Q+1 through Q+8 coverage buckets with adjustable notional per tenor

export class HedgeLadder {
    /**
     * @param {HTMLElement} container - DOM element to render into
     * @param {Object} options
     * @param {Object} options.exposure - the exposure being hedged
     * @param {number} options.maxTenor - max forward quarters (default 8)
     * @param {Function} options.onChange - callback({ tenor, pct }) when user adjusts a bucket
     */
    constructor(container, options = {}) {
        this.container = container;
        this.exposure = options.exposure || null;
        this.maxTenor = options.maxTenor || 8;
        this.onChange = options.onChange || null;

        // Coverage per tenor bucket: { 1: 0.5, 2: 0.3, ... } = 50% Q+1, 30% Q+2 etc.
        this.buckets = {};
        for (let i = 1; i <= this.maxTenor; i++) {
            this.buckets[i] = 0;
        }

        // Currently selected tenor for trade execution
        this.selectedTenor = 1;
    }

    /**
     * Set existing hedge coverage per tenor (from active hedges).
     * @param {Object} existing - { tenor: ratio } e.g. { 1: 0.5, 2: 0.25 }
     */
    setExistingCoverage(existing) {
        for (let i = 1; i <= this.maxTenor; i++) {
            this.buckets[i] = existing[i] || 0;
        }
        this.render();
    }

    /**
     * Get the currently selected tenor and percentage.
     */
    getSelection() {
        return {
            tenor: this.selectedTenor,
            pct: this.buckets[this.selectedTenor] || 0
        };
    }

    /**
     * Get all bucket values.
     */
    getAllBuckets() {
        return { ...this.buckets };
    }

    render() {
        if (!this.container) return;

        const quarterlyNotional = this.exposure?.quarterlyNotional || 0;

        let html = `
            <div class="hedge-ladder">
                <div class="hedge-ladder-header">
                    <span class="pixel-text" style="font-size:7px;color:var(--text-secondary)">TENOR</span>
                    <span class="pixel-text" style="font-size:7px;color:var(--text-secondary)">COVERAGE</span>
                    <span class="pixel-text" style="font-size:7px;color:var(--text-secondary)">NOTIONAL</span>
                </div>
        `;

        for (let t = 1; t <= this.maxTenor; t++) {
            const pct = this.buckets[t] || 0;
            const pctDisplay = Math.round(pct * 100);
            const notional = quarterlyNotional * pct;
            const isSelected = t === this.selectedTenor;
            const barWidth = Math.min(100, pct * 100);

            // Color coding: green if covered, amber if partial, grey if none
            const barColor = pct >= 0.5 ? 'var(--pnl-positive)' : pct > 0 ? 'var(--gold)' : 'var(--border-inner)';

            html += `
                <div class="hedge-ladder-row ${isSelected ? 'selected' : ''}" data-tenor="${t}">
                    <span class="hedge-ladder-tenor">Q+${t}</span>
                    <div class="hedge-ladder-bar-container">
                        <div class="hedge-ladder-bar" style="width:${barWidth}%;background:${barColor};"></div>
                        <span class="hedge-ladder-pct">${pctDisplay}%</span>
                    </div>
                    <span class="hedge-ladder-notional">${this.formatCompact(notional)}</span>
                </div>
            `;
        }

        html += `
            </div>
            <div class="hedge-ladder-controls" style="margin-top:6px;">
                <div class="hedge-slider-label">
                    <span>Q+${this.selectedTenor} HEDGE</span>
                    <span class="hedge-slider-value" id="ladder-pct-label">${Math.round((this.buckets[this.selectedTenor] || 0) * 100)}%</span>
                </div>
                <input type="range" id="ladder-slider" min="0" max="100" value="${Math.round((this.buckets[this.selectedTenor] || 0) * 100)}" step="10">
            </div>
        `;

        this.container.innerHTML = html;
        this.bindEvents();
    }

    bindEvents() {
        // Row click to select tenor
        this.container.querySelectorAll('.hedge-ladder-row').forEach(row => {
            row.addEventListener('click', () => {
                this.selectedTenor = parseInt(row.dataset.tenor);
                this.render();
            });
        });

        // Slider to adjust selected tenor
        const slider = this.container.querySelector('#ladder-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value) / 100;
                this.buckets[this.selectedTenor] = pct;
                const label = this.container.querySelector('#ladder-pct-label');
                if (label) label.textContent = `${e.target.value}%`;

                // Update the bar in the row
                const row = this.container.querySelector(`.hedge-ladder-row[data-tenor="${this.selectedTenor}"]`);
                if (row) {
                    const bar = row.querySelector('.hedge-ladder-bar');
                    const pctSpan = row.querySelector('.hedge-ladder-pct');
                    const notionalSpan = row.querySelector('.hedge-ladder-notional');
                    if (bar) {
                        bar.style.width = `${Math.min(100, pct * 100)}%`;
                        bar.style.background = pct >= 0.5 ? 'var(--pnl-positive)' : pct > 0 ? 'var(--gold)' : 'var(--border-inner)';
                    }
                    if (pctSpan) pctSpan.textContent = `${e.target.value}%`;
                    if (notionalSpan) notionalSpan.textContent = this.formatCompact((this.exposure?.quarterlyNotional || 0) * pct);
                }

                if (this.onChange) {
                    this.onChange({ tenor: this.selectedTenor, pct });
                }
            });
        }
    }

    formatCompact(amount) {
        const abs = Math.abs(amount);
        if (abs >= 1e9) return `${(abs / 1e9).toFixed(1)}B`;
        if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)}M`;
        if (abs >= 1e3) return `${(abs / 1e3).toFixed(0)}K`;
        if (abs === 0) return '—';
        return abs.toFixed(0);
    }
}
