import type { AppProps } from 'next/app';

import '../styles/globals.css';
import { ProposalProvider } from '../context/ProposalContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ProposalProvider>
      <Component {...pageProps} />
    </ProposalProvider>
  );
}
