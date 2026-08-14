import "./globals.css";

import {
  Space_Grotesk,
  Manrope,
} from "next/font/google";

const spaceGrotesk =
  Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space",
    display: "swap",
    weight: [
      "400",
      "500",
      "600",
      "700",
    ],
  });

const manrope =
  Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
    display: "swap",
    weight: [
      "400",
      "500",
      "600",
      "700",
      "800",
    ],
  });

export const metadata = {
  title:
    "HoneyShare — Fast. Simple. Temporary.",

  description:
    "Fast, simple and temporary file sharing without an account.",

  icons: {
    icon: "/honeyshare.svg",
    shortcut:
      "/honeyshare.svg",
    apple:
      "/honeyshare.svg",
  },
};

export const viewport = {
  width:
    "device-width",

  initialScale:
    1,

  viewportFit:
    "cover",

  maximumScale:
    1,
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${manrope.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
