import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
