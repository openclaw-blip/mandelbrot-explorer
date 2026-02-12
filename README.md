# 🌀 Mandelbrot Explorer

A high-performance, interactive Mandelbrot set explorer with a cyberpunk aesthetic.

![Mandelbrot Explorer](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)

## ✨ Features

- **Full Viewport Experience** - Immersive, scrollbar-free exploration
- **Smooth Animations** - Cubic ease-out transitions for zoom operations
- **Multi-threaded Rendering** - Web Workers for parallel computation
- **Cyberpunk Color Scheme** - Neon gradients with hot pink, cyan, purple, and electric blue
- **Interactive Controls** - Click, drag, and scroll to explore

## 🎮 Controls

| Action | Effect |
|--------|--------|
| **Click** | Zoom in at cursor position |
| **Right-click** | Zoom out |
| **Shift + Click** | Zoom out |
| **Drag** | Pan the view |
| **Scroll wheel** | Zoom in/out |
| **R** | Reset to initial view |

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎨 Color Palette

The visualization uses a carefully curated cyberpunk palette:

- **Hot Pink** `#ff00ff` - Primary accent
- **Cyan** `#00ffff` - Secondary accent
- **Purple** `#9d00ff` - Tertiary accent
- **Electric Blue** `#0066ff` - Quaternary accent

Colors are smoothly interpolated based on escape iteration count using cosine interpolation for fluid gradients.

## ⚡ Performance Optimizations

- **Web Workers** - Utilizes all available CPU cores for parallel computation
- **Cardioid/Bulb Detection** - Skips computation for known in-set regions
- **Period Checking** - Early escape for periodic orbits
- **Transfer Buffers** - Zero-copy data transfer between workers and main thread
- **Incremental Rendering** - Progressive display as computation completes

## 📁 Project Structure

```
mandelbrot-explorer/
├── src/
│   ├── components/
│   │   ├── MandelbrotCanvas.tsx  # Main canvas component
│   │   ├── InfoOverlay.tsx       # Coordinate/zoom display
│   │   ├── HelpOverlay.tsx       # Controls reference
│   │   └── LoadingIndicator.tsx  # Computation spinner
│   ├── hooks/
│   │   └── useMandelbrot.ts      # Core rendering logic
│   ├── workers/
│   │   └── mandelbrot.worker.ts  # Web Worker for computation
│   ├── utils/
│   │   └── colors.ts             # Color palette & interpolation
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🔧 Technical Details

### The Mandelbrot Set

The Mandelbrot set is defined as the set of complex numbers *c* for which the iteration:

```
z_{n+1} = z_n² + c
```

Starting with z₀ = 0, does not diverge to infinity.

### Coloring Algorithm

Points are colored based on the escape time (number of iterations before |z| > 2). The algorithm uses:

1. **Smooth iteration count** to eliminate banding
2. **Cosine interpolation** between palette colors
3. **Multi-cycle palette** for visual depth at high zoom levels

## 📝 License

MIT
