import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { buildThemeBootstrapScript } from "./store/persist";
import "./styles/theme.css";

const themeBootstrapScript = buildThemeBootstrapScript();

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        {/* Outlet is where your routes (Home, StationHUD, etc.) render */}
        <Outlet /> 
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}