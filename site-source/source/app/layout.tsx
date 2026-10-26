import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clarity for US — Follow public power",
  description:
    "Search connected records about public officials, candidates, political money, bills, votes, executive orders, beneficiaries, and court challenges.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
