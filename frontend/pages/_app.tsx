import type { AppProps } from 'next/app';

import '../styles/globals.css';
import { AuthGate } from '../components/auth/AuthGate';
import { AuthProvider } from '../context/AuthContext';
import { ProposalProvider } from '../context/ProposalContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthGate>
        <ProposalProvider>
          <Component {...pageProps} />
        </ProposalProvider>
      </AuthGate>
    </AuthProvider>
  );
}
