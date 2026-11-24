<?php
declare(strict_types=1);

/**
 * GIPT PHP 8+ PDO Database Layer (MySQL utf8mb4 with automatic SQLite local preview fallback).
 *
 * - Reads `config.php` if present (or environment variables).
 * - Uses native prepared statements (`PDO::ATTR_EMULATE_PREPARES => false`).
 * - Auto-initializes all 8 tables (`CREATE TABLE IF NOT EXISTS`) and seeds sample GIPT content
 *   plus the initial Super Admin account on first request when the database is empty.
 */

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/seed.php';

/**
 * @return array<string, mixed>
 */
function gipt_load_config(): array
{
    $configFile = __DIR__ . '/config.php';
    $fileConfig = [];
    if (is_file($configFile)) {
        $loaded = require $configFile;
        if (is_array($loaded)) {
            $fileConfig = $loaded;
        }
    }

    return [
        'db_host' => (string) ($fileConfig['db_host'] ?? (getenv('DB_HOST') ?: '')),
        'db_port' => (int) ($fileConfig['db_port'] ?? (getenv('DB_PORT') ?: 3306)),
        'db_name' => (string) ($fileConfig['db_name'] ?? (getenv('DB_NAME') ?: '')),
        'db_user' => (string) ($fileConfig['db_user'] ?? (getenv('DB_USER') ?: '')),
        'db_pass' => (string) ($fileConfig['db_pass'] ?? (getenv('DB_PASSWORD') ?: (getenv('DB_PASS') ?: ''))),
        'jwt_secret' => (string) ($fileConfig['jwt_secret'] ?? (getenv('JWT_SECRET') ?: '')),
        'admin_email' => strtolower(trim((string) ($fileConfig['admin_email'] ?? (getenv('ADMIN_EMAIL') ?: 'admin@gipt.edu.mw')))),
        'admin_password' => (string) ($fileConfig['admin_password'] ?? (getenv('ADMIN_PASSWORD') ?: 'Admin@1234')),
        'author_email' => strtolower(trim((string) ($fileConfig['author_email'] ?? (getenv('AUTHOR_EMAIL') ?: 'editor@gipt.edu.mw')))),
        'author_password' => (string) ($fileConfig['author_password'] ?? (getenv('AUTHOR_PASSWORD') ?: 'Author@1234')),
        'debug' => (bool) ($fileConfig['debug'] ?? false),
    ];
}

final class GiptRepository
{
    public PDO $pdo;
    public string $driver; // 'mysql' | 'sqlite'
    /** @var array<string, mixed> */
    public array $config;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(PDO $pdo, string $driver, array $config)
    {
        $this->pdo = $pdo;
        $this->driver = $driver;
        $this->config = $config;
    }

    public static function boot(): self
    {
        $config = gipt_load_config();
        $pdoOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $hasMysqlConfig =
            $config['db_host'] !== '' &&
            $config['db_name'] !== '' &&
            $config['db_user'] !== '' &&
            $config['db_name'] !== 'your_cpanel_gipt_db';

        if ($hasMysqlConfig) {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $config['db_host'],
                $config['db_port'],
                $config['db_name']
            );
            $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], $pdoOptions);
            $repo = new self($pdo, 'mysql', $config);
            $repo->initializeSchemaAndSeed();
            return $repo;
        }

        // Graceful local fallback using PDO SQLite when config.php is not yet configured
        $dataDir = __DIR__ . '/.data';
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0750, true);
        }
        $sqlitePath = $dataDir . '/gipt_local.sqlite';
        $pdo = new PDO('sqlite:' . $sqlitePath, null, null, $pdoOptions);
        $pdo->exec('PRAGMA foreign_keys = ON;');
        $repo = new self($pdo, 'sqlite', $config);
        $repo->initializeSchemaAndSeed();
        return $repo;
    }

    private function initializeSchemaAndSeed(): void
    {
        if ($this->driver === 'mysql') {
            $this->createMysqlTables();
        } else {
            $this->createSqliteTables();
        }

        $userCount = (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($userCount === 0) {
            $this->seedInitialData();
        }
    }

    private function createMysqlTables(): void
    {
        $statements = [
            "CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(190) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('super_admin', 'author') NOT NULL DEFAULT 'author',
                title VARCHAR(180) DEFAULT '',
                bio TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                slug VARCHAR(150) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                excerpt TEXT,
                content LONGTEXT NOT NULL,
                cover_image VARCHAR(500) DEFAULT '',
                category_id INT NULL,
                author_id INT NOT NULL,
                tags VARCHAR(500) DEFAULT '',
                reading_time INT NOT NULL DEFAULT 1,
                featured TINYINT(1) NOT NULL DEFAULT 0,
                status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
                published_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
                CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS programs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                level ENUM('undergraduate', 'postgraduate', 'short_course') NOT NULL,
                faculty VARCHAR(180) DEFAULT '',
                duration VARCHAR(120) DEFAULT '',
                study_mode VARCHAR(120) DEFAULT '',
                entry_requirements TEXT,
                summary TEXT,
                highlights TEXT,
                intake VARCHAR(120) DEFAULT '',
                featured TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS resources (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                summary TEXT,
                file_url VARCHAR(500) NOT NULL,
                publication_year VARCHAR(16) DEFAULT '2026',
                file_size VARCHAR(60) DEFAULT '1.2 MB PDF',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS inquiries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(190) NOT NULL,
                phone VARCHAR(60) DEFAULT '',
                category VARCHAR(100) NOT NULL DEFAULT 'General',
                program_of_interest VARCHAR(255) DEFAULT '',
                message TEXT NOT NULL,
                status ENUM('new', 'in_progress', 'resolved') NOT NULL DEFAULT 'new',
                admin_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS subscribers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(190) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

            "CREATE TABLE IF NOT EXISTS site_settings (
                setting_key VARCHAR(120) PRIMARY KEY,
                setting_value LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ];

        foreach ($statements as $sql) {
            $this->pdo->exec($sql);
        }
    }

    private function createSqliteTables(): void
    {
        $statements = [
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'author',
                title TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                description TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                excerpt TEXT DEFAULT '',
                content TEXT NOT NULL,
                cover_image TEXT DEFAULT '',
                category_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tags TEXT DEFAULT '',
                reading_time INTEGER NOT NULL DEFAULT 1,
                featured INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'draft',
                published_at TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS programs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                level TEXT NOT NULL,
                faculty TEXT DEFAULT '',
                duration TEXT DEFAULT '',
                study_mode TEXT DEFAULT '',
                entry_requirements TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                highlights TEXT DEFAULT '',
                intake TEXT DEFAULT '',
                featured INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                summary TEXT DEFAULT '',
                file_url TEXT NOT NULL,
                publication_year TEXT DEFAULT '2026',
                file_size TEXT DEFAULT '1.2 MB PDF',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS inquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT DEFAULT '',
                category TEXT NOT NULL DEFAULT 'General',
                program_of_interest TEXT DEFAULT '',
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                admin_notes TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS site_settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
        ];

        foreach ($statements as $sql) {
            $this->pdo->exec($sql);
        }
    }

    private function seedInitialData(): void
    {
        $seed = gipt_seed_data();

        // 1. Seed Super Admin & secondary Author
        $adminEmail = $this->config['admin_email'] ?: 'admin@gipt.edu.mw';
        $adminPassword = $this->config['admin_password'] ?: 'Admin@1234';
        $adminStmt = $this->pdo->prepare(
            'INSERT INTO users (name, email, password_hash, role, title, bio) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $adminStmt->execute([
            'Prof. Hastings Chikwanda',
            $adminEmail,
            gipt_hash_password($adminPassword),
            'super_admin',
            'Principal & Lead Research Mentor',
            'Senior academic leader and quantitative research mentor overseeing GIPT’s institutional strategy, mentorship clinics, and short-course excellence.',
        ]);
        $adminId = (int) $this->pdo->lastInsertId();

        $authorId = $adminId;
        $authorEmail = $this->config['author_email'];
        $authorPassword = $this->config['author_password'];
        if ($authorEmail !== '' && $authorEmail !== $adminEmail && $authorPassword !== '') {
            $adminStmt->execute([
                'Dr. Grace Nkhoma',
                $authorEmail,
                gipt_hash_password($authorPassword),
                'author',
                'Director, Flagship Research Mentorship & Methods',
                'Methodologist overseeing GIPT’s Flagship Research Mentorship Programme and the August–September Research Methods Short Courses calendar.',
            ]);
            $authorId = (int) $this->pdo->lastInsertId();
        }

        // 2. Seed Categories
        $catMap = [];
        $catStmt = $this->pdo->prepare(
            'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
        );
        foreach ($seed['categories'] as $c) {
            $catStmt->execute([$c['name'], $c['slug'], $c['description']]);
            $catMap[$c['slug']] = (int) $this->pdo->lastInsertId();
        }

        // 3. Seed Programs
        $progStmt = $this->pdo->prepare(
            'INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed['programs'] as $p) {
            $progStmt->execute([
                $p['title'],
                $p['slug'],
                $p['level'],
                $p['faculty'],
                $p['duration'],
                $p['study_mode'],
                $p['entry_requirements'],
                $p['summary'],
                $p['highlights'],
                $p['intake'],
                $p['featured'],
            ]);
        }

        // 4. Seed Posts
        $postStmt = $this->pdo->prepare(
            'INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed['posts'] as $post) {
            $pubDate = $this->driver === 'mysql'
                ? gmdate('Y-m-d H:i:s', strtotime($post['published_at']))
                : $post['published_at'];
            $postStmt->execute([
                $post['title'],
                $post['slug'],
                $post['excerpt'],
                $post['content'],
                $post['cover_image'],
                $catMap[$post['category_slug']] ?? null,
                $post['author_role'] === 'author' ? $authorId : $adminId,
                $post['tags'],
                gipt_calculate_reading_time($post['content']),
                $post['featured'],
                $post['status'],
                $pubDate,
            ]);
        }

        // 5. Seed Resources
        $resStmt = $this->pdo->prepare(
            'INSERT INTO resources (title, category, summary, file_url, publication_year, file_size) VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed['resources'] as $r) {
            $resStmt->execute([
                $r['title'],
                $r['category'],
                $r['summary'],
                $r['file_url'],
                $r['publication_year'],
                $r['file_size'],
            ]);
        }

        // 6. Seed Inquiries
        $inqStmt = $this->pdo->prepare(
            'INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($seed['inquiries'] as $inq) {
            $inqStmt->execute([
                $inq['name'],
                $inq['email'],
                $inq['phone'],
                $inq['category'],
                $inq['program_of_interest'],
                $inq['message'],
                $inq['status'],
                $inq['admin_notes'],
            ]);
        }

        // 7. Seed Subscribers
        $subStmt = $this->pdo->prepare('INSERT INTO subscribers (email) VALUES (?)');
        foreach ($seed['subscribers'] as $email) {
            $subStmt->execute([$email]);
        }

        // 8. Seed Site Settings
        $this->saveSettings($seed['settings']);
    }

    // ==================== USERS ====================

    /** @return array<string, mixed>|null */
    public function getUserByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1');
        $stmt->execute([trim($email)]);
        $row = $stmt->fetch();
        return $row ? $this->formatUser($row, true) : null;
    }

    /** @return array<string, mixed>|null */
    public function getUserById(int $id, bool $includeHash = false): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->formatUser($row, $includeHash) : null;
    }

    /** @return array<int, array<string, mixed>> */
    public function listUsers(): array
    {
        $rows = $this->pdo->query('SELECT * FROM users ORDER BY id ASC')->fetchAll();
        return array_map(fn(array $r) => $this->formatUser($r, false), $rows);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createUser(array $data): array
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (name, email, password_hash, role, title, bio) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['email'],
            $data['password_hash'],
            $data['role'],
            $data['title'] ?? '',
            $data['bio'] ?? '',
        ]);
        return $this->getUserById((int) $this->pdo->lastInsertId()) ?? [];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updateUser(int $id, array $data): ?array
    {
        $existing = $this->getUserById($id, true);
        if (!$existing) {
            return null;
        }
        $fields = [];
        $params = [];
        foreach (['name', 'email', 'role', 'title', 'bio', 'password_hash'] as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "$col = ?";
                $params[] = $data[$col];
            }
        }
        if ($fields !== []) {
            $params[] = $id;
            $stmt = $this->pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?');
            $stmt->execute($params);
        }
        return $this->getUserById($id, false);
    }

    public function deleteUser(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $row */
    private function formatUser(array $row, bool $includeHash): array
    {
        $user = [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'role' => (string) $row['role'],
            'title' => (string) ($row['title'] ?? ''),
            'bio' => (string) ($row['bio'] ?? ''),
            'created_at' => $this->toIso((string) ($row['created_at'] ?? '')),
        ];
        if ($includeHash) {
            $user['password_hash'] = (string) $row['password_hash'];
        }
        return $user;
    }

    // ==================== CATEGORIES ====================

    /** @return array<int, array<string, mixed>> */
    public function listCategories(): array
    {
        $rows = $this->pdo->query('SELECT * FROM categories ORDER BY name ASC')->fetchAll();
        return array_map(fn(array $r) => $this->formatCategory($r), $rows);
    }

    /** @return array<string, mixed> */
    public function createCategory(string $name, string $slug, string $description): array
    {
        $stmt = $this->pdo->prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)');
        $stmt->execute([$name, $slug, $description]);
        $id = (int) $this->pdo->lastInsertId();
        $row = $this->pdo->prepare('SELECT * FROM categories WHERE id = ?');
        $row->execute([$id]);
        return $this->formatCategory($row->fetch());
    }

    /** @return array<string, mixed>|null */
    public function updateCategory(int $id, string $name, string $slug, string $description): ?array
    {
        $stmt = $this->pdo->prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?');
        $stmt->execute([$name, $slug, $description, $id]);
        $fetch = $this->pdo->prepare('SELECT * FROM categories WHERE id = ?');
        $fetch->execute([$id]);
        $row = $fetch->fetch();
        return $row ? $this->formatCategory($row) : null;
    }

    public function deleteCategory(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $r */
    private function formatCategory(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'name' => (string) $r['name'],
            'slug' => (string) $r['slug'],
            'description' => (string) ($r['description'] ?? ''),
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
        ];
    }

    // ==================== POSTS ====================

    /** @return array<int, array<string, mixed>> */
    public function listPosts(string $status = 'published', ?int $authorId = null): array
    {
        $where = [];
        $params = [];
        if ($status !== 'all') {
            $where[] = 'p.status = ?';
            $params[] = $status;
        }
        if ($authorId !== null) {
            $where[] = 'p.author_id = ?';
            $params[] = $authorId;
        }
        $sql = 'SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                       u.name AS author_name, u.title AS author_title, u.bio AS author_bio
                FROM posts p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.author_id = u.id';
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return array_map(fn(array $r) => $this->formatPost($r), $stmt->fetchAll());
    }

    /** @return array<string, mixed>|null */
    public function getPostBySlug(string $slug): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                    u.name AS author_name, u.title AS author_title, u.bio AS author_bio
             FROM posts p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN users u ON p.author_id = u.id
             WHERE p.slug = ? LIMIT 1'
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch();
        return $row ? $this->formatPost($row) : null;
    }

    /** @return array<string, mixed>|null */
    public function getPostById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.*, c.name AS category_name, c.slug AS category_slug,
                    u.name AS author_name, u.title AS author_title, u.bio AS author_bio
             FROM posts p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN users u ON p.author_id = u.id
             WHERE p.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->formatPost($row) : null;
    }

    private function ensureUniquePostSlug(string $rawSlug, ?int $excludeId = null): string
    {
        $base = gipt_slugify($rawSlug);
        if ($base === '') {
            $base = 'article';
        }
        $candidate = $base;
        $counter = 2;
        while (true) {
            if ($excludeId !== null) {
                $stmt = $this->pdo->prepare('SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1');
                $stmt->execute([$candidate, $excludeId]);
            } else {
                $stmt = $this->pdo->prepare('SELECT id FROM posts WHERE slug = ? LIMIT 1');
                $stmt->execute([$candidate]);
            }
            if (!$stmt->fetch()) {
                return $candidate;
            }
            $candidate = "$base-$counter";
            $counter++;
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createPost(array $data): array
    {
        $slug = $this->ensureUniquePostSlug((string) ($data['slug'] ?: $data['title']));
        $publishedAt = null;
        if (($data['status'] ?? 'draft') === 'published') {
            $publishedAt = $this->driver === 'mysql' ? gmdate('Y-m-d H:i:s') : gipt_now_iso();
        }
        $stmt = $this->pdo->prepare(
            'INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['title'],
            $slug,
            $data['excerpt'],
            $data['content'],
            $data['cover_image'],
            $data['category_id'],
            $data['author_id'],
            $data['tags'],
            $data['reading_time'],
            !empty($data['featured']) ? 1 : 0,
            $data['status'],
            $publishedAt,
        ]);
        return $this->getPostById((int) $this->pdo->lastInsertId()) ?? [];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updatePost(int $id, array $data): ?array
    {
        $existing = $this->getPostById($id);
        if (!$existing) {
            return null;
        }
        $slug = $this->ensureUniquePostSlug((string) ($data['slug'] ?? $existing['slug']), $id);
        $status = (string) ($data['status'] ?? $existing['status']);
        $publishedAt = $existing['published_at'];
        if ($status === 'published' && empty($publishedAt)) {
            $publishedAt = $this->driver === 'mysql' ? gmdate('Y-m-d H:i:s') : gipt_now_iso();
        } elseif ($this->driver === 'mysql' && !empty($publishedAt)) {
            $publishedAt = gmdate('Y-m-d H:i:s', strtotime((string) $publishedAt));
        }

        $nowSql = $this->driver === 'mysql' ? gmdate('Y-m-d H:i:s') : gipt_now_iso();
        $stmt = $this->pdo->prepare(
            'UPDATE posts
             SET title = ?, slug = ?, excerpt = ?, content = ?, cover_image = ?,
                 category_id = ?, tags = ?, reading_time = ?, featured = ?,
                 status = ?, published_at = ?, updated_at = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $data['title'],
            $slug,
            $data['excerpt'],
            $data['content'],
            $data['cover_image'],
            $data['category_id'],
            $data['tags'],
            $data['reading_time'],
            !empty($data['featured']) ? 1 : 0,
            $status,
            $publishedAt,
            $nowSql,
            $id,
        ]);
        return $this->getPostById($id);
    }

    public function deletePost(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $r */
    private function formatPost(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'slug' => (string) $r['slug'],
            'excerpt' => (string) ($r['excerpt'] ?? ''),
            'content' => (string) $r['content'],
            'cover_image' => (string) ($r['cover_image'] ?? ''),
            'category_id' => $r['category_id'] !== null ? (int) $r['category_id'] : null,
            'category_name' => (string) ($r['category_name'] ?? 'General'),
            'category_slug' => (string) ($r['category_slug'] ?? 'general'),
            'author_id' => (int) $r['author_id'],
            'author_name' => (string) ($r['author_name'] ?? 'GIPT Editorial Desk'),
            'author_title' => (string) ($r['author_title'] ?? ''),
            'author_bio' => (string) ($r['author_bio'] ?? ''),
            'tags' => (string) ($r['tags'] ?? ''),
            'reading_time' => (int) ($r['reading_time'] ?? 1),
            'featured' => (bool) $r['featured'],
            'status' => (string) $r['status'],
            'published_at' => !empty($r['published_at']) ? $this->toIso((string) $r['published_at']) : null,
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
            'updated_at' => $this->toIso((string) ($r['updated_at'] ?? '')),
        ];
    }

    // ==================== PROGRAMS ====================

    /** @return array<int, array<string, mixed>> */
    public function listPrograms(): array
    {
        $rows = $this->pdo->query('SELECT * FROM programs ORDER BY featured DESC, id ASC')->fetchAll();
        return array_map(fn(array $r) => $this->formatProgram($r), $rows);
    }

    private function ensureUniqueProgramSlug(string $rawSlug, ?int $excludeId = null): string
    {
        $base = gipt_slugify($rawSlug);
        if ($base === '') {
            $base = 'program';
        }
        $candidate = $base;
        $counter = 2;
        while (true) {
            if ($excludeId !== null) {
                $stmt = $this->pdo->prepare('SELECT id FROM programs WHERE slug = ? AND id != ? LIMIT 1');
                $stmt->execute([$candidate, $excludeId]);
            } else {
                $stmt = $this->pdo->prepare('SELECT id FROM programs WHERE slug = ? LIMIT 1');
                $stmt->execute([$candidate]);
            }
            if (!$stmt->fetch()) {
                return $candidate;
            }
            $candidate = "$base-$counter";
            $counter++;
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createProgram(array $data): array
    {
        $slug = $this->ensureUniqueProgramSlug((string) ($data['slug'] ?: $data['title']));
        $stmt = $this->pdo->prepare(
            'INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['title'],
            $slug,
            $data['level'],
            $data['faculty'],
            $data['duration'],
            $data['study_mode'],
            $data['entry_requirements'],
            $data['summary'],
            $data['highlights'],
            $data['intake'],
            !empty($data['featured']) ? 1 : 0,
        ]);
        $id = (int) $this->pdo->lastInsertId();
        $fetch = $this->pdo->prepare('SELECT * FROM programs WHERE id = ?');
        $fetch->execute([$id]);
        return $this->formatProgram($fetch->fetch());
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updateProgram(int $id, array $data): ?array
    {
        $fetch = $this->pdo->prepare('SELECT * FROM programs WHERE id = ?');
        $fetch->execute([$id]);
        $existing = $fetch->fetch();
        if (!$existing) {
            return null;
        }
        $title = $data['title'] ?? $existing['title'];
        $slug = array_key_exists('slug', $data)
            ? $this->ensureUniqueProgramSlug((string) $data['slug'], $id)
            : (string) $existing['slug'];
        $stmt = $this->pdo->prepare(
            'UPDATE programs
             SET title = ?, slug = ?, level = ?, faculty = ?, duration = ?, study_mode = ?,
                 entry_requirements = ?, summary = ?, highlights = ?, intake = ?, featured = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $title,
            $slug,
            $data['level'] ?? $existing['level'],
            $data['faculty'] ?? $existing['faculty'],
            $data['duration'] ?? $existing['duration'],
            $data['study_mode'] ?? $existing['study_mode'],
            $data['entry_requirements'] ?? $existing['entry_requirements'],
            $data['summary'] ?? $existing['summary'],
            $data['highlights'] ?? $existing['highlights'],
            $data['intake'] ?? $existing['intake'],
            array_key_exists('featured', $data) ? (!empty($data['featured']) ? 1 : 0) : (int) $existing['featured'],
            $id,
        ]);
        $fetch->execute([$id]);
        return $this->formatProgram($fetch->fetch());
    }

    public function deleteProgram(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM programs WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $r */
    private function formatProgram(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'slug' => (string) $r['slug'],
            'level' => (string) $r['level'],
            'faculty' => (string) ($r['faculty'] ?? ''),
            'duration' => (string) ($r['duration'] ?? ''),
            'study_mode' => (string) ($r['study_mode'] ?? ''),
            'entry_requirements' => (string) ($r['entry_requirements'] ?? ''),
            'summary' => (string) ($r['summary'] ?? ''),
            'highlights' => (string) ($r['highlights'] ?? ''),
            'intake' => (string) ($r['intake'] ?? ''),
            'featured' => (bool) $r['featured'],
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
        ];
    }

    // ==================== RESOURCES ====================

    /** @return array<int, array<string, mixed>> */
    public function listResources(): array
    {
        $rows = $this->pdo->query('SELECT * FROM resources ORDER BY id ASC')->fetchAll();
        return array_map(fn(array $r) => $this->formatResource($r), $rows);
    }

    /** @return array<string, mixed>|null */
    public function getResourceById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM resources WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->formatResource($row) : null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createResource(array $data): array
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO resources (title, category, summary, file_url, publication_year, file_size) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['title'],
            $data['category'],
            $data['summary'],
            $data['file_url'],
            $data['publication_year'],
            $data['file_size'],
        ]);
        $id = (int) $this->pdo->lastInsertId();
        if ($data['file_url'] === '') {
            $upd = $this->pdo->prepare('UPDATE resources SET file_url = ? WHERE id = ?');
            $upd->execute(["/api/resources/$id/download", $id]);
        }
        return $this->getResourceById($id) ?? [];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updateResource(int $id, array $data): ?array
    {
        $existing = $this->getResourceById($id);
        if (!$existing) {
            return null;
        }
        $stmt = $this->pdo->prepare(
            'UPDATE resources SET title = ?, category = ?, summary = ?, file_url = ?, publication_year = ?, file_size = ? WHERE id = ?'
        );
        $stmt->execute([
            $data['title'] ?? $existing['title'],
            $data['category'] ?? $existing['category'],
            $data['summary'] ?? $existing['summary'],
            $data['file_url'] ?? $existing['file_url'],
            $data['publication_year'] ?? $existing['publication_year'],
            $data['file_size'] ?? $existing['file_size'],
            $id,
        ]);
        return $this->getResourceById($id);
    }

    public function deleteResource(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM resources WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $r */
    private function formatResource(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'category' => (string) $r['category'],
            'summary' => (string) ($r['summary'] ?? ''),
            'file_url' => (string) $r['file_url'],
            'publication_year' => (string) ($r['publication_year'] ?? '2026'),
            'file_size' => (string) ($r['file_size'] ?? ''),
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
        ];
    }

    // ==================== INQUIRIES ====================

    /** @return array<int, array<string, mixed>> */
    public function listInquiries(): array
    {
        $rows = $this->pdo->query('SELECT * FROM inquiries ORDER BY id DESC')->fetchAll();
        return array_map(fn(array $r) => $this->formatInquiry($r), $rows);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createInquiry(array $data): array
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['email'],
            $data['phone'] ?? '',
            $data['category'] ?? 'General',
            $data['program_of_interest'] ?? '',
            $data['message'],
            'new',
            '',
        ]);
        $id = (int) $this->pdo->lastInsertId();
        $fetch = $this->pdo->prepare('SELECT * FROM inquiries WHERE id = ?');
        $fetch->execute([$id]);
        return $this->formatInquiry($fetch->fetch());
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updateInquiry(int $id, array $data): ?array
    {
        $fetch = $this->pdo->prepare('SELECT * FROM inquiries WHERE id = ?');
        $fetch->execute([$id]);
        $existing = $fetch->fetch();
        if (!$existing) {
            return null;
        }
        $stmt = $this->pdo->prepare('UPDATE inquiries SET status = ?, admin_notes = ? WHERE id = ?');
        $stmt->execute([
            $data['status'] ?? $existing['status'],
            $data['admin_notes'] ?? $existing['admin_notes'],
            $id,
        ]);
        $fetch->execute([$id]);
        return $this->formatInquiry($fetch->fetch());
    }

    public function deleteInquiry(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM inquiries WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    /** @param array<string, mixed> $r */
    private function formatInquiry(array $r): array
    {
        return [
            'id' => (int) $r['id'],
            'name' => (string) $r['name'],
            'email' => (string) $r['email'],
            'phone' => (string) ($r['phone'] ?? ''),
            'category' => (string) ($r['category'] ?? 'General'),
            'program_of_interest' => (string) ($r['program_of_interest'] ?? ''),
            'message' => (string) $r['message'],
            'status' => (string) $r['status'],
            'admin_notes' => (string) ($r['admin_notes'] ?? ''),
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
        ];
    }

    // ==================== SUBSCRIBERS ====================

    /** @return array<int, array<string, mixed>> */
    public function listSubscribers(): array
    {
        $rows = $this->pdo->query('SELECT * FROM subscribers ORDER BY id DESC')->fetchAll();
        return array_map(fn(array $r) => [
            'id' => (int) $r['id'],
            'email' => (string) $r['email'],
            'created_at' => $this->toIso((string) ($r['created_at'] ?? '')),
        ], $rows);
    }

    /** @return array{subscriber: array<string, mixed>, alreadyExists: bool} */
    public function addSubscriber(string $email): array
    {
        $clean = strtolower(trim($email));
        $stmt = $this->pdo->prepare('SELECT * FROM subscribers WHERE LOWER(email) = LOWER(?) LIMIT 1');
        $stmt->execute([$clean]);
        $existing = $stmt->fetch();
        if ($existing) {
            return [
                'subscriber' => [
                    'id' => (int) $existing['id'],
                    'email' => (string) $existing['email'],
                    'created_at' => $this->toIso((string) ($existing['created_at'] ?? '')),
                ],
                'alreadyExists' => true,
            ];
        }
        $ins = $this->pdo->prepare('INSERT INTO subscribers (email) VALUES (?)');
        $ins->execute([$clean]);
        $id = (int) $this->pdo->lastInsertId();
        $fetch = $this->pdo->prepare('SELECT * FROM subscribers WHERE id = ?');
        $fetch->execute([$id]);
        $row = $fetch->fetch();
        return [
            'subscriber' => [
                'id' => (int) $row['id'],
                'email' => (string) $row['email'],
                'created_at' => $this->toIso((string) ($row['created_at'] ?? '')),
            ],
            'alreadyExists' => false,
        ];
    }

    public function deleteSubscriber(int $id): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM subscribers WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    // ==================== SITE SETTINGS ====================

    /** @return array<string, mixed> */
    public function getSettings(): array
    {
        $defaults = gipt_seed_data()['settings'];
        $rows = $this->pdo->query('SELECT setting_key, setting_value FROM site_settings')->fetchAll();
        if ($rows === []) {
            return $defaults;
        }
        $merged = $defaults;
        foreach ($rows as $row) {
            $decoded = json_decode((string) $row['setting_value'], true);
            $merged[(string) $row['setting_key']] = json_last_error() === JSON_ERROR_NONE
                ? $decoded
                : (string) $row['setting_value'];
        }
        return $merged;
    }

    /**
     * @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    public function saveSettings(array $settings): array
    {
        $sql = $this->driver === 'mysql'
            ? 'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
               ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
            : 'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
               ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP';
        $stmt = $this->pdo->prepare($sql);
        foreach ($settings as $key => $val) {
            $encoded = json_encode($val, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $stmt->execute([(string) $key, (string) $encoded]);
        }
        return $this->getSettings();
    }

    // ==================== DASHBOARD STATS ====================

    /** @return array<string, int> */
    public function getDashboardStats(): array
    {
        return [
            'published_posts' => (int) $this->pdo->query("SELECT COUNT(*) FROM posts WHERE status = 'published'")->fetchColumn(),
            'draft_posts' => (int) $this->pdo->query("SELECT COUNT(*) FROM posts WHERE status = 'draft'")->fetchColumn(),
            'programs_count' => (int) $this->pdo->query('SELECT COUNT(*) FROM programs')->fetchColumn(),
            'resources_count' => (int) $this->pdo->query('SELECT COUNT(*) FROM resources')->fetchColumn(),
            'new_inquiries' => (int) $this->pdo->query("SELECT COUNT(*) FROM inquiries WHERE status = 'new'")->fetchColumn(),
            'total_inquiries' => (int) $this->pdo->query('SELECT COUNT(*) FROM inquiries')->fetchColumn(),
            'subscribers_count' => (int) $this->pdo->query('SELECT COUNT(*) FROM subscribers')->fetchColumn(),
            'authors_count' => (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        ];
    }

    private function toIso(string $raw): string
    {
        if ($raw === '') {
            return gipt_now_iso();
        }
        if (str_contains($raw, 'T') && str_ends_with($raw, 'Z')) {
            return $raw;
        }
        $ts = strtotime($raw);
        return $ts !== false ? gmdate('Y-m-d\TH:i:s.000\Z', $ts) : $raw;
    }
}
