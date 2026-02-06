<?php
// ============================================================
// Clan Families API
//
// Leaders are auto-pulled from roblox_clans (daimyo fields).
// Children are stored in roblox_clan_families.
//
// GET    /families.php              - Get all families (leaders + children)
// GET    /families.php?clan=oda     - Get one clan's family
// POST   /families.php              - Add a child to a clan family
// DELETE /families.php?id=123       - Remove a child
// PUT    /families.php              - Update a child's details
// ============================================================

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = getDB();

    switch ($method) {

        // ---- GET: Fetch families ----
        case 'GET':
            $clanKey = isset($_GET['clan']) ? $_GET['clan'] : null;

            if ($clanKey) {
                $family = getClanFamily($pdo, $clanKey);
                if (!$family) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Clan not found: ' . $clanKey]);
                    exit;
                }
                echo json_encode($family);
            } else {
                // All clans
                $families = [];
                foreach (array_keys(getClanMap()) as $key) {
                    $fam = getClanFamily($pdo, $key);
                    if ($fam) $families[$key] = $fam;
                }
                echo json_encode(['families' => $families]);
            }
            break;

        // ---- POST: Add a child to a clan family ----
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON body']);
                exit;
            }

            $clanKey = $input['clan'] ?? null;
            $robloxUserId = $input['roblox_user_id'] ?? null;
            $characterName = $input['character_name'] ?? null;
            $gender = $input['gender'] ?? null;

            if (!$clanKey || !$characterName || !$gender) {
                http_response_code(400);
                echo json_encode(['error' => 'Required: clan, character_name, gender']);
                exit;
            }

            $dbClanId = clanKeyToId($clanKey);
            if (!$dbClanId) {
                http_response_code(400);
                echo json_encode(['error' => 'Unknown clan: ' . $clanKey]);
                exit;
            }

            if (!in_array($gender, ['male', 'female'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Gender must be "male" or "female"']);
                exit;
            }

            // If roblox_user_id provided, verify they're in the clan
            if ($robloxUserId) {
                $check = $pdo->prepare(
                    "SELECT 1 FROM " . MEMBERS_TABLE .
                    " WHERE " . MEMBERS_USER_COL . " = ? AND " . MEMBERS_CLAN_COL . " = ?"
                );
                $check->execute([$robloxUserId, $dbClanId]);
                if (!$check->fetch()) {
                    http_response_code(403);
                    echo json_encode([
                        'error' => 'Roblox user ' . $robloxUserId . ' is not a member of this clan. They must join the clan first.'
                    ]);
                    exit;
                }
            }

            // Get next display order
            $orderStmt = $pdo->prepare(
                "SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
                 FROM roblox_clan_families WHERE clan_id = ?"
            );
            $orderStmt->execute([$dbClanId]);
            $nextOrder = $orderStmt->fetch()['next_order'];

            // Insert as child
            $stmt = $pdo->prepare(
                "INSERT INTO roblox_clan_families (clan_id, roblox_user_id, character_name, role, gender, display_order)
                 VALUES (?, ?, ?, 'child', ?, ?)"
            );
            $stmt->execute([$dbClanId, $robloxUserId, $characterName, $gender, $nextOrder]);
            $newId = $pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'id' => (int)$newId,
                'message' => $characterName . ' added to ' . $clanKey . ' family'
            ]);
            break;

        // ---- PUT: Update a child ----
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing id']);
                exit;
            }

            $id = (int)$input['id'];

            $existing = $pdo->prepare("SELECT * FROM roblox_clan_families WHERE id = ?");
            $existing->execute([$id]);
            $member = $existing->fetch();
            if (!$member) {
                http_response_code(404);
                echo json_encode(['error' => 'Family member not found']);
                exit;
            }

            // If changing roblox_user_id, verify clan membership
            $newRobloxId = isset($input['roblox_user_id']) ? $input['roblox_user_id'] : $member['roblox_user_id'];
            if ($newRobloxId && $newRobloxId != $member['roblox_user_id']) {
                $check = $pdo->prepare(
                    "SELECT 1 FROM " . MEMBERS_TABLE .
                    " WHERE " . MEMBERS_USER_COL . " = ? AND " . MEMBERS_CLAN_COL . " = ?"
                );
                $check->execute([$newRobloxId, $member['clan_id']]);
                if (!$check->fetch()) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Roblox user ' . $newRobloxId . ' is not a member of this clan']);
                    exit;
                }
            }

            $stmt = $pdo->prepare(
                "UPDATE roblox_clan_families
                 SET character_name = ?, roblox_user_id = ?, gender = ?
                 WHERE id = ?"
            );
            $stmt->execute([
                $input['character_name'] ?? $member['character_name'],
                $newRobloxId,
                $input['gender'] ?? $member['gender'],
                $id
            ]);

            echo json_encode(['success' => true, 'message' => 'Family member updated']);
            break;

        // ---- DELETE: Remove a child ----
        case 'DELETE':
            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing id parameter']);
                exit;
            }

            // Check if in active marriage
            $marriageCheck = $pdo->prepare(
                "SELECT id FROM roblox_clan_marriages
                 WHERE (person1_id = ? OR person2_id = ?) AND status = 'accepted'"
            );
            $marriageCheck->execute([$id, $id]);
            if ($marriageCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Cannot remove: dissolve the marriage first']);
                exit;
            }

            $stmt = $pdo->prepare("DELETE FROM roblox_clan_families WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode(['success' => true, 'deleted' => $stmt->rowCount() > 0]);
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

// ============================================================
// Get a clan's full family: leader (from roblox_clans) + children (from roblox_clan_families)
// ============================================================
function getClanFamily($pdo, $clanKey) {
    $dbClanId = clanKeyToId($clanKey);
    if (!$dbClanId) return null;

    // Get leader from roblox_clans (daimyo fields)
    $stmt = $pdo->prepare(
        "SELECT " . CLANS_PK . ", " . CLANS_NAME . ", " . CLANS_ICON . ", " .
        CLANS_DAIMYO_USER_ID . ", " . CLANS_DAIMYO_USERNAME . ", " . CLANS_DAIMYO_RP_NAME .
        " FROM " . CLANS_TABLE . " WHERE " . CLANS_PK . " = ?"
    );
    $stmt->execute([$dbClanId]);
    $clanRow = $stmt->fetch();

    if (!$clanRow) return null;

    $leader = null;
    if ($clanRow[CLANS_DAIMYO_USER_ID]) {
        $rpName = $clanRow[CLANS_DAIMYO_RP_NAME];
        $username = $clanRow[CLANS_DAIMYO_USERNAME];
        $leader = [
            'name'      => $rpName ?: $username ?: 'Daimyo',
            'robloxId'  => (int)$clanRow[CLANS_DAIMYO_USER_ID],
            'title'     => 'Daimyo of ' . $clanRow[CLANS_NAME],
        ];
    }

    // Get children from roblox_clan_families
    $stmt = $pdo->prepare(
        "SELECT * FROM roblox_clan_families
         WHERE clan_id = ?
         ORDER BY display_order ASC, id ASC"
    );
    $stmt->execute([$dbClanId]);
    $childRows = $stmt->fetchAll();

    $children = array_map(function($row) {
        return [
            'id'        => 'db_' . $row['id'],   // prefix so frontend can distinguish DB IDs
            'name'      => $row['character_name'],
            'gender'    => $row['gender'],
            'robloxId'  => $row['roblox_user_id'] ? (int)$row['roblox_user_id'] : null,
            'dbId'      => (int)$row['id'],       // raw DB id for API calls
        ];
    }, $childRows);

    return [
        'leader'   => $leader,
        'children' => $children,
        'icon'     => $clanRow[CLANS_ICON] ?: null,
    ];
}
