# Syntari UI coverage

Syntari is an open interface system. Its component gallery, interactive examples, source runtime, and documentation are maintained as one shared product surface.

The current release includes 107 component families, 250 authored preview states and layouts, and four composed starter screens. Components share Syntari’s tokens, typography, interaction runtime, accessibility conventions, and restrained motion system.

## Coverage principles

- Use a component only when it has a clear product purpose.
- Keep interaction behavior local, inspectable, and reversible in the gallery.
- Share primitives and tokens across components rather than duplicating patterns.
- Preserve keyboard access, readable status feedback, and reduced-motion behavior.
- Extend the system through Syntari foundations and documented component contracts.

## Product boundary

Syntari ships editable interface source and a browser runtime. Demonstrations use local data; connections to storage, billing, authentication, or other services belong to the adopting product.
