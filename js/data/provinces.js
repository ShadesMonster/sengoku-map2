// Sengoku-era Japan Province Data
// Each province has: id, name, japaneseName, path (SVG), center (x,y), terrain, neighbors
// Terrain types: castle, village, plains, mountain
// Map is oriented with north at top, laid out to approximate real Japan geography

const PROVINCES = [
    // --- Kinai (Capital Region) ---
    {
        id: "yamashiro",
        name: "Yamashiro",
        japaneseName: "山城",
        terrain: "castle",
        center: { x: 520, y: 480 },
        path: "M500,460 L540,455 L555,470 L550,490 L535,500 L510,495 L495,480 Z",
        neighbors: ["yamato", "settsu", "omi", "iga", "kawachi", "tanba"]
    },
    {
        id: "yamato",
        name: "Yamato",
        japaneseName: "大和",
        terrain: "mountain",
        center: { x: 545, y: 520 },
        path: "M535,500 L550,490 L570,495 L580,515 L570,535 L545,540 L525,530 L520,510 Z",
        neighbors: ["yamashiro", "kawachi", "izumi", "kii", "iga"]
    },
    {
        id: "kawachi",
        name: "Kawachi",
        japaneseName: "河内",
        terrain: "village",
        center: { x: 495, y: 510 },
        path: "M480,490 L510,495 L520,510 L515,530 L495,535 L475,520 L475,500 Z",
        neighbors: ["yamashiro", "settsu", "izumi", "yamato"]
    },
    {
        id: "izumi",
        name: "Izumi",
        japaneseName: "和泉",
        terrain: "village",
        center: { x: 485, y: 545 },
        path: "M475,535 L495,535 L510,545 L505,560 L480,560 L465,550 Z",
        neighbors: ["kawachi", "yamato", "kii", "settsu"]
    },
    {
        id: "settsu",
        name: "Settsu",
        japaneseName: "摂津",
        terrain: "castle",
        center: { x: 470, y: 475 },
        path: "M445,460 L470,455 L500,460 L495,480 L480,490 L475,500 L460,495 L440,480 Z",
        neighbors: ["yamashiro", "kawachi", "izumi", "harima", "tanba"]
    },
    // --- Tokaido (Eastern Sea Route) ---
    {
        id: "iga",
        name: "Iga",
        japaneseName: "伊賀",
        terrain: "mountain",
        center: { x: 570, y: 490 },
        path: "M555,470 L575,465 L590,478 L588,500 L570,505 L555,498 Z",
        neighbors: ["yamashiro", "yamato", "ise", "omi"]
    },
    {
        id: "ise",
        name: "Ise",
        japaneseName: "伊勢",
        terrain: "plains",
        center: { x: 610, y: 490 },
        path: "M590,470 L620,460 L640,475 L635,505 L615,515 L595,510 L588,500 L590,478 Z",
        neighbors: ["iga", "omi", "owari", "shima", "kii"]
    },
    {
        id: "shima",
        name: "Shima",
        japaneseName: "志摩",
        terrain: "village",
        center: { x: 635, y: 525 },
        path: "M615,515 L635,505 L650,515 L650,535 L635,545 L615,535 Z",
        neighbors: ["ise", "kii"]
    },
    {
        id: "owari",
        name: "Owari",
        japaneseName: "尾張",
        terrain: "plains",
        center: { x: 645, y: 450 },
        path: "M625,435 L650,425 L670,440 L665,460 L645,470 L625,465 L620,450 Z",
        neighbors: ["ise", "mikawa", "mino", "omi"]
    },
    {
        id: "mikawa",
        name: "Mikawa",
        japaneseName: "三河",
        terrain: "plains",
        center: { x: 680, y: 445 },
        path: "M665,430 L690,420 L705,435 L700,455 L680,460 L665,455 Z",
        neighbors: ["owari", "totomi", "shinano", "mino"]
    },
    {
        id: "totomi",
        name: "Totomi",
        japaneseName: "遠江",
        terrain: "plains",
        center: { x: 715, y: 430 },
        path: "M700,415 L725,405 L740,420 L735,440 L715,450 L700,445 Z",
        neighbors: ["mikawa", "suruga", "shinano"]
    },
    {
        id: "suruga",
        name: "Suruga",
        japaneseName: "駿河",
        terrain: "mountain",
        center: { x: 745, y: 410 },
        path: "M730,395 L755,385 L770,400 L765,420 L745,430 L730,420 Z",
        neighbors: ["totomi", "izu", "kai", "shinano"]
    },
    {
        id: "izu",
        name: "Izu",
        japaneseName: "伊豆",
        terrain: "village",
        center: { x: 775, y: 425 },
        path: "M765,415 L780,405 L795,415 L792,435 L775,440 L762,430 Z",
        neighbors: ["suruga", "sagami"]
    },
    {
        id: "kai",
        name: "Kai",
        japaneseName: "甲斐",
        terrain: "mountain",
        center: { x: 755, y: 370 },
        path: "M740,355 L765,345 L780,360 L775,380 L755,390 L738,380 Z",
        neighbors: ["suruga", "shinano", "sagami", "musashi"]
    },
    {
        id: "sagami",
        name: "Sagami",
        japaneseName: "相模",
        terrain: "plains",
        center: { x: 800, y: 395 },
        path: "M785,380 L810,370 L825,385 L820,405 L800,410 L785,400 Z",
        neighbors: ["izu", "kai", "musashi"]
    },
    {
        id: "musashi",
        name: "Musashi",
        japaneseName: "武蔵",
        terrain: "plains",
        center: { x: 815, y: 360 },
        path: "M800,345 L825,335 L845,350 L840,370 L820,380 L800,370 Z",
        neighbors: ["sagami", "kai", "kozuke", "shimotsuke", "shimosa", "kazusa"]
    },
    {
        id: "awa_east",
        name: "Awa (East)",
        japaneseName: "安房",
        terrain: "village",
        center: { x: 850, y: 405 },
        path: "M835,395 L855,385 L870,398 L865,415 L845,420 L832,410 Z",
        neighbors: ["kazusa"]
    },
    {
        id: "kazusa",
        name: "Kazusa",
        japaneseName: "上総",
        terrain: "plains",
        center: { x: 855, y: 378 },
        path: "M840,365 L860,355 L878,368 L873,388 L855,395 L838,385 Z",
        neighbors: ["musashi", "shimosa", "awa_east"]
    },
    {
        id: "shimosa",
        name: "Shimosa",
        japaneseName: "下総",
        terrain: "plains",
        center: { x: 845, y: 345 },
        path: "M830,332 L855,325 L870,340 L865,358 L845,365 L828,352 Z",
        neighbors: ["musashi", "kazusa", "hitachi", "shimotsuke"]
    },
    // --- Tosando (Eastern Mountain Route) ---
    {
        id: "omi",
        name: "Omi",
        japaneseName: "近江",
        terrain: "castle",
        center: { x: 560, y: 440 },
        path: "M540,420 L565,415 L585,430 L582,455 L560,460 L540,450 Z",
        neighbors: ["yamashiro", "iga", "ise", "mino", "owari", "echizen", "wakasa", "tanba"]
    },
    {
        id: "mino",
        name: "Mino",
        japaneseName: "美濃",
        terrain: "mountain",
        center: { x: 620, y: 415 },
        path: "M600,400 L625,390 L645,405 L640,425 L620,435 L600,425 Z",
        neighbors: ["omi", "owari", "mikawa", "shinano", "hida", "echizen"]
    },
    {
        id: "hida",
        name: "Hida",
        japaneseName: "飛騨",
        terrain: "mountain",
        center: { x: 650, y: 370 },
        path: "M635,355 L660,345 L678,360 L672,380 L650,388 L632,375 Z",
        neighbors: ["mino", "shinano", "etchu", "echizen"]
    },
    {
        id: "shinano",
        name: "Shinano",
        japaneseName: "信濃",
        terrain: "mountain",
        center: { x: 710, y: 365 },
        path: "M690,345 L720,335 L740,350 L738,375 L715,385 L695,378 L688,360 Z",
        neighbors: ["kai", "suruga", "totomi", "mikawa", "mino", "hida", "etchu", "echigo", "kozuke"]
    },
    {
        id: "kozuke",
        name: "Kozuke",
        japaneseName: "上野",
        terrain: "mountain",
        center: { x: 790, y: 325 },
        path: "M775,310 L800,300 L820,315 L815,335 L795,342 L772,332 Z",
        neighbors: ["shinano", "musashi", "shimotsuke", "echigo"]
    },
    {
        id: "shimotsuke",
        name: "Shimotsuke",
        japaneseName: "下野",
        terrain: "plains",
        center: { x: 830, y: 310 },
        path: "M815,295 L840,288 L858,303 L852,322 L832,330 L812,318 Z",
        neighbors: ["kozuke", "musashi", "shimosa", "hitachi", "mutsu"]
    },
    {
        id: "hitachi",
        name: "Hitachi",
        japaneseName: "常陸",
        terrain: "plains",
        center: { x: 865, y: 315 },
        path: "M852,300 L875,290 L892,305 L888,325 L868,332 L850,320 Z",
        neighbors: ["shimotsuke", "shimosa", "mutsu"]
    },
    // --- Hokuriku (Northern Land Route) ---
    {
        id: "wakasa",
        name: "Wakasa",
        japaneseName: "若狭",
        terrain: "village",
        center: { x: 500, y: 420 },
        path: "M485,408 L510,400 L525,415 L520,430 L500,435 L482,425 Z",
        neighbors: ["omi", "tanba", "tango", "echizen"]
    },
    {
        id: "echizen",
        name: "Echizen",
        japaneseName: "越前",
        terrain: "castle",
        center: { x: 555, y: 390 },
        path: "M535,375 L560,365 L580,380 L575,400 L555,408 L532,398 Z",
        neighbors: ["omi", "mino", "hida", "kaga", "wakasa"]
    },
    {
        id: "kaga",
        name: "Kaga",
        japaneseName: "加賀",
        terrain: "plains",
        center: { x: 585, y: 355 },
        path: "M570,340 L595,332 L612,348 L607,365 L585,372 L567,360 Z",
        neighbors: ["echizen", "noto", "etchu"]
    },
    {
        id: "noto",
        name: "Noto",
        japaneseName: "能登",
        terrain: "village",
        center: { x: 610, y: 320 },
        path: "M595,305 L620,298 L635,312 L630,332 L610,338 L592,325 Z",
        neighbors: ["kaga", "etchu"]
    },
    {
        id: "etchu",
        name: "Etchu",
        japaneseName: "越中",
        terrain: "plains",
        center: { x: 645, y: 335 },
        path: "M630,320 L655,312 L672,328 L668,348 L648,355 L627,342 Z",
        neighbors: ["kaga", "noto", "hida", "shinano", "echigo"]
    },
    {
        id: "echigo",
        name: "Echigo",
        japaneseName: "越後",
        terrain: "plains",
        center: { x: 735, y: 295 },
        path: "M710,275 L745,265 L770,280 L765,305 L740,315 L715,308 L708,290 Z",
        neighbors: ["etchu", "shinano", "kozuke", "dewa", "mutsu"]
    },
    // --- San'indo (Mountain Shadow Route) ---
    {
        id: "tanba",
        name: "Tanba",
        japaneseName: "丹波",
        terrain: "mountain",
        center: { x: 460, y: 445 },
        path: "M440,432 L465,425 L485,440 L480,458 L458,462 L438,450 Z",
        neighbors: ["yamashiro", "settsu", "harima", "tango", "wakasa", "tamba_border"]
    },
    {
        id: "tango",
        name: "Tango",
        japaneseName: "丹後",
        terrain: "village",
        center: { x: 455, y: 405 },
        path: "M438,392 L462,385 L480,398 L475,418 L455,422 L435,412 Z",
        neighbors: ["tanba", "wakasa", "tajima"]
    },
    {
        id: "tajima",
        name: "Tajima",
        japaneseName: "但馬",
        terrain: "mountain",
        center: { x: 420, y: 405 },
        path: "M402,392 L428,385 L445,400 L440,418 L418,422 L400,412 Z",
        neighbors: ["tango", "harima", "inaba", "tanba"]
    },
    {
        id: "inaba",
        name: "Inaba",
        japaneseName: "因幡",
        terrain: "plains",
        center: { x: 385, y: 390 },
        path: "M368,378 L392,370 L410,385 L405,405 L383,408 L365,398 Z",
        neighbors: ["tajima", "hoki", "harima"]
    },
    {
        id: "hoki",
        name: "Hoki",
        japaneseName: "伯耆",
        terrain: "mountain",
        center: { x: 350, y: 385 },
        path: "M332,372 L358,365 L375,380 L370,398 L348,402 L330,392 Z",
        neighbors: ["inaba", "mimasaka", "bizen", "izumo", "bitchu"]
    },
    {
        id: "izumo",
        name: "Izumo",
        japaneseName: "出雲",
        terrain: "castle",
        center: { x: 310, y: 380 },
        path: "M292,368 L318,360 L338,375 L332,395 L310,398 L290,388 Z",
        neighbors: ["hoki", "iwami", "bitchu"]
    },
    {
        id: "iwami",
        name: "Iwami",
        japaneseName: "石見",
        terrain: "village",
        center: { x: 270, y: 395 },
        path: "M252,382 L278,375 L298,390 L292,408 L270,412 L250,402 Z",
        neighbors: ["izumo", "aki", "suo"]
    },
    // --- San'yodo (Sunny Mountain Route) ---
    {
        id: "harima",
        name: "Harima",
        japaneseName: "播磨",
        terrain: "plains",
        center: { x: 425, y: 470 },
        path: "M405,458 L430,450 L450,462 L448,482 L428,490 L405,480 Z",
        neighbors: ["settsu", "tanba", "tajima", "inaba", "bizen", "mimasaka"]
    },
    {
        id: "mimasaka",
        name: "Mimasaka",
        japaneseName: "美作",
        terrain: "mountain",
        center: { x: 390, y: 440 },
        path: "M372,428 L398,420 L415,435 L410,455 L390,460 L370,448 Z",
        neighbors: ["harima", "bizen", "hoki", "inaba", "bitchu"]
    },
    {
        id: "bizen",
        name: "Bizen",
        japaneseName: "備前",
        terrain: "plains",
        center: { x: 380, y: 480 },
        path: "M362,468 L388,460 L405,475 L400,495 L378,498 L360,488 Z",
        neighbors: ["harima", "mimasaka", "bitchu"]
    },
    {
        id: "bitchu",
        name: "Bitchu",
        japaneseName: "備中",
        terrain: "village",
        center: { x: 340, y: 465 },
        path: "M322,452 L348,445 L365,460 L360,480 L338,484 L320,472 Z",
        neighbors: ["bizen", "mimasaka", "hoki", "izumo", "bingo"]
    },
    {
        id: "bingo",
        name: "Bingo",
        japaneseName: "備後",
        terrain: "plains",
        center: { x: 305, y: 460 },
        path: "M288,448 L312,440 L330,455 L325,475 L303,478 L285,468 Z",
        neighbors: ["bitchu", "aki", "izumo", "iwami"]
    },
    {
        id: "aki",
        name: "Aki",
        japaneseName: "安芸",
        terrain: "castle",
        center: { x: 265, y: 460 },
        path: "M248,448 L272,440 L292,455 L288,472 L265,478 L245,468 Z",
        neighbors: ["bingo", "iwami", "suo"]
    },
    {
        id: "suo",
        name: "Suo",
        japaneseName: "周防",
        terrain: "village",
        center: { x: 225, y: 465 },
        path: "M208,452 L232,445 L252,460 L248,478 L225,482 L205,472 Z",
        neighbors: ["aki", "iwami", "nagato"]
    },
    {
        id: "nagato",
        name: "Nagato",
        japaneseName: "長門",
        terrain: "village",
        center: { x: 190, y: 455 },
        path: "M172,442 L198,435 L218,450 L212,468 L190,472 L170,462 Z",
        neighbors: ["suo", "buzen"]
    },
    // --- Nankaido (Southern Sea Route) ---
    {
        id: "kii",
        name: "Kii",
        japaneseName: "紀伊",
        terrain: "mountain",
        center: { x: 530, y: 570 },
        path: "M505,555 L540,545 L565,558 L560,580 L535,590 L510,582 L500,568 Z",
        neighbors: ["yamato", "izumi", "ise", "shima"]
    },
    {
        id: "awaji",
        name: "Awaji",
        japaneseName: "淡路",
        terrain: "village",
        center: { x: 445, y: 530 },
        path: "M435,518 L455,515 L462,530 L455,545 L438,545 L432,530 Z",
        neighbors: ["settsu", "awa_west", "sanuki"]
    },
    {
        id: "awa_west",
        name: "Awa (West)",
        japaneseName: "阿波",
        terrain: "plains",
        center: { x: 440, y: 565 },
        path: "M420,552 L450,548 L468,562 L462,580 L440,585 L418,575 Z",
        neighbors: ["awaji", "sanuki", "tosa", "iyo"]
    },
    {
        id: "sanuki",
        name: "Sanuki",
        japaneseName: "讃岐",
        terrain: "plains",
        center: { x: 395, y: 535 },
        path: "M375,522 L405,518 L425,532 L420,550 L395,555 L372,545 Z",
        neighbors: ["awaji", "awa_west", "bitchu", "bizen", "iyo"]
    },
    {
        id: "iyo",
        name: "Iyo",
        japaneseName: "伊予",
        terrain: "village",
        center: { x: 340, y: 555 },
        path: "M318,540 L348,535 L368,550 L362,570 L340,575 L315,565 Z",
        neighbors: ["sanuki", "awa_west", "tosa", "aki", "bingo"]
    },
    {
        id: "tosa",
        name: "Tosa",
        japaneseName: "土佐",
        terrain: "mountain",
        center: { x: 385, y: 595 },
        path: "M355,580 L395,575 L425,588 L418,610 L385,618 L352,605 Z",
        neighbors: ["awa_west", "iyo"]
    },
    // --- Saikado (Western Sea Route / Kyushu) ---
    {
        id: "buzen",
        name: "Buzen",
        japaneseName: "豊前",
        terrain: "plains",
        center: { x: 175, y: 490 },
        path: "M158,478 L185,472 L202,486 L198,505 L175,510 L155,498 Z",
        neighbors: ["nagato", "bungo", "chikuzen"]
    },
    {
        id: "bungo",
        name: "Bungo",
        japaneseName: "豊後",
        terrain: "mountain",
        center: { x: 195, y: 525 },
        path: "M178,512 L205,505 L222,520 L218,540 L195,545 L175,532 Z",
        neighbors: ["buzen", "chikugo", "higo", "hyuga"]
    },
    {
        id: "chikuzen",
        name: "Chikuzen",
        japaneseName: "筑前",
        terrain: "castle",
        center: { x: 135, y: 505 },
        path: "M118,492 L145,485 L162,500 L158,518 L135,522 L115,512 Z",
        neighbors: ["buzen", "chikugo", "hizen"]
    },
    {
        id: "chikugo",
        name: "Chikugo",
        japaneseName: "筑後",
        terrain: "plains",
        center: { x: 145, y: 540 },
        path: "M128,528 L155,522 L172,536 L168,555 L145,558 L125,548 Z",
        neighbors: ["chikuzen", "bungo", "hizen", "higo"]
    },
    {
        id: "hizen",
        name: "Hizen",
        japaneseName: "肥前",
        terrain: "village",
        center: { x: 95, y: 535 },
        path: "M72,520 L102,515 L122,530 L118,550 L95,555 L70,542 Z",
        neighbors: ["chikuzen", "chikugo", "higo"]
    },
    {
        id: "higo",
        name: "Higo",
        japaneseName: "肥後",
        terrain: "plains",
        center: { x: 130, y: 580 },
        path: "M108,565 L140,558 L162,572 L158,595 L132,600 L105,588 Z",
        neighbors: ["chikugo", "bungo", "hyuga", "osumi", "satsuma", "hizen"]
    },
    {
        id: "hyuga",
        name: "Hyuga",
        japaneseName: "日向",
        terrain: "plains",
        center: { x: 185, y: 575 },
        path: "M168,560 L198,555 L215,570 L210,592 L185,598 L165,585 Z",
        neighbors: ["bungo", "higo", "osumi"]
    },
    {
        id: "satsuma",
        name: "Satsuma",
        japaneseName: "薩摩",
        terrain: "mountain",
        center: { x: 115, y: 630 },
        path: "M95,615 L125,608 L145,622 L140,645 L115,650 L92,638 Z",
        neighbors: ["higo", "osumi"]
    },
    {
        id: "osumi",
        name: "Osumi",
        japaneseName: "大隅",
        terrain: "village",
        center: { x: 155, y: 625 },
        path: "M138,612 L168,605 L185,620 L180,642 L155,648 L135,635 Z",
        neighbors: ["higo", "hyuga", "satsuma"]
    },
    // --- Mutsu & Dewa (Far North) ---
    {
        id: "mutsu",
        name: "Mutsu",
        japaneseName: "陸奥",
        terrain: "mountain",
        center: { x: 820, y: 240 },
        path: "M790,200 L835,190 L870,210 L875,255 L855,280 L820,290 L790,275 L780,240 Z",
        neighbors: ["dewa", "echigo", "shimotsuke", "hitachi"]
    },
    {
        id: "dewa",
        name: "Dewa",
        japaneseName: "出羽",
        terrain: "mountain",
        center: { x: 760, y: 250 },
        path: "M740,215 L770,205 L790,225 L785,265 L765,280 L740,270 L732,240 Z",
        neighbors: ["mutsu", "echigo"]
    },
    // --- Remove tamba_border placeholder, add it as alias ---
];

// Fix: remove tamba_border from tanba neighbors since it doesn't exist
PROVINCES.find(p => p.id === "tanba").neighbors =
    PROVINCES.find(p => p.id === "tanba").neighbors.filter(n => n !== "tamba_border");

// Province adjacency lookup (auto-generated)
const PROVINCE_MAP = {};
PROVINCES.forEach(p => { PROVINCE_MAP[p.id] = p; });

// Terrain config
const TERRAIN_CONFIG = {
    castle: { icon: "\u{1F3EF}", name: "Castle Town", battleType: "Castle Siege", color: "#8B4513" },
    village: { icon: "\u{1F3D8}\uFE0F", name: "Village", battleType: "Village Raid", color: "#228B22" },
    plains: { icon: "\u2694\uFE0F", name: "Open Plains", battleType: "Open Field", color: "#DAA520" },
    mountain: { icon: "\u{1F38C}", name: "Mountain", battleType: "Sanry\u014D Battleground", color: "#696969" }
};
