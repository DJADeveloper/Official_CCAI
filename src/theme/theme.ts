import { PaletteMode } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { Inter } from 'next/font/google';
import { blueGrey } from '@mui/material/colors'; // Import Material UI colors

// If you're using Next.js font optimization
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// Define light palette
const lightPalette = {
  primary: {
    main: blueGrey[400], // #78909C
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: blueGrey[200], // #B0BEC5
    contrastText: blueGrey[800], // #37474F
  },
  background: {
    default: blueGrey[50], // #ECEFF1
    paper: '#FFFFFF',
  },
  text: {
    primary: blueGrey[800], // #37474F
    secondary: blueGrey[500], // #607D8B
  },
  divider: blueGrey[100], // #CFD8DC
  // Keep standard status colors (can customize if needed)
};

// Define dark palette
const darkPalette = {
  primary: {
    main: blueGrey[300], // #90A4AE - Lighter primary for dark mode
    contrastText: blueGrey[900], // #263238
  },
  secondary: {
    main: blueGrey[700], // #455A64 - Darker secondary
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#263238', // blueGrey[900] - Dark background
    paper: blueGrey[800], // #37474F - Slightly lighter for paper elements
  },
  text: {
    primary: '#FFFFFF', // White text
    secondary: blueGrey[200], // #B0BEC5 - Lighter grey for secondary text
  },
  divider: blueGrey[700], // #455A64
};

// Function to get theme tokens based on mode
export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light' ? lightPalette : darkPalette),
    // Add common status colors here if not defined in light/dark palettes
    error: { main: '#D32F2F' },
    warning: { main: '#FFA000' },
    info: { main: '#1976D2' },
    success: { main: '#2E7D32' },
  },
  // Typography and components can be defined here as before
  // They can also be mode-dependent if needed
  typography: {
    fontFamily: inter.style.fontFamily, // Use Inter font
    h1: { fontSize: '2.5rem', fontWeight: 600 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1.1rem', fontWeight: 600 },
  },
  components: {
    // Example: Different Paper elevation based on mode
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Disable gradient backgrounds from MUI
          ...(mode === 'dark' && {
             // Add specific dark mode paper styles if needed
          }),
        },
      },
    },
    MuiAppBar: {
       styleOverrides: {
         root: {
            // Use paper background for AppBar for a flatter look, or primary if preferred
            backgroundColor: mode === 'light' ? lightPalette.background.paper : darkPalette.background.paper,
            color: mode === 'light' ? lightPalette.text.primary : darkPalette.text.primary,
            boxShadow: 'none', // Remove shadow for a flatter look initially
            borderBottom: `1px solid ${mode === 'light' ? lightPalette.divider : darkPalette.divider}`,
         }
       }
    },
    MuiDrawer: {
        styleOverrides: {
          paper: {
             borderRight: `1px solid ${mode === 'light' ? lightPalette.divider : darkPalette.divider}`,
             // Keep drawer background as paper
          }
        }
    }
    // Add other component customizations
  },
});

// Create theme using the function (example for export if not creating dynamically)
// const theme = createTheme(getDesignTokens('light'));
// export default theme;

// Note: We will create the theme dynamically in ClientLayout now

export default getDesignTokens('light'); 