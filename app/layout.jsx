import './globals.css';

export const metadata = {
  title: 'Serotonin',
  description: 'A local-first chat workspace for Ollama, OpenAI, and Anthropic.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
