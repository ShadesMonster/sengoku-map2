-- ============================================================
-- Shogunate Map - Clan Families & Marriages Tables
-- Run this in your phpMyAdmin SQL console (SQL tab)
-- ============================================================

-- Children of clan leaders (for marriage/alliance system).
-- Leaders auto-populate from roblox_clans daimyo fields.
-- clan_id references roblox_clans.clan_id.
-- roblox_user_id must match a member in roblox_clan_members for that clan.
CREATE TABLE IF NOT EXISTS roblox_clan_families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,                           -- References roblox_clans.clan_id
    roblox_user_id BIGINT DEFAULT NULL,             -- Roblox user ID (for profile picture)
    character_name VARCHAR(100) NOT NULL,            -- RP character name
    role ENUM('leader', 'child') NOT NULL DEFAULT 'child',
    gender ENUM('male', 'female') NOT NULL,
    title VARCHAR(100) DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clan_id (clan_id),
    INDEX idx_roblox_user (roblox_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Marriages between clan family members (= alliances).
-- status 'accepted' = active alliance.
-- status 'dissolved' = broken alliance (kept for history).
CREATE TABLE IF NOT EXISTS roblox_clan_marriages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    person1_id INT NOT NULL,                        -- FK to roblox_clan_families.id
    person2_id INT NOT NULL,                        -- FK to roblox_clan_families.id
    clan1_id INT NOT NULL,                          -- Clan of person1
    clan2_id INT NOT NULL,                          -- Clan of person2
    status ENUM('proposed', 'accepted', 'dissolved') NOT NULL DEFAULT 'proposed',
    proposed_by_clan_id INT NOT NULL,               -- Which clan proposed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (person1_id) REFERENCES roblox_clan_families(id) ON DELETE CASCADE,
    FOREIGN KEY (person2_id) REFERENCES roblox_clan_families(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_clan1 (clan1_id),
    INDEX idx_clan2 (clan2_id),
    INDEX idx_person1 (person1_id),
    INDEX idx_person2 (person2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
