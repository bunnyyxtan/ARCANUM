import type { Anomaly } from "../types";

export const mockAnomalies: Anomaly[] = [
  {
    id: "ano-100",
    agentId: "ag-100",
    agentName: "DevAgent-01",
    score: 7.4,
    narrative: "Volume deviation above 7.4 detected on compute expenditure.",
    suggestedAction: "freeze",
    points: [0.1, 0.2, 0.4, 1.2, 3.4, 5.1, 7.4],
    flaggedPoint: 6,
    timestamp: "2026-06-08T02:47:00Z",
  },
  {
    id: "ano-101",
    agentId: "ag-200",
    agentName: "OpsAgent-02",
    score: 3.1,
    narrative: "Unusual API vendor usage during non-business hours.",
    suggestedAction: "investigate",
    points: [0.5, 0.6, 1.1, 1.5, 2.2, 3.1],
    flaggedPoint: 5,
    timestamp: "2026-06-08T05:15:00Z",
  },
  {
    id: "ano-102",
    agentId: "ag-300",
    agentName: "DataBot-03",
    score: 1.8,
    narrative: "Minor deviation in data egress payload size.",
    suggestedAction: "dismiss",
    points: [0.1, 0.2, 0.3, 0.4, 1.0, 1.8],
    flaggedPoint: 5,
    timestamp: "2026-06-08T08:00:00Z",
  },
];
