export interface Location {
  id: string;
  name: string;
  x: number;
  y: number;
  zoom: number;
}

export const interestingLocations: Location[] = [
  {
    id: 'seahorse',
    name: 'Seahorse Valley',
    x: -0.743643887037158,
    y: 0.131825904205311,
    zoom: 500,
  },
  {
    id: 'elephant',
    name: 'Elephant Valley',
    x: 0.281717921930775,
    y: 0.5771052841488505,
    zoom: 200,
  },
  {
    id: 'spiral',
    name: 'Double Spiral',
    x: -0.7436438870371587,
    y: 0.13182590420531197,
    zoom: 50000,
  },
  {
    id: 'lightning',
    name: 'Lightning',
    x: -1.315180982097868,
    y: 0.073481649996795,
    zoom: 10000,
  },
  {
    id: 'starfish',
    name: 'Starfish',
    x: -0.374004139,
    y: 0.659792175,
    zoom: 5000,
  },
  {
    id: 'tendrils',
    name: 'Tendrils',
    x: -0.226266,
    y: 1.11617,
    zoom: 1000,
  },
  {
    id: 'mini',
    name: 'Mini Mandelbrot',
    x: -1.7497591451303837,
    y: 0.0000000043121492,
    zoom: 50000000,
  },
  {
    id: 'julia',
    name: 'Julia Island',
    x: -1.768778833,
    y: -0.001738996,
    zoom: 2000000,
  },
];
