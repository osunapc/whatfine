import React, { useState, useEffect } from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

import { createTheme, ThemeProvider } from "@mui/material/styles"; // Actualizado para MUI v5
import { ptBR } from "@mui/material/locale"; // Actualizado para MUI v5
import CssBaseline from "@mui/material/CssBaseline"; // Importar CssBaseline de MUI v5

const App = () => {
  const [locale, setLocale] = useState(undefined); // Inicializar con undefined o un valor por defecto

  const theme = createTheme(
    {
      // scrollbarStyles: { // Esto es una personalización, necesitará un enfoque diferente en v5 (ej. GlobalStyles)
      //   "&::-webkit-scrollbar": {
      //     width: "8px",
      //     height: "8px",
      //   },
      //   "&::-webkit-scrollbar-thumb": {
      //     boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
      //     backgroundColor: "#e8e8e8",
      //   },
      // },
      palette: {
        primary: { main: "#2576d2" }, // Mantener la paleta
      },
      // Otros ajustes de tema para v5 si son necesarios
    },
    locale || {} // Pasar un objeto vacío si locale es undefined para evitar errores
  );

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Añadir CssBaseline aquí */}
      <Routes />
    </ThemeProvider>
  );
};

export default App;
