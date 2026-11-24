<?php
declare(strict_types=1);

/**
 * GIPT Institutional Website & CMS — PHP 8+ Front-Controller REST API
 *
 * Deployed alongside the built Vite static bundle on cPanel shared hosting:
 *   public_html/
 *     .htaccess          (React Router SPA fallback; passes /api/* and /uploads/* through)
 *     index.html
 *     assets/...
 *     uploads/.htaccess  (Disables PHP execution inside /uploads/)
 *     api/
 *       .htaccess        (Routes /api/* -> api/index.php; blocks internal files)
 *       index.php        (This router)
 *       config.php       (Copied from config.example.php with cPanel MySQL credentials)
 *       db.php           (PDO MySQL utf8mb4 + automatic SQLite local fallback)
 *       auth.php         (bcrypt password_hash/verify + HS256 HTTP-only JWT cookie + CSRF)
 *       helpers.php
 *       seed.php
 */

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

// Normalize request path relative to /api/ (works both at domain root and in a cPanel subdirectory)
function gipt_resolve_route(): string
{
    $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $path = (string) (parse_url($requestUri, PHP_URL_PATH) ?: '/');

    $scriptDir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')));
    $scriptDir = rtrim($scriptDir, '/');

    if ($scriptDir !== '' && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    } elseif (preg_match('#^/api(/.*)?$#', $path, $m)) {
        $path = $m[1] ?? '/';
    }

    if (str_starts_with($path, '/index.php')) {
        $path = substr($path, strlen('/index.php'));
    }

    $path = '/' . trim($path, '/');
    return $path === '' ? '/' : $path;
}

/**
 * @param array<string, mixed> $user
 * @return array<string, mixed>
 */
function gipt_strip_password(array $user): array
{
    unset($user['password_hash']);
    return $user;
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$debugMode = false;

try {
    $repo = GiptRepository::boot();
    $config = $repo->config;
    $debugMode = !empty($config['debug']);
    $route = gipt_resolve_route();

    // Apply CSRF verification to all state-changing routes
    gipt_verify_csrf($method);

    // Helper closures for authentication & role-based access control
    $getSessionUser = static function () use ($repo, $config): ?array {
        $token = gipt_extract_token();
        if ($token === null || $token === '') {
            return null;
        }
        $payload = gipt_verify_jwt($token, $config);
        if ($payload === null) {
            return null;
        }
        return $repo->getUserById($payload['userId'], false);
    };

    $requireAuth = static function () use ($getSessionUser): array {
        $user = $getSessionUser();
        if ($user === null) {
            gipt_error('Authentication required.', 401);
        }
        return $user;
    };

    $requireSuperAdmin = static function (array $user): void {
        if (($user['role'] ?? '') !== 'super_admin') {
            gipt_error('Super Admin privileges required.', 403);
        }
    };

    // ==================== PUBLIC API ROUTES ====================

    if ($method === 'GET' && $route === '/health') {
        gipt_json([
            'status' => 'ok',
            'storage' => $repo->driver,
            'runtime' => 'php',
        ]);
    }

    if ($method === 'GET' && $route === '/settings') {
        gipt_json($repo->getSettings());
    }

    if ($method === 'GET' && $route === '/categories') {
        gipt_json($repo->listCategories());
    }

    if ($method === 'GET' && $route === '/posts') {
        $posts = $repo->listPosts('published');
        $category = strtolower(trim((string) ($_GET['category'] ?? '')));
        $tag = strtolower(trim((string) ($_GET['tag'] ?? '')));
        $q = strtolower(trim((string) ($_GET['q'] ?? '')));

        if ($category !== '' && $category !== 'all') {
            $posts = array_values(array_filter(
                $posts,
                static fn(array $p): bool => strtolower((string) ($p['category_slug'] ?? '')) === $category
            ));
        }

        if ($tag !== '') {
            $posts = array_values(array_filter(
                $posts,
                static function (array $p) use ($tag): bool {
                    $tags = array_map(
                        static fn(string $t): string => strtolower(trim($t)),
                        explode(',', (string) ($p['tags'] ?? ''))
                    );
                    return in_array($tag, $tags, true);
                }
            ));
        }

        if ($q !== '') {
            $posts = array_values(array_filter(
                $posts,
                static function (array $p) use ($q): bool {
                    $haystack = strtolower(
                        ($p['title'] ?? '') . ' ' .
                        ($p['excerpt'] ?? '') . ' ' .
                        ($p['content'] ?? '') . ' ' .
                        ($p['tags'] ?? '') . ' ' .
                        ($p['author_name'] ?? '')
                    );
                    return str_contains($haystack, $q);
                }
            ));
        }

        gipt_json($posts);
    }

    if ($method === 'GET' && preg_match('#^/posts/([^/]+)$#', $route, $m)) {
        $slug = rawurldecode($m[1]);
        $post = $repo->getPostBySlug($slug);
        if ($post === null || ($post['status'] ?? '') !== 'published') {
            gipt_error('Article not found.', 404);
        }

        $allPublished = $repo->listPosts('published');
        $related = array_values(array_filter(
            $allPublished,
            static fn(array $p): bool => (int) $p['id'] !== (int) $post['id']
        ));
        usort($related, static function (array $a, array $b) use ($post): int {
            $sameA = ($a['category_id'] === $post['category_id']) ? 1 : 0;
            $sameB = ($b['category_id'] === $post['category_id']) ? 1 : 0;
            return $sameB <=> $sameA;
        });

        gipt_json([
            'post' => $post,
            'related' => array_slice($related, 0, 3),
        ]);
    }

    if ($method === 'GET' && $route === '/programs') {
        gipt_json($repo->listPrograms());
    }

    if ($method === 'GET' && $route === '/resources') {
        gipt_json($repo->listResources());
    }

    if ($method === 'GET' && preg_match('#^/resources/(\d+)/download$#', $route, $m)) {
        $id = (int) $m[1];
        if ($id <= 0) {
            gipt_error('Invalid resource ID.', 400);
        }
        $resource = $repo->getResourceById($id);
        if ($resource === null) {
            gipt_error('Publication not found.', 404);
        }

        // If resource points to an uploaded local file inside /uploads/, stream it safely
        $fileUrl = (string) ($resource['file_url'] ?? '');
        if (str_starts_with($fileUrl, '/uploads/')) {
            $uploadsDir = realpath(__DIR__ . '/../uploads');
            $safeName = basename($fileUrl);
            if ($uploadsDir !== false && $safeName !== '' && $safeName !== '.' && $safeName !== '..') {
                $candidate = realpath($uploadsDir . DIRECTORY_SEPARATOR . $safeName);
                if (
                    $candidate !== false &&
                    str_starts_with($candidate, $uploadsDir . DIRECTORY_SEPARATOR) &&
                    is_file($candidate)
                ) {
                    $mime = 'application/octet-stream';
                    if (function_exists('finfo_open')) {
                        $finfo = finfo_open(FILEINFO_MIME_TYPE);
                        if ($finfo !== false) {
                            $detected = finfo_file($finfo, $candidate);
                            finfo_close($finfo);
                            if (is_string($detected) && $detected !== '') {
                                $mime = $detected;
                            }
                        }
                    }
                    $headerName = preg_replace('/["\r\n]/', '', $safeName) ?? 'download';
                    header('Content-Type: ' . $mime);
                    header('X-Content-Type-Options: nosniff');
                    header('Content-Disposition: attachment; filename="' . $headerName . '"');
                    header('Content-Length: ' . (string) filesize($candidate));
                    readfile($candidate);
                    exit;
                }
            }
        }

        // Otherwise generate a clean institutional brief HTML sheet suitable for print/save
        $settings = $repo->getSettings();
        $instName = gipt_escape_html((string) ($settings['institute_name'] ?? 'Global Institute for Postgraduate Training'));
        $instShort = gipt_escape_html((string) ($settings['institute_short_name'] ?? 'GIPT'));
        $resTitle = gipt_escape_html((string) $resource['title']);
        $resCategory = gipt_escape_html((string) $resource['category']);
        $resYear = gipt_escape_html((string) ($resource['publication_year'] ?? '2026'));
        $resSize = gipt_escape_html((string) ($resource['file_size'] ?? ''));
        $resSummary = gipt_escape_html((string) ($resource['summary'] ?? ''));
        $address = gipt_escape_html((string) ($settings['contact_address'] ?? ''));
        $admissionsEmail = gipt_escape_html((string) ($settings['contact_email_admissions'] ?? 'info@gipt.edu.mw'));
        $phone = gipt_escape_html((string) ($settings['contact_phone_primary'] ?? '+265 885 921 221'));

        $html = <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{$resTitle} — {$instShort}</title>
  <style>
    body { font-family: Georgia, serif; color: #181F29; max-width: 780px; margin: 48px auto; padding: 0 24px; line-height: 1.7; }
    .header { border-bottom: 2px solid #181F29; padding-bottom: 18px; margin-bottom: 28px; }
    .kicker { font-family: sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #008398; font-weight: 600; }
    h1 { font-size: 28px; margin: 10px 0 8px; }
    .meta { font-family: sans-serif; font-size: 13px; color: #475569; }
    .summary { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px 24px; margin: 24px 0; }
    .footer { margin-top: 48px; border-top: 1px solid #CBD5E1; padding-top: 16px; font-family: sans-serif; font-size: 12px; color: #64748B; }
  </style>
</head>
<body>
  <div class="header">
    <div class="kicker">{$instName} · {$resCategory}</div>
    <h1>{$resTitle}</h1>
    <div class="meta">Publication Year: {$resYear} · Format: {$resSize}</div>
  </div>
  <div class="summary">
    <strong>Executive Overview</strong>
    <p>{$resSummary}</p>
  </div>
  <p>This official institutional document is published by the {$instName} ({$instShort}). For full printed prospectuses, certified syllabi, or institutional licensing inquiries, please contact the Office of Admissions and Academic Affairs.</p>
  <div class="footer">
    {$address} · {$admissionsEmail} · {$phone}
  </div>
</body>
</html>
HTML;

        $filename = (gipt_slugify((string) $resource['title']) ?: 'gipt-publication') . '.html';
        header('Content-Type: text/html; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        if (isset($_GET['download']) && (string) $_GET['download'] === '1') {
            header('Content-Disposition: attachment; filename="' . $filename . '"');
        }
        echo $html;
        exit;
    }

    if ($method === 'POST' && $route === '/subscribers') {
        $body = gipt_read_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        if (!gipt_is_valid_email($email)) {
            gipt_error('Please enter a valid email address.', 400);
        }
        $result = $repo->addSubscriber($email);
        $already = (bool) $result['alreadyExists'];
        gipt_json([
            'subscriber' => $result['subscriber'],
            'alreadyExists' => $already,
            'message' => $already
                ? 'This email address is already subscribed to GIPT intake alerts.'
                : 'Thank you for subscribing to GIPT intake alerts and research briefs.',
        ], $already ? 200 : 201);
    }

    if ($method === 'POST' && $route === '/inquiries') {
        $body = gipt_read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));
        $category = trim((string) ($body['category'] ?? 'General'));
        $programOfInterest = trim((string) ($body['program_of_interest'] ?? ''));
        $message = trim((string) ($body['message'] ?? ''));

        if (strlen($name) < 2) {
            gipt_error('Please provide your full name.', 400);
        }
        if (!gipt_is_valid_email($email)) {
            gipt_error('Please provide a valid email address.', 400);
        }
        if (strlen($message) < 10) {
            gipt_error('Please enter a message of at least 10 characters.', 400);
        }

        $inquiry = $repo->createInquiry([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'category' => $category !== '' ? $category : 'General',
            'program_of_interest' => $programOfInterest,
            'message' => $message,
        ]);

        gipt_json([
            'inquiry' => $inquiry,
            'message' => 'Your inquiry has been received by the GIPT Admissions & Registry desk.',
        ], 201);
    }

    // ==================== AUTH ROUTES ====================

    if ($method === 'POST' && $route === '/auth/login') {
        $body = gipt_read_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || $password === '') {
            gipt_error('Email and password are required.', 400);
        }

        $user = $repo->getUserByEmail($email);
        if ($user === null || !gipt_verify_password($password, (string) ($user['password_hash'] ?? ''))) {
            gipt_error('Invalid email or password.', 401);
        }

        $token = gipt_sign_jwt([
            'userId' => (int) $user['id'],
            'email' => (string) $user['email'],
            'role' => (string) $user['role'],
        ], $config);
        gipt_set_auth_cookie($token);

        gipt_json(['user' => gipt_strip_password($user)]);
    }

    if ($method === 'POST' && $route === '/auth/logout') {
        gipt_clear_auth_cookie();
        gipt_json(['success' => true]);
    }

    if ($method === 'GET' && $route === '/auth/me') {
        $user = $getSessionUser();
        gipt_json(['user' => $user]);
    }

    // ==================== FILE UPLOAD (POST /api/upload & /api/admin/upload) ====================

    if ($method === 'POST' && ($route === '/upload' || $route === '/admin/upload')) {
        $requireAuth();

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            gipt_error('No file provided.', 400);
        }

        $file = $_FILES['file'];
        $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($uploadError !== UPLOAD_ERR_OK) {
            $errMsg = match ($uploadError) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File exceeds maximum allowed size of 10 MB.',
                UPLOAD_ERR_NO_FILE => 'No file provided.',
                default => 'File upload failed. Please try again.',
            };
            gipt_error($errMsg, 400);
        }

        $tmpPath = (string) ($file['tmp_name'] ?? '');
        $origName = (string) ($file['name'] ?? '');
        $sizeBytes = (int) ($file['size'] ?? 0);

        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            gipt_error('Invalid file upload.', 400);
        }

        if ($sizeBytes <= 0 || $sizeBytes > 10 * 1024 * 1024) {
            gipt_error('File must be between 1 byte and 10 MB.', 400);
        }

        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowedMap = [
            'jpg' => ['image/jpeg'],
            'jpeg' => ['image/jpeg'],
            'png' => ['image/png'],
            'webp' => ['image/webp'],
            'pdf' => ['application/pdf'],
        ];

        if (!isset($allowedMap[$ext])) {
            gipt_error('Only JPG, PNG, WebP images and PDF files are permitted.', 400);
        }

        // Verify actual file content MIME type via finfo (not trusting client Content-Type)
        $detectedMime = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mime = finfo_file($finfo, $tmpPath);
                finfo_close($finfo);
                if (is_string($mime)) {
                    $detectedMime = strtolower(trim($mime));
                }
            }
        }
        if ($detectedMime === '') {
            $detectedMime = strtolower(trim((string) ($file['type'] ?? '')));
        }

        if (!in_array($detectedMime, $allowedMap[$ext], true)) {
            gipt_error('Uploaded file content does not match an allowed JPG, PNG, WebP, or PDF format.', 400);
        }

        $uploadsBase = __DIR__ . '/../uploads';
        if (!is_dir($uploadsBase) && !@mkdir($uploadsBase, 0755, true)) {
            gipt_error('Unable to prepare uploads directory on server.', 500);
        }

        $resolvedUploads = realpath($uploadsBase);
        if ($resolvedUploads === false || !is_writable($resolvedUploads)) {
            gipt_error('Uploads directory is not writable. Check folder permissions in cPanel.', 500);
        }

        $safeFilename = sprintf('%d-%s.%s', time(), bin2hex(random_bytes(8)), $ext);
        $destination = $resolvedUploads . DIRECTORY_SEPARATOR . $safeFilename;

        if (!move_uploaded_file($tmpPath, $destination)) {
            gipt_error('Failed to store uploaded file.', 500);
        }
        @chmod($destination, 0644);

        $sizeKb = $sizeBytes / 1024;
        $readableSize = $sizeKb >= 1024
            ? number_format($sizeKb / 1024, 1) . ' MB'
            : (string) max(1, (int) round($sizeKb)) . ' KB';

        gipt_json([
            'url' => '/uploads/' . $safeFilename,
            'filename' => $safeFilename,
            'size' => $readableSize,
            'mimetype' => $detectedMime,
        ], 201);
    }

    // ==================== PROTECTED ADMIN ROUTES ====================

    if ($method === 'GET' && $route === '/admin/stats') {
        $user = $requireAuth();
        $stats = $repo->getDashboardStats();
        if (($user['role'] ?? '') === 'author') {
            $ownPosts = $repo->listPosts('all', (int) $user['id']);
            $stats['published_posts'] = count(array_filter(
                $ownPosts,
                static fn(array $p): bool => ($p['status'] ?? '') === 'published'
            ));
            $stats['draft_posts'] = count(array_filter(
                $ownPosts,
                static fn(array $p): bool => ($p['status'] ?? '') === 'draft'
            ));
        }
        gipt_json($stats);
    }

    if ($method === 'PUT' && $route === '/admin/profile') {
        $user = $requireAuth();
        $body = gipt_read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $title = trim((string) ($body['title'] ?? ''));
        $bio = trim((string) ($body['bio'] ?? ''));
        $newPassword = (string) ($body['password'] ?? '');

        if (strlen($name) < 2) {
            gipt_error('Name must be at least 2 characters.', 400);
        }

        $updateData = [
            'name' => $name,
            'title' => $title,
            'bio' => $bio,
        ];
        if ($newPassword !== '') {
            if (strlen($newPassword) < 8) {
                gipt_error('Password must be at least 8 characters.', 400);
            }
            $updateData['password_hash'] = gipt_hash_password($newPassword);
        }

        $updated = $repo->updateUser((int) $user['id'], $updateData);
        gipt_json(['user' => $updated]);
    }

    // -------------------- POSTS CRUD --------------------

    if ($method === 'GET' && $route === '/admin/posts') {
        $user = $requireAuth();
        $authorFilter = ($user['role'] ?? '') === 'author' ? (int) $user['id'] : null;
        gipt_json($repo->listPosts('all', $authorFilter));
    }

    if ($method === 'POST' && $route === '/admin/posts') {
        $user = $requireAuth();
        $body = gipt_read_json_body();
        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['content'] ?? ''));
        if (strlen($title) < 3 || strlen($content) < 10) {
            gipt_error('Title and article body content are required.', 400);
        }

        $status = (($body['status'] ?? '') === 'published') ? 'published' : 'draft';
        $cover = gipt_sanitize_url((string) ($body['cover_image'] ?? ''));
        $categoryId = !empty($body['category_id']) ? (int) $body['category_id'] : null;
        $featured = (($user['role'] ?? '') === 'super_admin') ? !empty($body['featured']) : false;
        $excerpt = trim((string) ($body['excerpt'] ?? ''));
        if ($excerpt === '') {
            $excerpt = trim(substr($content, 0, 180));
        }

        $created = $repo->createPost([
            'title' => $title,
            'slug' => trim((string) ($body['slug'] ?? '')) ?: gipt_slugify($title),
            'excerpt' => $excerpt,
            'content' => $content,
            'cover_image' => $cover,
            'category_id' => $categoryId,
            'author_id' => (int) $user['id'],
            'tags' => trim((string) ($body['tags'] ?? '')),
            'reading_time' => gipt_calculate_reading_time($content),
            'featured' => $featured,
            'status' => $status,
        ]);

        gipt_json($created, 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/posts/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $id = (int) $m[1];
        $existing = $repo->getPostById($id);
        if ($existing === null) {
            gipt_error('Post not found.', 404);
        }
        if (($user['role'] ?? '') === 'author' && (int) $existing['author_id'] !== (int) $user['id']) {
            gipt_error('You may only edit your own articles.', 403);
        }

        $body = gipt_read_json_body();
        $title = array_key_exists('title', $body) ? trim((string) $body['title']) : (string) $existing['title'];
        $content = array_key_exists('content', $body) ? trim((string) $body['content']) : (string) $existing['content'];
        if (strlen($title) < 3 || strlen($content) < 10) {
            gipt_error('Title and article body content are required.', 400);
        }

        $status = (string) $existing['status'];
        if (($body['status'] ?? '') === 'published') {
            $status = 'published';
        } elseif (($body['status'] ?? '') === 'draft') {
            $status = 'draft';
        }

        $categoryId = $existing['category_id'];
        if (array_key_exists('category_id', $body)) {
            $categoryId = !empty($body['category_id']) ? (int) $body['category_id'] : null;
        }

        $featured = (bool) $existing['featured'];
        if (($user['role'] ?? '') === 'super_admin' && array_key_exists('featured', $body)) {
            $featured = !empty($body['featured']);
        }

        $updated = $repo->updatePost($id, [
            'title' => $title,
            'slug' => array_key_exists('slug', $body) ? trim((string) $body['slug']) : (string) $existing['slug'],
            'excerpt' => array_key_exists('excerpt', $body) ? trim((string) $body['excerpt']) : (string) $existing['excerpt'],
            'content' => $content,
            'cover_image' => array_key_exists('cover_image', $body)
                ? gipt_sanitize_url((string) $body['cover_image'])
                : (string) $existing['cover_image'],
            'category_id' => $categoryId,
            'tags' => array_key_exists('tags', $body) ? trim((string) $body['tags']) : (string) $existing['tags'],
            'reading_time' => gipt_calculate_reading_time($content),
            'featured' => $featured,
            'status' => $status,
        ]);

        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/posts/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $id = (int) $m[1];
        $existing = $repo->getPostById($id);
        if ($existing === null) {
            gipt_error('Post not found.', 404);
        }
        if (($user['role'] ?? '') === 'author' && (int) $existing['author_id'] !== (int) $user['id']) {
            gipt_error('You may only delete your own articles.', 403);
        }
        $repo->deletePost($id);
        gipt_json(['success' => true]);
    }

    // -------------------- CATEGORIES CRUD (Super Admin only) --------------------

    if ($method === 'POST' && $route === '/admin/categories') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $body = gipt_read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        if (strlen($name) < 2) {
            gipt_error('Category name is required.', 400);
        }
        $slug = gipt_slugify((string) ($body['slug'] ?? $name));
        if ($slug === '') {
            gipt_error('Valid category slug is required.', 400);
        }
        $description = trim((string) ($body['description'] ?? ''));
        try {
            gipt_json($repo->createCategory($name, $slug, $description), 201);
        } catch (PDOException) {
            gipt_error('A category with that slug already exists.', 400);
        }
    }

    if ($method === 'PUT' && preg_match('#^/admin/categories/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        $body = gipt_read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        if (strlen($name) < 2) {
            gipt_error('Category name is required.', 400);
        }
        $slug = gipt_slugify((string) ($body['slug'] ?? $name));
        $description = trim((string) ($body['description'] ?? ''));
        try {
            $updated = $repo->updateCategory($id, $name, $slug, $description);
        } catch (PDOException) {
            gipt_error('A category with that slug already exists.', 400);
        }
        if ($updated === null) {
            gipt_error('Category not found.', 404);
        }
        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/categories/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        if (!$repo->deleteCategory((int) $m[1])) {
            gipt_error('Category not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    // -------------------- PROGRAMS CRUD (Super Admin only) --------------------

    if ($method === 'POST' && $route === '/admin/programs') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $body = gipt_read_json_body();
        $title = trim((string) ($body['title'] ?? ''));
        $level = (string) ($body['level'] ?? '');
        if (strlen($title) < 3 || !in_array($level, ['undergraduate', 'postgraduate', 'short_course'], true)) {
            gipt_error('Valid program title and academic level are required.', 400);
        }

        $created = $repo->createProgram([
            'title' => $title,
            'slug' => gipt_slugify((string) ($body['slug'] ?? $title)),
            'level' => $level,
            'faculty' => trim((string) ($body['faculty'] ?? '')),
            'duration' => trim((string) ($body['duration'] ?? '')),
            'study_mode' => trim((string) ($body['study_mode'] ?? '')),
            'entry_requirements' => trim((string) ($body['entry_requirements'] ?? '')),
            'summary' => trim((string) ($body['summary'] ?? '')),
            'highlights' => trim((string) ($body['highlights'] ?? '')),
            'intake' => trim((string) ($body['intake'] ?? '')),
            'featured' => !empty($body['featured']),
        ]);
        gipt_json($created, 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/programs/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        $body = gipt_read_json_body();

        $updateData = [];
        foreach (['title', 'slug', 'faculty', 'duration', 'study_mode', 'entry_requirements', 'summary', 'highlights', 'intake'] as $field) {
            if (array_key_exists($field, $body)) {
                $updateData[$field] = trim((string) $body[$field]);
            }
        }
        if (array_key_exists('level', $body)) {
            $level = (string) $body['level'];
            if (!in_array($level, ['undergraduate', 'postgraduate', 'short_course'], true)) {
                gipt_error('Invalid academic level.', 400);
            }
            $updateData['level'] = $level;
        }
        if (array_key_exists('featured', $body)) {
            $updateData['featured'] = !empty($body['featured']);
        }

        $updated = $repo->updateProgram($id, $updateData);
        if ($updated === null) {
            gipt_error('Program not found.', 404);
        }
        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/programs/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        if (!$repo->deleteProgram((int) $m[1])) {
            gipt_error('Program not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    // -------------------- RESOURCES CRUD (Super Admin only) --------------------

    if ($method === 'POST' && $route === '/admin/resources') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $body = gipt_read_json_body();
        $title = trim((string) ($body['title'] ?? ''));
        $category = trim((string) ($body['category'] ?? ''));
        if (strlen($title) < 3 || $category === '') {
            gipt_error('Publication title and category are required.', 400);
        }

        $created = $repo->createResource([
            'title' => $title,
            'category' => $category,
            'summary' => trim((string) ($body['summary'] ?? '')),
            'file_url' => gipt_sanitize_url((string) ($body['file_url'] ?? '')),
            'publication_year' => trim((string) ($body['publication_year'] ?? date('Y'))),
            'file_size' => trim((string) ($body['file_size'] ?? '1.0 MB PDF')),
        ]);
        gipt_json($created, 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/resources/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        $body = gipt_read_json_body();

        $updateData = [];
        foreach (['title', 'category', 'summary', 'publication_year', 'file_size'] as $field) {
            if (array_key_exists($field, $body)) {
                $updateData[$field] = trim((string) $body[$field]);
            }
        }
        if (array_key_exists('file_url', $body)) {
            $updateData['file_url'] = gipt_sanitize_url((string) $body['file_url']);
        }

        $updated = $repo->updateResource($id, $updateData);
        if ($updated === null) {
            gipt_error('Publication not found.', 404);
        }
        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/resources/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        if (!$repo->deleteResource((int) $m[1])) {
            gipt_error('Publication not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    // -------------------- INQUIRIES & SUBSCRIBERS (Super Admin only) --------------------

    if ($method === 'GET' && $route === '/admin/inquiries') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        gipt_json($repo->listInquiries());
    }

    if ($method === 'PUT' && preg_match('#^/admin/inquiries/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        $body = gipt_read_json_body();

        $updateData = [];
        if (array_key_exists('status', $body) && $body['status'] !== null && $body['status'] !== '') {
            $status = (string) $body['status'];
            if (!in_array($status, ['new', 'in_progress', 'resolved'], true)) {
                gipt_error('Invalid inquiry status.', 400);
            }
            $updateData['status'] = $status;
        }
        if (array_key_exists('admin_notes', $body)) {
            $updateData['admin_notes'] = trim((string) $body['admin_notes']);
        }

        $updated = $repo->updateInquiry($id, $updateData);
        if ($updated === null) {
            gipt_error('Inquiry not found.', 404);
        }
        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/inquiries/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        if (!$repo->deleteInquiry((int) $m[1])) {
            gipt_error('Inquiry not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    if ($method === 'GET' && $route === '/admin/subscribers') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        gipt_json($repo->listSubscribers());
    }

    if ($method === 'DELETE' && preg_match('#^/admin/subscribers/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        if (!$repo->deleteSubscriber((int) $m[1])) {
            gipt_error('Subscriber not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    // -------------------- USERS CRUD (Super Admin only) --------------------

    if ($method === 'GET' && $route === '/admin/users') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        gipt_json($repo->listUsers());
    }

    if ($method === 'POST' && $route === '/admin/users') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $body = gipt_read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $role = (($body['role'] ?? '') === 'super_admin') ? 'super_admin' : 'author';
        $title = trim((string) ($body['title'] ?? ''));
        $bio = trim((string) ($body['bio'] ?? ''));

        if (strlen($name) < 2 || !gipt_is_valid_email($email) || strlen($password) < 8) {
            gipt_error('Valid name, email, and password (min 8 characters) are required.', 400);
        }

        if ($repo->getUserByEmail($email) !== null) {
            gipt_error('An account with this email already exists.', 409);
        }

        $created = $repo->createUser([
            'name' => $name,
            'email' => $email,
            'password_hash' => gipt_hash_password($password),
            'role' => $role,
            'title' => $title,
            'bio' => $bio,
        ]);
        gipt_json($created, 201);
    }

    if ($method === 'PUT' && preg_match('#^/admin/users/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        $body = gipt_read_json_body();

        $updateData = [];
        if (array_key_exists('name', $body)) {
            $updateData['name'] = trim((string) $body['name']);
        }
        if (array_key_exists('email', $body)) {
            $email = strtolower(trim((string) $body['email']));
            if (!gipt_is_valid_email($email)) {
                gipt_error('Valid email is required.', 400);
            }
            $updateData['email'] = $email;
        }
        if (($body['role'] ?? '') === 'super_admin' || ($body['role'] ?? '') === 'author') {
            $updateData['role'] = (string) $body['role'];
        }
        if (array_key_exists('title', $body)) {
            $updateData['title'] = trim((string) $body['title']);
        }
        if (array_key_exists('bio', $body)) {
            $updateData['bio'] = trim((string) $body['bio']);
        }
        if (!empty($body['password'])) {
            $pw = (string) $body['password'];
            if (strlen($pw) < 8) {
                gipt_error('Password must be at least 8 characters.', 400);
            }
            $updateData['password_hash'] = gipt_hash_password($pw);
        }

        try {
            $updated = $repo->updateUser($id, $updateData);
        } catch (PDOException) {
            gipt_error('Another account already uses that email address.', 409);
        }
        if ($updated === null) {
            gipt_error('User not found.', 404);
        }
        gipt_json($updated);
    }

    if ($method === 'DELETE' && preg_match('#^/admin/users/(\d+)$#', $route, $m)) {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $id = (int) $m[1];
        if ($id === (int) $user['id']) {
            gipt_error('You cannot delete your own active account.', 400);
        }
        if (!$repo->deleteUser($id)) {
            gipt_error('User not found.', 404);
        }
        gipt_json(['success' => true]);
    }

    // -------------------- SITE SETTINGS (Super Admin only) --------------------

    if ($method === 'PUT' && $route === '/admin/settings') {
        $user = $requireAuth();
        $requireSuperAdmin($user);
        $current = $repo->getSettings();
        $incoming = gipt_read_json_body();

        $sanitizedSlides = $current['hero_slides'] ?? [];
        if (isset($incoming['hero_slides']) && is_array($incoming['hero_slides'])) {
            $sanitizedSlides = array_map(static function (mixed $slide): array {
                $s = is_array($slide) ? $slide : [];
                $s['image_url'] = gipt_sanitize_url((string) ($s['image_url'] ?? ''));
                $s['primary_cta_link'] = gipt_sanitize_url((string) ($s['primary_cta_link'] ?? '')) ?: '/programs';
                $s['secondary_cta_link'] = gipt_sanitize_url((string) ($s['secondary_cta_link'] ?? '')) ?: '/#knowledge-hub';
                return $s;
            }, $incoming['hero_slides']);
        }

        $allowedKeys = array_flip(array_keys($current));
        $filteredIncoming = array_intersect_key($incoming, $allowedKeys);
        $merged = array_merge($current, $filteredIncoming);
        $merged['hero_slides'] = $sanitizedSlides;
        if (array_key_exists('logo_url', $incoming)) {
            $merged['logo_url'] = gipt_sanitize_url((string) $incoming['logo_url']);
        }
        if (array_key_exists('announcement_link_url', $incoming)) {
            $merged['announcement_link_url'] = gipt_sanitize_url((string) $incoming['announcement_link_url']) ?: '/programs';
        }
        foreach (['social_linkedin', 'social_twitter', 'social_facebook', 'social_youtube'] as $socialKey) {
            if (array_key_exists($socialKey, $incoming)) {
                $merged[$socialKey] = gipt_sanitize_url((string) $incoming[$socialKey]);
            }
        }

        gipt_json($repo->saveSettings($merged));
    }

    // 404 for unknown API routes
    gipt_error('API endpoint not found.', 404);
} catch (Throwable $e) {
    $message = $debugMode
        ? 'Internal server error: ' . $e->getMessage()
        : 'An unexpected server error occurred.';
    gipt_error($message, 500);
}
