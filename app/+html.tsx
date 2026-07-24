import { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#10100f" />
        <meta
          name="description"
          content="Turn GitHub stars into a searchable, AI-assisted knowledge shelf."
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Star Shelf — organize what you starred" />
        <meta
          property="og:description"
          content="Sync, sort, and understand your GitHub stars with review-first AI categorization."
        />
        <meta name="twitter:card" content="summary" />
        <title>Star Shelf — organize what you starred</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { min-height: 100%; background: #10100f; }
          body { margin: 0; overflow: hidden; }
          * { box-sizing: border-box; }
          *:focus-visible { outline: 3px solid #ffd84d !important; outline-offset: 3px; }
          ::selection { background: #ffd84d; color: #10100f; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
