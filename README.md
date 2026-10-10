# ⚡ Astro-Smash: Arena (Web Client)

> High-velocity 3v3 cybernetic physics arena brawler powered by **Babylon.js**, **TypeScript**, and **Vite**. Official Web F2P flagship of **Tachyon Studios**.

---

## 🚀 Overview

**Astro-Smash: Arena** is a zero-friction, browser-native 3D physics arena game designed for instant zero-install desktop and mobile browser play. Pilots steer high-speed cybernetic hover-strikers across an Obsidian electro-grid stadium, maneuvering and slamming an energy plasma puck into the opponent's containment goal.

### Key Pillars
- **Zero-Install WebGL/WebGPU:** Powered by Babylon.js with deterministic custom physics, procedural spatial particle FX, and dynamic neon lighting.
- **Hardware Agnostic Control:** Play instantly with standard Keyboard/Mouse, Gamepad, or pair your smartphone as a physical 6-DOF gyroscopic flight yoke via the **Tachyon Mobile HOTAS** companion (`/controller`).
- **Zero-Latency Audio Engine:** 100% procedurally synthesized Web Audio SFX (afterburner whine, collision deflection clicks, sub-bass goal detonation fanfare).
- **Cross-Progression Ready:** Prepared for unified Supabase pilot clearance, leaderboard rankings, and cross-game cosmetic unlocks.

---

## 🎮 Flight & Arena Controls

| Control | Action | Details |
| :--- | :--- | :--- |
| **W / S** or **↑ / ↓** | Forward Thrust / Reverse | Linear acceleration with aerodynamic drag |
| **A / D** or **← / →** | Yaw Steering & Bank | Smooth aerodynamic banking and roll response |
| **SPACE** | Afterburner Hyper-Boost | Consumes boost meter for +70% burst velocity |
| **Left Click / F** | Kinetic Shunt Pulse | Directional kinetic shockwave deflecting the puck |
| **C** | Toggle Camera | Cycle between 3rd-Person Chase Cam and Drone Arena Cam |
| **HOTAS Link** | Gyro Cockpit Controls | 60Hz 16-byte packed telemetry via WebRTC DataChannel |

---

## 📱 Mobile HOTAS Pairing

Pilots can use their smartphone as a physical flight yoke:
1. Open the **Tachyon Mobile HOTAS** companion on your smartphone browser: [https://tachyon.get.be.eu.org/controller](https://tachyon.get.be.eu.org/controller)
2. Enter the tactical room code: `TACHYON-7492`
3. Tilt your device to steer, pull the throttle lever with your thumb, and slam the trigger to fire kinetic pulses!

---

## 🛠️ Development & Build Setup

### Prerequisites
- **Node.js**: v20+ or v24+
- **NPM**: v10+

### Installation & Local Run
```bash
# Navigate to the repo
cd astro-smash-web

# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

### Production Build
```bash
npm run build
```

---

## 🏛️ Architecture & Project Structure

```
astro-smash-web/
├── public/
│   └── favicon.svg           # Tachyon cybernetic vector branding
├── src/
│   ├── game/
│   │   ├── Arena.ts          # Sci-fi stadium geometry, grid floor, perimeter glass, goals
│   │   ├── Striker.ts        # Aerodynamic ship model, kinematics, banking, boost particles
│   │   ├── Puck.ts           # Plasma energy orb, particle trails, elastic collision bounce
│   │   ├── AudioEngine.ts    # Procedural Web Audio API sound generator
│   │   ├── HotasReceiver.ts  # WebRTC PeerJS receiver unpacking 16-byte HOTAS binary frames
│   │   └── Game.ts           # Central match loop, AI bot logic, camera orchestration, HUD sync
│   ├── style.css             # Tachyon neon HUD styling & animations
│   └── main.ts               # DOM bootstrap and canvas binding
├── index.html                # Fullscreen cybernetic glassmorphism HUD overlay
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🌐 Deployment

This web client builds cleanly to static assets in `dist/` and can be deployed directly to Cloudflare Pages, Cloudflare Workers static assets, Vercel, or Netlify.

```bash
# Cloudflare Pages release
npx wrangler pages deploy dist/ --project-name=astro-smash-web
```
