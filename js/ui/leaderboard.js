// Leaderboard & Stats Dashboard
// Shows clan rankings, territory %, military strength, and allows clicking clans to open family panel

const Leaderboard = {
    _visible: false,
    _replayWeek: null, // null = live, number = viewing that week's snapshot

    init() {
        const btn = document.getElementById("btn-leaderboard");
        const panel = document.getElementById("leaderboard-panel");
        if (!btn || !panel) return;

        btn.addEventListener("click", () => this.toggle());
        panel.querySelector(".overlay-close").addEventListener("click", () => this.hide());
    },

    toggle() {
        const panel = document.getElementById("leaderboard-panel");
        const wasHidden = panel.classList.contains("hidden");
        closeAllOverlays("leaderboard-panel");
        if (wasHidden) {
            panel.classList.remove("hidden");
            this._visible = true;
            this.render();
        } else {
            this.hide();
        }
    },

    hide() {
        const panel = document.getElementById("leaderboard-panel");
        if (panel) panel.classList.add("hidden");
        this._visible = false;
    },

    render() {
        const container = document.getElementById("leaderboard-content");
        if (!container) return;

        const clans = Object.values(GameState.clans);
        if (clans.length === 0) {
            container.innerHTML = '<div class="empty-state">No clans loaded</div>';
            return;
        }

        // Calculate stats for each clan
        const clanStats = clans.map(clan => {
            const clanId = clan.id;
            const ownedProvinces = GameState.getOwnedProvinces(clanId);
            const totalTroops = GameState.getTotalTroops(clanId);
            const allies = GameState.getAllies(clanId);
            const casualties = GameState.casualties[clanId] || 0;
            const totalProvinces = PROVINCES.length;
            const territoryPct = totalProvinces > 0 ? ((ownedProvinces.length / totalProvinces) * 100) : 0;

            // Count wars (battles from history involving this clan)
            const battles = GameState.history.filter(
                h => h.type === "battle" && h.message && h.message.toLowerCase().includes(clanId)
            ).length;

            return {
                clan,
                clanId,
                provinces: ownedProvinces.length,
                territoryPct,
                troops: totalTroops,
                allies: allies.length,
                casualties,
                battles,
                // Composite score: territory weight + military weight
                score: (ownedProvinces.length * 100) + totalTroops
            };
        });

        // Sort by score descending
        clanStats.sort((a, b) => b.score - a.score);

        let html = '';

        // Week replay controls
        html += this._renderReplayControls();

        // Leaderboard table
        html += '<div class="lb-table">';
        html += '<div class="lb-header-row">';
        html += '<span class="lb-col-rank">#</span>';
        html += '<span class="lb-col-clan">Clan</span>';
        html += '<span class="lb-col-prov">Provinces</span>';
        html += '<span class="lb-col-territory">Territory</span>';
        html += '<span class="lb-col-troops">Troops</span>';
        html += '<span class="lb-col-allies">Allies</span>';
        html += '</div>';

        clanStats.forEach((cs, idx) => {
            const rank = idx + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
            const barWidth = Math.min(cs.territoryPct, 100);

            html += `<div class="lb-row" data-clan="${cs.clanId}" onclick="Leaderboard.onClanClick('${cs.clanId}')" title="Click to view ${cs.clan.name} family">`;
            html += `<span class="lb-col-rank">${medal}</span>`;
            html += `<span class="lb-col-clan"><span class="lb-clan-color" style="background:${cs.clan.color}"></span>${cs.clan.name}</span>`;
            html += `<span class="lb-col-prov">${cs.provinces}</span>`;
            html += `<span class="lb-col-territory"><div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${barWidth}%;background:${cs.clan.color}"></div></div><span class="lb-pct">${cs.territoryPct.toFixed(1)}%</span></span>`;
            html += `<span class="lb-col-troops">${cs.troops.toLocaleString()}</span>`;
            html += `<span class="lb-col-allies">${cs.allies}</span>`;
            html += '</div>';
        });

        html += '</div>';

        // Summary stats
        const totalProvinces = PROVINCES.length;
        const claimedProvinces = Object.values(GameState.provinces).filter(p => p.owner).length;
        const unclaimedProvinces = totalProvinces - claimedProvinces;

        html += '<div class="lb-summary">';
        html += `<span>Week ${GameState.week}</span>`;
        html += `<span>${claimedProvinces}/${totalProvinces} provinces claimed</span>`;
        html += `<span>${unclaimedProvinces} unclaimed</span>`;
        html += '</div>';

        container.innerHTML = html;
    },

    _renderReplayControls() {
        const maxWeek = GameState.week;
        const currentWeek = this._replayWeek !== null ? this._replayWeek : maxWeek;
        const isLive = this._replayWeek === null;

        let html = '<div class="lb-replay-controls">';
        html += '<button class="lb-replay-btn" onclick="Leaderboard.replayPrev()" ' + (currentWeek <= 1 ? 'disabled' : '') + '>&laquo;</button>';
        html += `<span class="lb-replay-label">${isLive ? `Week ${maxWeek} (Live)` : `Week ${currentWeek}`}</span>`;
        html += '<button class="lb-replay-btn" onclick="Leaderboard.replayNext()" ' + (isLive ? 'disabled' : '') + '>&raquo;</button>';
        html += '<button class="lb-replay-btn lb-replay-live' + (isLive ? ' active' : '') + '" onclick="Leaderboard.replayLive()">Live</button>';
        html += '</div>';

        // Week-by-week history summary
        if (!isLive) {
            const weekEvents = GameState.history.filter(h => h.week === currentWeek);
            if (weekEvents.length > 0) {
                html += '<div class="lb-week-events">';
                html += `<div class="lb-week-events-title">Week ${currentWeek} Events</div>`;
                const shown = weekEvents.slice(0, 10);
                shown.forEach(e => {
                    const icons = { battle: "⚔️", move: "🏃", diplomacy: "🤝", system: "📜" };
                    html += `<div class="lb-event">${icons[e.type] || "📜"} ${e.message}</div>`;
                });
                if (weekEvents.length > 10) {
                    html += `<div class="lb-event-more">+${weekEvents.length - 10} more events</div>`;
                }
                html += '</div>';
            } else {
                html += `<div class="lb-week-events"><div class="lb-week-events-title">Week ${currentWeek}</div><div class="lb-event">No recorded events for this week.</div></div>`;
            }
        }

        return html;
    },

    onClanClick(clanId) {
        ClanPanel.show(clanId);
    },

    replayPrev() {
        const maxWeek = GameState.week;
        if (this._replayWeek === null) {
            this._replayWeek = maxWeek - 1;
        } else if (this._replayWeek > 1) {
            this._replayWeek--;
        }
        if (this._replayWeek < 1) this._replayWeek = 1;
        this.render();
    },

    replayNext() {
        if (this._replayWeek === null) return;
        this._replayWeek++;
        if (this._replayWeek >= GameState.week) {
            this._replayWeek = null;
        }
        this.render();
    },

    replayLive() {
        this._replayWeek = null;
        this.render();
    }
};
