import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kutumb — Your Family's Shared Memory",
    short_name: "Kutumb",
    description: "A shared AI-powered family memory and coordination application.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#c2593f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/kutumb-logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
