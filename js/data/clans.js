// Default clan data for Sengoku-era major clans
// All clans start with 6000 soldiers (= 60 players at 1:100 ratio)
const DEFAULT_CLANS = [
    {
        id: "oda",
        name: "Oda",
        japaneseName: "織田",
        color: "#cc3333",
        rallyCap: 10000,
        homeProvince: "owari"
    },
    {
        id: "takeda",
        name: "Takeda",
        japaneseName: "武田",
        color: "#4444cc",
        rallyCap: 10000,
        homeProvince: "kai"
    },
    {
        id: "uesugi",
        name: "Uesugi",
        japaneseName: "上杉",
        color: "#22aa44",
        rallyCap: 10000,
        homeProvince: "echigo"
    },
    {
        id: "tokugawa",
        name: "Tokugawa",
        japaneseName: "徳川",
        color: "#ddaa00",
        rallyCap: 10000,
        homeProvince: "mikawa"
    },
    {
        id: "mori",
        name: "Mori",
        japaneseName: "毛利",
        color: "#aa44aa",
        rallyCap: 10000,
        homeProvince: "aki"
    },
    {
        id: "shimazu",
        name: "Shimazu",
        japaneseName: "島津",
        color: "#ff6600",
        rallyCap: 10000,
        homeProvince: "satsuma"
    },
    {
        id: "hojo",
        name: "Hojo",
        japaneseName: "北条",
        color: "#0088cc",
        rallyCap: 10000,
        homeProvince: "sagami"
    },
    {
        id: "chosokabe",
        name: "Chosokabe",
        japaneseName: "長宗我部",
        color: "#44ccaa",
        rallyCap: 10000,
        homeProvince: "tosa"
    },
    {
        id: "date",
        name: "Date",
        japaneseName: "伊達",
        color: "#cc44cc",
        rallyCap: 10000,
        homeProvince: "mutsu"
    },
    {
        id: "imagawa",
        name: "Imagawa",
        japaneseName: "今川",
        color: "#88cc44",
        rallyCap: 10000,
        homeProvince: "suruga"
    }
];

const STARTING_TROOPS = 6000;

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
    }
};
