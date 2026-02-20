// War Panel - "Battles This Week" public display
// Shows upcoming, active, and recently completed wars with live scores

const WarPanel = {
    _wars: [],
    _liveScores: {},
    _lastFetch: 0,
    _refreshInterval: null,

    init() {
        const btn = document.getElementById("btn-wars");
        const panel = document.getElementById("wars-panel");
        if (!btn || !panel) return;

        btn.addEventListener("click", () => {
            panel.classList.toggle("hidden");
            if (!panel.classList.contains("hidden")) {
                this._fetchAndRender();
            }
        });

        panel.querySelector(".overlay-close").addEventListener("click", () => {
            panel.classList.add("hidden");
        });
    },

    async refresh() {
        // Only refresh if panel is visible and enough time has passed (15s)
        const panel = document.getElementById("wars-panel");
        if (!panel || panel.classList.contains("hidden")) return;
        if (Date.now() - this._lastFetch < 15000) return;
        await this._fetchAndRender();
    },

    async _fetchAndRender() {
        if (!API.enabled) return;
        this._lastFetch = Date.now();

        try {
            const data = await API.getWarsThisWeek();
            if (!data || !data.wars) return;
            this._wars = data.wars;

            // Fetch live scores for active wars
            const activeWars = this._wars.filter(w => w.status === "active");
            for (const war of activeWars) {
                try {
                    const scoreData = await API.getWarLiveScore(war.id);
                    if (scoreData && scoreData.live && scoreData.score) {
                        this._liveScores[war.id] = scoreData.score;
                    } else {
                        delete this._liveScores[war.id];
                    }
                } catch (e) { /* ignore */ }
            }

            this._render();
        } catch (err) {
            console.warn("[WarPanel] Failed to fetch wars:", err.message);
        }
    },

    _render() {
        const container = document.getElementById("wars-list");
        if (!container) return;

        if (this._wars.length === 0) {
            container.innerHTML = '<div class="war-empty">No battles this week.</div>';
            return;
        }

        // Group by status
        const active = this._wars.filter(w => w.status === "active");
        const scheduled = this._wars.filter(w => w.status === "scheduled");
        const pending = this._wars.filter(w => w.status === "pending");
        const completed = this._wars.filter(w => w.status === "completed");

        let html = "";

        if (active.length > 0) {
            html += '<div class="war-section"><h3 class="war-section-title active-title">LIVE</h3>';
            active.forEach(w => { html += this._renderWar(w); });
            html += "</div>";
        }

        if (scheduled.length > 0) {
            html += '<div class="war-section"><h3 class="war-section-title scheduled-title">Scheduled</h3>';
            scheduled.forEach(w => { html += this._renderWar(w); });
            html += "</div>";
        }

        if (pending.length > 0) {
            html += '<div class="war-section"><h3 class="war-section-title pending-title">Awaiting Schedule</h3>';
            pending.forEach(w => { html += this._renderWar(w); });
            html += "</div>";
        }

        if (completed.length > 0) {
            html += '<div class="war-section"><h3 class="war-section-title completed-title">Completed</h3>';
            completed.forEach(w => { html += this._renderWar(w); });
            html += "</div>";
        }

        container.innerHTML = html;
    },

    _renderWar(war) {
        const wd = war.warData || {};
        const sides = wd.activeSides || wd.sides || [];

        // Get display names for the sides
        const sideNames = this._getSideNames(sides);
        const province = wd.provinceName || war.provinceId || "Unknown";
        const battleType = wd.battleType || "Battle";
        const isBracket = wd.isBracket || false;

        let html = '<div class="war-card war-' + war.status + '">';

        // Status indicator
        html += '<div class="war-card-header">';
        html += '<span class="war-status-badge ' + war.status + '">' + this._statusLabel(war.status) + '</span>';
        if (isBracket) html += '<span class="war-bracket-badge">Bracket</span>';
        html += '<span class="war-province">' + province + '</span>';
        html += '</div>';

        // Sides display
        html += '<div class="war-sides">';
        if (sideNames.length >= 2) {
            html += '<span class="war-side side-1">' + sideNames[0] + '</span>';
            html += '<span class="war-vs">vs</span>';
            html += '<span class="war-side side-2">' + sideNames[1] + '</span>';
        } else if (sideNames.length === 1) {
            html += '<span class="war-side">' + sideNames[0] + '</span>';
        }
        html += '</div>';

        // Troop counts
        const troops = this._getTroopCounts(sides);
        if (troops.length >= 2) {
            html += '<div class="war-troops">';
            html += '<span>' + troops[0] + ' troops</span>';
            html += '<span>' + troops[1] + ' troops</span>';
            html += '</div>';
        }

        // Live score for active wars
        if (war.status === "active" && this._liveScores[war.id]) {
            const score = this._liveScores[war.id];
            html += this._renderLiveScore(score, sideNames);
        }

        // Schedule info
        if (war.scheduledAt && (war.status === "scheduled" || war.status === "pending")) {
            const date = new Date(war.scheduledAt);
            html += '<div class="war-schedule">';
            html += '<span class="war-date">' + this._formatDate(date) + '</span>';
            html += '<span class="war-countdown">' + this._countdown(date) + '</span>';
            html += '</div>';
        }

        // Result for completed wars
        if (war.status === "completed" && war.result) {
            html += '<div class="war-result">';
            html += '<span class="war-winner">Winner: ' + (war.result.winner || "Unknown") + '</span>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderLiveScore(score, sideNames) {
        const meter = score.meter || 0;
        const maxMeter = score.maxMeter || 1800;
        // Normalize to 0-100% (meter goes from -max to +max)
        const pct = ((meter + maxMeter) / (2 * maxMeter)) * 100;
        const team1Name = sideNames[0] || "Team 1";
        const team2Name = sideNames[1] || "Team 2";

        let html = '<div class="war-live-score">';
        html += '<div class="war-score-labels">';
        html += '<span class="score-team1">' + team1Name + '</span>';
        html += '<span class="score-live-tag">LIVE</span>';
        html += '<span class="score-team2">' + team2Name + '</span>';
        html += '</div>';
        html += '<div class="war-score-bar">';
        html += '<div class="war-score-fill" style="width:' + pct.toFixed(1) + '%"></div>';
        html += '<div class="war-score-center"></div>';
        html += '</div>';
        html += '</div>';
        return html;
    },

    _getSideNames(sides) {
        // Group into at most 2 sides based on position
        // sides is a flat array of {name, clanId, troops} from activeSides or sides
        if (sides.length === 0) return [];
        if (sides.length === 1) return [sides[0].name || sides[0].clanId];
        if (sides.length === 2) return [
            sides[0].name || sides[0].clanId,
            sides[1].name || sides[1].clanId
        ];
        // More than 2 sides — group first half and second half
        const mid = Math.ceil(sides.length / 2);
        const side1 = sides.slice(0, mid).map(s => s.name || s.clanId).join(" & ");
        const side2 = sides.slice(mid).map(s => s.name || s.clanId).join(" & ");
        return [side1, side2];
    },

    _getTroopCounts(sides) {
        if (sides.length < 2) return [];
        const mid = Math.ceil(sides.length / 2);
        const t1 = sides.slice(0, mid).reduce((s, side) => s + (side.troops || 0), 0);
        const t2 = sides.slice(mid).reduce((s, side) => s + (side.troops || 0), 0);
        return [t1.toLocaleString(), t2.toLocaleString()];
    },

    _statusLabel(status) {
        switch (status) {
            case "active": return "LIVE";
            case "scheduled": return "Scheduled";
            case "pending": return "Pending";
            case "completed": return "Completed";
            default: return status;
        }
    },

    _formatDate(date) {
        const options = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
        return date.toLocaleDateString("en-GB", options);
    },

    _countdown(date) {
        const diff = date.getTime() - Date.now();
        if (diff <= 0) return "Starting soon";
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return "in " + days + "d " + (hours % 24) + "h";
        }
        return "in " + hours + "h " + mins + "m";
    }
};
