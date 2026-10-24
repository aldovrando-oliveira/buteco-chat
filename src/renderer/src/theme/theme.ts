import { createTheme, type MantineColorsTuple } from '@mantine/core'

const butecoBlue: MantineColorsTuple = ['#f5f8fe', '#eef3fb', '#d6e3f6', '#b0c8ee', '#6495db', '#4180d4', '#2a6ecb', '#245cad', '#1e4d92', '#1a3f78']
const green: MantineColorsTuple = ['#f3faf6', '#e9f6ee', '#cfe9dc', '#a0d7bd', '#4cc38a', '#33ab72', '#22935c', '#1e8853', '#1c814e', '#1a7a49']
const yellow: MantineColorsTuple = ['#fdf8ee', '#fbf1de', '#f4e0bb', '#e8c489', '#e2a63f', '#c78c28', '#b07a1e', '#9d6a13', '#93620a', '#8a5a00']
const red: MantineColorsTuple = ['#fef5f4', '#fdeceb', '#f9d3d0', '#f3aea7', '#f0766a', '#d94a3b', '#cf3a2b', '#c23325', '#b92e21', '#b02a1f']
const gray: MantineColorsTuple = ['#fcfcfb', '#faf9f8', '#f1f1f1', '#e5e5e5', '#d5d4d2', '#8b9097', '#686d74', '#4d5157', '#33363b', '#191a1c']
const dark: MantineColorsTuple = ['#e9eaec', '#c8cbd0', '#9aa0a8', '#7d838b', '#343639', '#2b2e34', '#24272c', '#1b1d21', '#16181b', '#121316']

const sans = '"IBM Plex Sans", system-ui, sans-serif'
const mono = '"IBM Plex Mono", ui-monospace, monospace'

export const theme = createTheme({
  colors: { butecoBlue, green, yellow, red, gray, dark },
  primaryColor: 'butecoBlue',
  primaryShade: { light: 6, dark: 4 },
  fontFamily: sans,
  fontFamilyMonospace: mono,
  fontSizes: { xs: '11px', sm: '12px', md: '13px', lg: '14px', xl: '16px' },
  lineHeights: { xs: '1.35', sm: '1.4', md: '1.45', lg: '1.5', xl: '1.55' },
  headings: {
    fontFamily: sans,
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '20px' },
      h2: { fontSize: '17px' },
      h3: { fontSize: '15px' },
      h4: { fontSize: '14px' },
      h5: { fontSize: '13px' },
      h6: { fontSize: '12px' }
    }
  },
  radius: { xs: '5px', sm: '7px', md: '9px', lg: '11px', xl: '14px' },
  defaultRadius: 'sm'
})
