import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Atkinson_Hyperlegible } from 'next/font/google';

import '../styles/globals.css';
import { AuthGate } from '../components/auth/AuthGate';
import { AuthProvider } from '../context/AuthContext';
import { ProposalProvider } from '../context/ProposalContext';

// A typeface designed to stay readable for people with low vision. Bundled with the
// site at build time, so visitors' browsers never contact Google.
const readable = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-readable',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={readable.variable}>
      <Head>
        <title>Community Grant Assistant</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#2F6B4F" />
      </Head>
      <AuthProvider>
        <AuthGate>
          <ProposalProvider>
            <Component {...pageProps} />
          </ProposalProvider>
        </AuthGate>
      </AuthProvider>
    </div>
  );
}
