// History Log - Battle history, moves, diplomacy event viewer
const HistoryLog = {
    currentFilter: "all",

    init() {
        document.getElementById("btn-history").addEventListener("click", () => {
            this.toggle();
        });

        document.querySelector("#history-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("history-panel").classList.add("hidden");
        });

        // Filter buttons
        document.querySelectorAll("#history-filters .filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#history-filters .filter-btn").forEach(b =>
                    b.classList.remove("active"));
                btn.classList.add("active");
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });
    },

    toggle() {
        const panel = document.getElementById("history-panel");
        const wasHidden = panel.classList.contains("hidden");
        closeAllOverlays("history-panel");
        if (wasHidden) {
            panel.classList.remove("hidden");
            this.render();
        } else {
            panel.classList.add("hidden");
        }
    },

    render() {
        const list = document.getElementById("history-list");
        let entries = GameState.history;

        if (this.currentFilter !== "all") {
            entries = entries.filter(e => e.type === this.currentFilter);
        }

        if (entries.length === 0) {
            list.innerHTML = '<div class="empty-state">No events yet</div>';
            return;
        }

        list.innerHTML = entries.slice(0, 100).map(entry => {
            const icons = { battle: "\u2694\uFE0F", move: "\uD83C\uDFC3", diplomacy: "\uD83E\uDD1D", system: "\uD83D\uDCDC" };
            const time = new Date(entry.timestamp).toLocaleString();
            return `
                <div class="history-entry type-${entry.type}">
                    <span class="history-icon">${icons[entry.type] || "\uD83D\uDCDC"}</span>
                    <div class="history-content">
                        <div class="history-message">${entry.message}</div>
                        <div class="history-meta">Week ${entry.week} - ${entry.phase} - ${time}</div>
                    </div>
                </div>
            `;
        }).join("");
    }
};
