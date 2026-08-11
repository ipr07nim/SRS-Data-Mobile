import { 
  type RouteConfig, 
  route, 
  index, 
  layout 
} from "@react-router/dev/routes";

export default [
  route("sandbox", "./components/SandboxHUD.tsx"),
  layout("./components/Layout.tsx", [
    index("./components/Home.tsx"),
    route("assign", "./components/Assign.tsx"),
    route("timing/:stationId", "./components/StationHUD.tsx"),
    route("summary", "./components/RollSummary.tsx"),
    route("history/:rollId?", "./components/History.tsx"),
    route("leaderboard", "./components/Leaderboard.tsx"),
  ]),
] satisfies RouteConfig;