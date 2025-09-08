This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install all dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Tiered Auth & Server-Signed (CDP) Tier‑A

This app integrates Privy for login (user vault) and Coinbase Developer Platform v2 server wallets for Tier‑A actions (tiny payable writes like praise/bless).

Server API routes under `/api/abraham/*` verify Privy Bearer tokens and submit transactions via CDP on behalf of a per-user Activity account. The UI tries server Tier‑A first, then falls back to direct wallet signing if the server path is unavailable.

Environment (see `.env.example`):

- NEXT_PUBLIC_PRIVY_APP_ID
- NEXT_PUBLIC_ABRAHAM_ADDRESS, NEXT_PUBLIC_PAYPATCH_ADDRESS, NEXT_PUBLIC_CHAIN_ID
- CDP_BASE_URL, CDP_API_KEY, CDP_API_SECRET
- CDP_ACTIVITY_SENDER (optional if you dynamically provision per-user accounts)

Security: keep Activity accounts minimally funded; enforce allowlists and per‑tx/day caps on your signer and/or on-chain permissions module.

Ensure you have all the required environment variables as specified in the **.env.example** file in your **.env.local**

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
