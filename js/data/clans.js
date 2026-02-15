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

// Clan family fallback data - leaders only (children come from DB)
// robloxId is used to fetch profile pictures from Roblox API
// These are overridden by loadFamiliesFromDB() when the API is available
const DEFAULT_ROBLOX_ID = 9003341;

const CLAN_FAMILIES = {
    oda:              { leader: { id: "oda_daimyo", name: "Oda Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    takeda:           { leader: { id: "takeda_daimyo", name: "Takeda Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    uesugi:           { leader: { id: "uesugi_daimyo", name: "Uesugi Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    tokugawa:         { leader: { id: "tokugawa_daimyo", name: "Tokugawa Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    mori:             { leader: { id: "mori_daimyo", name: "Mori Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    shimazu:          { leader: { id: "shimazu_daimyo", name: "Shimazu Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    hojo:             { leader: { id: "hojo_daimyo", name: "Hojo Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    chosokabe:        { leader: { id: "chosokabe_daimyo", name: "Chosokabe Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    date:             { leader: { id: "date_daimyo", name: "Date Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    imagawa:          { leader: { id: "imagawa_daimyo", name: "Imagawa Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    "imperial court": { leader: { id: "imperial_court_daimyo", name: "Emperor", title: "Son of Heaven", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
    soma:             { leader: { id: "soma_daimyo", name: "Soma Daimyo", title: "", gender: "male", robloxId: DEFAULT_ROBLOX_ID }, children: [] },
};
