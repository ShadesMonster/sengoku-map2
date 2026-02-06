<?php
// ============================================================
// Roblox Avatar Proxy
// Proxies requests to the Roblox thumbnails API to avoid CORS issues.
// GET /avatars.php?userIds=9003341,12345678
// ============================================================

require_once __DIR__ . '/cors.php';

$userIds = isset($_GET['userIds']) ? $_GET['userIds'] : '';

if (!$userIds) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing userIds parameter']);
    exit;
}

// Sanitize: only allow comma-separated numbers
if (!preg_match('/^[0-9,]+$/', $userIds)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid userIds format']);
    exit;
}

$url = 'https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' . $userIds . '&size=150x150&format=Png&isCircular=false';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach Roblox API: ' . $error]);
    exit;
}

http_response_code($httpCode);
echo $response;
