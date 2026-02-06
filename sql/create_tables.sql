-- ============================================================
-- Shogunate Map - Clan Families & Marriages Tables
-- Run this in your phpMyAdmin SQL console
-- ============================================================

-- Table for clan family members (leaders and children for the marriage/alliance system)
-- Each clan's daimyo can add their family members here.
-- roblox_user_id links to actual Roblox profiles for avatar fetching.
CREATE TABLE IF NOT EXISTS roblox_clan_families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clan_id INT NOT NULL,                           -- FK to roblox_clans.id
    roblox_user_id BIGINT DEFAULT NULL,             -- Roblox user ID (for profile picture)
    character_name VARCHAR(100) NOT NULL,            -- Character name in the Sengoku setting
    role ENUM('leader', 'child') NOT NULL DEFAULT 'child',
    gender ENUM('male', 'female') NOT NULL,
    title VARCHAR(100) DEFAULT NULL,                -- Optional title (e.g. "Tiger of Kai")
    display_order INT NOT NULL DEFAULT 0,           -- Sort order within clan family
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clan_id (clan_id),
    INDEX idx_roblox_user (roblox_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for marriages between clan family members (= alliances)
-- A marriage in 'accepted' status means the two clans are allied.
-- Dissolving a marriage breaks the alliance.
CREATE TABLE IF NOT EXISTS roblox_clan_marriages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    person1_id INT NOT NULL,                        -- FK to roblox_clan_families.id
    person2_id INT NOT NULL,                        -- FK to roblox_clan_families.id
    clan1_id INT NOT NULL,                          -- Clan of person1 (for quick lookups)
    clan2_id INT NOT NULL,                          -- Clan of person2
    status ENUM('proposed', 'accepted', 'dissolved') NOT NULL DEFAULT 'proposed',
    proposed_by_clan_id INT NOT NULL,               -- Which clan initiated the proposal
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
