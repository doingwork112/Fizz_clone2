import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fizz – Your Authentic Community',
  description: '匿名真实地与你的校友连接',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
