import type { Metadata } from 'next';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://storyteller-board-cn.akkoyyy.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title:'说书人配板台 · 人性本恶',
  description:'为《血染钟楼》说书人设计的中文配板工具。',
  icons:{ icon:[{ url:`${basePath}/brand-mark.svg`, type:'image/svg+xml' }], shortcut:`${basePath}/brand-mark.svg`, apple:`${basePath}/brand-mark.svg` },
  openGraph:{ title:'说书人配板台', description:'为血染钟楼说书人而做', images:[`${basePath}/og.png`] },
  twitter:{ card:'summary_large_image', title:'说书人配板台', description:'为血染钟楼说书人而做', images:[`${basePath}/og.png`] },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN"><body>{children}</body></html>; }
