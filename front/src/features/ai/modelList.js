export const MODELS = [
  { id: "signal",   label: "신호위반",    emoji: "🚦", file: "model_객체탐지_신호위반",   type: "yolo" },
  { id: "helmet",   label: "안전모미착용", emoji: "⛑️", file: "model_객체탐지_안전모",     type: "yolo" },
  { id: "center",   label: "중앙선침범",  emoji: "↔️", file: "model_객체탐지_중앙선침범",  type: "yolo" },
  { id: "lane",     label: "진로변경",    emoji: "🔀", file: "model_객체탐지_진로변경",    type: "yolo" },
  { id: "classify", label: "위반분류",    emoji: "📊", file: "위반상황분류",               type: "lstm" },
];