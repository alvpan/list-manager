import Head from "next/head";
import Script from "next/script";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-SC4R1WN19F"
        strategy="afterInteractive"
      />

      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SC4R1WN19F', {
              send_page_view: true,
              debug_mode: true
            });
          `,
        }}
      />

      <div style={{ fontFamily: "'Inter', sans-serif" }}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
