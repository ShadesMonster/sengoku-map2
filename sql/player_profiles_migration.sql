-- ============================================================
-- Shogunate - Player Profiles Table
-- Synced from the Roblox game whenever a player changes their
-- profile (given name, title, prefix, hide-prefix toggle).
-- The web map reads from this instead of daimyo_rp_name.
-- ============================================================

CREATE TABLE IF NOT EXISTS roblox_player_profiles (
    roblox_user_id BIGINT PRIMARY KEY,
    given_name     VARCHAR(50)  DEFAULT NULL,   -- e.g. "Pinheddonob"
    title          VARCHAR(100) DEFAULT NULL,   -- e.g. "Ronin", "The Wise"
    prefix         VARCHAR(50)  DEFAULT NULL,   -- clan rank e.g. "Emperor", "Daimyo", "Karo (Elder)"
    prefix_hidden  TINYINT(1)   NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
