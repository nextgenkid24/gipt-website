<?php
declare(strict_types=1);

/**
 * Shared utility helpers for the GIPT PHP 8+ REST API.
 */

function gipt_json(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function gipt_error(string $message, int $status = 400): void
{
    gipt_json(['error' => $message], $status);
}

/**
 * @return array<string, mixed>
 */
function gipt_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function gipt_now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s.000\Z');
}

function gipt_slugify(string $input): string
{
    $str = strtolower(trim($input));
    if (function_exists('iconv')) {
        $trans = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
        if ($trans !== false) {
            $str = $trans;
        }
    }
    $str = preg_replace('/[^a-z0-9\s-]/', '', $str) ?? '';
    $str = preg_replace('/[\s_-]+/', '-', trim($str)) ?? '';
    return trim($str, '-');
}

function gipt_calculate_reading_time(string $markdown): int
{
    $plain = preg_replace('/```[\s\S]*?```/', ' ', $markdown) ?? $markdown;
    $plain = preg_replace('/`[^`]*`/', ' ', $plain) ?? $plain;
    $plain = preg_replace('/!\[[^\]]*\]\([^)]*\)/', ' ', $plain) ?? $plain;
    $plain = preg_replace('/\[([^\]]+)\]\([^)]*\)/', '$1', $plain) ?? $plain;
    $plain = preg_replace('/[#>*_~\-]+/', ' ', $plain) ?? $plain;
    $plain = trim($plain);
    if ($plain === '') {
        return 1;
    }
    $words = preg_split('/\s+/', $plain, -1, PREG_SPLIT_NO_EMPTY);
    $count = is_array($words) ? count($words) : 0;
    return max(1, (int) ceil($count / 210));
}

function gipt_sanitize_url(?string $url): string
{
    if ($url === null) {
        return '';
    }
    $trimmed = trim($url);
    if ($trimmed === '') {
        return '';
    }
    if (str_starts_with($trimmed, '/') && !str_starts_with($trimmed, '//')) {
        return $trimmed;
    }
    $parts = parse_url($trimmed);
    if (!is_array($parts) || empty($parts['scheme'])) {
        return '';
    }
    $scheme = strtolower($parts['scheme']);
    if (in_array($scheme, ['http', 'https', 'mailto', 'tel'], true)) {
        return $trimmed;
    }
    return '';
}

function gipt_is_valid_email(string $email): bool
{
    return filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
}

function gipt_escape_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function gipt_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    return isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443;
}

function gipt_get_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (!empty($_SERVER[$key])) {
        return trim((string) $_SERVER[$key]);
    }
    if (strcasecmp($name, 'Authorization') === 0) {
        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return trim((string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        }
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (is_array($headers)) {
                foreach ($headers as $k => $v) {
                    if (strcasecmp((string) $k, 'Authorization') === 0) {
                        return trim((string) $v);
                    }
                }
            }
        }
    }
    return '';
}
