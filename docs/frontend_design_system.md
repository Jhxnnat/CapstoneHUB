# Sistema de diseño del Frontend

Identidad visual institucional UTB para CapstoneHUB. El lenguaje se tomó del
proyecto **utb-web-asistencia** (Sistema de Asistencia UTB) y se adaptó a la
arquitectura de este frontend.

Ver también: [Arquitectura del frontend](./frontend_arch.md).

## Principios

1. **Un solo azul manda.** El primario es el azul institucional `#0a41f5`. Las
   superficies oscuras (cabecera, heros) usan el azul profundo `#05174a`.
2. **Tokens antes que hex sueltos.** Todo color vive en `app/globals.css`. No se
   escriben valores como `bg-[#0a41f5]` en los componentes.
3. **Las pantallas se ven simétricas.** Todo módulo abre con el mismo hero
   (`ModuleHeader`); lo que cambia es el `eyebrow`, el `title` y el `accentColor`.
4. **Sin librería de animación.** Las animaciones son keyframes CSS y respetan
   `prefers-reduced-motion`.

## Tokens

Definidos en [`app/globals.css`](../hub-frontend/app/globals.css).

### Paleta institucional

Registrada en `@theme`, así que resuelve como utilidad de Tailwind con
modificador de opacidad (`bg-utb-blue/10`, `ring-utb-blue/10`, `text-utb-blue-pale/70`).

| Token | Valor | Uso |
| --- | --- | --- |
| `utb-deep-blue` | `#05174a` | Cabecera, base de los heros. |
| `utb-navy` | `#071f5a` | Paso intermedio del degradado. |
| `utb-blue` | `#0a41f5` | Primario: botones, píldoras activas, acentos. |
| `utb-blue-dark` | `#0835c8` | Hover del primario. |
| `utb-blue-light` | `#547af8` | Degradados y textos destacados. |
| `utb-blue-pale` | `#93b4ff` | Texto secundario sobre fondo oscuro. |
| `utb-accent-1/2/3` | ámbar / esmeralda / rojo | Acentos de estado. |

### Tokens semánticos

Los de shadcn/ui (`--primary`, `--muted`, `--border`…) se redefinieron con matiz
frío (hue 264) para que los componentes base hereden la identidad sin tocarlos
uno a uno.

- `--radius: 0.625rem` (antes `0.45rem`), de donde salen `rounded-lg` … `rounded-4xl`.
- Tipografía: **Geist Sans** y **Geist Mono**.
- Modo oscuro: variante azulada, no gris neutro.

> **Desviación deliberada respecto al referente:** ahí
> `--muted-foreground` es `oklch(0.50 0.10 264)`. Con contenido real (descripciones,
> subtítulos) ese croma hace que el texto secundario se lea como enlaces azules,
> así que aquí se bajó a `0.035`.

## Utilidades

Declaradas en `@layer utilities` de `globals.css`.

| Clase | Efecto |
| --- | --- |
| `utb-rise` | Entrada del elemento. Se escalona con `--utb-delay`. |
| `utb-orb` | Flotación lenta del orbe de los heros. |
| `hover-lift` | Elevación de tarjeta al hacer hover. |
| `grid-lines` / `grid-lines-dark` | Rejilla de fondo, sobre claro / sobre oscuro. |
| `noise-overlay` | Textura de ruido sobre superficies oscuras. |
| `text-gradient-utb` | Texto con degradado azul. |
| `glow-border` | Borde con brillo azul. |
| `shimmer` / `utb-skeleton` | Estados de carga. |
| `utb-spinner` | Rotación de 700 ms. |
| `pulse-dot` | Punto indicador con pulso. |
| `line-reveal` | Revelado horizontal de una regla. |
| `scrollbar-hidden` | Scroll funcional sin barra visible. |

Para escalonar una lista:

```tsx
{items.map((item, i) => (
  <article
    key={item.id}
    className="utb-rise"
    style={{ "--utb-delay": `${i * 80}ms` } as React.CSSProperties}
  >
    …
  </article>
))}
```

## Componentes propios

### `ModuleHeader`

[`app/components/module-header.tsx`](../hub-frontend/app/components/module-header.tsx).
Hero que abre cada módulo: degradado UTB, rejilla, orbe animado, eyebrow con
punto pulsante, título y subtítulo. Es Server Component.

```tsx
<ModuleHeader
  eyebrow="Gestión de proyectos"
  title="Lista de proyectos"
  subtitle="Consulta todos los proyectos Capstone registrados…"
  accentColor="rgba(56,189,248,0.34)"   // opcional
  actions={<Link href="/submit">…</Link>} // opcional
/>
```

`accentColor` diferencia cada módulo. **Usar tonos fríos**: los cálidos (ámbar,
púrpura) sobre el azul profundo producen un marrón sucio.

| Pantalla | Acento |
| --- | --- |
| Proyectos, detalle | por defecto (azul) |
| Proponer | `rgba(56,189,248,0.34)` — cian |
| Perfil | `rgba(16,185,129,0.28)` — esmeralda |
| Administración | `rgba(129,140,248,0.38)` — índigo |

Los botones que van en `actions` se apoyan sobre la zona clara del degradado:
usar fondo sólido blanco con texto `text-utb-deep-blue`, no `bg-white/10`.

### `UtbLogo`

[`app/components/utb-logo.tsx`](../hub-frontend/app/components/utb-logo.tsx).
Isotipo vectorial inline: nítido a cualquier tamaño, colorable con
`currentColor` y sin request HTTP. Acepta `size` (px) o dimensionado por
`className` (`h-16 w-auto`), útil para tamaños responsivos.

## Cabecera

[`app/components/navbar.tsx`](../hub-frontend/app/components/navbar.tsx) son dos
franjas hermanas, no un solo bloque:

1. **Banda institucional** (`<header>`) — logo grande, nombre de la universidad y
   wordmark. Se va con el scroll.
2. **Fila de navegación** (`<nav sticky top-0>`) — enlaces y sesión. Queda fija.

La separación es intencional: la cabecera completa mide ~193 px en escritorio y
dejarla fija entera se comía una quinta parte de la pantalla. Para que `sticky`
funcione más allá de la banda, ambas franjas deben ser **hermanas dentro de
`<body>`**; anidar la fila dentro del `<header>` la dejaría pegada solo mientras
la banda esté visible.

La ruta activa se marca con píldora `bg-utb-blue` y punto blanco.

## Convenciones para pantallas nuevas

```tsx
<main className="flex-1 text-foreground">
  <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <ModuleHeader eyebrow="…" title="…" subtitle="…" />
    {/* contenido */}
  </section>
</main>
```

- El fondo de plataforma lo pone `<body>` (`bg-muted/40`); no poner
  `bg-background` ni `min-h-screen` en los `main`.
- Ancho: `max-w-6xl` salvo el detalle de proyecto (`max-w-7xl`) y los
  formularios (`max-w-4xl`).
- Tarjetas: usar `Card` de `components/ui`. Suelta se replica con
  `rounded-2xl bg-card p-5 shadow-sm ring-1 ring-utb-blue/10`.
- Tablas: envolver en una tarjeta, cabecera `bg-muted/50 hover:bg-muted/50` y
  filas `transition-colors hover:bg-utb-blue/[0.04]`.

## Primitivas de shadcn/ui ajustadas

Se editaron para heredar el lenguaje; el resto sigue igual y toma los tokens
automáticamente.

| Componente | Cambio |
| --- | --- |
| `card.tsx` | `rounded-2xl`, `shadow-sm ring-1 ring-utb-blue/10`, hover a `shadow-md`. |
| `tabs.tsx` | Lista en tarjeta blanca; pestaña activa en píldora `bg-utb-blue`. En pantallas pequeñas la lista se envuelve en filas (`flex-wrap`) en vez de recortarse. |
| `button.tsx` | Radio a `rounded-xl`. |
| `input.tsx`, `textarea.tsx`, `select.tsx` | Radio a `rounded-xl`. |

Al añadir componentes con el CLI de shadcn vendrán con los radios por defecto
(`rounded-lg`); alinearlos a `rounded-xl` si quedan junto a los anteriores.
