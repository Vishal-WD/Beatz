/** Route-level loading state — the pulse matches the Vibe Bar's cadence. */
export default function Loading() {
  return (
    <div style={{ minHeight:'100dvh', background:'var(--stage-black)',
                  display:'grid', placeItems:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:52, height:52, borderRadius:16,
                      background:'linear-gradient(150deg,var(--neon-pink),var(--neon-violet))',
                      animation:'beat 1.4s ease-in-out infinite' }} />
        <div style={{ font:"400 9px/1 var(--font-tele)", letterSpacing:'.24em',
                      color:'var(--ink-40)' }}>
          CUEING UP
        </div>
      </div>
    </div>
  );
}
