// ============================================================
// Sengoku Map API Routes (Express Router)
//
// Drop this file into your Discord bot project and register it:
//
//   const sengokuRoutes = require('./sengokuRoutes');
//   app.use('/api/sengoku', sengokuRoutes(mysqlPool));
//
// Requires: mysql2 (your bot likely already has this)
//           node-fetch or built-in fetch (Node 18+)
//
// Endpoints:
//   GET    /families              - All clan families (leaders + children)
//   GET    /families?clan=oda     - One clan's family
//   POST   /families              - Add a child
//   PUT    /families              - Update a child
//   DELETE /families?id=123       - Remove a child
//   GET    /marriages             - All active marriages + proposals
//   GET    /marriages?clan=oda    - Marriages for one clan
//   POST   /marriages             - Propose marriage
//   PUT    /marriages             - Accept / reject / dissolve
//   GET    /avatars?userIds=1,2   - Roblox avatar proxy (CORS fix)
// ============================================================

const express = require('express');

// Frontend clan keys
const FRONTEND_KEYS = [
    'oda', 'takeda', 'uesugi', 'tokugawa', 'mori',
    'shimazu', 'hojo', 'chosokabe', 'date', 'imagawa'
];

module.exports = function createSengokuRouter(pool) {
    const router = express.Router();

    // ---- CORS middleware ----
    router.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });

    // JSON body parsing
    router.use(express.json());

    // ============================================================
    // Clan mapping helpers (cached per request cycle)
    // ============================================================

    let clanMapCache = null;
    let clanMapExpiry = 0;
    const CACHE_TTL = 60000; // 1 minute

    async function getClanMap() {
        const now = Date.now();
        if (clanMapCache && now < clanMapExpiry) return clanMapCache;

        const [rows] = await pool.query('SELECT clan_id, name FROM roblox_clans');
        const map = {};
        for (const row of rows) {
            const dbName = row.name.toLowerCase().trim();
            for (const key of FRONTEND_KEYS) {
                if (dbName === key || dbName.startsWith(key)) {
                    map[key] = row.clan_id;
                    break;
                }
            }
        }
        clanMapCache = map;
        clanMapExpiry = now + CACHE_TTL;
        return map;
    }

    async function getReverseMap() {
        const map = await getClanMap();
        const rev = {};
        for (const [key, id] of Object.entries(map)) {
            rev[id] = key;
        }
        return rev;
    }

    async function clanKeyToId(key) {
        const map = await getClanMap();
        return map[key] || null;
    }

    async function clanIdToKey(id) {
        const rev = await getReverseMap();
        return rev[id] || null;
    }

    // ============================================================
    // GET /families  |  GET /families?clan=oda
    // ============================================================
    router.get('/families', async (req, res) => {
        try {
            const clanKey = req.query.clan || null;

            if (clanKey) {
                const family = await getClanFamily(clanKey);
                if (!family) return res.status(404).json({ error: 'Clan not found: ' + clanKey });
                return res.json(family);
            }

            // All clans
            const map = await getClanMap();
            const families = {};
            for (const key of Object.keys(map)) {
                const fam = await getClanFamily(key);
                if (fam) families[key] = fam;
            }
            res.json({ families });
        } catch (err) {
            console.error('[Sengoku] GET /families error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    async function getClanFamily(clanKey) {
        const dbClanId = await clanKeyToId(clanKey);
        if (!dbClanId) return null;

        // Leader from roblox_clans
        const [clanRows] = await pool.query(
            'SELECT clan_id, name, icon, daimyo_user_id, daimyo_username, daimyo_rp_name FROM roblox_clans WHERE clan_id = ?',
            [dbClanId]
        );
        if (!clanRows.length) return null;
        const clan = clanRows[0];

        let leader = null;
        if (clan.daimyo_user_id) {
            const rpName = clan.daimyo_rp_name;
            const username = clan.daimyo_username;
            const isImperial = clan.name && clan.name.toLowerCase() === 'imperial court';
            leader = {
                name: rpName || username || (isImperial ? 'Emperor' : 'Daimyo'),
                robloxId: Number(clan.daimyo_user_id),
                title: isImperial ? 'Emperor' : ('Daimyo of ' + clan.name),
            };
        }

        // Children from roblox_clan_families
        const [childRows] = await pool.query(
            'SELECT * FROM roblox_clan_families WHERE clan_id = ? ORDER BY display_order ASC, id ASC',
            [dbClanId]
        );

        const children = childRows.map(row => ({
            id: 'db_' + row.id,
            name: row.character_name,
            gender: row.gender,
            robloxId: row.roblox_user_id ? Number(row.roblox_user_id) : null,
            dbId: row.id,
        }));

        return {
            leader,
            children,
            icon: clan.icon || null,
        };
    }

    // ============================================================
    // POST /families  -  Add a child
    // ============================================================
    router.post('/families', async (req, res) => {
        try {
            const { clan, roblox_user_id, character_name, gender } = req.body;

            if (!clan || !character_name || !gender) {
                return res.status(400).json({ error: 'Required: clan, character_name, gender' });
            }

            const dbClanId = await clanKeyToId(clan);
            if (!dbClanId) return res.status(400).json({ error: 'Unknown clan: ' + clan });

            if (!['male', 'female'].includes(gender)) {
                return res.status(400).json({ error: 'Gender must be "male" or "female"' });
            }

            // Verify clan membership if roblox_user_id provided
            if (roblox_user_id) {
                const [memberRows] = await pool.query(
                    'SELECT 1 FROM roblox_clan_members WHERE user_id = ? AND clan_id = ?',
                    [roblox_user_id, dbClanId]
                );
                if (!memberRows.length) {
                    return res.status(403).json({
                        error: 'Roblox user ' + roblox_user_id + ' is not a member of this clan. They must join the clan first.'
                    });
                }
            }

            // Next display order
            const [orderRows] = await pool.query(
                'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM roblox_clan_families WHERE clan_id = ?',
                [dbClanId]
            );
            const nextOrder = orderRows[0].next_order;

            const [result] = await pool.query(
                "INSERT INTO roblox_clan_families (clan_id, roblox_user_id, character_name, role, gender, display_order) VALUES (?, ?, ?, 'child', ?, ?)",
                [dbClanId, roblox_user_id || null, character_name, gender, nextOrder]
            );

            res.json({
                success: true,
                id: result.insertId,
                message: character_name + ' added to ' + clan + ' family'
            });
        } catch (err) {
            console.error('[Sengoku] POST /families error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    // ============================================================
    // PUT /families  -  Update a child
    // ============================================================
    router.put('/families', async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: 'Missing id' });

            const [existing] = await pool.query(
                'SELECT * FROM roblox_clan_families WHERE id = ?', [id]
            );
            if (!existing.length) return res.status(404).json({ error: 'Family member not found' });

            const member = existing[0];
            const newRobloxId = req.body.roblox_user_id !== undefined ? req.body.roblox_user_id : member.roblox_user_id;

            // Verify clan membership if changing roblox_user_id
            if (newRobloxId && newRobloxId != member.roblox_user_id) {
                const [memberRows] = await pool.query(
                    'SELECT 1 FROM roblox_clan_members WHERE user_id = ? AND clan_id = ?',
                    [newRobloxId, member.clan_id]
                );
                if (!memberRows.length) {
                    return res.status(403).json({ error: 'Roblox user ' + newRobloxId + ' is not a member of this clan' });
                }
            }

            await pool.query(
                'UPDATE roblox_clan_families SET character_name = ?, roblox_user_id = ?, gender = ? WHERE id = ?',
                [
                    req.body.character_name || member.character_name,
                    newRobloxId,
                    req.body.gender || member.gender,
                    id
                ]
            );

            res.json({ success: true, message: 'Family member updated' });
        } catch (err) {
            console.error('[Sengoku] PUT /families error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    // ============================================================
    // DELETE /families?id=123  -  Remove a child
    // ============================================================
    router.delete('/families', async (req, res) => {
        try {
            const id = parseInt(req.query.id);
            if (!id) return res.status(400).json({ error: 'Missing id parameter' });

            // Check active marriage
            const [marriageRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE (person1_id = ? OR person2_id = ?) AND status = 'accepted'",
                [id, id]
            );
            if (marriageRows.length) {
                return res.status(409).json({ error: 'Cannot remove: dissolve the marriage first' });
            }

            const [result] = await pool.query('DELETE FROM roblox_clan_families WHERE id = ?', [id]);
            res.json({ success: true, deleted: result.affectedRows > 0 });
        } catch (err) {
            console.error('[Sengoku] DELETE /families error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    // ============================================================
    // GET /marriages  |  GET /marriages?clan=oda
    // ============================================================
    router.get('/marriages', async (req, res) => {
        try {
            const clanKey = req.query.clan || null;

            let query = `
                SELECT m.*,
                       p1.character_name as person1_name, p1.gender as person1_gender,
                       p1.roblox_user_id as person1_roblox, p1.clan_id as person1_clan_db_id,
                       p2.character_name as person2_name, p2.gender as person2_gender,
                       p2.roblox_user_id as person2_roblox, p2.clan_id as person2_clan_db_id
                FROM roblox_clan_marriages m
                JOIN roblox_clan_families p1 ON p1.id = m.person1_id
                JOIN roblox_clan_families p2 ON p2.id = m.person2_id
                WHERE m.status IN ('proposed', 'accepted')
            `;
            const params = [];

            if (clanKey) {
                const dbClanId = await clanKeyToId(clanKey);
                if (!dbClanId) return res.status(400).json({ error: 'Unknown clan' });
                query += ' AND (m.clan1_id = ? OR m.clan2_id = ?)';
                params.push(dbClanId, dbClanId);
            }

            query += " ORDER BY m.status = 'accepted' DESC, m.created_at DESC";

            const [rows] = await pool.query(query, params);

            const alliances = [];
            const proposals = [];

            for (const row of rows) {
                const entry = await formatMarriage(row);
                if (row.status === 'accepted') {
                    alliances.push(entry);
                } else {
                    proposals.push(entry);
                }
            }

            res.json({ alliances, proposals });
        } catch (err) {
            console.error('[Sengoku] GET /marriages error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    async function formatMarriage(row) {
        return {
            id: row.id,
            status: row.status,
            clan1: await clanIdToKey(row.clan1_id),
            clan2: await clanIdToKey(row.clan2_id),
            proposed_by: await clanIdToKey(row.proposed_by_clan_id),
            person1: {
                id: row.person1_id,
                name: row.person1_name,
                gender: row.person1_gender,
                robloxId: row.person1_roblox ? Number(row.person1_roblox) : null,
                clan: await clanIdToKey(row.person1_clan_db_id),
            },
            person2: {
                id: row.person2_id,
                name: row.person2_name,
                gender: row.person2_gender,
                robloxId: row.person2_roblox ? Number(row.person2_roblox) : null,
                clan: await clanIdToKey(row.person2_clan_db_id),
            },
            created_at: row.created_at,
        };
    }

    // ============================================================
    // POST /marriages  -  Propose a marriage
    // ============================================================
    router.post('/marriages', async (req, res) => {
        try {
            const { person1_id, person2_id, proposed_by } = req.body;

            if (!person1_id || !person2_id || !proposed_by) {
                return res.status(400).json({ error: 'Missing: person1_id, person2_id, proposed_by' });
            }

            const proposedByDbId = await clanKeyToId(proposed_by);
            if (!proposedByDbId) return res.status(400).json({ error: 'Unknown clan: ' + proposed_by });

            // Fetch both persons
            const [persons] = await pool.query(
                'SELECT * FROM roblox_clan_families WHERE id IN (?, ?)',
                [person1_id, person2_id]
            );
            if (persons.length !== 2) {
                return res.status(404).json({ error: 'One or both persons not found' });
            }

            const p1 = persons.find(p => p.id == person1_id);
            const p2 = persons.find(p => p.id == person2_id);

            // Can't marry within same clan
            if (p1.clan_id === p2.clan_id) {
                return res.status(400).json({ error: 'Cannot marry within the same clan' });
            }

            // Check neither already married/proposed
            const [marriedRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE (person1_id IN (?, ?) OR person2_id IN (?, ?)) AND status IN ('proposed', 'accepted')",
                [person1_id, person2_id, person1_id, person2_id]
            );
            if (marriedRows.length) {
                return res.status(409).json({ error: 'One or both persons already have a pending or active marriage' });
            }

            // Check no existing alliance between these clans
            const [allianceRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE ((clan1_id = ? AND clan2_id = ?) OR (clan1_id = ? AND clan2_id = ?)) AND status = 'accepted'",
                [p1.clan_id, p2.clan_id, p2.clan_id, p1.clan_id]
            );
            if (allianceRows.length) {
                return res.status(409).json({ error: 'These clans are already allied through marriage' });
            }

            const [result] = await pool.query(
                "INSERT INTO roblox_clan_marriages (person1_id, person2_id, clan1_id, clan2_id, status, proposed_by_clan_id) VALUES (?, ?, ?, ?, 'proposed', ?)",
                [person1_id, person2_id, p1.clan_id, p2.clan_id, proposedByDbId]
            );

            res.json({
                success: true,
                id: result.insertId,
                message: 'Marriage proposed'
            });
        } catch (err) {
            console.error('[Sengoku] POST /marriages error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    // ============================================================
    // PUT /marriages  -  Accept / reject / dissolve
    // ============================================================
    router.put('/marriages', async (req, res) => {
        try {
            const { id, action } = req.body;
            if (!id || !action) {
                return res.status(400).json({ error: 'Missing: id, action (accept/reject/dissolve)' });
            }

            const [rows] = await pool.query('SELECT * FROM roblox_clan_marriages WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Marriage not found' });

            const marriage = rows[0];

            switch (action) {
                case 'accept':
                    if (marriage.status !== 'proposed') {
                        return res.status(400).json({ error: 'Can only accept proposals' });
                    }
                    await pool.query(
                        "UPDATE roblox_clan_marriages SET status = 'accepted', resolved_at = NOW() WHERE id = ?", [id]
                    );
                    return res.json({ success: true, message: 'Marriage accepted - alliance formed' });

                case 'reject':
                    if (marriage.status !== 'proposed') {
                        return res.status(400).json({ error: 'Can only reject proposals' });
                    }
                    await pool.query(
                        "UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?", [id]
                    );
                    return res.json({ success: true, message: 'Marriage proposal rejected' });

                case 'dissolve':
                    if (marriage.status !== 'accepted') {
                        return res.status(400).json({ error: 'Can only dissolve accepted marriages' });
                    }
                    await pool.query(
                        "UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?", [id]
                    );
                    return res.json({ success: true, message: 'Marriage dissolved - alliance broken' });

                default:
                    return res.status(400).json({ error: 'Invalid action. Use: accept, reject, dissolve' });
            }
        } catch (err) {
            console.error('[Sengoku] PUT /marriages error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    // ============================================================
    // GET /avatars?userIds=9003341,12345  -  Roblox avatar proxy
    // ============================================================
    router.get('/avatars', async (req, res) => {
        try {
            const userIds = req.query.userIds || '';
            if (!userIds) return res.status(400).json({ error: 'Missing userIds parameter' });

            // Sanitize: only allow comma-separated numbers
            if (!/^[0-9,]+$/.test(userIds)) {
                return res.status(400).json({ error: 'Invalid userIds format' });
            }

            const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=150x150&format=Png&isCircular=false`;

            // Use built-in fetch (Node 18+) or fall back to node-fetch
            let fetchFn;
            if (typeof fetch !== 'undefined') {
                fetchFn = fetch;
            } else {
                try { fetchFn = require('node-fetch'); } catch (e) {
                    return res.status(500).json({ error: 'No fetch available. Install node-fetch or use Node 18+.' });
                }
            }

            const response = await fetchFn(url, {
                headers: { 'Accept': 'application/json' },
                timeout: 10000,
            });

            const data = await response.json();
            res.status(response.status).json(data);
        } catch (err) {
            console.error('[Sengoku] GET /avatars error:', err);
            res.status(502).json({ error: 'Failed to reach Roblox API: ' + err.message });
        }
    });

    // ============================================================
    // GET /clans  -  All clans from roblox_clans (name, description, daimyo)
    // ============================================================
    router.get('/clans', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT clan_id, name, icon, description,
                       daimyo_user_id, daimyo_username, daimyo_rp_name, daimyo_last_seen,
                       discord_role_id
                FROM roblox_clans
                ORDER BY name ASC
            `);

            const clans = rows.map(row => ({
                clanId: row.clan_id,
                name: row.name,
                icon: row.icon || null,
                description: row.description || null,
                daimyo: row.daimyo_user_id ? {
                    robloxId: Number(row.daimyo_user_id),
                    username: row.daimyo_username,
                    rpName: row.daimyo_rp_name,
                    lastSeen: row.daimyo_last_seen ? Number(row.daimyo_last_seen) : null,
                } : null,
            }));

            res.json({ clans });
        } catch (err) {
            console.error('[Sengoku] GET /clans error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    });

    return router;
};
