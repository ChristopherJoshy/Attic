# Orix Landing Page

<div align="center">

![Orix](https://img.shields.io/badge/Orix-Fast%2C%20Fair%2C%20Friendly-ridesharing-brightgreen?style=for-the-badge&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**A modern landing page for Orix — a college ride coordination platform**

[Live Demo](https://or1x.vercel.app/) · [Report Bug](https://github.com/anomalyco/opencode/issues) · [Request Feature](https://github.com/anomalyco/opencode/issues)

</div>

---

## About The Project

Orix is a college ride coordination platform that connects riders and drivers with fair fares, verified drivers, and safety-first features. This landing page serves as the primary user acquisition channel, allowing prospective users to join an early access waitlist.

The landing page is built with a focus on conversion, accessibility, and performance. It features a modern, clean design with smooth animations and a user-friendly waitlist signup process.

### Key Highlights

- **Two-step waitlist form** — Collects email first, then name for higher conversion rates
- **Integrated chatbot** — AI-powered support for visitor inquiries
- **Responsive design** — Works seamlessly on desktop, tablet, and mobile devices
- **SEO optimized** — Full meta tags, Open Graph, and Twitter Card support
- **Accessibility first** — ARIA labels, focus management, and reduced motion support

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Waitlist Signup** | Two-step form with email validation and Formbricks integration |
| **Chatbot Integration** | AI-powered chatbot for answering visitor questions |
| **Mobile Navigation** | Smooth drawer navigation with focus trap for accessibility |
| **Parallax Hero Effect** | Subtle scroll-based animation for visual depth |
| **Real-time Validation** | Instant email format validation with visual feedback |
| **Local Storage** | Remembers waitlist signup status across sessions |
| **SEO Optimization** | Complete meta tags, Open Graph, and Twitter Cards |

### Design Features

- Custom Tailwind color palette (beige, charcoal, mint accent)
- Google Fonts integration (Playfair Display + Inter)
- Custom box shadows with hover states
- Smooth scroll behavior
- Reduced motion support for accessibility
- Responsive breakpoints for all screen sizes

---

## Tech Stack

- **HTML5** — Semantic markup
- **Tailwind CSS** — Utility-first CSS framework
- **JavaScript (ES6+)** — Interactive functionality
- **Formbricks** — Survey and waitlist management
- **Google Fonts** — Typography (Playfair Display, Inter)

---

## Getting Started

### Prerequisites

- Node.js (v14+) and npm for development
- A modern web browser

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/anomalyco/orix-landing.git
   cd orix-landing
   ```

2. **Install Tailwind CSS** (if not already installed)

   ```bash
   npm install -D tailwindcss
   npx tailwindcss init
   ```

3. **Build Tailwind CSS**

   ```bash
   npx tailwindcss -i ./input.css -o ./output.css --watch
   ```

   Or for production:

   ```bash
   npx tailwindcss -i ./input.css -o ./output.css --minify
   ```

4. **Open in browser**

   Simply open `index.html` in your browser, or use a local server:

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve .
   ```

### Formbricks Setup (Optional)

To enable the waitlist functionality with Formbricks:

1. Create a Formbricks account at [formbricks.com](https://formbricks.com)
2. Create a new survey/waitlist
3. Add your Formbricks API key to the project
4. The form will automatically track signups and user attributes

---

## Project Structure

```
Orix-Landing/
├── index.html           # Main landing page
├── tailwind.config.js   # Tailwind CSS configuration
├── chatbot.js           # Chatbot integration logic
├── chatbot.css          # Chatbot styling
├── hero.js              # Hero section and waitlist form
├── hero-illustration.svg # Hero section illustration
├── Chat-Icon.svg       # Chatbot icon
├── Chat-window.svg      # Chatbot window illustration
├── Socialcard.png       # Social media preview image
├── favicon.png          # Site favicon
└── README.md            # This file
```

---

## Screenshots

> Add your screenshots here

| Desktop View | Mobile View |
|--------------|-------------|
| ![Desktop](link-to-desktop-screenshot) | ![Mobile](link-to-mobile-screenshot) |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Credits

- [Tailwind CSS](https://tailwindcss.com/) — CSS Framework
- [Formbricks](https://formbricks.com/) — Survey Platform
- [Google Fonts](https://fonts.google.com/) — Typography
- [Vercel](https://vercel.com/) — Hosting Platform
- [Opencode](https://opencode.ai/) — AI Development Assistant

---

<div align="center">

**Built with ❤️ for college students everywhere**

*Fast. Fair. Friendly. Ridesharing made simple.*

</div>
