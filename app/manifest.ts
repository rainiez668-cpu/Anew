import type { MetadataRoute } from "next";

// PWA manifest for Anew. Colors track the app's calm palette
// (globals.css --background and the layout viewport themeColor) so the
// installed app blends with the splash/toolbar instead of flashing white.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anew",
    short_name: "Anew",
    description: "One small loop a day.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#e5e8ec",
    theme_color: "#E2ECF8",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
