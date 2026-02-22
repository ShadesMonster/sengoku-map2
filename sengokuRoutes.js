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
            const isImperial = !!clan.is_imperial;
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
            parentId: row.parent_id || null,
            title: row.title || null,
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
            const { clan, roblox_user_id, character_name, gender, parent_id } = req.body;

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

            // Validate parent_id if provided
            if (parent_id) {
                const [parentRows] = await pool.query(
                    'SELECT 1 FROM roblox_clan_families WHERE id = ? AND clan_id = ?',
                    [parent_id, dbClanId]
                );
                if (!parentRows.length) {
                    return res.status(400).json({ error: 'Parent not found in this clan' });
                }
            }

            const [result] = await pool.query(
                "INSERT INTO roblox_clan_families (clan_id, roblox_user_id, character_name, role, gender, display_order, parent_id) VALUES (?, ?, ?, 'child', ?, ?, ?)",
                [dbClanId, roblox_user_id || null, character_name, gender, nextOrder, parent_id || null]
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

            const newParentId = req.body.parent_id !== undefined ? req.body.parent_id : member.parent_id;

            await pool.query(
                'UPDATE roblox_clan_families SET character_name = ?, roblox_user_id = ?, gender = ?, parent_id = ? WHERE id = ?',
                [
                    req.body.character_name || member.character_name,
                    newRobloxId,
                    req.body.gender || member.gender,
                    newParentId,
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

    // ============================================================
    //  IN-GAME FAMILY ENDPOINTS
    //  Used by FamilyService.lua via HttpService
    // ============================================================

    // ---- API key auth middleware for in-game routes ----
    function requireApiKey(req, res, next) {
        const key = req.headers['x-api-key'];
        if (!key || key !== 'ShogunateRBX_k8m3p9x2v7n4j1q6') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    }

    // GET /ingame/family/:userId  -  Get a player's family tree
    router.get('/ingame/family/:userId', requireApiKey, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            if (!userId) return res.status(400).json({ success: false, error: 'Invalid userId' });

            // Check family_membership first
            const [membershipRows] = await pool.query(
                'SELECT fg.*, fm.family_member_id FROM roblox_family_membership fm JOIN roblox_family_groups fg ON fg.id = fm.family_group_id WHERE fm.roblox_user_id = ?',
                [userId]
            );

            if (!membershipRows.length) {
                return res.json({ success: true, family: null });
            }

            const group = membershipRows[0];
            const familyGroupId = group.id;

            // Get all members of this family
            const [members] = await pool.query(
                'SELECT * FROM roblox_clan_families WHERE family_group_id = ? ORDER BY display_order ASC, id ASC',
                [familyGroupId]
            );

            // Get marriages involving any member of this family
            const memberIds = members.map(m => m.id);
            let marriages = [];
            if (memberIds.length > 0) {
                const placeholders = memberIds.map(() => '?').join(',');
                const [marriageRows] = await pool.query(
                    `SELECT m.*,
                            p1.character_name as person1_name, p1.gender as person1_gender,
                            p1.roblox_user_id as person1_roblox, p1.family_group_id as person1_fg,
                            p2.character_name as person2_name, p2.gender as person2_gender,
                            p2.roblox_user_id as person2_roblox, p2.family_group_id as person2_fg
                     FROM roblox_clan_marriages m
                     JOIN roblox_clan_families p1 ON p1.id = m.person1_id
                     JOIN roblox_clan_families p2 ON p2.id = m.person2_id
                     WHERE (m.person1_id IN (${placeholders}) OR m.person2_id IN (${placeholders}))
                       AND m.status IN ('proposed', 'accepted')`,
                    [...memberIds, ...memberIds]
                );
                marriages = marriageRows.map(row => ({
                    id: row.id,
                    status: row.status,
                    person1: { id: row.person1_id, name: row.person1_name, gender: row.person1_gender, robloxId: row.person1_roblox ? Number(row.person1_roblox) : null, familyGroupId: row.person1_fg },
                    person2: { id: row.person2_id, name: row.person2_name, gender: row.person2_gender, robloxId: row.person2_roblox ? Number(row.person2_roblox) : null, familyGroupId: row.person2_fg },
                    created_at: row.created_at,
                }));
            }

            const isLeader = group.leader_user_id === userId;

            res.json({
                success: true,
                family: {
                    id: familyGroupId,
                    name: group.name,
                    leaderUserId: Number(group.leader_user_id),
                    leaderUsername: group.leader_username,
                    clanId: group.clan_id,
                    maxMembers: group.max_members,
                    isClan: group.is_clan ? true : false,
                    members: members.map(m => ({
                        id: m.id,
                        characterName: m.character_name,
                        gender: m.gender,
                        robloxUserId: m.roblox_user_id ? Number(m.roblox_user_id) : null,
                        parentId: m.parent_id || null,
                        title: m.title || null,
                        role: m.role,
                    })),
                    marriages,
                },
                isLeader,
            });
        } catch (err) {
            console.error('[Sengoku] GET /ingame/family error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // POST /ingame/family  -  Create a new family group
    router.post('/ingame/family', requireApiKey, async (req, res) => {
        try {
            const { leader_user_id, leader_username, leader_character_name, leader_gender, name } = req.body;

            if (!leader_user_id || !leader_character_name || !leader_gender || !name) {
                return res.status(400).json({ success: false, error: 'Required: leader_user_id, leader_character_name, leader_gender, name' });
            }
            if (!['male', 'female'].includes(leader_gender)) {
                return res.status(400).json({ success: false, error: 'Gender must be "male" or "female"' });
            }

            // Check player isn't already in a family
            const [existing] = await pool.query(
                'SELECT 1 FROM roblox_family_membership WHERE roblox_user_id = ?',
                [leader_user_id]
            );
            if (existing.length) {
                return res.status(409).json({ success: false, error: 'Player is already in a family' });
            }

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                // Create family group
                const [groupResult] = await conn.query(
                    'INSERT INTO roblox_family_groups (name, leader_user_id, leader_username, leader_character_name, leader_gender, max_members) VALUES (?, ?, ?, ?, ?, 8)',
                    [name, leader_user_id, leader_username || null, leader_character_name, leader_gender]
                );
                const familyGroupId = groupResult.insertId;

                // Create leader as first family member
                const [memberResult] = await conn.query(
                    "INSERT INTO roblox_clan_families (family_group_id, roblox_user_id, character_name, role, gender, display_order) VALUES (?, ?, ?, 'leader', ?, 0)",
                    [familyGroupId, leader_user_id, leader_character_name, leader_gender]
                );
                const memberId = memberResult.insertId;

                // Track membership
                await conn.query(
                    'INSERT INTO roblox_family_membership (roblox_user_id, family_group_id, family_member_id) VALUES (?, ?, ?)',
                    [leader_user_id, familyGroupId, memberId]
                );

                await conn.commit();
                res.json({ success: true, familyGroupId, memberId });
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        } catch (err) {
            console.error('[Sengoku] POST /ingame/family error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // POST /ingame/family/member  -  Add a child to the family tree
    router.post('/ingame/family/member', requireApiKey, async (req, res) => {
        try {
            const { family_group_id, roblox_user_id, character_name, gender, parent_id } = req.body;

            if (!family_group_id || !character_name || !gender) {
                return res.status(400).json({ success: false, error: 'Required: family_group_id, character_name, gender' });
            }
            if (!['male', 'female'].includes(gender)) {
                return res.status(400).json({ success: false, error: 'Gender must be "male" or "female"' });
            }

            // Verify family group exists
            const [groupRows] = await pool.query(
                'SELECT * FROM roblox_family_groups WHERE id = ?', [family_group_id]
            );
            if (!groupRows.length) {
                return res.status(404).json({ success: false, error: 'Family not found' });
            }
            const group = groupRows[0];

            // Check capacity
            const [countRows] = await pool.query(
                'SELECT COUNT(*) as cnt FROM roblox_clan_families WHERE family_group_id = ?',
                [family_group_id]
            );
            if (countRows[0].cnt >= group.max_members) {
                return res.status(409).json({ success: false, error: 'Family is full (' + group.max_members + ' members max)' });
            }

            // Check target isn't already in a family
            if (roblox_user_id) {
                const [existingMember] = await pool.query(
                    'SELECT 1 FROM roblox_family_membership WHERE roblox_user_id = ?',
                    [roblox_user_id]
                );
                if (existingMember.length) {
                    return res.status(409).json({ success: false, error: 'That player is already in a family' });
                }
            }

            // Validate parent_id if provided
            if (parent_id) {
                const [parentRows] = await pool.query(
                    'SELECT 1 FROM roblox_clan_families WHERE id = ? AND family_group_id = ?',
                    [parent_id, family_group_id]
                );
                if (!parentRows.length) {
                    return res.status(400).json({ success: false, error: 'Parent not found in this family' });
                }
            }

            // Next display order
            const [orderRows] = await pool.query(
                'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM roblox_clan_families WHERE family_group_id = ?',
                [family_group_id]
            );

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                const [result] = await conn.query(
                    "INSERT INTO roblox_clan_families (family_group_id, roblox_user_id, character_name, role, gender, display_order, parent_id) VALUES (?, ?, ?, 'child', ?, ?, ?)",
                    [family_group_id, roblox_user_id || null, character_name, gender, orderRows[0].next_order, parent_id || null]
                );
                const memberId = result.insertId;

                // Track membership if linked to a real player
                if (roblox_user_id) {
                    await conn.query(
                        'INSERT INTO roblox_family_membership (roblox_user_id, family_group_id, family_member_id) VALUES (?, ?, ?)',
                        [roblox_user_id, family_group_id, memberId]
                    );
                }

                await conn.commit();
                res.json({ success: true, memberId });
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        } catch (err) {
            console.error('[Sengoku] POST /ingame/family/member error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // DELETE /ingame/family/member/:id  -  Remove a member from the tree
    router.delete('/ingame/family/member/:id', requireApiKey, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (!id) return res.status(400).json({ success: false, error: 'Invalid member id' });

            // Check active marriage
            const [marriageRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE (person1_id = ? OR person2_id = ?) AND status IN ('proposed', 'accepted')",
                [id, id]
            );
            if (marriageRows.length) {
                return res.status(409).json({ success: false, error: 'Cannot remove: dissolve the marriage first' });
            }

            // Get member info for cleanup
            const [memberRows] = await pool.query('SELECT * FROM roblox_clan_families WHERE id = ?', [id]);
            if (!memberRows.length) {
                return res.status(404).json({ success: false, error: 'Member not found' });
            }
            const member = memberRows[0];

            // Can't remove the leader
            if (member.role === 'leader') {
                return res.status(400).json({ success: false, error: 'Cannot remove the family leader' });
            }

            // Re-parent children to this member's parent (or null)
            await pool.query(
                'UPDATE roblox_clan_families SET parent_id = ? WHERE parent_id = ?',
                [member.parent_id, id]
            );

            // Remove membership tracking
            if (member.roblox_user_id) {
                await pool.query(
                    'DELETE FROM roblox_family_membership WHERE roblox_user_id = ?',
                    [member.roblox_user_id]
                );
            }

            // Remove the member
            await pool.query('DELETE FROM roblox_clan_families WHERE id = ?', [id]);

            res.json({ success: true });
        } catch (err) {
            console.error('[Sengoku] DELETE /ingame/family/member error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // POST /ingame/family/invite  -  Create a pending invite
    router.post('/ingame/family/invite', requireApiKey, async (req, res) => {
        try {
            const { family_group_id, target_user_id, target_username, invited_by, character_name, gender, parent_id } = req.body;

            if (!family_group_id || !target_user_id || !character_name || !gender || !invited_by) {
                return res.status(400).json({ success: false, error: 'Required: family_group_id, target_user_id, character_name, gender, invited_by' });
            }

            // Check target doesn't already have a pending invite
            const [existing] = await pool.query(
                'SELECT 1 FROM roblox_family_invites WHERE target_user_id = ?', [target_user_id]
            );
            if (existing.length) {
                return res.status(409).json({ success: false, error: 'That player already has a pending invite' });
            }

            // Check target isn't already in a family
            const [membership] = await pool.query(
                'SELECT 1 FROM roblox_family_membership WHERE roblox_user_id = ?', [target_user_id]
            );
            if (membership.length) {
                return res.status(409).json({ success: false, error: 'That player is already in a family' });
            }

            const [result] = await pool.query(
                'INSERT INTO roblox_family_invites (family_group_id, target_user_id, target_username, invited_by_user_id, character_name, gender, parent_member_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [family_group_id, target_user_id, target_username || null, invited_by, character_name, gender, parent_id || null]
            );

            res.json({ success: true, inviteId: result.insertId });
        } catch (err) {
            console.error('[Sengoku] POST /ingame/family/invite error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // GET /ingame/family/invite/:userId  -  Get pending invite for a player
    router.get('/ingame/family/invite/:userId', requireApiKey, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const [rows] = await pool.query(
                `SELECT fi.*, fg.name as family_name, fg.leader_username
                 FROM roblox_family_invites fi
                 JOIN roblox_family_groups fg ON fg.id = fi.family_group_id
                 WHERE fi.target_user_id = ?`,
                [userId]
            );

            res.json({ success: true, invite: rows.length ? rows[0] : null });
        } catch (err) {
            console.error('[Sengoku] GET /ingame/family/invite error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // PUT /ingame/family/invite/:userId  -  Accept or decline an invite
    router.put('/ingame/family/invite/:userId', requireApiKey, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const { action } = req.body; // 'accept' or 'decline'

            const [inviteRows] = await pool.query(
                'SELECT * FROM roblox_family_invites WHERE target_user_id = ?', [userId]
            );
            if (!inviteRows.length) {
                return res.status(404).json({ success: false, error: 'No pending invite' });
            }
            const invite = inviteRows[0];

            if (action === 'decline') {
                await pool.query('DELETE FROM roblox_family_invites WHERE id = ?', [invite.id]);
                return res.json({ success: true, message: 'Invite declined' });
            }

            if (action !== 'accept') {
                return res.status(400).json({ success: false, error: 'Action must be accept or decline' });
            }

            // Check family capacity
            const [groupRows] = await pool.query('SELECT * FROM roblox_family_groups WHERE id = ?', [invite.family_group_id]);
            if (!groupRows.length) {
                await pool.query('DELETE FROM roblox_family_invites WHERE id = ?', [invite.id]);
                return res.status(404).json({ success: false, error: 'Family no longer exists' });
            }
            const group = groupRows[0];

            const [countRows] = await pool.query(
                'SELECT COUNT(*) as cnt FROM roblox_clan_families WHERE family_group_id = ?',
                [invite.family_group_id]
            );
            if (countRows[0].cnt >= group.max_members) {
                return res.status(409).json({ success: false, error: 'Family is full' });
            }

            // Check player isn't already in a family
            const [membership] = await pool.query(
                'SELECT 1 FROM roblox_family_membership WHERE roblox_user_id = ?', [userId]
            );
            if (membership.length) {
                await pool.query('DELETE FROM roblox_family_invites WHERE id = ?', [invite.id]);
                return res.status(409).json({ success: false, error: 'You are already in a family' });
            }

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                // Next display order
                const [orderRows] = await conn.query(
                    'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM roblox_clan_families WHERE family_group_id = ?',
                    [invite.family_group_id]
                );

                // Add to family tree
                const [memberResult] = await conn.query(
                    "INSERT INTO roblox_clan_families (family_group_id, roblox_user_id, character_name, role, gender, display_order, parent_id) VALUES (?, ?, ?, 'child', ?, ?, ?)",
                    [invite.family_group_id, userId, invite.character_name, invite.gender, orderRows[0].next_order, invite.parent_member_id]
                );

                // Track membership
                await conn.query(
                    'INSERT INTO roblox_family_membership (roblox_user_id, family_group_id, family_member_id) VALUES (?, ?, ?)',
                    [userId, invite.family_group_id, memberResult.insertId]
                );

                // Remove invite
                await conn.query('DELETE FROM roblox_family_invites WHERE id = ?', [invite.id]);

                await conn.commit();
                res.json({ success: true, memberId: memberResult.insertId });
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        } catch (err) {
            console.error('[Sengoku] PUT /ingame/family/invite error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // DELETE /ingame/family/:familyGroupId  -  Disband a family
    router.delete('/ingame/family/:familyGroupId', requireApiKey, async (req, res) => {
        try {
            const familyGroupId = parseInt(req.params.familyGroupId);
            if (!familyGroupId) return res.status(400).json({ success: false, error: 'Invalid family group id' });

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                // Remove all memberships
                await conn.query('DELETE FROM roblox_family_membership WHERE family_group_id = ?', [familyGroupId]);

                // Remove all invites
                await conn.query('DELETE FROM roblox_family_invites WHERE family_group_id = ?', [familyGroupId]);

                // Dissolve any marriages involving members of this family
                const [members] = await conn.query(
                    'SELECT id FROM roblox_clan_families WHERE family_group_id = ?', [familyGroupId]
                );
                if (members.length) {
                    const memberIds = members.map(m => m.id);
                    const placeholders = memberIds.map(() => '?').join(',');
                    await conn.query(
                        `UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW()
                         WHERE (person1_id IN (${placeholders}) OR person2_id IN (${placeholders}))
                           AND status IN ('proposed', 'accepted')`,
                        [...memberIds, ...memberIds]
                    );
                }

                // Remove all family members
                await conn.query('DELETE FROM roblox_clan_families WHERE family_group_id = ?', [familyGroupId]);

                // Remove the family group
                await conn.query('DELETE FROM roblox_family_groups WHERE id = ?', [familyGroupId]);

                await conn.commit();
                res.json({ success: true });
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        } catch (err) {
            console.error('[Sengoku] DELETE /ingame/family error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // POST /ingame/family/leave  -  Leave a family (non-leader)
    router.post('/ingame/family/leave', requireApiKey, async (req, res) => {
        try {
            const { user_id } = req.body;
            if (!user_id) return res.status(400).json({ success: false, error: 'Missing user_id' });

            const [membershipRows] = await pool.query(
                'SELECT fm.*, cf.id as member_id, cf.role FROM roblox_family_membership fm JOIN roblox_clan_families cf ON cf.id = fm.family_member_id WHERE fm.roblox_user_id = ?',
                [user_id]
            );
            if (!membershipRows.length) {
                return res.status(404).json({ success: false, error: 'Not in a family' });
            }
            const membership = membershipRows[0];

            if (membership.role === 'leader') {
                return res.status(400).json({ success: false, error: 'The leader cannot leave. Disband the family instead.' });
            }

            // Check active marriage
            const [marriageRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE (person1_id = ? OR person2_id = ?) AND status IN ('proposed', 'accepted')",
                [membership.member_id, membership.member_id]
            );
            if (marriageRows.length) {
                return res.status(409).json({ success: false, error: 'Cannot leave: dissolve your marriage first' });
            }

            // Re-parent children
            await pool.query(
                'UPDATE roblox_clan_families SET parent_id = ? WHERE parent_id = ?',
                [null, membership.member_id]
            );

            // Remove membership tracking
            await pool.query('DELETE FROM roblox_family_membership WHERE roblox_user_id = ?', [user_id]);

            // Remove family member record
            await pool.query('DELETE FROM roblox_clan_families WHERE id = ?', [membership.member_id]);

            res.json({ success: true });
        } catch (err) {
            console.error('[Sengoku] POST /ingame/family/leave error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // POST /ingame/marriages  -  Propose marriage (uses family_group_id instead of clan keys)
    router.post('/ingame/marriages', requireApiKey, async (req, res) => {
        try {
            const { person1_id, person2_id } = req.body;

            if (!person1_id || !person2_id) {
                return res.status(400).json({ success: false, error: 'Required: person1_id, person2_id' });
            }

            // Fetch both persons
            const [persons] = await pool.query(
                'SELECT * FROM roblox_clan_families WHERE id IN (?, ?)',
                [person1_id, person2_id]
            );
            if (persons.length !== 2) {
                return res.status(404).json({ success: false, error: 'One or both persons not found' });
            }

            const p1 = persons.find(p => p.id == person1_id);
            const p2 = persons.find(p => p.id == person2_id);

            // Can't marry within same family
            const p1Group = p1.family_group_id || p1.clan_id;
            const p2Group = p2.family_group_id || p2.clan_id;
            if (p1Group && p2Group && p1Group === p2Group) {
                return res.status(400).json({ success: false, error: 'Cannot marry within the same family' });
            }

            // Opposite sex only
            if (p1.gender === p2.gender) {
                return res.status(400).json({ success: false, error: 'Marriage requires opposite genders' });
            }

            // Check neither already married/proposed
            const [marriedRows] = await pool.query(
                "SELECT id FROM roblox_clan_marriages WHERE (person1_id IN (?, ?) OR person2_id IN (?, ?)) AND status IN ('proposed', 'accepted')",
                [person1_id, person2_id, person1_id, person2_id]
            );
            if (marriedRows.length) {
                return res.status(409).json({ success: false, error: 'One or both persons already have an active or pending marriage' });
            }

            // Use clan_id or family_group_id as the "clan" identifiers for the marriage record
            const clan1 = p1.clan_id || p1.family_group_id || 0;
            const clan2 = p2.clan_id || p2.family_group_id || 0;

            const [result] = await pool.query(
                "INSERT INTO roblox_clan_marriages (person1_id, person2_id, clan1_id, clan2_id, status, proposed_by_clan_id) VALUES (?, ?, ?, ?, 'proposed', ?)",
                [person1_id, person2_id, clan1, clan2, clan1]
            );

            res.json({ success: true, marriageId: result.insertId });
        } catch (err) {
            console.error('[Sengoku] POST /ingame/marriages error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // PUT /ingame/marriages  -  Accept / reject / dissolve (same logic, just with API key auth)
    router.put('/ingame/marriages', requireApiKey, async (req, res) => {
        try {
            const { id, action } = req.body;
            if (!id || !action) {
                return res.status(400).json({ success: false, error: 'Required: id, action (accept/reject/dissolve)' });
            }

            const [rows] = await pool.query('SELECT * FROM roblox_clan_marriages WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ success: false, error: 'Marriage not found' });

            const marriage = rows[0];

            switch (action) {
                case 'accept':
                    if (marriage.status !== 'proposed') {
                        return res.status(400).json({ success: false, error: 'Can only accept proposals' });
                    }
                    await pool.query("UPDATE roblox_clan_marriages SET status = 'accepted', resolved_at = NOW() WHERE id = ?", [id]);
                    return res.json({ success: true, message: 'Marriage accepted' });

                case 'reject':
                    if (marriage.status !== 'proposed') {
                        return res.status(400).json({ success: false, error: 'Can only reject proposals' });
                    }
                    await pool.query("UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?", [id]);
                    return res.json({ success: true, message: 'Proposal rejected' });

                case 'dissolve':
                    if (marriage.status !== 'accepted') {
                        return res.status(400).json({ success: false, error: 'Can only dissolve accepted marriages' });
                    }
                    await pool.query("UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?", [id]);
                    return res.json({ success: true, message: 'Marriage dissolved' });

                default:
                    return res.status(400).json({ success: false, error: 'Invalid action' });
            }
        } catch (err) {
            console.error('[Sengoku] PUT /ingame/marriages error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    // GET /ingame/marriages/:familyGroupId  -  Get marriages for a family
    router.get('/ingame/marriages/:familyGroupId', requireApiKey, async (req, res) => {
        try {
            const familyGroupId = parseInt(req.params.familyGroupId);

            const [members] = await pool.query(
                'SELECT id FROM roblox_clan_families WHERE family_group_id = ?', [familyGroupId]
            );
            if (!members.length) return res.json({ success: true, alliances: [], proposals: [] });

            const memberIds = members.map(m => m.id);
            const placeholders = memberIds.map(() => '?').join(',');

            const [rows] = await pool.query(
                `SELECT m.*,
                        p1.character_name as person1_name, p1.gender as person1_gender, p1.roblox_user_id as person1_roblox,
                        p2.character_name as person2_name, p2.gender as person2_gender, p2.roblox_user_id as person2_roblox
                 FROM roblox_clan_marriages m
                 JOIN roblox_clan_families p1 ON p1.id = m.person1_id
                 JOIN roblox_clan_families p2 ON p2.id = m.person2_id
                 WHERE (m.person1_id IN (${placeholders}) OR m.person2_id IN (${placeholders}))
                   AND m.status IN ('proposed', 'accepted')
                 ORDER BY m.status = 'accepted' DESC, m.created_at DESC`,
                [...memberIds, ...memberIds]
            );

            const alliances = [];
            const proposals = [];
            for (const row of rows) {
                const entry = {
                    id: row.id,
                    status: row.status,
                    person1: { id: row.person1_id, name: row.person1_name, gender: row.person1_gender, robloxId: row.person1_roblox ? Number(row.person1_roblox) : null },
                    person2: { id: row.person2_id, name: row.person2_name, gender: row.person2_gender, robloxId: row.person2_roblox ? Number(row.person2_roblox) : null },
                    created_at: row.created_at,
                };
                if (row.status === 'accepted') alliances.push(entry);
                else proposals.push(entry);
            }

            res.json({ success: true, alliances, proposals });
        } catch (err) {
            console.error('[Sengoku] GET /ingame/marriages error:', err);
            res.status(500).json({ success: false, error: 'Database error' });
        }
    });

    return router;
};
