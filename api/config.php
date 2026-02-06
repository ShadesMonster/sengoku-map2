<?php
// ============================================================
// Database Configuration - Fill in your PebbleHost MySQL details
// ============================================================

define('DB_HOST', 'YOUR_HOST_HERE');         // e.g. '123.456.789.0' or 'sql.pebblehost.com'
define('DB_PORT', '3306');                    // Usually 3306
define('DB_NAME', 'YOUR_DATABASE_NAME');      // Your single database name
define('DB_USER', 'YOUR_USERNAME');           // MySQL username
define('DB_PASS', 'YOUR_PASSWORD');           // MySQL password

// ============================================================
// Clan ID mapping - maps frontend string IDs to your database numeric clan IDs
// Update these to match your roblox_clans table IDs
// ============================================================
define('CLAN_MAP', [
    'oda'       => 1,   // Change these numbers to match your roblox_clans.id values
    'takeda'    => 2,
    'uesugi'    => 3,
    'tokugawa'  => 4,
    'mori'      => 5,
    'shimazu'   => 6,
    'hojo'      => 7,
    'chosokabe' => 8,
    'date'      => 9,
    'imagawa'   => 10,
]);

// Reverse map (db ID -> frontend key)
$CLAN_MAP_REVERSE = array_flip(CLAN_MAP);

// ============================================================
// Existing table column names - update if yours are different
// ============================================================
define('MEMBERS_TABLE', 'roblox_clan_members');
define('MEMBERS_USER_COL', 'user_id');       // Column with Roblox user ID
define('MEMBERS_CLAN_COL', 'clan_id');       // Column with clan ID (FK to roblox_clans)

define('CLANS_TABLE', 'roblox_clans');
define('CLANS_ID_COL', 'id');               // Primary key column
define('CLANS_NAME_COL', 'name');           // Clan name column

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

// Map frontend clan key to DB ID
function clanKeyToId($key) {
    $map = CLAN_MAP;
    return isset($map[$key]) ? $map[$key] : null;
}

// Map DB clan ID to frontend key
function clanIdToKey($id) {
    global $CLAN_MAP_REVERSE;
    return isset($CLAN_MAP_REVERSE[$id]) ? $CLAN_MAP_REVERSE[$id] : null;
}
