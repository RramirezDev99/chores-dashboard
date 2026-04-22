# Plan de Tareas del Hogar

Dashboard responsive para gestionar las tareas del hogar de Rubén y Natalia, basado en un plan mensual de 4 semanas.

## Características

- **Login** con selector de usuario (Rubén / Natalia)
- **Vista Hoy** — tareas del día con checklist, anillo de progreso y rol (principal/apoyo)
- **Vista Semana** — plan completo de los 7 días, cambia entre semanas 1–4
- **Vista Mes** — servicios externos y tareas mensuales
- **Vista Reglas** — regla de oro, horarios, revisión semanal
- **Notificaciones push locales** (9:00 AM y 6:00 PM) con recordatorios de tareas pendientes
- **PWA** — instalable, funciona offline
- **Responsive** — diseñado mobile-first, funciona perfecto en desktop
- **Tema claro/oscuro** automático según el sistema

## Cómo usar

1. Abre la app y elige tu usuario
2. Ingresa tu contraseña
3. Ve tus tareas de hoy, márcalas cuando las completes
4. Activa las notificaciones con el botón de campana para recordatorios diarios
5. Puedes navegar entre semanas y ver el plan mensual

## Stack

HTML + CSS + JS vanilla. Sin frameworks, sin build step. Se despliega como sitio estático.

## Desarrollo local

```bash
npx serve .
# o
python3 -m http.server 8080
```

## Despliegue

Este proyecto está listo para desplegarse en Vercel:

```bash
vercel deploy --prod
```
