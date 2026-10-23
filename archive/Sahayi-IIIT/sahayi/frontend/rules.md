# SAHAYI FRONTEND — RULES
# Team: Porottayum Beefum | TECHASHY'26

## Component Rules
- Every component is a functional React component with hooks
- No component renders more than 150 lines — split if larger
- All data fetching lives in hooks/ — never inside components
- All API calls live in api/sahayi.js — never inline in components

## Real-Time Rules
- Dashboard uses WebSocket for live updates — no polling
- Risk feed updates must animate in — never hard refresh
- Knowledge graph re-renders only on data change — memoize
- Active call indicator must pulse in real time

## Styling Rules
- Tailwind CSS only — no inline styles except for D3 graphs
- Dark theme throughout — background #0f172a
- Risk colours: Green #22c55e / Yellow #eab308 / Red #ef4444
- All cards use backdrop-blur glassmorphism effect

## Comment Rules
- Every component: JSDoc header explaining purpose + props
- Every hook: comment explaining what data it manages
- Every WebSocket handler: comment explaining event shape
- Every D3 render function: comment explaining the graph type
