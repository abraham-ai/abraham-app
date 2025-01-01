"use client";
//import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { MannaProvider } from "@/context/MannaContext";
import { ApolloProvider } from "@apollo/client";
import apolloClient from "@/lib/apolloClient";

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

// export const metadata: Metadata = {
//   title: "Abraham",
//   description: "An Autonomous Artificial Artist",
//   openGraph: {
//     title: "Abraham",
//     description: "An Autonomous Artificial Artist",
//     images: [
//       {
//         url: "/abrahamlogo.png",
//         width: 1200,
//         height: 630,
//         alt: "Abraham Logo",
//       },
//     ],
//   },
//   twitter: {
//     card: "summary_large_image",
//     title: "Abraham",
//     description: "An Autonomous Artificial Artist",
//     images: ["/abrahamlogo.png"],
//   },
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ApolloProvider client={apolloClient}>
      <html lang="en">
        <AuthProvider>
          <MannaProvider>
            <body
              className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
              {children}
            </body>
          </MannaProvider>
        </AuthProvider>
      </html>
    </ApolloProvider>
  );
}
