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
  // Several insets play in sequence, each from its own start.
  inset?: Inset | Inset[];
  // A full-screen typographic moment; the map holds the previous camera and dims.
  quote?: { text: string; cite: string; note?: string };
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
      "二十七年里，希腊世界最强的两个城邦把几乎所有希腊人都卷了进来。",
      `战争刚一开始，一位雅典人就动笔记录。他相信这会是一场“比以往任何战争都更值得记述”的战争${tc("1.1.1")}。他叫修昔底德。`,
    ],
    camera: { at: [21.5, 38.4], zoom: 1 },
  },
  {
    id: "two-powers",
    year: 431,
    kicker: "两个世界",
    title: "海上的帝国，陆上的同盟",
    body: [
      `公元前 431 年，希腊世界分成了两半。蓝色是雅典和它的盟邦，几乎占满了爱琴海的岛屿和海岸；红色是斯巴达领导的伯罗奔尼撒同盟，集中在希腊本土${tc("2.9")}。`,
      "一边的力量在海上，一边在陆上。要看懂这场战争，先要看懂这两座城各自靠什么活着，又各自害怕什么。",
    ],
    camera: aegean,
    labels: ["athens", "sparta", "corinth", "thebes", "corcyra", "samos", "chios", "mytilene", "argos"],
    legend: true,
  },
  {
    id: "grain",
    year: 431,
    kicker: "雅典的命脉",
    title: "一座靠海吃饭的城",
    body: [
      "阿提卡多山少地，种出的粮食不够养活全城。现代学者估计，平常年份它大约只能自给三分之一到一半。雅典高度依赖海外进口的粮食，黑海沿岸是最重要的来源之一。",
      "运粮船从黑海出发，经过拜占庭，穿过狭窄的赫勒斯滂海峡进入爱琴海，绕过苏尼昂角，驶进比雷埃夫斯港。",
      "记住这条航线。二十七年后，战争就在这里结束。",
    ],
    camera: { at: [26.3, 39.5], zoom: 1.7 },
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
      "雅典的海军由约三百艘可以出海的三列桨战舰组成。每艘船约 200 人，170 名桨手分三层坐在船舱里，船首装着青铜撞角。海战靠的是速度、机动和撞击。",
      `划桨的有穷苦的公民，也有外邦人和奴隶。当时就有人说，雅典的穷人之所以在城邦里说了算，是因为他们给舰队划桨${ps("1.2")}。雅典的民主和雅典的海军，是绑在一起的。`,
    ],
    camera: { at: [23.64, 37.94], zoom: 26 },
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
      `养一支舰队非常昂贵。修昔底德顺手记下过一笔账：60 塔兰特，正好是 60 艘战舰一个月的军饷${tc("6.8.1")}。也就是说，一艘船出海一个月，花掉 1 塔兰特。`,
      `钱从盟邦来。提洛同盟原本是为对抗波斯而结成的，各邦出船或出钱；后来大多数盟邦都改为交钱，同盟成了雅典的帝国${tc("1.96, 1.99")}。战争开始时，每年平均约有六百塔兰特贡金流入雅典，卫城上还存着六千塔兰特${tc("2.13.3")}。粗算一下：这笔储备只够三百艘战舰全部出海约二十个月。`,
    ],
    camera: { at: [25.3, 38.4], zoom: 2.1 },
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
      "斯巴达公民只是少数。他们统治着人数多得多的黑劳士，世代为奴的农民，替斯巴达人耕种拉科尼亚和美塞尼亚的土地。斯巴达人不必劳作，才能终身当兵。",
      `公元前 464 年大地震后，美塞尼亚的黑劳士据守伊托米山起义，坚持了多年。最后斯巴达放他们离开，雅典把这些人安置在科林斯湾边的瑙帕克图斯${tc("1.101 – 103")}。斯巴达的军队天下无敌，却很少敢长期远离家门。`,
      `修昔底德还记下一件事：斯巴达宣布，作战有功的黑劳士可以获得自由。被选出的两千人戴着花冠绕行神庙，不久，他们全都不见了${tc("4.80.3 – 4")}。`,
    ],
    camera: { at: [22.1, 37.55], zoom: 4.6 },
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
      "科西拉拥有希腊第二大的舰队，它和母邦科林斯开战后向雅典求援，雅典不愿看到这支舰队落入科林斯手中。雅典属邦波提狄亚在科林斯支持下叛离。雅典又对斯巴达的盟邦麦加拉下达了贸易禁令。",
      "这些争端都可以谈判，也确实谈过。但在修昔底德看来，它们只是表面的理由。",
    ],
    camera: { at: [22.2, 39.0], zoom: 2.2 },
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
    id: "pericles",
    year: 431,
    kicker: "伯里克利的赌局",
    title: "雅典变成一座岛",
    body: [
      "伯里克利的方案是放弃乡村。阿提卡的居民撤进城里，城墙由“长墙”一直连到比雷埃夫斯港。只要海路畅通，粮食就能从海上运进来。雅典变成了一座岛。",
      `率军入侵的斯巴达国王阿希达穆斯是伯里克利的朋友。伯里克利担心对方故意放过自己的庄园、借此离间，事先宣布把庄园捐给城邦${tc("2.13.1")}。阿希达穆斯故意在阿卡奈驻扎、焚烧田地，想逼雅典人出城决战。年轻人从没见过这样的景象，街头吵成一片，但伯里克利坚持不出城${tc("2.20 – 22")}。`,
    ],
    camera: attica,
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
      caption: "伯里克利胸像，底座刻着“伯里克利，克桑西波斯之子，雅典人”。罗马时代仿制，梵蒂冈博物馆。",
      at: [0.05, 0.6],
    },
  },
  {
    id: "fleet-raids",
    year: 431,
    kicker: "海上的回击",
    title: "绕着伯罗奔尼撒",
    body: [
      `斯巴达人烧田，雅典人就从海上回击。一百艘战舰从比雷埃夫斯出发，绕过伯罗奔尼撒半岛，在敌人的海岸登陆、劫掠，再回到船上${tc("2.23.2")}。`,
      `这是伯里克利战略的另一半：守住海军，不在战争中扩张帝国，耗到对方放弃${tc("2.65.7")}。`,
    ],
    camera: { at: [22.4, 37.5], zoom: 2.8 },
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
      `岛的代价很快到来。第二年夏天，一种至今无法确认的疫病在挤满难民的城里爆发，乡下人挤在闷热的棚屋和神庙里，死者堆积${tc("2.52")}。修昔底德自己也染上了，并且活了下来。他详细记下症状，“万一它再度出现，人们能认得出来”${tc("2.48.3")}。`,
      `瘟疫前后夺走了四千四百名重装步兵和三百名骑兵，平民的死亡“无法计数”${tc("3.87.3")}。公元前 429 年，伯里克利也死了${tc("2.65.6")}。`,
    ],
    camera: { at: [23.6, 37.97], zoom: 12 },
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
      `公元前 427 年，莱斯博斯岛上的米提列涅叛离雅典，被镇压了。雅典公民大会在愤怒中投票：处死全城成年男子，妇孺卖为奴隶。一艘战舰当即出发去传达命令${tc("3.36")}。`,
      `第二天，许多人后悔了。再次辩论后，大会以微弱多数改变决定，第二艘船立刻出发。桨手们一边划桨一边吃拌了酒和油的大麦，轮班睡觉，日夜不停。第一艘船本就不急着送这道可怕的命令；第二艘赶到时，命令刚刚宣读，还没有执行${tc("3.49")}。`,
      `米提列涅得救了，但据修昔底德记载，被押到雅典的一千余名“主谋者”仍按克里昂的提议被处死${tc("3.50.1")}。`,
    ],
    camera: { at: [25.1, 38.6], zoom: 2.7 },
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
      `公元前 425 年，雅典人在伯罗奔尼撒西南的皮洛斯筑起一座堡垒，把四百多名斯巴达士兵围困在对面的斯法克特里亚岛上${tc("4.3 – 8")}。被围七十二天后，292 人放下武器，其中约 120 人是斯巴达公民${tc("4.38.5, 4.39.1")}。整个希腊都震惊了：人们一直以为，斯巴达人宁可战死也不会投降${tc("4.40.1")}。`,
      `皮洛斯在美塞尼亚，黑劳士的故乡。雅典把瑙帕克图斯的美塞尼亚人派来驻守，他们说着当地方言四处劫掠，黑劳士开始逃亡${tc("4.41.2 – 3")}。雅典人还宣布：斯巴达再入侵阿提卡，就处死这些俘虏。斯巴达的大军从此再没来过${tc("4.41.1")}。`,
    ],
    camera: { at: [21.66, 36.93], zoom: 30 },
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
      "斯巴达也有自己的奇才。布拉西达斯带着一支小部队穿过整个希腊北上，在色雷斯一座接一座地劝降雅典的盟邦。",
      `公元前 424 年冬，他拿下了雅典的要地安菲波利斯。负责救援的雅典将军从萨索斯赶来，当天傍晚才到，只保住了河口的埃翁${tc("4.104 – 106")}。这位将军此后被放逐二十年，他就是修昔底德本人。放逐让他得以接触交战双方，尤其是伯罗奔尼撒人${tc("5.26.5")}。`,
      `两年后，布拉西达斯与雅典主战派领袖克里昂在安菲波利斯城下的同一场战斗中先后死去${tc("5.10")}。`,
    ],
    camera: { at: [23.2, 39.4], zoom: 2.6 },
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
      `两位主战者死后，双方在公元前 421 年签订“尼西阿斯和约”，约定和平五十年${tc("5.18")}。这份和平大多只存在于纸面上。`,
      `公元前 416 年，雅典要求岛国米洛斯归顺。米洛斯人是斯巴达的移民后裔，战争初期一直保持中立${tc("5.84.2")}。修昔底德把谈判写成了一场对话：米洛斯人诉诸正义与神明，雅典使者只谈利害${tc("5.85 – 113")}。`,
      `米洛斯拒绝了。城破之后，成年男子被处死，妇女和儿童被卖为奴隶${tc("5.116.4")}。`,
    ],
    camera: { at: [24.4, 37.2], zoom: 4.2 },
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
    id: "sicily",
    year: 415,
    kicker: "西西里远征",
    title: "最大的一次出征",
    body: [
      `公元前 415 年，雅典决定远征西西里，原定派出六十艘船${tc("6.8.2")}。年轻的亚西比德力主出兵；稳重的尼西阿斯想用夸大的开销吓退众人，结果适得其反：“所有人都爱上了这次远征”${tc("6.20 – 24")}。最后出发的是一百三十四艘三列桨战舰和五千一百名重装步兵${tc("6.43.1")}。`,
      `修昔底德说，大多数雅典人连西西里有多大、住着多少人都不知道${tc("6.1.1")}。出发前，城中的赫尔墨斯神像一夜之间被毁，亵渎秘仪的指控又牵连到亚西比德${tc("6.27 – 28")}。他在西西里被召回受审，半路逃走，投奔了斯巴达${tc("6.53, 6.61, 6.88.9")}。`,
    ],
    camera: { at: [19.2, 38.4], zoom: 1.35 },
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
      { type: "growth", from: 60, to: 134, unit: "艘战舰", note: "原定 → 出发", at: [0.15, 0.45] },
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
      `雅典人在叙拉古城外的高地埃皮波莱筑起一座圆堡，开始修环城墙，想从陆上把叙拉古围死；叙拉古人拼命修筑横墙，要截断雅典人的墙线${tc("6.97 – 103")}。`,
      `就在雅典的城墙快要合拢时，斯巴达派来的将领吉利普斯从陆上赶到，带着叙拉古人把横墙修过了雅典人的墙线。围城再也无法完成${tc("7.1 – 7")}。`,
    ],
    camera: { at: [15.2, 37.2], zoom: 8 },
    labels: ["syracuse", "catana"],
    inset: { type: "siege", at: [0.05, 0.85] },
  },
  {
    id: "syracuse",
    year: 413,
    kicker: "覆灭",
    title: "月食、海港与河流",
    body: [
      `雅典又增援了七十三艘战舰${tc("7.42.1")}，仍然打不开局面。撤退前夜发生了月食，统帅尼西阿斯听从占卜者，决定再等“三个九天”${tc("7.50.4")}。叙拉古人趁机在大港里击败雅典舰队，封住了港口${tc("7.70 – 72")}。`,
      `四万人从陆上撤退，在饥渴中被一路追杀。在阿西纳鲁斯河，口渴的士兵冲进河里争相喝水，敌人从岸上射杀他们，河水被血染红，人们仍在抢着喝${tc("7.75.5, 7.84")}。被俘者至少七千人${tc("7.87.4")}，被关进露天的采石场，白天曝晒，夜里受冻${tc("7.87.1")}。`,
    ],
    camera: { at: [15.2, 37.05], zoom: 7 },
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
    id: "decelea",
    year: 413,
    kicker: "狄西里亚",
    title: "家门口的要塞",
    body: [
      `同一年，斯巴达听从亚西比德的建议，在阿提卡境内的狄西里亚建起常驻要塞${tc("6.91.6, 7.19.1")}。过去的入侵每年只有几周，现在敌人一年到头就在家门口。此后陆续有两万多名奴隶逃走，多数是工匠${tc("7.27.5")}。`,
      `过去从优卑亚经陆路运来的物资，现在只能绕过苏尼昂角走海路，代价高昂。修昔底德说，雅典“从一座城变成了一座要塞”${tc("7.28.1")}。`,
    ],
    camera: { at: [23.75, 38.15], zoom: 9 },
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
      `西西里的消息传开后，雅典的盟邦一个接一个叛离：希俄斯、米利都、罗得岛、优卑亚${tc("8.14, 8.44, 8.95")}。`,
      `更致命的是钱。波斯总督开始资助斯巴达建立舰队，条件是让亚洲的希腊城邦重新归属波斯国王${tc("8.5, 8.18")}。斯巴达第一次有能力在海上和雅典打一场消耗战。`,
      `公元前 411 年，雅典的民主一度被“四百人”寡头政权推翻${tc("8.63 – 70")}。`,
    ],
    camera: { at: [26.0, 38.4], zoom: 2.2 },
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
      "此后七年的故事，要从另一位雅典人色诺芬的《希腊史》里接着读。",
    ],
    camera: aegean,
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
      `亚西比德又回到了雅典一边，被驻萨摩斯的雅典军队选为将军${tc("8.81 – 82")}。公元前 410 年，他在普罗庞提斯的基齐库斯附近歼灭了斯巴达舰队，斯巴达主将明达罗斯战死${xen("1.1.11 – 18")}。`,
      `雅典人截获了斯巴达副将发回国内的信，只有短短几句${xen("1.1.23")}。波斯总督法那巴佐斯的回答是：不必为了船木灰心，国王的土地上有的是木材${xen("1.1.24")}。`,
    ],
    camera: { at: [27.6, 40.45], zoom: 6 },
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
      `公元前 406 年，雅典倾尽全力造船，凡是适龄的人，自由人和奴隶都登上战舰，在莱斯博斯岛附近的阿吉纽西群岛大败斯巴达舰队${xen("1.6.24 – 35")}。`,
      `可是一场风暴让落水的人没能被救起。回到雅典，公民大会在一片激愤中，把打赢这场海战的六位将军一并判处死刑，其中有伯里克利的儿子。主持会议的人里，只有苏格拉底拒绝把这项违法的动议付诸表决${xen("1.7.15, 1.7.34")}。不久，雅典人就后悔了${xen("1.7.35")}。`,
    ],
    camera: { at: [26.5, 39.1], zoom: 5 },
    labels: ["arginusae", "mytilene", "samos"],
    marks: [{ type: "pulse", place: "arginusae", side: "athens", at: [0.1, 0.55] }],
  },
  {
    id: "aegospotami",
    year: 405,
    kicker: "羊河",
    title: "粮道的咽喉",
    body: [
      `斯巴达人终于明白了雅典的命门。几年前，斯巴达王阿基斯在狄西里亚望见运粮船源源驶入比雷埃夫斯，说光在陆上围堵雅典没有用${xen("1.1.35")}。公元前 405 年，吕山德带着波斯资助的舰队来到赫勒斯滂“拦截运粮船”，攻下了兰普萨库斯${xen("2.1.17 – 19")}。180 艘雅典战舰只能跟过来，停在对岸一片没有城市的开阔海滩，水手要走到远处的塞斯托斯买粮${xen("2.1.20 – 21, 2.1.25")}。`,
      `亚西比德就住在附近，骑马赶来警告雅典将领换个地方，被打发走了${xen("2.1.25 – 26")}。第五天，雅典水手照常上岸散开，吕山德突然出击，几乎俘获了整支舰队${xen("2.1.27 – 28")}。`,
      `“帕拉卢斯号”夜里抵达比雷埃夫斯，哭声沿着长墙一路传进城里。那一夜没有一个人睡着，人们想起了自己曾对米洛斯人做过的事${xen("2.2.3")}。`,
    ],
    camera: { at: [26.55, 40.3], zoom: 14 },
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
      `羊河之后，雅典再也没有舰队，粮道也断了。吕山德沿途接收一座又一座城邦。色诺芬说，海战之后，除了萨摩斯，希腊各地都背弃了雅典${xen("2.2.6")}。`,
      `吕山德把俘获的雅典人一律遣返雅典，不许他们去别处。他知道，城里的人越多，粮食耗尽得就越快${xen("2.2.2")}。`,
    ],
    camera: aegean,
    labels: ["athens", "samos", "byzantium", "mytilene", "aegospotami"],
    ripple: { from: "aegospotami", start: 0.1, span: 0.45 },
  },
  {
    id: "surrender",
    year: 404,
    kicker: "结局",
    title: "在笛声中拆墙",
    body: [
      `公元前 404 年，被围困、断了粮的雅典投降。科林斯和底比斯要求把雅典夷为平地，斯巴达拒绝了：它不愿毁掉一座在希腊危难时立过大功的城市${xen("2.2.19 – 20")}。`,
      `条件是拆毁长墙和比雷埃夫斯的城墙，只留下十二艘船${xen("2.2.20")}。长墙在吹笛女的乐声中被拆除，伯罗奔尼撒人相信，那一天是希腊自由的开始${xen("2.2.23")}。`,
    ],
    camera: attica,
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
