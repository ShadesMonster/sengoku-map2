// Sengoku-era Japan Province Data
// Mapped from real SVG paths in japan.svg
// pathIds = SVG element IDs from the map file
// center = computed bounding-box center of each path

const PROVINCES = [
    // === KINAI (Capital Region) ===
    { id: "yamashiro", name: "Yamashiro", japaneseName: "山城", pathIds: ["path23012"], center: { x: 312.6, y: 540.6 }, terrain: "mountain", neighbors: ["yamato", "settsu", "kawachi", "omi", "tanba", "iga"] },
    { id: "yamato", name: "Yamato", japaneseName: "大和", pathIds: ["path22124"], center: { x: 315.8, y: 577.5 }, terrain: "mountain", neighbors: ["yamashiro", "kawachi", "izumi", "kii", "iga"] },
    { id: "kawachi", name: "Kawachi", japaneseName: "河内", pathIds: ["path23921"], center: { x: 303.1, y: 562.3 }, terrain: "village", neighbors: ["yamashiro", "yamato", "izumi", "settsu"] },
    { id: "izumi", name: "Izumi", japaneseName: "和泉", pathIds: ["path15900"], center: { x: 291.5, y: 570.0 }, terrain: "village", neighbors: ["kawachi", "yamato", "kii", "settsu"] },
    { id: "settsu", name: "Settsu", japaneseName: "摂津", pathIds: ["path15012"], center: { x: 293.0, y: 551.8 }, terrain: "plains", neighbors: ["yamashiro", "kawachi", "izumi", "harima", "tanba", "awaji"] },

    // === TOKAIDO (Eastern Sea Route) ===
    { id: "iga", name: "Iga", japaneseName: "伊賀", pathIds: ["path6236"], center: { x: 328.0, y: 558.8 }, terrain: "mountain", neighbors: ["yamashiro", "yamato", "ise", "omi"] },
    { id: "ise", name: "Ise", japaneseName: "伊勢", pathIds: ["path7124"], center: { x: 339.4, y: 557.0 }, terrain: "plains", neighbors: ["iga", "omi", "owari", "shima", "kii"] },
    { id: "shima", name: "Shima", japaneseName: "志摩", pathIds: ["path8012"], center: { x: 355.5, y: 574.0 }, terrain: "village", neighbors: ["ise"] },
    { id: "owari", name: "Owari", japaneseName: "尾張", pathIds: ["path8900"], center: { x: 363.8, y: 540.3 }, terrain: "plains", neighbors: ["ise", "mikawa", "mino"] },
    { id: "mikawa", name: "Mikawa", japaneseName: "三河", pathIds: ["path9788"], center: { x: 380.6, y: 545.7 }, terrain: "plains", neighbors: ["owari", "totomi", "shinano", "mino"] },
    { id: "totomi", name: "Totomi", japaneseName: "遠江", pathIds: ["path10676"], center: { x: 402.4, y: 542.7 }, terrain: "plains", neighbors: ["mikawa", "suruga", "shinano"] },
    { id: "suruga", name: "Suruga", japaneseName: "駿河", pathIds: ["path11564"], center: { x: 431.0, y: 531.8 }, terrain: "mountain", neighbors: ["totomi", "izu", "kai", "shinano"] },
    { id: "izu", name: "Izu", japaneseName: "伊豆", pathIds: ["path12452"], center: { x: 446.3, y: 546.8 }, terrain: "village", neighbors: ["suruga", "sagami"] },
    { id: "kai", name: "Kai", japaneseName: "甲斐", pathIds: ["path14228"], center: { x: 434.9, y: 512.2 }, terrain: "mountain", neighbors: ["suruga", "shinano", "sagami", "musashi"] },
    { id: "sagami", name: "Sagami", japaneseName: "相模", pathIds: ["path13340"], center: { x: 461.9, y: 521.0 }, terrain: "plains", neighbors: ["izu", "kai", "musashi"] },
    { id: "musashi", name: "Musashi", japaneseName: "武蔵", pathIds: ["path15116"], center: { x: 462.5, y: 498.2 }, terrain: "plains", neighbors: ["sagami", "kai", "kozuke", "shimotsuke", "shimosa", "kazusa", "awa_east"] },
    { id: "awa_east", name: "Awa", japaneseName: "安房", pathIds: ["path16004"], center: { x: 493.1, y: 537.4 }, terrain: "village", neighbors: ["kazusa"] },
    { id: "kazusa", name: "Kazusa", japaneseName: "上総", pathIds: ["path16892"], center: { x: 499.3, y: 517.9 }, terrain: "plains", neighbors: ["musashi", "shimosa", "awa_east"] },
    { id: "shimosa", name: "Shimosa", japaneseName: "下総", pathIds: ["path17780"], center: { x: 502.0, y: 493.4 }, terrain: "plains", neighbors: ["musashi", "kazusa", "hitachi", "shimotsuke"] },
    { id: "hitachi", name: "Hitachi", japaneseName: "常陸", pathIds: ["path18668"], center: { x: 504.7, y: 470.7 }, terrain: "plains", neighbors: ["shimosa", "shimotsuke", "mutsu"] },

    // === TOSANDO (Eastern Mountain Route) ===
    { id: "omi", name: "Omi", japaneseName: "近江", pathIds: ["path21305"], center: { x: 327.2, y: 528.9 }, terrain: "mountain", neighbors: ["yamashiro", "iga", "ise", "mino", "echizen", "wakasa", "tanba"] },
    { id: "mino", name: "Mino", japaneseName: "美濃", pathIds: ["path23942"], center: { x: 363.2, y: 512.8 }, terrain: "mountain", neighbors: ["omi", "owari", "mikawa", "shinano", "hida", "echizen"] },
    { id: "hida", name: "Hida", japaneseName: "飛騨", pathIds: ["path24830"], center: { x: 372.9, y: 488.4 }, terrain: "mountain", neighbors: ["mino", "shinano", "etchu", "echizen"] },
    { id: "shinano", name: "Shinano", japaneseName: "信濃", pathIds: ["path25718"], center: { x: 408.2, y: 485.0 }, terrain: "mountain", neighbors: ["kai", "suruga", "totomi", "mikawa", "mino", "hida", "etchu", "echigo", "kozuke"] },
    { id: "kozuke", name: "Kozuke", japaneseName: "上野", pathIds: ["path1669"], center: { x: 449.9, y: 463.8 }, terrain: "mountain", neighbors: ["shinano", "musashi", "shimotsuke", "echigo"] },
    { id: "shimotsuke", name: "Shimotsuke", japaneseName: "下野", pathIds: ["path26606"], center: { x: 487.2, y: 456.2 }, terrain: "plains", neighbors: ["kozuke", "musashi", "shimosa", "hitachi", "mutsu"] },

    // === HOKURIKU (Northern Land Route) ===
    { id: "wakasa", name: "Wakasa", japaneseName: "若狭", pathIds: ["path30926"], center: { x: 311.4, y: 515.5 }, terrain: "village", neighbors: ["omi", "tanba", "tango", "echizen"] },
    { id: "echizen", name: "Echizen", japaneseName: "越前", pathIds: ["path31814"], center: { x: 339.8, y: 494.9 }, terrain: "mountain", neighbors: ["omi", "mino", "hida", "kaga", "wakasa"] },
    { id: "kaga", name: "Kaga", japaneseName: "加賀", pathIds: ["path1781"], center: { x: 347.2, y: 464.7 }, terrain: "plains", neighbors: ["echizen", "noto", "etchu"] },
    { id: "noto", name: "Noto", japaneseName: "能登", pathIds: ["path2669"], center: { x: 366.8, y: 429.3 }, terrain: "village", neighbors: ["kaga", "etchu"] },
    { id: "etchu", name: "Etchu", japaneseName: "越中", pathIds: ["path3557"], center: { x: 376.3, y: 459.2 }, terrain: "plains", neighbors: ["kaga", "noto", "hida", "shinano", "echigo"] },
    { id: "echigo", name: "Echigo", japaneseName: "越後", pathIds: ["path4445"], center: { x: 438.3, y: 405.7 }, terrain: "plains", neighbors: ["etchu", "shinano", "kozuke", "dewa", "mutsu", "sado"] },
    { id: "sado", name: "Sado", japaneseName: "佐渡", pathIds: ["path5333"], center: { x: 421.9, y: 384.9 }, terrain: "village", neighbors: ["echigo"] },

    // === SAN'INDO (Mountain Shadow Route) ===
    { id: "tanba", name: "Tanba", japaneseName: "丹波", pathIds: ["path13236"], center: { x: 292.9, y: 531.5 }, terrain: "mountain", neighbors: ["yamashiro", "settsu", "harima", "tango", "wakasa", "tajima"] },
    { id: "tango", name: "Tango", japaneseName: "丹後", pathIds: ["path14124"], center: { x: 287.9, y: 511.5 }, terrain: "village", neighbors: ["tanba", "wakasa", "tajima"] },
    { id: "tajima", name: "Tajima", japaneseName: "但馬", pathIds: ["path12348"], center: { x: 270.7, y: 517.8 }, terrain: "mountain", neighbors: ["tanba", "tango", "harima", "inaba"] },
    { id: "inaba", name: "Inaba", japaneseName: "因幡", pathIds: ["path11460"], center: { x: 247.5, y: 518.4 }, terrain: "plains", neighbors: ["tajima", "hoki", "mimasaka"] },
    { id: "hoki", name: "Hoki", japaneseName: "伯耆", pathIds: ["path9681"], center: { x: 221.5, y: 522.9 }, terrain: "mountain", neighbors: ["inaba", "izumo", "mimasaka", "bitchu"] },
    { id: "izumo", name: "Izumo", japaneseName: "出雲", pathIds: ["path8793"], center: { x: 193.3, y: 523.5 }, terrain: "village", neighbors: ["hoki", "iwami", "bingo", "oki"] },
    { id: "iwami", name: "Iwami", japaneseName: "石見", pathIds: ["path7905"], center: { x: 161.0, y: 547.2 }, terrain: "village", neighbors: ["izumo", "aki", "suo"] },
    { id: "oki", name: "Oki", japaneseName: "隠岐", pathIds: ["path10569"], center: { x: 204.2, y: 477.3 }, terrain: "village", neighbors: ["izumo", "hoki"] },

    // === SAN'YODO (Sunny Mountain Route) ===
    { id: "harima", name: "Harima", japaneseName: "播磨", pathIds: ["path7017"], center: { x: 266.9, y: 543.6 }, terrain: "plains", neighbors: ["settsu", "tanba", "tajima", "mimasaka", "bizen", "awaji"] },
    { id: "mimasaka", name: "Mimasaka", japaneseName: "美作", pathIds: ["path6129"], center: { x: 235.1, y: 533.4 }, terrain: "mountain", neighbors: ["harima", "bizen", "bitchu", "hoki", "inaba"] },
    { id: "bizen", name: "Bizen", japaneseName: "備前", pathIds: ["path5241"], center: { x: 235.6, y: 555.4 }, terrain: "plains", neighbors: ["harima", "mimasaka", "bitchu"] },
    { id: "bitchu", name: "Bitchu", japaneseName: "備中", pathIds: ["path4353"], center: { x: 216.5, y: 547.2 }, terrain: "village", neighbors: ["bizen", "mimasaka", "hoki", "bingo"] },
    { id: "bingo", name: "Bingo", japaneseName: "備後", pathIds: ["path3465"], center: { x: 198.4, y: 551.9 }, terrain: "plains", neighbors: ["bitchu", "aki", "izumo"] },
    { id: "aki", name: "Aki", japaneseName: "安芸", pathIds: ["path2577"], center: { x: 173.8, y: 561.7 }, terrain: "plains", neighbors: ["bingo", "iwami", "suo"] },
    { id: "suo", name: "Suo", japaneseName: "周防", pathIds: ["path1689"], center: { x: 144.1, y: 581.5 }, terrain: "village", neighbors: ["aki", "iwami", "nagato"] },
    { id: "nagato", name: "Nagato", japaneseName: "長門", pathIds: ["path15801"], center: { x: 123.1, y: 569.6 }, terrain: "village", neighbors: ["suo", "buzen"] },

    // === NANKAIDO (Southern Sea Route) ===
    { id: "kii", name: "Kii", japaneseName: "紀伊", pathIds: ["path2460"], center: { x: 307.1, y: 598.2 }, terrain: "mountain", neighbors: ["yamato", "izumi", "ise", "shima", "awa_west"] },
    { id: "awaji", name: "Awaji", japaneseName: "淡路", pathIds: ["path14913"], center: { x: 272.5, y: 571.5 }, terrain: "village", neighbors: ["settsu", "harima", "awa_west", "sanuki"] },
    { id: "awa_west", name: "Awa", japaneseName: "阿波", pathIds: ["path12246"], center: { x: 243.5, y: 597.8 }, terrain: "plains", neighbors: ["awaji", "sanuki", "tosa", "kii"] },
    { id: "sanuki", name: "Sanuki", japaneseName: "讃岐", pathIds: ["path13134"], center: { x: 236.3, y: 575.5 }, terrain: "plains", neighbors: ["awaji", "awa_west", "iyo"] },
    { id: "iyo", name: "Iyo", japaneseName: "伊予", pathIds: ["path14025"], center: { x: 171.0, y: 627.2 }, terrain: "village", neighbors: ["sanuki", "tosa"] },
    { id: "tosa", name: "Tosa", japaneseName: "土佐", pathIds: ["path11358"], center: { x: 211.1, y: 626.0 }, terrain: "mountain", neighbors: ["awa_west", "iyo"] },

    // === SAIKADO (Kyushu) ===
    { id: "buzen", name: "Buzen", japaneseName: "豊前", pathIds: ["path5163"], center: { x: 109.8, y: 602.9 }, terrain: "plains", neighbors: ["nagato", "bungo", "chikuzen"] },
    { id: "bungo", name: "Bungo", japaneseName: "豊後", pathIds: ["path6051"], center: { x: 125.0, y: 625.3 }, terrain: "mountain", neighbors: ["buzen", "chikugo", "higo", "hyuga"] },
    { id: "chikuzen", name: "Chikuzen", japaneseName: "筑前", pathIds: ["path3402"], center: { x: 85.5, y: 603.0 }, terrain: "plains", neighbors: ["buzen", "chikugo", "hizen"] },
    { id: "chikugo", name: "Chikugo", japaneseName: "筑後", pathIds: ["path7744"], center: { x: 88.0, y: 625.5 }, terrain: "plains", neighbors: ["chikuzen", "bungo", "hizen", "higo"] },
    { id: "hizen", name: "Hizen", japaneseName: "肥前", pathIds: ["path1629"], center: { x: 44.6, y: 628.8 }, terrain: "village", neighbors: ["chikuzen", "chikugo", "higo", "iki"] },
    { id: "higo", name: "Higo", japaneseName: "肥後", pathIds: ["path3592", "path3594"], center: { x: 96.2, y: 652.5 }, terrain: "plains", neighbors: ["chikugo", "bungo", "hyuga", "osumi", "satsuma", "hizen"] },
    { id: "hyuga", name: "Hyuga", japaneseName: "日向", pathIds: ["path2702"], center: { x: 116.0, y: 681.6 }, terrain: "plains", neighbors: ["bungo", "higo", "osumi"] },
    { id: "satsuma", name: "Satsuma", japaneseName: "薩摩", pathIds: ["path3367"], center: { x: 65.7, y: 699.2 }, terrain: "mountain", neighbors: ["higo", "osumi"] },
    { id: "osumi", name: "Osumi", japaneseName: "大隅", pathIds: ["path6853"], center: { x: 89.2, y: 730.5 }, terrain: "village", neighbors: ["satsuma", "higo", "hyuga"] },

    // === ISLANDS ===
    { id: "iki", name: "Iki", japaneseName: "壱岐", pathIds: ["path9579"], center: { x: 52.5, y: 591.1 }, terrain: "village", neighbors: ["hizen", "tsushima"] },
    { id: "tsushima", name: "Tsushima", japaneseName: "対馬", pathIds: ["path10467"], center: { x: 38.6, y: 559.3 }, terrain: "village", neighbors: ["iki"] },

    // === MUTSU & DEWA (Far North) ===
    { id: "mutsu", name: "Mutsu", japaneseName: "陸奥", pathIds: ["path27494"], center: { x: 511.1, y: 322.9 }, terrain: "mountain", neighbors: ["dewa", "echigo", "shimotsuke", "hitachi"] },
    { id: "dewa", name: "Dewa", japaneseName: "出羽", pathIds: ["path29270"], center: { x: 492.6, y: 331.6 }, terrain: "mountain", neighbors: ["mutsu", "echigo"] },
];

// Yezo/Hokkaido paths (not playable in Sengoku era, displayed as decoration)
const YEZO_PATH_IDS = ["path3370", "path2340", "path3241", "path5015", "path4249", "path5136", "path9953", "path10840", "path10842", "path7264"];

// Province lookup map
const PROVINCE_MAP = {};
PROVINCES.forEach(p => { PROVINCE_MAP[p.id] = p; });

// SVG path ID -> province ID lookup
const PATH_TO_PROVINCE = {};
PROVINCES.forEach(p => {
    p.pathIds.forEach(pid => { PATH_TO_PROVINCE[pid] = p.id; });
});

// Terrain config (3 base terrain types + Castle Siege is dynamic at clan capitals)
const TERRAIN_CONFIG = {
    plains: { icon: "\u2694\uFE0F", name: "Open Plains", battleType: "Open Field", color: "#DAA520" },
    village: { icon: "\u{1F3D8}\uFE0F", name: "Village", battleType: "Village", color: "#228B22" },
    mountain: { icon: "\u{1F38C}", name: "Warzone", battleType: "Sanry\u014D Battleground", color: "#696969" }
};

// Castle Siege config (triggered when attacking a clan's capital province)
const CASTLE_SIEGE = { icon: "\u{1F3EF}", name: "Castle Siege", color: "#8B4513" };
