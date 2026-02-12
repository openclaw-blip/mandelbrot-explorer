export type LocationSet = 'mandelbrot' | 'burning-ship' | 'tricorn' | 'multibrot' | 'julia';

export interface Location {
  id: string;
  name: string;
  x: number;
  y: number;
  zoom: number;
  set: LocationSet;
}

export const interestingLocations: Location[] = [
  // Mandelbrot locations
  {
    id: 'seahorse',
    name: 'Seahorse Valley',
    x: -0.743643887037158,
    y: 0.131825904205311,
    zoom: 500,
    set: 'mandelbrot',
  },
  {
    id: 'elephant',
    name: 'Elephant Valley',
    x: 0.281717921930775,
    y: 0.5771052841488505,
    zoom: 200,
    set: 'mandelbrot',
  },
  {
    id: 'spiral',
    name: 'Double Spiral',
    x: -0.7436438870371587,
    y: 0.13182590420531197,
    zoom: 50000,
    set: 'mandelbrot',
  },
  {
    id: 'lightning',
    name: 'Lightning',
    x: -1.315180982097868,
    y: 0.073481649996795,
    zoom: 10000,
    set: 'mandelbrot',
  },
  {
    id: 'starfish',
    name: 'Starfish',
    x: -0.374004139,
    y: 0.659792175,
    zoom: 5000,
    set: 'mandelbrot',
  },
  {
    id: 'tendrils',
    name: 'Tendrils',
    x: -0.226266,
    y: 1.11617,
    zoom: 1000,
    set: 'mandelbrot',
  },
  {
    id: 'mini',
    name: 'Mini Mandelbrot',
    x: -1.7497591451303837,
    y: 0.0000000043121492,
    zoom: 50000000,
    set: 'mandelbrot',
  },
  {
    id: 'julia-island',
    name: 'Julia Island',
    x: -1.768778833,
    y: -0.001738996,
    zoom: 2000000,
    set: 'mandelbrot',
  },
  {
    id: 'scepter',
    name: 'Scepter Valley',
    x: -0.1011,
    y: 0.9563,
    zoom: 500,
    set: 'mandelbrot',
  },
  {
    id: 'needle',
    name: 'The Needle',
    x: -0.74364085,
    y: 0.13182733,
    zoom: 200000,
    set: 'mandelbrot',
  },
  {
    id: 'crown',
    name: 'Triple Crown',
    x: -0.0452407411,
    y: 0.9868162204352258,
    zoom: 5000,
    set: 'mandelbrot',
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    x: -1.25066,
    y: 0.02012,
    zoom: 2000,
    set: 'mandelbrot',
  },
  {
    id: 'buzzsaw',
    name: 'Buzzsaw',
    x: -0.761574,
    y: -0.0847596,
    zoom: 10000,
    set: 'mandelbrot',
  },
  {
    id: 'peacock',
    name: 'Peacock Tail',
    x: -0.745,
    y: 0.113,
    zoom: 500,
    set: 'mandelbrot',
  },
  {
    id: 'lace',
    name: 'Lace Curtain',
    x: -1.254024,
    y: 0.046569,
    zoom: 3000,
    set: 'mandelbrot',
  },
  {
    id: 'frozen',
    name: 'Frozen Lightning',
    x: -0.170337,
    y: -1.06506,
    zoom: 1000,
    set: 'mandelbrot',
  },
  // Burning Ship locations
  {
    id: 'ship-armada',
    name: 'The Armada',
    x: -1.762,
    y: -0.028,
    zoom: 50,
    set: 'burning-ship',
  },
  {
    id: 'ship-stern',
    name: 'Ship Stern',
    x: -1.755,
    y: -0.035,
    zoom: 500,
    set: 'burning-ship',
  },
  {
    id: 'ship-mast',
    name: 'The Mast',
    x: -1.941,
    y: -0.015,
    zoom: 100,
    set: 'burning-ship',
  },
  // Tricorn locations
  {
    id: 'tricorn-spiral',
    name: 'Tricorn Spiral',
    x: -0.4,
    y: 0.6,
    zoom: 50,
    set: 'tricorn',
  },
  {
    id: 'tricorn-horn',
    name: 'The Horn',
    x: -1.0,
    y: 0.0,
    zoom: 20,
    set: 'tricorn',
  },
];
