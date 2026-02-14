// Main Application - Initialization and coordination
const OVERLAY_PANEL_IDS = ["dashboard-panel", "history-panel", "admin-panel", "faq-panel"];

function closeAllOverlays(exceptId) {
    OVERLAY_PANEL_IDS.forEach(id => {
        if (id !== exceptId) {
            document.getElementById(id).classList.add("hidden");
        }
    });
    // Also close the province side panel + clan panel unless keeping them
    if (exceptId !== "side-panel") {
        document.getElementById("side-panel").classList.add("hidden");
        ClanPanel.hide();
        if (MapInteraction.selectedProvince) {
            MapRenderer.highlightProvince(MapInteraction.selectedProvince, false);
            MapInteraction.selectedProvince = null;
        }
    }
}

const App = {
    countdownInterval: null,

    init() {
        // Initialize game state
        GameState.init();

        // Fetch Roblox avatars (async, non-blocking)
        RobloxAvatar.fetchAll();

        // Initialize UI components
        Notifications.init();
        MapRenderer.init();
        MapInteraction.init();
        Panels.init();
        ClanPanel.init();
        Dashboard.init();
        HistoryLog.init();
        Admin.init();
        FAQ.init();

        // Update all UI
        this.updateUI();

        // Initialize auth (Discord login - sets selectedClan from account)
        Auth.init();

        // Start countdown timer
        this.startCountdown();

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
    }
};

// Boot up when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
