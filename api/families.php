<?php
// ============================================================
// Clan Families API
// GET    /families.php              - Get all families
// GET    /families.php?clan=oda     - Get one clan's family
// POST   /families.php              - Add a family member
// DELETE /families.php?id=123       - Remove a family member
// PUT    /families.php              - Update a family member
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
                // Single clan
                $dbClanId = clanKeyToId($clanKey);
                if (!$dbClanId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Unknown clan key: ' . $clanKey]);
                    exit;
                }
                $stmt = $pdo->prepare(
                    "SELECT f.*, c." . CLANS_NAME_COL . " as clan_name
                     FROM roblox_clan_families f
                     LEFT JOIN " . CLANS_TABLE . " c ON c." . CLANS_ID_COL . " = f.clan_id
                     WHERE f.clan_id = ?
                     ORDER BY f.role = 'leader' DESC, f.display_order ASC, f.id ASC"
                );
                $stmt->execute([$dbClanId]);
                $members = $stmt->fetchAll();

                echo json_encode([
                    'clan' => $clanKey,
                    'clan_db_id' => $dbClanId,
                    'members' => formatMembers($members)
                ]);
            } else {
                // All clans
                $stmt = $pdo->query(
                    "SELECT f.*, c." . CLANS_NAME_COL . " as clan_name
                     FROM roblox_clan_families f
                     LEFT JOIN " . CLANS_TABLE . " c ON c." . CLANS_ID_COL . " = f.clan_id
                     ORDER BY f.clan_id, f.role = 'leader' DESC, f.display_order ASC, f.id ASC"
                );
                $all = $stmt->fetchAll();

                // Group by clan
                $families = [];
                foreach ($all as $row) {
                    $key = clanIdToKey($row['clan_id']);
                    if (!$key) continue;
                    if (!isset($families[$key])) {
                        $families[$key] = ['leader' => null, 'children' => []];
                    }
                    $member = formatMember($row);
                    if ($row['role'] === 'leader') {
                        $families[$key]['leader'] = $member;
                    } else {
                        $families[$key]['children'][] = $member;
                    }
                }

                echo json_encode(['families' => $families]);
            }
            break;

        // ---- POST: Add a family member ----
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
            $role = $input['role'] ?? 'child';
            $gender = $input['gender'] ?? null;
            $title = $input['title'] ?? null;

            // Validate required fields
            if (!$clanKey || !$characterName || !$gender) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields: clan, character_name, gender']);
                exit;
            }

            $dbClanId = clanKeyToId($clanKey);
            if (!$dbClanId) {
                http_response_code(400);
                echo json_encode(['error' => 'Unknown clan: ' . $clanKey]);
                exit;
            }

            // Validate role
            if (!in_array($role, ['leader', 'child'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Role must be "leader" or "child"']);
                exit;
            }

            // Validate gender
            if (!in_array($gender, ['male', 'female'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Gender must be "male" or "female"']);
                exit;
            }

            // If roblox_user_id is provided, verify they're in the clan
            if ($robloxUserId) {
                $check = $pdo->prepare(
                    "SELECT 1 FROM " . MEMBERS_TABLE . "
                     WHERE " . MEMBERS_USER_COL . " = ? AND " . MEMBERS_CLAN_COL . " = ?"
                );
                $check->execute([$robloxUserId, $dbClanId]);
                if (!$check->fetch()) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Roblox user ' . $robloxUserId . ' is not a member of this clan']);
                    exit;
                }
            }

            // If adding a leader, check one doesn't already exist
            if ($role === 'leader') {
                $existingLeader = $pdo->prepare(
                    "SELECT id FROM roblox_clan_families WHERE clan_id = ? AND role = 'leader'"
                );
                $existingLeader->execute([$dbClanId]);
                if ($existingLeader->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'This clan already has a leader. Update or remove the existing one first.']);
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

            // Insert
            $stmt = $pdo->prepare(
                "INSERT INTO roblox_clan_families (clan_id, roblox_user_id, character_name, role, gender, title, display_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$dbClanId, $robloxUserId, $characterName, $role, $gender, $title, $nextOrder]);
            $newId = $pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'id' => (int)$newId,
                'message' => 'Family member added'
            ]);
            break;

        // ---- PUT: Update a family member ----
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input || !isset($input['id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing id']);
                exit;
            }

            $id = (int)$input['id'];

            // Get existing member
            $existing = $pdo->prepare("SELECT * FROM roblox_clan_families WHERE id = ?");
            $existing->execute([$id]);
            $member = $existing->fetch();
            if (!$member) {
                http_response_code(404);
                echo json_encode(['error' => 'Family member not found']);
                exit;
            }

            // If changing roblox_user_id, verify membership
            $newRobloxId = $input['roblox_user_id'] ?? $member['roblox_user_id'];
            if ($newRobloxId && $newRobloxId != $member['roblox_user_id']) {
                $check = $pdo->prepare(
                    "SELECT 1 FROM " . MEMBERS_TABLE . "
                     WHERE " . MEMBERS_USER_COL . " = ? AND " . MEMBERS_CLAN_COL . " = ?"
                );
                $check->execute([$newRobloxId, $member['clan_id']]);
                if (!$check->fetch()) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Roblox user ' . $newRobloxId . ' is not a member of this clan']);
                    exit;
                }
            }

            // Update fields
            $stmt = $pdo->prepare(
                "UPDATE roblox_clan_families
                 SET character_name = ?, roblox_user_id = ?, gender = ?, title = ?
                 WHERE id = ?"
            );
            $stmt->execute([
                $input['character_name'] ?? $member['character_name'],
                $newRobloxId,
                $input['gender'] ?? $member['gender'],
                $input['title'] ?? $member['title'],
                $id
            ]);

            echo json_encode(['success' => true, 'message' => 'Family member updated']);
            break;

        // ---- DELETE: Remove a family member ----
        case 'DELETE':
            $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing id parameter']);
                exit;
            }

            // Check if person is in an active marriage
            $marriageCheck = $pdo->prepare(
                "SELECT id FROM roblox_clan_marriages
                 WHERE (person1_id = ? OR person2_id = ?) AND status = 'accepted'"
            );
            $marriageCheck->execute([$id, $id]);
            if ($marriageCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Cannot remove: this person is in an active marriage. Dissolve the marriage first.']);
                exit;
            }

            $stmt = $pdo->prepare("DELETE FROM roblox_clan_families WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode([
                'success' => true,
                'deleted' => $stmt->rowCount() > 0
            ]);
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

// ---- Helper functions ----

function formatMembers($rows) {
    return array_map('formatMember', $rows);
}

function formatMember($row) {
    return [
        'id'             => (int)$row['id'],
        'clan_id'        => clanIdToKey($row['clan_id']),
        'roblox_user_id' => $row['roblox_user_id'] ? (int)$row['roblox_user_id'] : null,
        'character_name' => $row['character_name'],
        'role'           => $row['role'],
        'gender'         => $row['gender'],
        'title'          => $row['title'],
    ];
}
