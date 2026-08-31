/** Route-level loading state — the pulse matches the Vibe Bar's cadence. */
export default function Loading() {
  return (
    <div style={{ minHeight:'100dvh', background:'var(--stage-black,#05050a)',
                  display:'grid', placeItems:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:52, height:52, borderRadius:16,
                      background:'linear-gradient(150deg,#ff2e88,#7b2bff)',
                      animation:'beat 1.4s ease-in-out infinite' }} />
        <div style={{ font:"400 9px/1 var(--font-tele,monospace)", letterSpacing:'.24em',
                      color:'rgba(244,242,255,.4)' }}>
          CUEING UP
        </div>
      </div>
    </div>
  );
}
