import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: '#3b82f6',
            fontFamily: 'sans-serif',
            letterSpacing: '-5px',
            lineHeight: 1,
          }}
        >
          P
        </span>
      </div>
    ),
    { ...size }
  )
}
