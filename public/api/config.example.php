<?php
declare(strict_types=1);

/**
 * GIPT PHP 8+ Backend Configuration Template (cPanel Shared Hosting)
 *
 * Instructions:
 * 1. Copy this file to `api/config.php` inside your cPanel `public_html/api/` directory.
 * 2. Fill in your cPanel MySQL database credentials and a strong random JWT_SECRET.
 * 3. Change ADMIN_PASSWORD to a strong password before deploying to production.
 * 4. Keep `api/config.php` out of version control (blocked from HTTP access via `.htaccess`).
 */

return [
    // MySQL Database Settings (from cPanel -> MySQL Databases)
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'your_cpanel_gipt_db',
    'db_user' => 'your_cpanel_db_user',
    'db_pass' => 'your_strong_db_password',

    // Secret key used to sign HTTP-only JWT authentication tokens (min 32 random chars)
    // Generate one via: php -r "echo bin2hex(random_bytes(32));"
    'jwt_secret' => 'REPLACE_WITH_64_CHAR_RANDOM_HEX_SECRET',

    // Initial Super Admin seeded automatically on first database boot when users table is empty
    'admin_email' => 'admin@gipt.edu.mw',
    'admin_password' => 'ChangeThisStrongPassword!2026',

    // Optional secondary author seeded on first boot (set to '' to skip)
    'author_email' => 'editor@gipt.edu.mw',
    'author_password' => 'ChangeThisAuthorPassword!2026',

    // Set to false on production cPanel hosting
    'debug' => false,
];
