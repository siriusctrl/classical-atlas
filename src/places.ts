// Approximate site coordinates as [longitude, latitude]. Positions are for orientation
// at map scale, not for archaeology; see README for sources.

export type Side = "athens" | "sparta" | "neutral" | "persia";

export type Place = {
  name: string;
  en: string;
  at: [number, number];
  // Label placement relative to the dot.
  label?: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
};

export const places = {
  athens: { name: "雅典", en: "Athens", at: [23.727, 37.972], label: "ne" },
  piraeus: { name: "比雷埃夫斯", en: "Piraeus", at: [23.635, 37.943], label: "sw" },
  phaleron: { name: "法勒隆", en: "Phaleron", at: [23.69, 37.935], label: "s" },
  sparta: { name: "斯巴达", en: "Sparta", at: [22.43, 37.074], label: "e" },
  corinth: { name: "科林斯", en: "Corinth", at: [22.88, 37.906], label: "nw" },
  megara: { name: "麦加拉", en: "Megara", at: [23.345, 37.996], label: "n" },
  thebes: { name: "底比斯", en: "Thebes", at: [23.319, 38.321], label: "n" },
  plataea: { name: "普拉提亚", en: "Plataea", at: [23.273, 38.214], label: "w" },
  argos: { name: "阿尔戈斯", en: "Argos", at: [22.724, 37.632], label: "w" },
  mantinea: { name: "曼提尼亚", en: "Mantinea", at: [22.393, 37.617], label: "w" },
  tegea: { name: "泰格亚", en: "Tegea", at: [22.418, 37.455], label: "w" },
  elis: { name: "伊利斯", en: "Elis", at: [21.383, 37.893], label: "w" },
  sicyon: { name: "西锡安", en: "Sicyon", at: [22.712, 37.982], label: "w" },
  epidaurus: { name: "埃皮道鲁斯", en: "Epidaurus", at: [23.155, 37.636], label: "e" },
  aegina: { name: "埃吉纳", en: "Aegina", at: [23.43, 37.75], label: "s" },
  chalcis: { name: "卡尔基斯", en: "Chalcis", at: [23.594, 38.464], label: "e" },
  eretria: { name: "埃雷特里亚", en: "Eretria", at: [23.795, 38.396], label: "e" },
  decelea: { name: "狄西里亚", en: "Decelea", at: [23.783, 38.133], label: "ne" },
  acharnae: { name: "阿卡奈", en: "Acharnae", at: [23.73, 38.08], label: "w" },
  naupactus: { name: "瑙帕克图斯", en: "Naupactus", at: [21.828, 38.393], label: "n" },
  corcyra: { name: "科西拉", en: "Corcyra", at: [19.92, 39.624], label: "w" },
  ambracia: { name: "安布拉基亚", en: "Ambracia", at: [20.985, 39.157], label: "e" },
  leucas: { name: "琉卡斯", en: "Leucas", at: [20.7, 38.83], label: "w" },
  zacynthus: { name: "扎金索斯", en: "Zacynthus", at: [20.9, 37.78], label: "w" },
  pylos: { name: "皮洛斯", en: "Pylos", at: [21.666, 36.957], label: "e" },
  sphacteria: { name: "斯法克特里亚", en: "Sphacteria", at: [21.664, 36.925], label: "w" },
  melos: { name: "米洛斯", en: "Melos", at: [24.43, 36.73], label: "s" },
  thera: { name: "锡拉", en: "Thera", at: [25.43, 36.4], label: "s" },
  naxos: { name: "纳克索斯", en: "Naxos", at: [25.376, 37.105], label: "e" },
  delos: { name: "提洛", en: "Delos", at: [25.268, 37.396], label: "e" },
  andros: { name: "安德罗斯", en: "Andros", at: [24.84, 37.84], label: "e" },
  samos: { name: "萨摩斯", en: "Samos", at: [26.94, 37.69], label: "s" },
  chios: { name: "希俄斯", en: "Chios", at: [26.135, 38.37], label: "w" },
  mytilene: { name: "米提列涅", en: "Mytilene", at: [26.555, 39.11], label: "e" },
  miletus: { name: "米利都", en: "Miletus", at: [27.278, 37.53], label: "e" },
  ephesus: { name: "以弗所", en: "Ephesus", at: [27.34, 37.94], label: "e" },
  halicarnassus: { name: "哈利卡纳苏斯", en: "Halicarnassus", at: [27.42, 37.04], label: "e" },
  rhodes: { name: "罗得岛", en: "Rhodes", at: [28.08, 36.3], label: "e" },
  byzantium: { name: "拜占庭", en: "Byzantium", at: [28.98, 41.01], label: "n" },
  abdera: { name: "阿布德拉", en: "Abdera", at: [24.98, 40.94], label: "n" },
  thasos: { name: "萨索斯", en: "Thasos", at: [24.71, 40.78], label: "e" },
  amphipolis: { name: "安菲波利斯", en: "Amphipolis", at: [23.845, 40.82], label: "n" },
  eion: { name: "埃翁", en: "Eion", at: [23.88, 40.78], label: "se" },
  potidaea: { name: "波提狄亚", en: "Potidaea", at: [23.33, 40.195], label: "w" },
  acanthus: { name: "阿坎苏斯", en: "Acanthus", at: [23.87, 40.4], label: "e" },
  heraclea: { name: "赫拉克利亚", en: "Heraclea Trachinia", at: [22.42, 38.8], label: "w" },
  pharsalus: { name: "法萨卢斯", en: "Pharsalus", at: [22.38, 39.3], label: "w" },
  dion: { name: "狄翁", en: "Dion", at: [22.5, 40.17], label: "w" },
  aegospotami: { name: "羊河", en: "Aegospotami", at: [26.599, 40.332], label: "w" },
  lampsacus: { name: "兰普萨库斯", en: "Lampsacus", at: [26.69, 40.35], label: "e" },
  sestos: { name: "塞斯托斯", en: "Sestos", at: [26.4, 40.23], label: "w" },
  cyzicus: { name: "基齐库斯", en: "Cyzicus", at: [27.89, 40.38], label: "e" },
  sardis: { name: "萨迪斯", en: "Sardis", at: [28.04, 38.49], label: "e" },
  syracuse: { name: "叙拉古", en: "Syracuse", at: [15.29, 37.07], label: "e" },
  catana: { name: "卡塔那", en: "Catana", at: [15.09, 37.5], label: "e" },
  rhegium: { name: "利吉翁", en: "Rhegium", at: [15.65, 38.11], label: "e" },
  segesta: { name: "塞杰斯塔", en: "Segesta", at: [12.83, 37.94], label: "n" },
  tarentum: { name: "他林敦", en: "Tarentum", at: [17.24, 40.47], label: "n" },
  croton: { name: "克罗顿", en: "Croton", at: [17.13, 39.08], label: "e" },
  ithome: { name: "伊托米山", en: "Mount Ithome", at: [21.92, 37.18], label: "e" },
  sunium: { name: "苏尼昂", en: "Sunium", at: [24.025, 37.65], label: "s" },
  chalcedon: { name: "卡尔西顿", en: "Chalcedon", at: [29.03, 40.99], label: "e" },
  arginusae: { name: "阿吉纽西", en: "Arginusae", at: [26.78, 39.03], label: "e" },
  trogilus: { name: "特罗吉卢斯", en: "Trogilus", at: [15.26, 37.12], label: "n" },
  epipolae: { name: "埃皮波莱", en: "Epipolae", at: [15.23, 37.095], label: "w" },
  assinarus: { name: "阿西纳鲁斯河", en: "Assinarus", at: [15.07, 36.87], label: "w" },
  methone: { name: "墨托涅", en: "Methone", at: [21.704, 36.814], label: "w" },
  pheia: { name: "菲亚", en: "Pheia", at: [21.311, 37.661], label: "w" },
} satisfies Record<string, Place>;

export type PlaceId = keyof typeof places;
