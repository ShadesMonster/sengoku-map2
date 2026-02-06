<?php
// ============================================================
// Database Configuration Template
// Copy this file to config.php and fill in your credentials:
//   cp config.example.php config.php
// ============================================================

define('DB_HOST', 'YOUR_HOST_HERE');         // e.g. 'na01-sql.pebblehost.com'
define('DB_PORT', '3306');
define('DB_NAME', 'YOUR_DATABASE_NAME');
define('DB_USER', 'YOUR_USERNAME');
define('DB_PASS', 'YOUR_PASSWORD');

// ============================================================
// Existing table/column names - update if yours are different
// ============================================================
define('CLANS_TABLE', 'roblox_clans');
define('CLANS_PK', 'clan_id');
define('CLANS_NAME', 'name');
define('CLANS_ICON', 'icon');
define('CLANS_DAIMYO_USER_ID', 'daimyo_user_id');
define('CLANS_DAIMYO_USERNAME', 'daimyo_username');
define('CLANS_DAIMYO_RP_NAME', 'daimyo_rp_name');

define('MEMBERS_TABLE', 'roblox_clan_members');
define('MEMBERS_USER_COL', 'user_id');
define('MEMBERS_CLAN_COL', 'clan_id');

// ============================================================
// Database connection
// ============================================================
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

// ============================================================
// Dynamic clan mapping
// ============================================================
function getClanMap() {
    static $map = null;
    if ($map !== null) return $map;

    $pdo = getDB();
    $stmt = $pdo->query("SELECT " . CLANS_PK . ", " . CLANS_NAME . " FROM " . CLANS_TABLE);
    $rows = $stmt->fetchAll();

    $frontendKeys = ['oda', 'takeda', 'uesugi', 'tokugawa', 'mori', 'shimazu', 'hojo', 'chosokabe', 'date', 'imagawa'];

    $map = [];
    foreach ($rows as $row) {
        $dbName = strtolower(trim($row[CLANS_NAME]));
        foreach ($frontendKeys as $key) {
            if ($dbName === $key || strpos($dbName, $key) === 0) {
                $map[$key] = (int)$row[CLANS_PK];
                break;
            }
        }
    }

    return $map;
}

function getReverseMap() {
    return array_flip(getClanMap());
}

function clanKeyToId($key) {
    $map = getClanMap();
    return isset($map[$key]) ? $map[$key] : null;
}

function clanIdToKey($id) {
    $map = getReverseMap();
    $id = (int)$id;
    return isset($map[$id]) ? $map[$id] : null;
}
