// Notifications system
const Notifications = {
    container: null,

    init() {
        this.container = document.getElementById("notifications");
    },

    show(message, type = "info", duration = 4000) {
        const notif = document.createElement("div");
        notif.className = `notification notif-${type}`;

        const icons = {
            success: "\u2705",
            error: "\u274C",
            warning: "\u26A0\uFE0F",
            info: "\u{1F4AC}",
            diplomacy: "\u{1F91D}",
            battle: "\u2694\uFE0F"
        };

        notif.innerHTML = `
            <span class="notif-icon">${icons[type] || icons.info}</span>
            <span class="notif-message">${message}</span>
            <button class="notif-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        this.container.appendChild(notif);

        // Animate in
        requestAnimationFrame(() => notif.classList.add("show"));

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notif.classList.remove("show");
                setTimeout(() => notif.remove(), 300);
            }, duration);
        }
    }
};
