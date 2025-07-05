import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";

import App from "./App";
import "./translate/i18n"; // Asegurarse de que i18n se inicialice

// Nueva API de React 18 para el root
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

root.render(
	<React.StrictMode>
		{/* CssBaseline se movió a App.js para estar dentro del ThemeProvider de MUI v5 */}
		<App />
	</React.StrictMode>
);
