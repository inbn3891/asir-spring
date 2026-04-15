export const MODELS = [
  { id: "signal",   label: "신호위반",    emoji: "🚦", file: "model_객체탐지_신호위반",  type: "yolo", visible: true },
  { id: "helmet",   label: "안전모미착용", emoji: "⛑️", file: "model_객체탐지_안전모",    type: "yolo", visible: true },
  { id: "center",   label: "중앙선침범",  emoji: "↔️", file: "model_객체탐지_중앙선침범", type: "yolo", visible: true },
  { id: "lane",     label: "진로변경",    emoji: "🔀", file: "model_객체탐지_진로변경",   type: "yolo", visible: true },
  { id: "classify", label: "위반분류",    emoji: "📊", file: "위반상황분류",              type: "lstm", visible: false },
  { id: "traffic",  label: "교통영역탐지", emoji: "🛣️", file: "교통영역탐지", type: "detectron2", visible: false },
  { id: "lane_sig", label: "차선탐지_신호위반", emoji: "🚦", file: "신호위반", type: "detectron2", visible: false },
  { id: "lane_ctr", label: "차선탐지_중앙선침범", emoji: "↔️", file: "중앙선침범", type: "detectron2", visible: false },
  { id: "lane_chg", label: "차선탐지_진로변경", emoji: "🔀", file: "진로변경", type: "detectron2", visible: false },
];