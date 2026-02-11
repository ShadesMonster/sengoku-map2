// Armor data - slots, items, rank presets
// Armor is in development, so items are placeholders for now

const ARMOR_SLOTS = {
    kabuto:     { name: "Kabuto",      icon: "🪖", description: "Helmet" },
    menpo:      { name: "Menpō",       icon: "🎭", description: "Face guard" },
    dou:        { name: "Dō",          icon: "🛡️", description: "Chest armor" },
    kote:       { name: "Kote",        icon: "🧤", description: "Gauntlets" },
    suneate:    { name: "Suneate",     icon: "🦵", description: "Shin guards" },
    haidate:    { name: "Haidate",     icon: "👖", description: "Thigh armor" },
    shitagi:    { name: "Shitagi",     icon: "👘", description: "Undergarments" },
    sashimono:  { name: "Sashimono",   icon: "🚩", description: "Back banner" },
};

// Items per slot. id must be unique across all slots.
// rank: minimum rank required (0 = everyone, higher = more elite)
// gamepassOnly: true means only available with mix-and-match gamepass
const ARMOR_ITEMS = {
    kabuto: [
        { id: "kabuto_none",       name: "None",              rank: 0 },
        { id: "kabuto_jingasa",    name: "Jingasa",           rank: 0, description: "Simple conical hat" },
        { id: "kabuto_zunari",     name: "Zunari Kabuto",     rank: 1, description: "Simple shaped helmet" },
        { id: "kabuto_suji",       name: "Suji Kabuto",       rank: 2, description: "Ridged helmet" },
        { id: "kabuto_hoshi",      name: "Hoshi Kabuto",      rank: 2, description: "Riveted star helmet" },
        { id: "kabuto_kawari",     name: "Kawari Kabuto",     rank: 3, description: "Ornate decorative helmet" },
        { id: "kabuto_daimyo",     name: "Daimyō Kabuto",    rank: 4, description: "Lord's ceremonial helmet" },
    ],
    menpo: [
        { id: "menpo_none",        name: "None",              rank: 0 },
        { id: "menpo_happuri",     name: "Happuri",           rank: 0, description: "Simple forehead guard" },
        { id: "menpo_hanbo",       name: "Hanbō",            rank: 1, description: "Half mask" },
        { id: "menpo_menpo",       name: "Menpō",            rank: 2, description: "Full face mask" },
        { id: "menpo_somen",       name: "Sōmen",            rank: 3, description: "Full face cover with nose" },
        { id: "menpo_oni",         name: "Oni Menpō",        rank: 4, description: "Demon-faced mask" },
    ],
    dou: [
        { id: "dou_none",          name: "None",              rank: 0 },
        { id: "dou_haramaki",      name: "Haramaki",          rank: 0, description: "Belly wrap armor" },
        { id: "dou_okegawa",       name: "Okegawa Dō",       rank: 1, description: "Barrel-sided chest" },
        { id: "dou_nuinobe",       name: "Nuinobe Dō",       rank: 2, description: "Laced plate armor" },
        { id: "dou_hotoke",        name: "Hotoke Dō",        rank: 3, description: "Smooth riveted cuirass" },
        { id: "dou_nimaido",       name: "Nimai Dō",         rank: 3, description: "Two-piece cuirass" },
        { id: "dou_tameshi",       name: "Tameshi Dō",       rank: 4, description: "Bullet-tested armor" },
    ],
    kote: [
        { id: "kote_none",         name: "None",              rank: 0 },
        { id: "kote_cloth",        name: "Cloth Kote",        rank: 0, description: "Padded sleeve" },
        { id: "kote_chain",        name: "Kusari Kote",       rank: 1, description: "Chain-mail gauntlets" },
        { id: "kote_plate",        name: "Karuta Kote",       rank: 2, description: "Plated gauntlets" },
        { id: "kote_full",         name: "Oda Kote",          rank: 3, description: "Full armored sleeves" },
    ],
    suneate: [
        { id: "suneate_none",      name: "None",              rank: 0 },
        { id: "suneate_cloth",     name: "Cloth Suneate",     rank: 0, description: "Padded shin wraps" },
        { id: "suneate_shino",     name: "Shino Suneate",     rank: 1, description: "Splinted shin guards" },
        { id: "suneate_tsutsu",    name: "Tsutsu Suneate",    rank: 2, description: "Tubular shin armor" },
        { id: "suneate_bishamon",  name: "Bishamon Suneate",  rank: 3, description: "Guardian's shin armor" },
    ],
    haidate: [
        { id: "haidate_none",      name: "None",              rank: 0 },
        { id: "haidate_cloth",     name: "Cloth Haidate",     rank: 0, description: "Padded thigh wraps" },
        { id: "haidate_kusari",    name: "Kusari Haidate",    rank: 1, description: "Chain-mail thigh guards" },
        { id: "haidate_karuta",    name: "Karuta Haidate",    rank: 2, description: "Plated thigh armor" },
        { id: "haidate_etchu",     name: "Etchū Haidate",    rank: 3, description: "Full thigh armor" },
    ],
    shitagi: [
        { id: "shitagi_none",      name: "None",              rank: 0 },
        { id: "shitagi_white",     name: "White Shitagi",     rank: 0, description: "Plain white underrobe" },
        { id: "shitagi_dark",      name: "Dark Shitagi",      rank: 0, description: "Dark colored underrobe" },
        { id: "shitagi_dyed",      name: "Dyed Shitagi",      rank: 1, description: "Clan-colored underrobe" },
        { id: "shitagi_silk",      name: "Silk Shitagi",      rank: 2, description: "Fine silk underrobe" },
        { id: "shitagi_embroid",   name: "Embroidered Shitagi", rank: 3, description: "Embroidered silk robe" },
    ],
    sashimono: [
        { id: "sashimono_none",    name: "None",              rank: 0 },
        { id: "sashimono_plain",   name: "Plain Sashimono",   rank: 0, description: "Simple clan banner" },
        { id: "sashimono_marked",  name: "Marked Sashimono",  rank: 1, description: "Unit-marked banner" },
        { id: "sashimono_silk",    name: "Silk Sashimono",    rank: 2, description: "Silk clan banner" },
        { id: "sashimono_general", name: "General's Uma-jirushi", rank: 3, description: "Commander's standard" },
    ],
};

// Ranks - index is the rank number
const ARMOR_RANKS = [
    { name: "Ashigaru",    description: "Foot soldier" },
    { name: "Gashira",     description: "Squad leader" },
    { name: "Samurai",     description: "Warrior" },
    { name: "Taishō",     description: "General" },
    { name: "Daimyō",     description: "Lord" },
];

// Presets per rank - what each rank gets by default (no gamepass needed)
const ARMOR_PRESETS = {
    0: { // Ashigaru
        kabuto: "kabuto_jingasa",
        menpo: "menpo_none",
        dou: "dou_haramaki",
        kote: "kote_cloth",
        suneate: "suneate_cloth",
        haidate: "haidate_cloth",
        shitagi: "shitagi_white",
        sashimono: "sashimono_plain",
    },
    1: { // Gashira
        kabuto: "kabuto_zunari",
        menpo: "menpo_hanbo",
        dou: "dou_okegawa",
        kote: "kote_chain",
        suneate: "suneate_shino",
        haidate: "haidate_kusari",
        shitagi: "shitagi_dyed",
        sashimono: "sashimono_marked",
    },
    2: { // Samurai
        kabuto: "kabuto_suji",
        menpo: "menpo_menpo",
        dou: "dou_nuinobe",
        kote: "kote_plate",
        suneate: "suneate_tsutsu",
        haidate: "haidate_karuta",
        shitagi: "shitagi_silk",
        sashimono: "sashimono_silk",
    },
    3: { // Taisho
        kabuto: "kabuto_kawari",
        menpo: "menpo_somen",
        dou: "dou_hotoke",
        kote: "kote_full",
        suneate: "suneate_bishamon",
        haidate: "haidate_etchu",
        shitagi: "shitagi_embroid",
        sashimono: "sashimono_general",
    },
    4: { // Daimyo
        kabuto: "kabuto_daimyo",
        menpo: "menpo_oni",
        dou: "dou_tameshi",
        kote: "kote_full",
        suneate: "suneate_bishamon",
        haidate: "haidate_etchu",
        shitagi: "shitagi_embroid",
        sashimono: "sashimono_general",
    },
};

// Build lookup for quick item access
const ARMOR_ITEM_MAP = {};
Object.values(ARMOR_ITEMS).forEach(items => {
    items.forEach(item => { ARMOR_ITEM_MAP[item.id] = item; });
});
