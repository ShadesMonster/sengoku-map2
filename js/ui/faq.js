// FAQ - How to Play overlay
const FAQ = {
    init() {
        document.getElementById("btn-faq").addEventListener("click", () => this.toggle());
        document.querySelector("#faq-panel .overlay-close").addEventListener("click", () => {
            document.getElementById("faq-panel").classList.add("hidden");
        });
    },

    toggle() {
        const panel = document.getElementById("faq-panel");
        const wasHidden = panel.classList.contains("hidden");
        closeAllOverlays("faq-panel");
        if (wasHidden) {
            panel.classList.remove("hidden");
            this.render();
        } else {
            panel.classList.add("hidden");
        }
    },

    render() {
        document.getElementById("faq-content").innerHTML = `
            <div class="faq-section">
                <h3>Basics</h3>
                <p><strong>Select your clan</strong> from the dropdown in the top bar. Click any province on the map to see its details.</p>
                <p>The game runs in <strong>weekly turns</strong>. Each week has a <strong>Planning Phase</strong> where you issue orders, then the admin advances the week to resolve everything.</p>
            </div>

            <div class="faq-section">
                <h3>Ashigaru (Troops)</h3>
                <p>Each clan starts with <strong>6,000 ashigaru</strong> at their home province. Troops are the soldiers you command.</p>
                <p><strong>Raise Levy</strong> in provinces you own to recruit more, up to your <strong>Rally Cap</strong>. Troops must be raised in units of 100.</p>
                <p>1 ashigaru = 1 soldier on the map. 100 ashigaru = 1 man (player).</p>
            </div>

            <div class="faq-section">
                <h3>Moving Armies</h3>
                <p>Click a province with your troops, then <strong>Move Army</strong>. Pick a neighbouring province and how many to send.</p>
                <p><strong>Pending orders</strong> (yellow dashes) can be changed. <strong>Committed orders</strong> (green) are locked in.</p>
                <p>Movement happens when the admin advances the week.</p>
            </div>

            <div class="faq-section">
                <h3>Claiming Land</h3>
                <p><strong>Unclaimed</strong> land: your army moves in and claims it automatically.</p>
                <p><strong>Undefended enemy</strong> land: your army takes it without a fight.</p>
                <p><strong>Defended enemy</strong> land: a battle is created for the admin to resolve.</p>
            </div>

            <div class="faq-section">
                <h3>Battles</h3>
                <p>When armies clash, a battle is created. The admin decides who wins based on the RP.</p>
                <p><strong>Casualties scale with the force ratio</strong>:</p>
                <ul>
                    <li>Winner takes light casualties (1-30% depending on how outnumbered)</li>
                    <li>Loser takes heavy casualties (40-100% depending on how outmatched)</li>
                    <li>A small force vs a huge army may lose everything</li>
                </ul>
                <p><strong>Battle types</strong>: Castle Siege (home province), Field/Village/Mountain (terrain-based), or Sanryo Battleground (multi-clan collisions).</p>
            </div>

            <div class="faq-section">
                <h3>Retreating</h3>
                <p>Surviving losers <strong>retreat</strong> toward the nearest allied territory over <strong>2 weeks</strong>.</p>
                <p>Retreating armies are shown with a flag icon and a dashed arrow pointing to their destination.</p>
                <p><strong>Retreating armies cannot be attacked.</strong> They arrive at their destination and become available again after 2 weeks.</p>
            </div>

            <div class="faq-section">
                <h3>Casualties & Recovery</h3>
                <p>Troops killed in battle enter a <strong>recovery pool</strong>. They count against your Rally Cap but can't be used.</p>
                <p>Each week, <strong>50%</strong> of recovering troops become available to raise again.</p>
            </div>

            <div class="faq-section">
                <h3>Multi-Clan Battles (Brackets)</h3>
                <p>When 3+ hostile groups collide at one province, a <strong>bracket tournament</strong> begins:</p>
                <ul>
                    <li>Random pairing: 2 groups fight, others wait</li>
                    <li>Winner (with casualties) fights the next group</li>
                    <li>Province owner gets a bye and fights the bracket winner last</li>
                </ul>
            </div>

            <div class="faq-section">
                <h3>Marriage Alliances</h3>
                <p>Click a clan on the map to view their family. Select a character to propose marriages. Both clans must agree.</p>
                <p>Allied clans can <strong>reinforce</strong> each other in battle and share territory for retreats.</p>
                <p>Alliances can be dissolved from the clan panel.</p>
            </div>

            <div class="faq-section">
                <h3>Map Legend</h3>
                <p>Bottom-left shows all clans with their province count and ashigaru total. Click a clan on the map to view their details.</p>
            </div>
        `;
    }
};
