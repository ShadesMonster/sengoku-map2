-- ============================================================
-- Family Groups Migration
-- Adds standalone family support alongside existing clan families.
-- Run AFTER create_tables.sql
-- ============================================================

-- Family groups: represents a family unit (standalone or clan-linked).
-- Standalone families: clan_id IS NULL, max_members = 8
-- Clan families:       clan_id set,    max_members = 16 (expandable to 32)
CREATE TABLE IF NOT EXISTS roblox_family_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    leader_user_id BIGINT NOT NULL,
    leader_username VARCHAR(50) DEFAULT NULL,
    leader_character_name VARCHAR(100) DEFAULT NULL,
    leader_gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
    clan_id INT DEFAULT NULL,
    max_members INT NOT NULL DEFAULT 8,
    is_clan BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_leader (leader_user_id),
    INDEX idx_clan (clan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link family members to a family group (in addition to clan_id).
-- Existing clan family rows keep their clan_id; new standalone rows use family_group_id.
ALTER TABLE roblox_clan_families
    ADD COLUMN IF NOT EXISTS family_group_id INT DEFAULT NULL AFTER clan_id,
    ADD INDEX idx_family_group (family_group_id);

-- Allow clan_id to be NULL for standalone families
ALTER TABLE roblox_clan_families
    MODIFY COLUMN clan_id INT DEFAULT NULL;

-- Track which roblox user is in which family group (fast player lookup)
CREATE TABLE IF NOT EXISTS roblox_family_membership (
    roblox_user_id BIGINT NOT NULL,
    family_group_id INT NOT NULL,
    family_member_id INT DEFAULT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (roblox_user_id),
    INDEX idx_family_group (family_group_id),
    FOREIGN KEY (family_group_id) REFERENCES roblox_family_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (family_member_id) REFERENCES roblox_clan_families(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pending family invites (for in-game invitation flow)
CREATE TABLE IF NOT EXISTS roblox_family_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_group_id INT NOT NULL,
    target_user_id BIGINT NOT NULL,
    target_username VARCHAR(50) DEFAULT NULL,
    invited_by_user_id BIGINT NOT NULL,
    character_name VARCHAR(100) NOT NULL,
    gender ENUM('male', 'female') NOT NULL,
    parent_member_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_target (target_user_id),
    INDEX idx_family (family_group_id),
    FOREIGN KEY (family_group_id) REFERENCES roblox_family_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_member_id) REFERENCES roblox_clan_families(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
