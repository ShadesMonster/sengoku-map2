<?php
// ============================================================
// Marriages / Alliances API
// GET    /marriages.php                    - Get all active marriages + proposals
// GET    /marriages.php?clan=oda           - Get marriages/proposals for a clan
// POST   /marriages.php                    - Propose a marriage
// PUT    /marriages.php                    - Accept, reject, or dissolve
// ============================================================

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    switch ($method) {

        // ---- GET: Fetch marriages and proposals ----
        case 'GET':
            $clanKey = isset($_GET['clan']) ? $_GET['clan'] : null;

            $query = "
                SELECT m.*,
                       p1.character_name as person1_name, p1.gender as person1_gender,
                       p1.roblox_user_id as person1_roblox, p1.clan_id as person1_clan_db_id,
                       p2.character_name as person2_name, p2.gender as person2_gender,
                       p2.roblox_user_id as person2_roblox, p2.clan_id as person2_clan_db_id
                FROM roblox_clan_marriages m
                JOIN roblox_clan_families p1 ON p1.id = m.person1_id
                JOIN roblox_clan_families p2 ON p2.id = m.person2_id
                WHERE m.status IN ('proposed', 'accepted')
            ";
            $params = [];

            if ($clanKey) {
                $dbClanId = clanKeyToId($clanKey);
                if (!$dbClanId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Unknown clan']);
                    exit;
                }
                $query .= " AND (m.clan1_id = ? OR m.clan2_id = ?)";
                $params = [$dbClanId, $dbClanId];
            }

            $query .= " ORDER BY m.status = 'accepted' DESC, m.created_at DESC";

            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $rows = $stmt->fetchAll();

            $alliances = [];
            $proposals = [];

            foreach ($rows as $row) {
                $entry = formatMarriage($row);
                if ($row['status'] === 'accepted') {
                    $alliances[] = $entry;
                } else {
                    $proposals[] = $entry;
                }
            }

            echo json_encode([
                'alliances' => $alliances,
                'proposals' => $proposals
            ]);
            break;

        // ---- POST: Propose a marriage ----
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON body']);
                exit;
            }

            $person1Id = (int)($input['person1_id'] ?? 0);
            $person2Id = (int)($input['person2_id'] ?? 0);
            $proposedByClan = $input['proposed_by'] ?? null;

            if (!$person1Id || !$person2Id || !$proposedByClan) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing: person1_id, person2_id, proposed_by']);
                exit;
            }

            $proposedByDbId = clanKeyToId($proposedByClan);
            if (!$proposedByDbId) {
                http_response_code(400);
                echo json_encode(['error' => 'Unknown clan: ' . $proposedByClan]);
                exit;
            }

            // Fetch both persons
            $stmt = $pdo->prepare("SELECT * FROM roblox_clan_families WHERE id IN (?, ?)");
            $stmt->execute([$person1Id, $person2Id]);
            $persons = $stmt->fetchAll();

            if (count($persons) !== 2) {
                http_response_code(404);
                echo json_encode(['error' => 'One or both persons not found']);
                exit;
            }

            $p1 = $persons[0]['id'] == $person1Id ? $persons[0] : $persons[1];
            $p2 = $persons[0]['id'] == $person2Id ? $persons[0] : $persons[1];

            // Can't marry within same clan
            if ($p1['clan_id'] === $p2['clan_id']) {
                http_response_code(400);
                echo json_encode(['error' => 'Cannot marry within the same clan']);
                exit;
            }

            // Check neither is already married
            $marriedCheck = $pdo->prepare(
                "SELECT id FROM roblox_clan_marriages
                 WHERE (person1_id IN (?, ?) OR person2_id IN (?, ?))
                 AND status IN ('proposed', 'accepted')"
            );
            $marriedCheck->execute([$person1Id, $person2Id, $person1Id, $person2Id]);
            if ($marriedCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'One or both persons already have a pending or active marriage']);
                exit;
            }

            // Check no existing alliance between these clans
            $allianceCheck = $pdo->prepare(
                "SELECT id FROM roblox_clan_marriages
                 WHERE ((clan1_id = ? AND clan2_id = ?) OR (clan1_id = ? AND clan2_id = ?))
                 AND status = 'accepted'"
            );
            $allianceCheck->execute([$p1['clan_id'], $p2['clan_id'], $p2['clan_id'], $p1['clan_id']]);
            if ($allianceCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'These clans are already allied through marriage']);
                exit;
            }

            // Create proposal
            $stmt = $pdo->prepare(
                "INSERT INTO roblox_clan_marriages (person1_id, person2_id, clan1_id, clan2_id, status, proposed_by_clan_id)
                 VALUES (?, ?, ?, ?, 'proposed', ?)"
            );
            $stmt->execute([$person1Id, $person2Id, $p1['clan_id'], $p2['clan_id'], $proposedByDbId]);

            echo json_encode([
                'success' => true,
                'id' => (int)$pdo->lastInsertId(),
                'message' => 'Marriage proposed'
            ]);
            break;

        // ---- PUT: Accept, reject, or dissolve a marriage ----
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id']) || !isset($input['action'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing: id, action (accept/reject/dissolve)']);
                exit;
            }

            $id = (int)$input['id'];
            $action = $input['action'];

            // Fetch marriage
            $stmt = $pdo->prepare("SELECT * FROM roblox_clan_marriages WHERE id = ?");
            $stmt->execute([$id]);
            $marriage = $stmt->fetch();

            if (!$marriage) {
                http_response_code(404);
                echo json_encode(['error' => 'Marriage not found']);
                exit;
            }

            switch ($action) {
                case 'accept':
                    if ($marriage['status'] !== 'proposed') {
                        http_response_code(400);
                        echo json_encode(['error' => 'Can only accept proposals']);
                        exit;
                    }
                    $stmt = $pdo->prepare(
                        "UPDATE roblox_clan_marriages SET status = 'accepted', resolved_at = NOW() WHERE id = ?"
                    );
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Marriage accepted - alliance formed']);
                    break;

                case 'reject':
                    if ($marriage['status'] !== 'proposed') {
                        http_response_code(400);
                        echo json_encode(['error' => 'Can only reject proposals']);
                        exit;
                    }
                    $stmt = $pdo->prepare(
                        "UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?"
                    );
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Marriage proposal rejected']);
                    break;

                case 'dissolve':
                    if ($marriage['status'] !== 'accepted') {
                        http_response_code(400);
                        echo json_encode(['error' => 'Can only dissolve accepted marriages']);
                        exit;
                    }
                    $stmt = $pdo->prepare(
                        "UPDATE roblox_clan_marriages SET status = 'dissolved', resolved_at = NOW() WHERE id = ?"
                    );
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Marriage dissolved - alliance broken']);
                    break;

                default:
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid action. Use: accept, reject, dissolve']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// ---- Helper ----

function formatMarriage($row) {
    return [
        'id'         => (int)$row['id'],
        'status'     => $row['status'],
        'clan1'      => clanIdToKey($row['clan1_id']),
        'clan2'      => clanIdToKey($row['clan2_id']),
        'proposed_by'=> clanIdToKey($row['proposed_by_clan_id']),
        'person1'    => [
            'id'        => (int)$row['person1_id'],
            'name'      => $row['person1_name'],
            'gender'    => $row['person1_gender'],
            'robloxId'  => $row['person1_roblox'] ? (int)$row['person1_roblox'] : null,
            'clan'      => clanIdToKey($row['person1_clan_db_id']),
        ],
        'person2'    => [
            'id'        => (int)$row['person2_id'],
            'name'      => $row['person2_name'],
            'gender'    => $row['person2_gender'],
            'robloxId'  => $row['person2_roblox'] ? (int)$row['person2_roblox'] : null,
            'clan'      => clanIdToKey($row['person2_clan_db_id']),
        ],
        'created_at' => $row['created_at'],
    ];
}
