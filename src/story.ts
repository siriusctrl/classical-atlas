import type { PlaceId, Side } from "./places";

export type Camera = { at: [number, number]; zoom: number };
export type Window = [number, number];
type Point = PlaceId | [number, number];

// "grain" tints merchant shipping rather than either side.
export type Tint = Side | "grain";

export type Mark =
  | { type: "pulse"; place: PlaceId; side: Tint; at?: Window }
  | {
      type: "route";
      via: Point[];
      side: Tint;
      // "band" is a Minard-style flow whose width stands for the force's size;
      // "wall" is a fortification line being built.
      style: "fleet" | "army" | "band" | "wall";
      width?: number;
      ships?: number;
      // A short caption that rides with the leading ship or arrow.
      tag?: string;
      tagBelow?: boolean;
      draw?: Window;
      // Keep a faint trace after the step ends.
      trace?: boolean;
    }
  | { type: "blockade"; place: PlaceId; side: Tint; radius: number; at?: Window }
  | { type: "flow"; via: Point[]; side: Tint; at?: Window }
  // Farm plots scattered over an area; they char as the army passes.
  | { type: "fields"; center: [number, number]; radius: number; count: number; burn?: Window; from?: [number, number] };

export type Inset =
  | { type: "count"; value: number; of?: number; unit: string; note?: string; at?: Window }
  | { type: "dots"; groups: { count: number; label: string }[]; per: number; at?: Window }
  | { type: "growth"; from: number; to: number; unit: string; note: string; at?: Window }
  | { type: "trireme"; at?: Window }
  | { type: "siege"; at?: Window }
  | { type: "talent"; at?: Window }
  | {
      type: "ratio";
      title: string;
      groups: { count: number; label: string; side: Side }[];
      note: string;
      at?: Window;
    }
  // An artifact photo from public/media; the credit comes from credits.json.
  | { type: "image"; file: string; caption: string; at?: Window }
  // A short document: a dispatch, a decree, an inscription.
  | { type: "note"; kicker: string; lines: string[]; cite: string; at?: Window };

export type Step = {
  id: string;
  year: number;
  yearLabel?: string;
  kicker: string;
  title: string;
  body: string[];
  camera: Camera;
  labels?: PlaceId[];
  legend?: boolean;
  // Side changes in this step spread outward from one place.
  ripple?: { from: PlaceId; start: number; span: number };
  marks?: Mark[];
  // "all" keeps every city at full strength; otherwise places outside the step recede.
  focus?: "all";
  // Several insets play in sequence, each from its own start.
  inset?: Inset | Inset[];
  // Details along the way: pins in free reading, a guided camera tour in autoplay.
  beats?: Beat[];
  // A full-screen typographic moment; the map holds the previous camera and dims.
  quote?: { text: string; cite: string; note?: string };
  // An act title: a full-screen card that opens a part of the story with one question.
  act?: { label: string; title: string; line: string };
  // "night" dims the map like the title does but keeps the scene readable (the cold open).
  mood?: "night";
};

export type Beat = {
  at: Point;
  title: string;
  text: string;
  cite?: string;
  // Camera zoom while the tour holds on this beat; defaults to twice the step's zoom.
  zoom?: number;
};

export type MapText = {
  name: string;
  latin: string;
  at: [number, number];
  // Visible between these camera zoom levels.
  zoom: [number, number];
  size?: number;
  rotate?: number;
};

export const regions: MapText[] = [
  { name: "阿提卡", latin: "Attica", at: [23.86, 38.12], zoom: [5, 60] },
  { name: "彼奥提亚", latin: "Boeotia", at: [23.05, 38.42], zoom: [5, 40] },
  { name: "伯罗奔尼撒", latin: "Peloponnesus", at: [22.15, 37.42], zoom: [1.3, 14], size: 17 },
  { name: "优卑亚", latin: "Euboea", at: [23.9, 38.62], zoom: [3, 30], rotate: -32 },
  { name: "马其顿", latin: "Macedonia", at: [22.1, 40.75], zoom: [1.3, 8] },
  { name: "色雷斯", latin: "Thracia", at: [25.6, 41.25], zoom: [1.3, 8] },
  { name: "卡尔基狄克", latin: "Chalcidice", at: [23.55, 40.38], zoom: [2.6, 14] },
  { name: "爱奥尼亚", latin: "Ionia", at: [27.75, 38.35], zoom: [1.5, 8] },
  { name: "小亚细亚", latin: "Asia Minor", at: [29.6, 39.3], zoom: [1, 4], size: 17 },
  { name: "西西里", latin: "Sicilia", at: [14.15, 37.6], zoom: [1, 10], size: 17 },
  { name: "大希腊", latin: "Magna Graecia", at: [16.4, 39.75], zoom: [1, 5] },
  { name: "克里特", latin: "Creta", at: [24.9, 35.22], zoom: [1.4, 8] },
];

export const seas: MapText[] = [
  { name: "爱 琴 海", latin: "Mare Aegaeum", at: [25.05, 39.25], zoom: [1, 6], size: 19 },
  { name: "伊奥尼亚海", latin: "Mare Ionium", at: [19.1, 37.5], zoom: [1, 5], size: 17 },
  { name: "克里特海", latin: "Mare Creticum", at: [25.1, 35.95], zoom: [1.6, 8] },
  { name: "萨罗尼克湾", latin: "Sinus Saronicus", at: [23.42, 37.76], zoom: [6, 40] },
  { name: "科林斯湾", latin: "Sinus Corinthiacus", at: [22.45, 38.22], zoom: [2.4, 16], rotate: -12 },
  { name: "赫勒斯滂", latin: "Hellespontus", at: [26.43, 40.24], zoom: [5, 40], rotate: 38 },
  { name: "普罗庞提斯", latin: "Propontis", at: [28.0, 40.72], zoom: [1.8, 10] },
  { name: "第勒尼安海", latin: "Mare Tyrrhenum", at: [12.6, 39.6], zoom: [1, 4] },
];

// Conventional phases of the war, shown on the time ruler.
export const phases = [
  { name: "阿希达穆斯战争", from: 431, to: 421 },
  { name: "尼西阿斯和约", from: 421, to: 413 },
  { name: "狄西里亚战争", from: 413, to: 404 },
];

const tc = (ref: string) => `<cite>修昔底德 ${ref}</cite>`;
const xen = (ref: string) => `<cite>色诺芬《希腊史》${ref}</cite>`;
const ps = (ref: string) => `<cite>伪色诺芬《雅典政制》${ref}</cite>`;

const aegean: Camera = { at: [24.2, 38.4], zoom: 1.65 };
const attica: Camera = { at: [23.36, 38.0], zoom: 17 };

export const steps: Step[] = [
  {
    id: "opening",
    year: 431,
    kicker: "The Peloponnesian War · 431 – 404 BC",
    title: "伯罗奔尼撒战争",
    body: [
      "一场打了二十七年的战争，一部没有写完的史书。",
      `修昔底德从战争第一天起就在记录。他相信这会是一场“比以往任何战争都更值得记述”的战争${tc("1.1.1")}。`,
    ],
    camera: { at: [21.5, 38.4], zoom: 1 },
  },
  {
    id: "cold-open",
    year: 405,
    kicker: "公元前 405 年，一个夜里",
    title: "那一夜，没有人睡着",
    body: [
      `一艘快船从赫勒斯滂一路南下，在夜里驶进比雷埃夫斯港${xen("2.1.29, 2.2.3")}。`,
      `它带回的消息从港口沿着长墙传进城里，哭声跟着一路传了过去${xen("2.2.3")}。雅典的舰队没了。`,
    ],
    camera: { at: [25.0, 38.95], zoom: 2.2 },
    mood: "night",
    marks: [
      {
        type: "route",
        via: ["aegospotami", [26.25, 40.0], [25.6, 39.35], [24.95, 38.7], [24.45, 38.05], [24.15, 37.62], "sunium", [23.75, 37.75], "piraeus"],
        side: "athens",
        style: "fleet",
        ships: 1,
        tag: "帕拉卢斯号",
        draw: [0.05, 0.8],
      },
      { type: "pulse", place: "athens", side: "athens", at: [0.78, 1] },
    ],
  },
  {
    id: "act-1",
    year: 431,
    kicker: "",
    title: "",
    body: [],
    camera: aegean,
    act: { label: "第一幕", title: "两个世界", line: "二十六年前，雅典还是希腊最强大的海上帝国。它是怎么走到那一夜的？" },
  },
  {
    id: "two-powers",
    year: 431,
    kicker: "两个世界",
    title: "海上的帝国，陆上的同盟",
    body: [
      `公元前 431 年，希腊分成了两半。蓝色是雅典和它的盟邦，几乎占满了爱琴海；红色是斯巴达领导的伯罗奔尼撒同盟，盘踞在希腊本土${tc("2.9")}。`,
      "一边的力量在海上，一边在陆上。谁都打不到对方的要害，至少一开始是这样。",
    ],
    camera: aegean,
    focus: "all",
    beats: [
      {
        at: "corinth",
        title: "科林斯的激将",
        text: `波提狄亚被围后，科林斯召集盟邦到斯巴达控诉雅典${tc("1.67.1")}。它的使者对斯巴达人说：雅典人从不待在家里，你们从不出门${tc("1.70.4")}。`,
        zoom: 4,
      },
      {
        at: "melos",
        title: "两座例外的岛",
        text: `基克拉泽斯群岛里，只有米洛斯和锡拉不在雅典的同盟里${tc("2.9.4")}。`,
        zoom: 4,
      },
    ],
    labels: ["athens", "sparta", "corinth", "thebes", "corcyra", "samos", "chios", "mytilene", "argos"],
    legend: true,
  },
  {
    id: "grain",
    year: 431,
    kicker: "雅典的命脉",
    title: "一座靠海吃饭的城",
    body: [
      "阿提卡多山少地，种出的粮食不够养活全城。现代学者估计，平常年份只能自给三分之一到一半。雅典高度依赖海外的粮食，黑海是最重要的来源之一。",
      "运粮船出黑海，穿过窄窄的赫勒斯滂海峡，绕过苏尼昂角，驶进比雷埃夫斯。",
      "<strong>记住这条航线。</strong>开头那一夜的快船，就是沿着它开回来的。",
    ],
    camera: { at: [26.3, 39.5], zoom: 1.7 },
    beats: [
      {
        at: [29.02, 41.025],
        title: "黑海的出口",
        text: `运粮船从这里驶出黑海。公元前 410 年，雅典人在拜占庭对岸的克律索波利斯筑垒设关，向驶出黑海的船只征收十分之一的关税${xen("1.1.22")}。`,
        zoom: 7,
      },
      {
        at: [26.4, 40.15],
        title: "赫勒斯滂",
        text: "按今天的测量，海峡最窄处（今恰纳卡莱）只有约 1.2 公里，所有运粮船都要从这里挤过去。谁守住这里，谁就掐住了雅典的喉咙。",
        zoom: 8,
      },
      {
        at: "sunium",
        title: "苏尼昂角",
        text: `运粮船进港前的最后一个转角。斯巴达人占据狄西里亚后，优卑亚的物资不能再经陆路运来，只能花大价钱绕过这里走海路${tc("7.28.1")}。`,
        zoom: 9,
      },
    ],
    labels: ["byzantium", "sestos", "sunium", "athens"],
    marks: [
      {
        type: "route",
        via: [[29.7, 41.55], [29.1, 41.17], "byzantium", [28.3, 40.8], [27.3, 40.5], [26.7, 40.37], [26.4, 40.18], [26.15, 40.03], [25.55, 39.6], [24.9, 38.95], [24.55, 38.25], [24.3, 37.75], [24.05, 37.6], [23.75, 37.75], "piraeus"],
        side: "grain",
        style: "fleet",
        ships: 6,
        tag: "运粮船",
        draw: [0.05, 0.8],
      },
      { type: "pulse", place: "sestos", side: "grain", at: [0.5, 0.95] },
    ],
  },
  {
    id: "trireme",
    year: 431,
    kicker: "雅典的武器",
    title: "三列桨战舰",
    body: [
      `雅典有约三百艘能出海的三列桨战舰${tc("2.13.8")}。每艘约 200 人，170 名桨手分三层挤在船舱里，船头是青铜撞角。`,
      `划桨的多是穷人。当时就有人说：雅典的穷人之所以说了算，是因为舰队靠他们划${ps("1.2")}。<strong>海军和民主，是同一件事的两面。</strong>`,
      "可是三百艘船，算下来就是六万人，军饷从哪里来？",
    ],
    camera: { at: [23.64, 37.94], zoom: 26 },
    beats: [
      {
        at: "piraeus",
        title: "三个港湾",
        text: `地米斯托克利看中比雷埃夫斯有三个天然港湾，劝雅典人把它修成要塞${tc("1.93.3")}。远征西西里时，舰长们还在国家军饷之外，自掏腰包给上层桨手加发奖金${tc("6.31.3")}。`,
        zoom: 40,
      },
    ],
    labels: ["piraeus", "athens"],
    marks: [{ type: "blockade", place: "piraeus", side: "athens", radius: 2.2, at: [0.02, 0.4] }],
    inset: [
      { type: "trireme", at: [0.08, 0.5] },
      {
        type: "image",
        file: "trireme-olympias.webp",
        caption: "1987 年建成的复原舰“奥林匹亚斯号”。它是推测性的复原，证明三层桨可行，但不等于古代战舰的真实性能。",
        at: [0.55, 0.9],
      },
    ],
  },
  {
    id: "money",
    year: 431,
    kicker: "钱就是舰队",
    title: "盟邦的贡金",
    body: [
      `修昔底德顺手记过一笔账：60 塔兰特，正好是 60 艘战舰一个月的军饷${tc("6.8.1")}。一艘船出海一个月，就是 1 塔兰特。`,
      `钱从盟邦来。原本为对抗波斯而结的同盟，渐渐变成了向雅典交钱的帝国${tc("1.96, 1.99")}。开战时，盟邦每年平均交来约六百塔兰特贡金，卫城上还存着六千${tc("2.13.3")}。`,
      "<strong>粗算一下：六千塔兰特，只够三百艘船全部出海二十个月。</strong>这场仗，最好不要拖。",
    ],
    camera: { at: [25.3, 38.4], zoom: 2.1 },
    beats: [
      {
        at: "delos",
        title: "金库原本在提洛岛",
        text: `同盟初建时，金库设在提洛岛，同盟会议也在岛上的神庙里召开${tc("1.96.2")}。`,
        zoom: 5,
      },
      {
        at: "potidaea",
        title: "一座城的账单",
        text: `仅围攻波提狄亚一役，雅典就花掉了两千塔兰特${tc("2.70.2")}。`,
        zoom: 5,
      },
      {
        at: "athens",
        title: "最后的底牌",
        text: `雅典从卫城存款中另拨一千塔兰特，再留一百艘最好的战舰，除非敌人从海上来攻城，一律不得动用；提议挪作他用者处死${tc("2.24.1 – 2")}。`,
        zoom: 6,
      },
    ],
    labels: ["athens", "samos", "chios", "mytilene", "naxos", "rhodes", "thasos"],
    marks: [
      { type: "flow", via: ["samos", [25.6, 37.6], [24.4, 37.6], "athens"], side: "athens", at: [0.05, 1] },
      { type: "flow", via: ["chios", [25.0, 38.2], "athens"], side: "athens", at: [0.1, 1] },
      { type: "flow", via: ["mytilene", [25.4, 38.7], "athens"], side: "athens", at: [0.15, 1] },
      { type: "flow", via: ["rhodes", [26.2, 36.6], [24.6, 37.3], "athens"], side: "athens", at: [0.2, 1] },
      { type: "flow", via: ["thasos", [24.3, 39.6], [24.1, 38.4], "athens"], side: "athens", at: [0.25, 1] },
      { type: "flow", via: ["naxos", [24.6, 37.5], "athens"], side: "athens", at: [0.3, 1] },
    ],
    inset: { type: "talent", at: [0.1, 0.62] },
  },
  {
    id: "helots",
    year: 431,
    kicker: "斯巴达的恐惧",
    title: "害怕自己奴隶的城",
    body: [
      "斯巴达公民只是少数。替他们种地的是人数多得多的黑劳士，世代为奴。斯巴达人不必劳作，所以能终身当兵。",
      `公元前 464 年，美塞尼亚的黑劳士据守伊托米山起义；最后斯巴达放他们离开，雅典把他们安置在瑙帕克图斯${tc("1.101 – 103")}。`,
      "<strong>记住这些人。</strong>将近四十年后，他们的族人会回到故乡，让斯巴达寝食难安。",
    ],
    camera: { at: [22.1, 37.55], zoom: 4.6 },
    beats: [
      {
        at: "sparta",
        title: "消失的两千人",
        text: `斯巴达宣布，作战有功的黑劳士可以获得自由。被选出的两千人戴着花冠绕行神庙，不久，他们全都不见了${tc("4.80.3 – 4")}。`,
        zoom: 8,
      },
      {
        at: "ithome",
        title: "第一次交恶",
        text: `斯巴达曾请雅典派兵帮助围攻伊托米山，随后又单单把雅典人打发回去。两国第一次公开交恶${tc("1.102.1 – 3")}。`,
        zoom: 9,
      },
    ],
    labels: ["sparta", "ithome", "naupactus"],
    marks: [
      { type: "pulse", place: "ithome", side: "sparta", at: [0.2, 0.55] },
      {
        type: "route",
        via: ["ithome", [21.7, 37.5], [21.45, 38.0], [21.6, 38.3], "naupactus"],
        side: "athens",
        style: "army",
        tag: "美塞尼亚人",
        draw: [0.45, 0.8],
      },
    ],
    inset: {
      type: "ratio",
      title: "公元前 479 年普拉提亚之战",
      groups: [
        { count: 5, label: "斯巴达公民 5,000", side: "sparta" },
        { count: 35, label: "随军黑劳士 35,000", side: "neutral" },
      ],
      note: "每个点代表 1,000 人。数字出自希罗多德 9.10、9.28，是战前半个世纪的记录。",
      at: [0.1, 0.55],
    },
  },
  {
    id: "causes",
    year: 432,
    yearLabel: "公元前 435 – 432 年",
    kicker: "起因",
    title: "三根导火索",
    body: [
      `科西拉手握希腊数一数二的舰队，和母邦科林斯打了起来，转身向雅典求援${tc("1.25.4, 1.33.1, 1.44.2")}。雅典的属邦波提狄亚在科林斯支持下叛离。雅典又对斯巴达的盟邦麦加拉下了贸易禁令。`,
      "三件事都能谈，也确实谈过。但修昔底德说，真正的原因不在这里。",
    ],
    camera: { at: [22.2, 39.0], zoom: 2.2 },
    beats: [
      {
        at: "megara",
        title: "麦加拉禁令",
        text: `麦加拉人在斯巴达控诉：雅典违背和约，不许他们进入雅典帝国的港口和阿提卡的市场${tc("1.67.4")}。`,
        zoom: 7,
      },
      {
        at: "athens",
        title: "大灾难的开始",
        text: `进军前，阿希达穆斯派梅勒西普斯去雅典。雅典人不让他进城，当天押送出境。临别时他说：这一天将是希腊人大灾难的开始${tc("2.12.1 – 3")}。`,
        zoom: 6,
      },
    ],
    labels: ["corcyra", "corinth", "potidaea", "megara", "athens", "sparta"],
    marks: [
      { type: "pulse", place: "corcyra", side: "athens", at: [0.05, 0.6] },
      { type: "pulse", place: "potidaea", side: "sparta", at: [0.2, 0.75] },
      { type: "pulse", place: "megara", side: "sparta", at: [0.35, 0.9] },
    ],
  },
  {
    id: "truest-cause",
    year: 432,
    yearLabel: "公元前 435 – 432 年",
    kicker: "",
    title: "",
    body: [],
    camera: { at: [22.2, 39.0], zoom: 2.2 },
    quote: {
      text: "使战争不可避免的，是雅典势力的增长，以及由此在斯巴达引起的恐惧。",
      cite: "修昔底德 1.23.6",
      note: "他称之为“最真实、却最少被说出口的原因”。",
    },
  },
  {
    id: "act-2",
    year: 431,
    kicker: "",
    title: "",
    body: [],
    camera: attica,
    act: { label: "第二幕", title: "伯里克利的赌局", line: "放弃乡村，只守城墙和大海。这样的城，能打赢一场战争吗？" },
  },
  {
    id: "pericles",
    year: 431,
    kicker: "伯里克利的赌局",
    title: "雅典变成一座岛",
    body: [
      "伯里克利的办法是：放弃乡村。阿提卡的人全部撤进城里，长墙把城市和港口连成一体，粮食从海上运进来。<strong>雅典变成了一座岛。</strong>",
      `斯巴达王阿希达穆斯带兵来了，偏偏在阿卡奈扎营烧田，想逼雅典人出城决战。年轻人在城头看着田地被毁，街头吵成一片，伯里克利就是不出城${tc("2.20 – 22")}。`,
    ],
    camera: attica,
    beats: [
      {
        at: "acharnae",
        title: "故意的挑衅",
        text: `阿卡奈人是城邦里举足轻重的一群，有三千名重装步兵。阿希达穆斯在这里扎营，料定他们不会坐看家园被毁，会拖着全城出战${tc("2.20.4")}。`,
        zoom: 30,
      },
      {
        at: "athens",
        title: "城头上的愤怒",
        text: `年轻人从没见过自家土地遭敌蹂躏，老人也只在波斯战争时见过。街头聚众争吵，人们把怒气撒在伯里克利身上${tc("2.21.2 – 3")}。`,
        zoom: 30,
      },
    ],
    labels: ["athens", "piraeus", "acharnae", "megara", "aegina"],
    marks: [
      { type: "fields", center: [23.7, 38.08], radius: 17, count: 80, burn: [0.4, 0.92], from: [23.48, 38.05] },
      {
        type: "route",
        via: ["corinth", [23.05, 37.97], "megara", [23.55, 38.05], "acharnae"],
        side: "sparta",
        style: "army",
        tag: "阿希达穆斯",
        draw: [0.25, 0.7],
      },
    ],
    inset: {
      type: "image",
      file: "pericles-bust-vatican.webp",
      caption: "伯里克利胸像，罗马时代仿制，梵蒂冈博物馆。入侵的斯巴达王阿希达穆斯是他的世交；他事先宣布，若敌人放过他的庄园，就捐给城邦〔修昔底德 2.13.1〕。",
      at: [0.05, 0.6],
    },
  },
  {
    id: "fleet-raids",
    year: 431,
    kicker: "海上的回击",
    title: "绕着伯罗奔尼撒",
    body: [
      `斯巴达人烧田，雅典人就从海上回击：一百艘战舰绕着伯罗奔尼撒，在敌人的海岸登陆、劫掠，再回到船上${tc("2.23.2")}。`,
      `守住海军，不扩张帝国，耗到对方放弃，这就是伯里克利的战略${tc("2.65.7")}。它本来可能奏效。<strong>可是第二年，一个谁也没想到的敌人进了城。</strong>`,
    ],
    camera: { at: [22.4, 37.5], zoom: 2.8 },
    beats: [
      {
        at: "methone",
        title: "布拉西达斯第一次登场",
        text: `雅典人进攻无人驻守的墨托涅。斯巴达人布拉西达斯带一百名重装步兵冲过散开的雅典军队，进城守住了它，成为这场战争中第一个受到斯巴达嘉奖的人${tc("2.25.1 – 2")}。`,
        zoom: 9,
      },
      {
        at: "pheia",
        title: "劫掠伊利斯",
        text: `舰队在伊利斯的菲亚登陆，劫掠两天，击败三百名援兵。美塞尼亚人随后从陆路攻下菲亚；伊利斯大军赶到时，雅典人已弃城登船${tc("2.25.3 – 5")}。`,
        zoom: 8,
      },
    ],
    labels: ["athens", "sparta", "corinth", "elis", "zacynthus", "naupactus"],
    marks: [
      {
        type: "route",
        via: ["piraeus", [23.5, 37.55], [23.2, 36.6], [22.5, 36.25], [21.75, 36.65], [21.25, 37.4], "zacynthus", [21.0, 38.15], "naupactus"],
        side: "athens",
        style: "fleet",
        ships: 7,
        draw: [0.1, 0.75],
      },
    ],
  },
  {
    id: "plague",
    year: 430,
    yearLabel: "公元前 430 – 426 年",
    kicker: "瘟疫",
    title: "城里的敌人",
    body: [
      `一座挤满难民的岛，最怕瘟疫。第二年夏天，一种至今无法确认的疫病爆发了，乡下人挤在闷热的棚屋和神庙里，死者堆叠${tc("2.52")}。`,
      `前后死了四千四百名重装步兵、三百名骑兵，平民死了多少“无从查清”${tc("3.87.3")}。修昔底德自己也病倒了，又活了下来${tc("2.48.3")}。`,
      `公元前 429 年，伯里克利也死了${tc("2.65.6")}。<strong>雅典失去了那个能管住民众、而不被民众牵着走的人</strong>${tc("2.65.8")}。`,
    ],
    camera: { at: [23.6, 37.97], zoom: 12 },
    beats: [
      {
        at: "piraeus",
        title: "先从港口开始",
        text: `瘟疫先在比雷埃夫斯出现。当时有人传言，是伯罗奔尼撒人往蓄水井里投了毒${tc("2.48.2")}。`,
        zoom: 26,
      },
      {
        at: "athens",
        title: "幸存者",
        text: `得过此病又活下来的人，不会再因它而死。最怜悯垂死者和病人的，正是这些幸存者${tc("2.51.6")}。`,
        zoom: 26,
      },
    ],
    labels: ["athens", "piraeus"],
    inset: {
      type: "dots",
      per: 100,
      groups: [
        { count: 44, label: "重装步兵 4,400" },
        { count: 3, label: "骑兵 300" },
      ],
      at: [0.15, 0.7],
    },
  },
  {
    id: "mytilene",
    year: 427,
    kicker: "米提列涅",
    title: "追赶死刑令",
    body: [
      `公元前 427 年，叛离的米提列涅被镇压。雅典公民大会在盛怒中投票：处死全城成年男子。一艘战舰当即出发传令${tc("3.36")}。`,
      `第二天，很多人后悔了。再表决一次，以微弱多数改了主意，第二艘船立刻追了出去。桨手轮班睡觉，边划边吃，日夜不停${tc("3.49")}。`,
      `它赶到时，死刑令刚刚宣读完${tc("3.49.4")}。米提列涅得救了，但一千余名“主谋者”仍被处死${tc("3.50.1")}。<strong>没有了伯里克利，雅典的决定可以在一夜之间反转。</strong>`,
    ],
    camera: { at: [25.1, 38.6], zoom: 2.7 },
    beats: [
      {
        at: [25.3, 38.45],
        title: "日夜不停",
        text: `第二艘船的桨手轮班睡觉，一边划桨一边吃用酒和油和成的大麦饼。第一艘船比它早出发了大约一天一夜${tc("3.49.2 – 3")}。`,
        zoom: 4.5,
      },
    ],
    labels: ["athens", "mytilene"],
    inset: {
      type: "image",
      file: "pnyx-bema-acropolis.webp",
      caption: "普尼克斯山上的演讲台，雅典公民大会在这里开会、表决。远处是卫城。",
      at: [0.02, 0.32],
    },
    marks: [
      {
        type: "route",
        via: ["piraeus", [24.1, 37.6], [24.85, 38.15], [25.8, 38.75], [26.3, 39.0], "mytilene"],
        side: "neutral",
        style: "fleet",
        ships: 1,
        tag: "死刑令",
        draw: [0.05, 0.64],
      },
      {
        type: "route",
        via: ["piraeus", [24.1, 37.6], [24.85, 38.15], [25.8, 38.75], [26.3, 39.0], "mytilene"],
        side: "athens",
        style: "fleet",
        ships: 1,
        tag: "赦免令",
        tagBelow: true,
        draw: [0.34, 0.66],
      },
      { type: "pulse", place: "mytilene", side: "athens", at: [0.64, 0.98] },
    ],
  },
  {
    id: "sphacteria",
    year: 425,
    kicker: "斯法克特里亚",
    title: "斯巴达人投降了",
    body: [
      `公元前 425 年，四百多名斯巴达士兵被困在皮洛斯对面的斯法克特里亚岛上${tc("4.8.9, 4.14.5")}。七十二天后，292 人放下武器，其中约 120 人是斯巴达公民${tc("4.38.5, 4.39.1")}。全希腊都惊呆了：斯巴达人不是宁死不降吗${tc("4.40.1")}？`,
      `更要命的是地点。皮洛斯在美塞尼亚，正是那些被赶走的黑劳士的故乡。他们从瑙帕克图斯回来驻守，四处劫掠，黑劳士开始逃亡${tc("4.41.2 – 3")}。<strong>斯巴达最怕的事，发生在了自家后院。</strong>`,
      `雅典人还放话：斯巴达再入侵阿提卡，就处死这些俘虏。斯巴达的大军果然再没来过${tc("4.41.1")}。`,
    ],
    camera: { at: [21.66, 36.93], zoom: 30 },
    beats: [
      {
        at: "sphacteria",
        title: "潜水送粮",
        text: `斯巴达许诺给运粮上岛的黑劳士自由，黑劳士便趁夜驾船冲滩${tc("4.26.5 – 7")}。还有人从港湾潜水过去，用绳子拖着皮囊，装着拌蜂蜜的罂粟籽和捣碎的亚麻籽${tc("4.26.8")}。`,
        zoom: 60,
      },
      {
        at: "pylos",
        title: "克里昂的大话",
        text: `克里昂夸口：二十天内，要么把岛上的斯巴达人活着带回来，要么就地杀光。雅典人听了忍不住发笑${tc("4.28.4 – 5")}。结果他真在二十天内把人带回了雅典${tc("4.39.3")}。`,
        zoom: 60,
      },
    ],
    labels: ["pylos", "sphacteria"],
    marks: [{ type: "blockade", place: "sphacteria", side: "athens", radius: 6, at: [0.05, 0.4] }],
    inset: [{
      type: "count",
      value: 292,
      of: 420,
      unit: "人投降，其中约 120 人是斯巴达公民",
      note: "有人讥讽俘虏：战死的才算好汉吧？俘虏答：要是箭能分辨谁是好汉，那它就值钱了。〔修昔底德 4.40.2〕",
      at: [0.2, 0.52],
    }, {
      type: "image",
      file: "pylos-spartan-shield.webp",
      caption: "雅典人在皮洛斯之战中缴获的斯巴达青铜盾牌，今藏雅典古市场博物馆。",
      at: [0.56, 0.9],
    }],
  },
  {
    id: "brasidas",
    year: 424,
    yearLabel: "公元前 424 – 422 年",
    kicker: "布拉西达斯",
    title: "北方的奇袭，史家的放逐",
    body: [
      "斯巴达也有自己的奇才。布拉西达斯带着一支小部队穿过整个希腊，在北方一座接一座地劝降雅典的盟邦。",
      `公元前 424 年冬，他拿下了要地安菲波利斯。赶来救援的雅典将军晚了一步，只保住了河口的埃翁${tc("4.104 – 106")}。这位将军被放逐了二十年，他就是修昔底德本人。`,
      `<strong>放逐让他得以去看交战的双方</strong>${tc("5.26.5")}。我们读到的这部史书，因此不只是雅典人的视角。`,
    ],
    camera: { at: [23.2, 39.4], zoom: 2.6 },
    beats: [
      {
        at: "pharsalus",
        title: "急行穿过色萨利",
        text: `色萨利民众一向亲雅典。布拉西达斯由当地友人护送，赶在对方聚集更多人阻拦之前不停急行，一天就赶到法萨卢斯${tc("4.78.2 – 5")}。`,
        zoom: 6,
      },
      {
        at: "acanthus",
        title: "葡萄与演说",
        text: `布拉西达斯在葡萄收获前夕兵临阿坎苏斯。城里秘密投票，多数人被他的演说打动，又担心城外的果实，决定叛离雅典${tc("4.84.1, 4.88.1")}。`,
        zoom: 7,
      },
      {
        at: "amphipolis",
        title: "雪夜奇袭",
        text: `冬天的一个夜里，风急，下着小雪。他赶走斯特律蒙河桥头的少量守兵，过了河，安菲波利斯城外的人和财物都落入他手${tc("4.102.1, 4.103.2 – 5")}。`,
        zoom: 8,
      },
      {
        at: "eion",
        title: "晚了一步",
        text: `修昔底德带着 7 艘船从半天航程外的萨索斯赶来。当天晚些时候他驶进埃翁港时，安菲波利斯刚刚投降，他只保住了河口的埃翁${tc("4.104.4 – 5, 4.106.3 – 4")}。`,
        zoom: 8,
      },
    ],
    labels: ["corinth", "heraclea", "pharsalus", "dion", "acanthus", "amphipolis", "thasos"],
    marks: [
      {
        type: "route",
        via: ["corinth", [22.6, 38.35], "heraclea", "pharsalus", "dion", [22.95, 40.6], "acanthus", "amphipolis"],
        side: "sparta",
        style: "army",
        tag: "布拉西达斯",
        draw: [0.05, 0.5],
        trace: true,
      },
      { type: "route", via: ["thasos", [24.3, 40.72], "eion"], side: "athens", style: "fleet", ships: 7, tag: "修昔底德", tagBelow: true, draw: [0.45, 0.62] },
      { type: "pulse", place: "amphipolis", side: "sparta", at: [0.5, 0.95] },
    ],
  },
  {
    id: "melos",
    year: 416,
    yearLabel: "公元前 421 – 416 年",
    kicker: "和约与米洛斯",
    title: "强权的逻辑",
    body: [
      `公元前 422 年，布拉西达斯和雅典主战派领袖克里昂死在同一场战斗里${tc("5.10")}。第二年，双方签下“尼西阿斯和约”，约定和平五十年${tc("5.18")}。和平大多只在纸面上。`,
      `公元前 416 年，雅典要求原本中立的岛国米洛斯归顺${tc("5.84.2")}。米洛斯人谈正义、谈神明，雅典使者只谈利害${tc("5.85 – 113")}。米洛斯拒绝了。城破后，成年男子被处死，妇孺被卖为奴${tc("5.116.4")}。`,
    ],
    camera: { at: [24.4, 37.2], zoom: 4.2 },
    beats: [
      {
        at: "melos",
        title: "寄望于斯巴达",
        text: `米洛斯人说，他们敬神守正，神会保佑；斯巴达人出于同族之情和羞耻心，也一定会来救${tc("5.104")}。雅典人回答：你们最信斯巴达，也会被骗得最惨${tc("5.113")}。`,
        zoom: 9,
      },
    ],
    labels: ["melos", "athens", "thera", "naxos"],
    marks: [{ type: "blockade", place: "melos", side: "athens", radius: 22, at: [0.2, 0.55] }],
  },
  {
    id: "strong-and-weak",
    year: 416,
    yearLabel: "公元前 416 年",
    kicker: "",
    title: "",
    body: [],
    camera: { at: [24.4, 37.2], zoom: 4.2 },
    quote: {
      text: "强者做他们能做的，弱者承受他们必须承受的。",
      cite: "修昔底德 5.89",
      note: "雅典使者对米洛斯人说。",
    },
  },
  {
    id: "act-3",
    year: 415,
    kicker: "",
    title: "",
    body: [],
    camera: { at: [19.2, 38.4], zoom: 1.35 },
    act: { label: "第三幕", title: "西西里", line: "和约签了没几年，雅典决定去赌一把更大的。" },
  },
  {
    id: "sicily",
    year: 415,
    kicker: "西西里远征",
    title: "最大的一次出征",
    body: [
      `公元前 415 年，雅典决定远征西西里。尼西阿斯想用夸大的开销吓退众人，结果适得其反：“所有人都爱上了这次远征”${tc("6.20 – 24")}。最后出发的是一百三十四艘战舰、五千一百名重装步兵${tc("6.43.1")}。`,
      `大多数雅典人连西西里有多大都不知道${tc("6.1.1")}。出发前，城里的赫尔墨斯像大多在一夜之间被砸了脸。这桩案子很快会让雅典失去它最有才华的将军亚西比德${tc("6.15.4, 6.27 – 28, 6.61")}。`,
    ],
    camera: { at: [19.2, 38.4], zoom: 1.35 },
    beats: [
      {
        at: "corcyra",
        title: "科西拉集结",
        text: `全军在科西拉集结：134 艘三列桨战舰、5,100 名重装步兵、480 名弓手、700 名罗得岛投石手${tc("6.43")}。`,
        zoom: 4,
      },
      {
        at: "tarentum",
        title: "冷淡的意大利",
        text: `沿途的意大利城邦都关起城门和集市，只许雅典人取水、停泊；他林敦和洛克里连这也不给${tc("6.44.2")}。`,
        zoom: 4,
      },
      {
        at: "segesta",
        title: "借来的财富",
        text: `塞杰斯塔人私下宴请雅典船员，把城里的金银杯连同从邻城借来的，各家轮流摆上桌充门面。真要掏钱时，只拿得出三十塔兰特${tc("6.46.1 – 4")}。`,
        zoom: 4,
      },
      {
        at: "catana",
        title: "从小门混进城",
        text: `卡塔那不肯接纳雅典军队。趁亚西比德在大会上讲话，士兵砸开一道没砌牢的小门，涌进集市；亲叙拉古派溜走，其余人投票结盟${tc("6.51.1 – 2")}。`,
        zoom: 5,
      },
    ],
    labels: ["athens", "corcyra", "tarentum", "rhegium", "catana", "syracuse", "segesta"],
    marks: [
      {
        type: "route",
        via: ["piraeus", [23.2, 36.55], [21.7, 36.6], [20.8, 37.9], [20.4, 39.2], "corcyra", [18.6, 39.9], [17.3, 39.3], "croton", [16.0, 38.3], "rhegium", "catana", "syracuse"],
        side: "athens",
        style: "band",
        width: 16,
        ships: 7,
        draw: [0.05, 0.6],
        trace: true,
      },
    ],
    inset: [
      { type: "growth", from: 60, to: 134, unit: "艘战舰〔修昔底德 6.8.2, 6.43.1〕", note: "原定 → 出发", at: [0.15, 0.45] },
      {
        type: "image",
        file: "herm-hermes-propylaios.webp",
        caption: "赫尔墨斯方柱像：方柱上立着神的头像，雅典人把它立在家门口和街口。图为罗马时代的仿制品。",
        at: [0.5, 0.9],
      },
    ],
  },
  {
    id: "siege",
    year: 414,
    kicker: "叙拉古",
    title: "城墙赛跑",
    body: [
      `雅典人在叙拉古城外的高地上筑起圆堡，开始修环城墙，要把叙拉古从陆上围死；叙拉古人拼命修横墙去截断它${tc("6.97 – 103")}。`,
      `就在墙快要合拢时，斯巴达派来的将领吉利普斯赶到了，带着叙拉古人把横墙修过了雅典的墙线${tc("7.1 – 7")}。`,
      `<strong>派一个斯巴达人来指挥，正是叛逃到斯巴达的亚西比德出的主意</strong>${tc("6.88.9, 6.91.4, 6.93.1 – 2")}。`,
    ],
    camera: { at: [15.2, 37.2], zoom: 8 },
    beats: [
      {
        at: "epipolae",
        title: "埃皮波莱高地",
        text: `高地陡峭，正压在叙拉古城上方。叙拉古人认为，雅典人不先拿下这里，就很难把城围住${tc("6.96.1")}。`,
        zoom: 30,
      },
      {
        at: "trogilus",
        title: "只差一段",
        text: `吉利普斯赶到时，雅典通往大港的双层墙只差临海一小段；通往特罗吉卢斯的北段，大半还只是沿线堆放的石料${tc("7.2.4")}。`,
        zoom: 30,
      },
    ],
    labels: ["syracuse", "catana"],
    inset: { type: "siege", at: [0.05, 0.85] },
  },
  {
    id: "syracuse",
    year: 413,
    kicker: "覆灭",
    title: "月食、海港与河流",
    body: [
      `雅典又派来七十三艘战舰${tc("7.42.1")}，仍打不开局面。撤退前夜，月食了。尼西阿斯听了占卜者的话，决定再等“三个九天”${tc("7.50.4")}。等来的是被封死的港口和大港里的惨败${tc("7.59.3, 7.70 – 72")}。`,
      `四万人从陆上撤退${tc("7.75.5")}。在阿西纳鲁斯河，口渴的士兵冲进河里抢水，敌人在岸上放箭，河水被血染红，人们还在抢着喝${tc("7.84")}。至少七千人被俘，关进了露天的采石场${tc("7.87.1, 7.87.4")}。`,
    ],
    camera: { at: [15.2, 37.05], zoom: 7 },
    beats: [
      {
        at: [15.27, 37.05],
        title: "大港决战",
        text: `岸上的雅典士兵看着港里的海战，身体随战局摇摆；“我们赢了！”“我们输了！”的喊声此起彼伏${tc("7.71.3 – 4")}。`,
        zoom: 14,
      },
    ],
    labels: ["syracuse", "assinarus"],
    marks: [
      { type: "blockade", place: "syracuse", side: "sparta", radius: 14, at: [0.1, 0.4] },
      {
        type: "route",
        via: ["syracuse", [15.15, 37.02], [15.05, 36.97], "assinarus"],
        side: "athens",
        style: "army",
        tag: "撤退",
        draw: [0.4, 0.7],
      },
      { type: "pulse", place: "assinarus", side: "sparta", at: [0.66, 0.98] },
    ],
    inset: [
      { type: "count", value: 7000, unit: "人被俘", note: "至少七千人", at: [0.5, 0.7] },
      {
        type: "image",
        file: "syracuse-latomia-paradiso.webp",
        caption: "叙拉古的“天堂采石场”，今天长满了树。雅典俘虏被关在这样的露天石坑里。",
        at: [0.74, 0.95],
      },
    ],
  },
  {
    id: "few-returned",
    year: 413,
    kicker: "",
    title: "",
    body: [],
    camera: { at: [15.2, 37.05], zoom: 7 },
    quote: {
      text: "舰队、陆军，一切都毁了。许多人出征，只有少数人回到家乡。",
      cite: "修昔底德 7.87.6",
    },
  },
  {
    id: "act-4",
    year: 413,
    kicker: "",
    title: "",
    body: [],
    camera: { at: [23.75, 38.15], zoom: 9 },
    act: { label: "第四幕", title: "钱与粮", line: "西西里之后，雅典再也输不起了。斯巴达开始往它的要害上打。" },
  },
  {
    id: "decelea",
    year: 413,
    kicker: "狄西里亚",
    title: "家门口的要塞",
    body: [
      `亚西比德给斯巴达出的第二个主意，是在阿提卡境内的狄西里亚建一座常驻要塞${tc("6.91.6, 7.19.1")}。从前的入侵最长也不过四十天左右${tc("2.57.2")}，现在敌人一年到头就在家门口；陆续有两万多名奴隶逃了过去${tc("7.27.5")}。`,
      `连优卑亚的物资也只能绕过苏尼昂角走海路。修昔底德说，雅典“从一座城变成了一座要塞”${tc("7.28.1")}。<strong>岛，只剩下海路这一条命。</strong>`,
    ],
    camera: { at: [23.75, 38.15], zoom: 9 },
    beats: [
      {
        at: "decelea",
        title: "望得见的要塞",
        text: `狄西里亚离雅典约一百二十斯塔德，从雅典城就能望见${tc("7.19.2")}。`,
        zoom: 14,
      },
    ],
    labels: ["athens", "decelea", "chalcis", "sunium"],
    marks: [
      { type: "pulse", place: "decelea", side: "sparta", at: [0.05, 0.5] },
      {
        type: "route",
        via: ["chalcis", [23.75, 38.3], [24.2, 38.1], [24.25, 37.75], [24.05, 37.58], [23.75, 37.75], "piraeus"],
        side: "grain",
        style: "fleet",
        ships: 4,
        tag: "改走海路",
        draw: [0.45, 0.88],
      },
    ],
  },
  {
    id: "persia",
    year: 412,
    yearLabel: "公元前 412 – 411 年",
    kicker: "波斯的金币",
    title: "斯巴达终于有了舰队",
    body: [
      `西西里的消息传开，雅典的盟邦一个接一个叛离：希俄斯、米利都、罗得岛、优卑亚${tc("8.14, 8.17, 8.44, 8.95")}。`,
      `更致命的是钱。波斯总督开始出钱给斯巴达造舰队，条件是亚洲的希腊城邦归还波斯国王${tc("8.5, 8.18")}。<strong>斯巴达第一次有钱在海上和雅典打一场消耗战。</strong>`,
      `公元前 411 年，雅典的民主一度被“四百人”推翻${tc("8.63 – 70")}。`,
    ],
    camera: { at: [26.0, 38.4], zoom: 2.2 },
    focus: "all",
    beats: [
      {
        at: "sardis",
        title: "居鲁士的宝座",
        text: `后来波斯王子居鲁士来到萨迪斯。他对吕山德说，自己带来五百塔兰特；不够就动用私产，再不够，就把坐着的金银宝座拆了${xen("1.5.1 – 3")}。`,
        zoom: 5,
      },
    ],
    labels: ["athens", "sardis", "miletus", "chios", "samos", "rhodes"],
    ripple: { from: "chios", start: 0.08, span: 0.32 },
    marks: [{ type: "flow", via: ["sardis", [27.8, 37.9], "miletus"], side: "persia", at: [0.35, 1] }],
  },
  {
    id: "break",
    year: 411,
    kicker: "停笔",
    title: "修昔底德的书没有写完",
    body: [
      `修昔底德的记述停在公元前 411 年的夏末${tc("8.109")}，没有结尾，也没有总结。`,
      "剩下的七年，要从另一位雅典人色诺芬的《希腊史》里接着读。这七年里，雅典还会打几场大胜仗，胜得让人以为它能翻盘。",
    ],
    camera: aegean,
    focus: "all",
    labels: ["athens", "sparta"],
    inset: {
      type: "image",
      file: "thucydides-bust.webp",
      caption: "修昔底德头像，罗马时代仿制，安大略皇家博物馆。",
      at: [0.05, 0.7],
    },
  },
  {
    id: "cyzicus",
    year: 410,
    kicker: "基齐库斯",
    title: "船没了，人在挨饿",
    body: [
      `叛逃过的亚西比德又回到了雅典一边${tc("8.81 – 82")}。公元前 410 年，他在基齐库斯附近全歼斯巴达舰队，主将明达罗斯战死${xen("1.1.11 – 18")}。雅典人截获了斯巴达人发回国内的信，只有四句话${xen("1.1.23")}。`,
      `波斯总督的反应更值得记住：不必为船木灰心，国王的土地上有的是木材${xen("1.1.24")}。<strong>雅典夺走多少船，波斯就出钱再造多少</strong>${xen("1.1.25")}。`,
    ],
    camera: { at: [27.6, 40.45], zoom: 6 },
    beats: [
      {
        at: "samos",
        title: "舰队里的民主",
        text: `雅典发生寡头政变时，驻萨摩斯的舰队坚持民主，自己选举将军，召回了亚西比德${tc("8.75.2, 8.76.2, 8.81.1")}。`,
        zoom: 7,
      },
    ],
    labels: ["cyzicus", "byzantium", "lampsacus"],
    marks: [
      { type: "route", via: [[26.9, 40.55], [27.4, 40.62], [27.75, 40.45], "cyzicus"], side: "athens", style: "fleet", ships: 6, tag: "亚西比德", draw: [0.05, 0.4] },
      { type: "pulse", place: "cyzicus", side: "athens", at: [0.35, 0.8] },
    ],
    inset: [{
      type: "image",
      file: "alcibiades-bust.webp",
      caption: "传为亚西比德的胸像，罗马卡比托利欧博物馆。身份是传统认定，底座铭文是后人加刻。",
      at: [0.04, 0.4],
    }, {
      type: "note",
      kicker: "截获的斯巴达战报",
      lines: ["船没了。", "明达罗斯死了。", "人在挨饿。", "不知如何是好。"],
      cite: "色诺芬《希腊史》1.1.23",
      at: [0.45, 0.8],
    }],
  },
  {
    id: "arginusae",
    year: 406,
    kicker: "阿吉纽西",
    title: "打赢的将军被处死",
    body: [
      `公元前 406 年，雅典倾尽全力，连奴隶都上了船，在阿吉纽西群岛大败斯巴达舰队${xen("1.6.24 – 35")}。`,
      `可一场风暴让落水的人没能被救起。公民大会在激愤中把打赢这一仗、回到雅典的六位将军一并处死，其中有伯里克利的儿子。只有苏格拉底拒绝把这项违法的动议付诸表决${xen("1.7.15, 1.7.34")}。`,
      "<strong>赢了海战的雅典，亲手处死了自己的将军。</strong>",
    ],
    camera: { at: [26.5, 39.1], zoom: 5 },
    beats: [
      {
        at: "arginusae",
        title: "落水的主帅",
        text: `斯巴达主帅卡利克拉提达斯在座舰撞击敌船时落海，再没浮上来${xen("1.6.33")}。雅典损失了 25 艘船，船上的人几乎全没了${xen("1.6.34")}。`,
        zoom: 10,
      },
      {
        at: "mytilene",
        title: "上船的奴隶",
        text: `为救被围在米提列涅的舰队，雅典三十天内给 110 艘船配齐人手，奴隶和自由人一起上船${xen("1.6.24")}。参战的奴隶随后像普拉提亚人那样成了公民（阿里斯托芬喜剧《蛙》693 – 694）。`,
        zoom: 8,
      },
    ],
    labels: ["arginusae", "mytilene", "samos"],
    marks: [{ type: "pulse", place: "arginusae", side: "athens", at: [0.1, 0.55] }],
  },
  {
    id: "aegospotami",
    year: 405,
    kicker: "羊河",
    title: "粮道的咽喉",
    body: [
      `斯巴达人终于看清了雅典的命门。斯巴达王阿基斯早就在狄西里亚望见运粮船源源驶进比雷埃夫斯，说光在陆上围堵没有用${xen("1.1.35")}。公元前 405 年，吕山德带着波斯的钱和舰队，开到赫勒斯滂“拦截运粮船”${xen("2.1.14, 2.1.17")}。`,
      `180 艘雅典战舰只能跟来，停在对岸一片没有城市的海滩，水手每天要上岸找吃的${xen("2.1.20 – 21, 2.1.25")}。住在附近城堡里的亚西比德赶来警告，被打发走了${xen("2.1.25 – 26")}。第五天，吕山德突然出击，几乎俘获了整支舰队${xen("2.1.27 – 28")}。`,
      `只有科农的八艘船和公务船“帕拉卢斯号”逃了出来${xen("2.1.28 – 29")}。<strong>就是开头那一夜的那艘船。</strong>`,
    ],
    camera: { at: [26.55, 40.3], zoom: 14 },
    beats: [
      {
        at: "lampsacus",
        title: "满是酒和粮食的富城",
        text: `吕山德强攻拿下了雅典的盟邦兰普萨库斯，色诺芬说这是一座“满是酒和粮食的富城”${xen("2.1.18 – 19")}。`,
        zoom: 22,
      },
      {
        at: [26.645, 40.34],
        title: "举盾为号",
        text: `第五天，尾随雅典舰队的快船看到雅典人上岸散开，便掉头回航，在海峡中途举起盾牌。吕山德随即下令全速出击${xen("2.1.27 – 28")}。`,
        zoom: 22,
      },
    ],
    labels: ["aegospotami", "lampsacus", "sestos"],
    marks: [
      { type: "route", via: ["lampsacus", [26.645, 40.345], "aegospotami"], side: "sparta", style: "fleet", ships: 6, tag: "吕山德", draw: [0.45, 0.66] },
      { type: "pulse", place: "aegospotami", side: "sparta", at: [0.62, 0.95] },
    ],
    inset: { type: "count", value: 9, of: 180, unit: "艘逃脱", note: "科农的 8 艘船和公务船“帕拉卢斯号”，其余几乎都在岸边被俘", at: [0.62, 0.92] },
  },
  {
    id: "collapse",
    year: 405,
    kicker: "帝国瓦解",
    title: "除了萨摩斯",
    body: [
      `那一夜，雅典人想起了自己对米洛斯人做过的事${xen("2.2.3")}。舰队没了，粮道断了。海战之后，除了萨摩斯，希腊各地都背弃了雅典${xen("2.2.6")}。`,
      `吕山德把各地的雅典驻军和雅典人都赶回雅典，不许他们去别处。<strong>城里的人越多，粮食耗尽得越快</strong>${xen("2.2.2")}。`,
    ],
    camera: aegean,
    focus: "all",
    beats: [
      {
        at: "samos",
        title: "最后的盟友",
        text: `羊河之后，各邦纷纷背离雅典，只有萨摩斯例外${xen("2.2.6")}。萨摩斯人被吕山德围到雅典投降之后，才每人只带一件外衣离城${xen("2.3.6")}。`,
        zoom: 6,
      },
      {
        at: "athens",
        title: "饥饿中的城",
        text: `雅典陆上海上都被围困，没有船，没有盟友，没有粮食，许多人饿死，城里仍不肯求和${xen("2.2.10 – 11")}。`,
        zoom: 6,
      },
    ],
    labels: ["athens", "samos", "byzantium", "mytilene", "aegospotami"],
    ripple: { from: "aegospotami", start: 0.1, span: 0.45 },
  },
  {
    id: "surrender",
    year: 404,
    kicker: "结局",
    title: "在笛声中拆墙",
    body: [
      `公元前 404 年，被围困、断了粮的雅典投降。科林斯和底比斯要求毁掉雅典，斯巴达拒绝了：它不愿毁掉一座在希腊危难时立过大功的城市${xen("2.2.19 – 20")}。`,
      `条件是拆掉长墙和比雷埃夫斯的城墙，只留十二艘船${xen("2.2.20")}。长墙在吹笛女的乐声中倒下，伯罗奔尼撒人相信，那一天是希腊自由的开始${xen("2.2.23")}。<strong>岛，又变回了一座城。</strong>`,
    ],
    camera: attica,
    beats: [
      {
        at: "sparta",
        title: "要求毁城",
        text: `在斯巴达的大会上，科林斯人和底比斯人主张不讲和、毁掉雅典。斯巴达人不肯：雅典在希腊最危急的时候立过大功${xen("2.2.19 – 20")}。`,
        zoom: 7,
      },
      {
        at: "athens",
        title: "此后",
        text: `战后，“三十人”在吕山德支持下掌权，不久就杀了不下一千五百人（亚里士多德《雅典政制》34.3、35.4）。次年民主恢复，双方立誓不追究旧怨（同书 39.6）。`,
        zoom: 20,
      },
    ],
    labels: ["athens", "piraeus"],
  },
  {
    id: "coda",
    year: 404,
    kicker: "",
    title: "",
    body: [],
    quote: {
      text: "我写下的这部书，不是为了博取一时的掌声，而是要成为一份永久的财产。",
      cite: "修昔底德 1.22.4",
      note: "两千四百年后，人们仍然在用它讨论强国之间的恐惧。",
    },
    camera: { at: [21.5, 38.4], zoom: 1 },
  },
];

// Allegiances change at a step; the change animates in over that step's first part.
// Simplified from Thucydides 2.9 and the later revolts he and Xenophon record.
const lostAfterAegospotami: Array<[string, Side]> = [["collapse", "sparta"]];

export const allegiance: Partial<Record<PlaceId, Array<[string, Side | "ruined"]>>> = {
  athens: [["two-powers", "athens"]],
  piraeus: [["two-powers", "athens"]],
  plataea: [["two-powers", "athens"], ["plague", "ruined"]],
  naupactus: [["two-powers", "athens"]],
  corcyra: [["two-powers", "athens"]],
  zacynthus: [["two-powers", "athens"]],
  chalcis: [["two-powers", "athens"], ["persia", "sparta"]],
  eretria: [["two-powers", "athens"], ["persia", "sparta"]],
  aegina: [["two-powers", "athens"], ...lostAfterAegospotami],
  // In revolt from Athens by 407 (Xenophon, Hellenica 1.4.21).
  andros: [["two-powers", "athens"], ["persia", "sparta"]],
  naxos: [["two-powers", "athens"], ...lostAfterAegospotami],
  delos: [["two-powers", "athens"], ...lostAfterAegospotami],
  samos: [["two-powers", "athens"]],
  chios: [["two-powers", "athens"], ["persia", "sparta"]],
  mytilene: [["two-powers", "athens"], ...lostAfterAegospotami],
  miletus: [["two-powers", "athens"], ["persia", "sparta"]],
  ephesus: [["two-powers", "athens"], ["persia", "sparta"]],
  halicarnassus: [["two-powers", "athens"], ...lostAfterAegospotami],
  rhodes: [["two-powers", "athens"], ["persia", "sparta"]],
  // Revolted in 411, recovered by Athens in 410 – 408, lost again after Aegospotami.
  byzantium: [["two-powers", "athens"], ["persia", "sparta"], ["arginusae", "athens"], ...lostAfterAegospotami],
  cyzicus: [["two-powers", "athens"], ["persia", "sparta"], ["cyzicus", "athens"], ...lostAfterAegospotami],
  abdera: [["two-powers", "athens"], ...lostAfterAegospotami],
  thasos: [["two-powers", "athens"], ["persia", "sparta"]],
  amphipolis: [["two-powers", "athens"], ["brasidas", "sparta"]],
  eion: [["two-powers", "athens"], ...lostAfterAegospotami],
  // In revolt and under Athenian siege when the war began; surrendered in winter 430/429.
  potidaea: [["two-powers", "sparta"], ["plague", "athens"], ...lostAfterAegospotami],
  acanthus: [["two-powers", "athens"], ["brasidas", "sparta"]],
  lampsacus: [["two-powers", "athens"], ["aegospotami", "sparta"]],
  sestos: [["two-powers", "athens"], ...lostAfterAegospotami],
  rhegium: [["two-powers", "athens"], ["sicily", "neutral"]],
  catana: [["two-powers", "neutral"], ["sicily", "athens"]],
  segesta: [["two-powers", "neutral"]],
  sparta: [["two-powers", "sparta"]],
  corinth: [["two-powers", "sparta"]],
  megara: [["two-powers", "sparta"]],
  thebes: [["two-powers", "sparta"]],
  sicyon: [["two-powers", "sparta"]],
  elis: [["two-powers", "sparta"]],
  tegea: [["two-powers", "sparta"]],
  mantinea: [["two-powers", "sparta"]],
  epidaurus: [["two-powers", "sparta"]],
  ambracia: [["two-powers", "sparta"]],
  leucas: [["two-powers", "sparta"]],
  syracuse: [["two-powers", "sparta"]],
  tarentum: [["two-powers", "neutral"]],
  croton: [["two-powers", "neutral"]],
  argos: [["two-powers", "neutral"]],
  // Lysander brought the surviving Melians home after Aegospotami (Hellenica 2.2.9).
  melos: [["two-powers", "neutral"], ["melos", "ruined"], ["collapse", "sparta"]],
  thera: [["two-powers", "neutral"], ["plague", "athens"]],
  sardis: [["two-powers", "persia"]],
};
