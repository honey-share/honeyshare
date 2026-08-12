import "./globals.css";

export const metadata = {
  title: "HoneyShare — Temporary File Sharing",

  description:
    "Fast, private and temporary file sharing without an account.",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
