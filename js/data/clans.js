// Default color/name lookup for known Sengoku clans
// Used as fallback when DB doesn't have color or japanese_name set yet
const CLAN_DEFAULTS = {
    oda:              { japaneseName: "織田",     color: "#cc3333" },
    takeda:           { japaneseName: "武田",     color: "#4444cc" },
    uesugi:           { japaneseName: "上杉",     color: "#22aa44" },
    tokugawa:         { japaneseName: "徳川",     color: "#ddaa00" },
    mori:             { japaneseName: "毛利",     color: "#aa44aa" },
    shimazu:          { japaneseName: "島津",     color: "#ff6600" },
    hojo:             { japaneseName: "北条",     color: "#0088cc" },
    chosokabe:        { japaneseName: "長宗我部", color: "#44ccaa" },
    date:             { japaneseName: "伊達",     color: "#cc44cc" },
    imagawa:          { japaneseName: "今川",     color: "#88cc44" },
    "imperial court": { japaneseName: "朝廷",     color: "#d4af37" },
    soma:             { japaneseName: "相馬",     color: "#cc8844" },
};

// Auto-assign palette for clans not in the defaults above
const AUTO_COLORS = [
    "#cc3333", "#4444cc", "#22aa44", "#ddaa00", "#aa44aa",
    "#ff6600", "#0088cc", "#44ccaa", "#cc44cc", "#88cc44",
    "#cc8844", "#4488aa", "#aa8844", "#44aa88"
];

// Clan family data - leaders and children for marriage alliances
// robloxId is used to fetch profile pictures from Roblox API
// Admins can update robloxId per person; defaults to placeholder
const DEFAULT_ROBLOX_ID = 9003341;

const CLAN_FAMILIES = {
    oda: {
        leader: { id: "oda_nobunaga", name: "Oda Nobunaga", title: "The Fool of Owari", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "oda_nobutada", name: "Oda Nobutada", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "oda_tokuhime", name: "Tokuhime", gender: "female", robloxId: DEFAULT_ROBLOX_ID },
            { id: "oda_nobukatsu", name: "Oda Nobukatsu", gender: "male", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    takeda: {
        leader: { id: "takeda_shingen", name: "Takeda Shingen", title: "Tiger of Kai", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "takeda_katsuyori", name: "Takeda Katsuyori", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "takeda_matsuhime", name: "Matsuhime", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    uesugi: {
        leader: { id: "uesugi_kenshin", name: "Uesugi Kenshin", title: "Dragon of Echigo", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "uesugi_kagekatsu", name: "Uesugi Kagekatsu", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "uesugi_aya", name: "Aya-Gozen", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    tokugawa: {
        leader: { id: "tokugawa_ieyasu", name: "Tokugawa Ieyasu", title: "The Patient Tiger", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "tokugawa_hidetada", name: "Tokugawa Hidetada", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "tokugawa_kamehime", name: "Kamehime", gender: "female", robloxId: DEFAULT_ROBLOX_ID },
            { id: "tokugawa_tadayoshi", name: "Tokugawa Tadayoshi", gender: "male", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    mori: {
        leader: { id: "mori_motonari", name: "Mori Motonari", title: "The Three Arrows", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "mori_takamoto", name: "Mori Takamoto", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "mori_myokyu", name: "Myokyu-ni", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    shimazu: {
        leader: { id: "shimazu_yoshihisa", name: "Shimazu Yoshihisa", title: "Lord of Satsuma", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "shimazu_tadatsune", name: "Shimazu Tadatsune", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "shimazu_kamesa", name: "Kamesa-hime", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    hojo: {
        leader: { id: "hojo_ujiyasu", name: "Hojo Ujiyasu", title: "The Lion of Sagami", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "hojo_ujimasa", name: "Hojo Ujimasa", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "hojo_hayakawa", name: "Hayakawa-dono", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    chosokabe: {
        leader: { id: "chosokabe_motochika", name: "Chosokabe Motochika", title: "Bat of Tosa", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "chosokabe_nobuchika", name: "Chosokabe Nobuchika", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "chosokabe_nana", name: "Nana-hime", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    date: {
        leader: { id: "date_masamune", name: "Date Masamune", title: "One-Eyed Dragon", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "date_hidemune", name: "Date Hidemune", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "date_iroha", name: "Iroha-hime", gender: "female", robloxId: DEFAULT_ROBLOX_ID },
            { id: "date_tadamune", name: "Date Tadamune", gender: "male", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    imagawa: {
        leader: { id: "imagawa_yoshimoto", name: "Imagawa Yoshimoto", title: "Aristocrat of the East", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: [
            { id: "imagawa_ujizane", name: "Imagawa Ujizane", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
            { id: "imagawa_reishoin", name: "Reishoin", gender: "female", robloxId: DEFAULT_ROBLOX_ID }
        ]
    },
    "imperial court": {
        leader: { id: "imperial_emperor", name: "Emperor", title: "Son of Heaven", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: []
    },
    soma: {
        leader: { id: "soma_yoshitane", name: "Soma Yoshitane", title: "Lord of Soma", gender: "male", robloxId: DEFAULT_ROBLOX_ID },
        children: []
    }
};
