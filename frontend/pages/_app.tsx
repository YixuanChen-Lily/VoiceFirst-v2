import type { AppProps } from 'next/app';
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
