# Electric Car Physics

An interactive guide to the physics of electric cars, built around one real machine: the Tesla Model Y.
Twelve chapters, 46 interactive figures, a driving simulator and a cheat sheet. Everything is plain
HTML, CSS and JavaScript with no dependencies and no build step.

## Open it

Double-click `index.html`, or serve the folder and open it in a browser:

```
python -m http.server 8000
# then visit http://localhost:8000
```

It works offline. Progress through the chapter quizzes is saved in the browser.

## What is in it

| | Chapter | What you can play with |
|---|---|---|
| 1 | Forces on the road | Road-load explorer with to-scale force arrows, kinetic energy as height, coast-down test |
| 2 | Energy and range | Consumption and range calculator, electric vs petrol energy flow, mountain-pass energy bank |
| 3 | Aerodynamics | Animated airflow past four shapes, drag budget, air density and wind |
| 4 | Tyres, grip and handling | Contact patch, grip-vs-slip curves, draggable friction circle, tilt table, stopping distance |
| 5 | The electric motor | Rotating magnetic field, magnet and cage rotors, torque-speed envelope, efficiency map |
| 6 | Power electronics | Voltage vs copper, six-switch inverter with space-vector hexagon, PWM builder |
| 7 | The battery | Animated lithium-ion cell, voltage under load, pack builder, ageing model |
| 8 | Charging | AC vs DC paths, charging-session simulator, why power tapers, road-trip planner |
| 9 | Acceleration and traction | Tractive-effort diagram with gear-ratio slider, load transfer, three-car standing start |
| 10 | Regenerative braking | Driving vs generating, anatomy of one stop, stop-and-go city cycle |
| 11 | Heat and thermal management | Heat-pump cycle, winter range, heat routing, battery temperature window |
| 12 | Drive simulator | The whole model in real time: forces, power flow, energy ledger |
| | Cheat sheet | Formulas, numbers for the selected car, glossary, sources |

The car selector at the top (RWD, Long Range AWD, Performance) recalculates every number, graph and
simulation on every page.

## How it is built

```
index.html                 page shell
assets/css/style.css       design tokens, layout, components (light and dark themes)
assets/js/model.js         the physics model: pure functions, no DOM
assets/js/core.js          maths typesetting, sliders, canvases, animation loops, quizzes
assets/js/plot.js          small canvas chart with tooltip, keyboard access and data table
assets/js/art.js           car drawing and the energy-flow diagram
assets/js/chapters/*.js    one file per chapter: text, figures and quiz together
assets/js/app.js           navigation and routing
tests/model.test.js        sanity checks of the model against published figures
```

Every figure computes its numbers from `model.js`, so the same car gives the same answer in every
chapter.

## The numbers

Run the checks with:

```
node tests/model.test.js
```

Mass, battery size, pack layout, acceleration, top speed, range and charging power are published
figures for the 2025-on European Model Y. Parameters Tesla does not publish (the torque curve, loss
coefficients, rolling resistance, cell resistance, charging curves, centre-of-gravity height) are
estimates, tuned so that the model reproduces the published 0-100 km/h times, typical measured
motorway consumption and typical charging times. The physics is exact; the parameters are
representative. A few figures are labelled "illustrative" where they show a mechanism rather than a
measurement.

This is independent educational material and is not affiliated with or endorsed by Tesla.
