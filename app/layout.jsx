export const metadata = {
  title: "HoneyShare",
  description: "Temporary file sharing",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
