import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/web-app/context/AuthContext";
import { MannaProvider } from "@/web-app/context/MannaContext";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "viem/chains";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Abraham",
  description: "An Autonomous Artificial Artist",
  openGraph: {
    title: "Abraham",
    description: "An Autonomous Artificial Artist",
    images: [
      {
        url: "/abrahamlogo.png",
        width: 1200,
        height: 630,
        alt: "Abraham Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Abraham",
    description: "An Autonomous Artificial Artist",
    images: ["/abrahamlogo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <MiniKitProvider
        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
        chain={{
          id: base.id,
          name: base.name,
          nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: [base.rpcUrls.default.http[0]],
            },
            public: {
              http: [base.rpcUrls.default.http[0]],
            },
          },
        }}
        config={{
          appearance: {
            mode: "auto",
            name: "Abraham",
            logo: "/abrahamlogo.png",
          },
        }}
      >
        <AuthProvider>
          <MannaProvider>
            <body
              className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
              {children}
            </body>
          </MannaProvider>
        </AuthProvider>
      </MiniKitProvider>
    </html>
  );
}
