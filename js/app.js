// Main Application - Initialization and coordination
const App = {
    countdownInterval: null,

    init() {
        // Initialize game state
        GameState.init();

        // Initialize UI components
        Notifications.init();
        MapRenderer.init();
        MapInteraction.init();
        Panels.init();
        Dashboard.init();
        HistoryLog.init();
        Admin.init();

        // Update all UI
        this.updateUI();

        // Populate clan selector
        this.updateClanSelector();

        // Clan selector change
        document.getElementById("clan-selector").addEventListener("change", (e) => {
            GameState.selectedClan = e.target.value || null;
            GameState.save();
            MapRenderer.update();
            this.updateUI();
        });

        // Restore selected clan
        if (GameState.selectedClan) {
            document.getElementById("clan-selector").value = GameState.selectedClan;
        }

        // Start countdown timer
        this.startCountdown();

        // Render legend
        this.renderLegend();

        // Initial map render
        MapRenderer.update();

        console.log("Shogunate Map initialized!");
    },

    updateUI() {
        // Phase badge
        const badge = document.getElementById("phase-badge");
        badge.textContent = GameState.phase === "planning" ? "Planning Phase" : "Battle Phase";
        badge.className = GameState.phase === "planning" ? "phase-planning" : "phase-battle";

        // Week display
        document.getElementById("week-display").textContent = `Week ${GameState.week}`;

        // Update legend
        this.renderLegend();
    },

    updateClanSelector() {
        const select = document.getElementById("clan-selector");
        const current = select.value;
        select.innerHTML = '<option value="">Select Clan...</option>' +
            Object.values(GameState.clans)
                .map(c => `<option value="${c.id}" style="color:${c.color}">${c.japaneseName} ${c.name}</option>`)
                .join("");
        if (current && GameState.clans[current]) {
            select.value = current;
        }
    },

    startCountdown() {
        const update = () => {
            const deadline = GameState.getDeadline();
            const now = new Date();
            const diff = deadline - now;

            if (diff <= 0) {
                document.getElementById("countdown-value").textContent = "DEADLINE PASSED";
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            let display = "";
            if (days > 0) display += `${days}d `;
            display += `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

            document.getElementById("countdown-value").textContent = display;
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
    },

    renderLegend() {
        const list = document.getElementById("legend-list");
        list.innerHTML = Object.values(GameState.clans).map(c => {
            const provinces = GameState.getOwnedProvinces(c.id).length;
            const troops = GameState.getTotalTroops(c.id);
            const isSelected = c.id === GameState.selectedClan;
            return `
                <div class="legend-entry ${isSelected ? 'selected' : ''}"
                     onclick="document.getElementById('clan-selector').value='${c.id}';
                              document.getElementById('clan-selector').dispatchEvent(new Event('change'))">
                    <span class="legend-color" style="background:${c.color}"></span>
                    <span class="legend-name">${c.japaneseName} ${c.name}</span>
                    <span class="legend-stats">${provinces}P ${troops}T</span>
                </div>
            `;
        }).join("");
    }
};

// Boot up when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
