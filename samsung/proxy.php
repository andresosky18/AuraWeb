<?php
/**
 * AURA TV v2.1 - Proxy ligero para Samsung Smart TV (Web / Tizen Browser)
 * Permite cargar listas M3U / Xtream HTTP desde https://auratv.site.je/samsung/ sin bloqueo CORS ni Mixed-Content.
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept, User-Agent");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$targetUrl = isset($_GET['url']) ? trim($_GET['url']) : '';
if (empty($targetUrl) || !preg_match('/^https?:\/\//i', $targetUrl)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing or invalid url parameter"]);
    exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 12);
curl_setopt($ch, CURLOPT_TIMEOUT, 45);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_USERAGENT, "VLC/3.0.20 LibVLC/3.0.20");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($contentType) {
    header("Content-Type: " . $contentType);
} else {
    header("Content-Type: text/plain; charset=utf-8");
}
http_response_code($httpCode > 0 ? $httpCode : 502);
echo $response;
