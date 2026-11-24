<?php
declare(strict_types=1);

/**
 * Authentication, JWT (HS256), HTTP-only cookie, and CSRF helpers for GIPT PHP API.
 */

const GIPT_AUTH_COOKIE = 'gipt_auth_token';
const GIPT_TOKEN_TTL_SECONDS = 604800; // 7 days

function gipt_b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function gipt_b64url_decode(string $data): string
{
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode(strtr($data, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

/**
 * Resolves the JWT signing secret from config/env, or generates a server-local random fallback.
 *
 * @param array<string, mixed> $config
 */
function gipt_get_jwt_secret(array $config): string
{
    $configured = trim((string) ($config['jwt_secret'] ?? getenv('JWT_SECRET') ?: ''));
    if ($configured !== '' && !str_starts_with($configured, 'REPLACE_WITH_')) {
        return $configured;
    }

    $dataDir = __DIR__ . '/.data';
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0750, true);
    }
    $secretFile = $dataDir . '/jwt.secret';
    if (is_file($secretFile)) {
        $stored = trim((string) @file_get_contents($secretFile));
        if (strlen($stored) >= 32) {
            return $stored;
        }
    }

    $generated = bin2hex(random_bytes(32));
    @file_put_contents($secretFile, $generated);
    @chmod($secretFile, 0600);
    return $generated;
}

function gipt_hash_password(string $password): string
{
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 11]);
}

function gipt_verify_password(string $password, string $hash): bool
{
    return password_verify($password, $hash);
}

/**
 * @param array{userId: int, email: string, role: string} $payload
 * @param array<string, mixed> $config
 */
function gipt_sign_jwt(array $payload, array $config): string
{
    $header = gipt_b64url_encode((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $now = time();
    $claims = array_merge($payload, [
        'iat' => $now,
        'exp' => $now + GIPT_TOKEN_TTL_SECONDS,
    ]);
    $body = gipt_b64url_encode((string) json_encode($claims));
    $signature = hash_hmac('sha256', "$header.$body", gipt_get_jwt_secret($config), true);
    return "$header.$body." . gipt_b64url_encode($signature);
}

/**
 * @param array<string, mixed> $config
 * @return array{userId: int, email: string, role: string}|null
 */
function gipt_verify_jwt(string $token, array $config): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$headerB64, $bodyB64, $sigB64] = $parts;
    $expectedSig = gipt_b64url_encode(
        hash_hmac('sha256', "$headerB64.$bodyB64", gipt_get_jwt_secret($config), true)
    );
    if (!hash_equals($expectedSig, $sigB64)) {
        return null;
    }

    $header = json_decode(gipt_b64url_decode($headerB64), true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $claims = json_decode(gipt_b64url_decode($bodyB64), true);
    if (!is_array($claims)) {
        return null;
    }
    if (!isset($claims['exp']) || (int) $claims['exp'] < time()) {
        return null;
    }
    if (!isset($claims['userId'], $claims['email'], $claims['role'])) {
        return null;
    }

    return [
        'userId' => (int) $claims['userId'],
        'email' => (string) $claims['email'],
        'role' => (string) $claims['role'],
    ];
}

function gipt_extract_token(): ?string
{
    $authHeader = gipt_get_header('Authorization');
    if ($authHeader !== '' && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $bearer = trim($matches[1]);
        if ($bearer !== '') {
            return $bearer;
        }
    }
    if (!empty($_COOKIE[GIPT_AUTH_COOKIE]) && is_string($_COOKIE[GIPT_AUTH_COOKIE])) {
        return trim($_COOKIE[GIPT_AUTH_COOKIE]);
    }
    return null;
}

function gipt_set_auth_cookie(string $token): void
{
    $secure = gipt_is_https();
    setcookie(GIPT_AUTH_COOKIE, $token, [
        'expires' => time() + GIPT_TOKEN_TTL_SECONDS,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function gipt_clear_auth_cookie(): void
{
    $secure = gipt_is_https();
    setcookie(GIPT_AUTH_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/**
 * Verifies CSRF protection for state-changing requests (POST, PUT, PATCH, DELETE).
 */
function gipt_verify_csrf(string $method): void
{
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }

    // Requests authenticated via Authorization: Bearer are inherently immune to cookie CSRF
    $authHeader = gipt_get_header('Authorization');
    if ($authHeader !== '' && stripos($authHeader, 'Bearer ') === 0) {
        return;
    }

    $requestedWith = strtolower(gipt_get_header('X-Requested-With'));
    if ($requestedWith === 'xmlhttprequest') {
        return;
    }

    $origin = gipt_get_header('Origin');
    $host = gipt_get_header('X-Forwarded-Host') ?: (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($origin !== '' && $host !== '') {
        $parsedHost = (string) parse_url($origin, PHP_URL_HOST);
        $parsedPort = parse_url($origin, PHP_URL_PORT);
        $originHost = $parsedPort ? "$parsedHost:$parsedPort" : $parsedHost;
        if (strcasecmp($originHost, $host) === 0) {
            return;
        }
    }

    gipt_error('Forbidden: missing CSRF verification header.', 403);
}
