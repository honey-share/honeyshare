import "./globals.css";

import {
  Space_Grotesk,
  Manrope,
} from "next/font/google";

const spaceGrotesk = Space_Grotesk({
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

const manrope = Manrope({
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
  title: "HoneyShare",
  description:
    "Fast, simple and temporary file sharing.",
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
