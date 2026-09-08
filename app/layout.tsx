import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://storyteller-board-cn.ys774034048.chatgpt.site'),
  title:'说书人配板台 · 人性本恶',
  description:'为《血染钟楼》说书人设计的中文配板工具。',
  openGraph:{ title:'说书人配板台', description:'为血染钟楼说书人而做', images:['/og.png'] },
  twitter:{ card:'summary_large_image', title:'说书人配板台', description:'为血染钟楼说书人而做', images:['/og.png'] },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN"><body>{children}</body></html>; }
