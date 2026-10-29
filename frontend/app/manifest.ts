import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChatApp",
    short_name: "Chat",
    description: "Simple 1:1 and group chat, installable on mobile and desktop.",
    id: "/",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#B9BFB2",
    theme_color: "#B9BFB2",
    categories: ["social", "productivity"],
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
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New chat",
        short_name: "New chat",
        url: "/chat?new=chat",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "New group",
        short_name: "New group",
        url: "/chat?new=group",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
