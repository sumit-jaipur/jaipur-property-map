import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "99Bricks | Property Map for Jaipur",
    template: "%s | 99Bricks",
  },

  description:
    "Find your dream home in Jaipur. Browse verified properties on an interactive map with filters, favorites, and seller inquiries — powered by 99Bricks.",

  keywords: [
    "99Bricks",
    "Jaipur property",
    "Jaipur real estate",
    "property in Jaipur",
    "Jaipur villas",
    "Jaipur apartments",
    "Jaipur plots",
  ],

  metadataBase: new URL(
    "https://jaipur-property-map.vercel.app"
  ),

  openGraph: {
    title: "99Bricks — Find your dream home in Jaipur",

    description:
      "Browse verified Jaipur properties on an interactive map with filters, favorites, and seller inquiries.",

    url: "https://jaipur-property-map.vercel.app",

    siteName: "99Bricks",

    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
