import { useId } from 'react';
import type { Place } from './places';

// Original vector concept art. Replace with team photos through places.ts.
export function CampusScene({ kind = 'pond', theme = 'today', className = '' }: { kind?: Place['kind']; theme?: string; className?: string }) {
  const id = useId().replaceAll(':', '');
  const palettes: Record<string, [string, string, string, string]> = {
    today: ['#294d50', '#8aaf98', '#b3b699', '#293e39'],
    future: ['#1b3a46', '#649c92', '#94bab5', '#204742'],
    homecoming: ['#2b2a3a', '#c9a24a', '#b9b08c', '#2f3f37'],
    storm: ['#222d3b', '#5b6d77', '#82938f', '#24363a'],
    rocket: ['#243343', '#aa9976', '#adad91', '#2f4541'],
    nature: ['#234039', '#859b60', '#87976b', '#294b36'],
    medieval: ['#47382e', '#ad8a58', '#998975', '#383b2c'],
    snow: ['#486170', '#c5d7d8', '#b6c9c5', '#627e7d'],
  };
  const [sky, glow, stone, green] = palettes[theme] || palettes.today;
  const palm = (x: number, y: number, scale = 1) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0 90 Q-3 40 4 0" fill="none" stroke="#576452" strokeWidth="8" />
    <g fill="#234e42" stroke="#527464" strokeWidth="1">
      <path d="M4 0 Q-30 -32 -70 5 Q-26 -4 4 0M4 0 Q-20 -45 -49 -24 Q-12 -22 4 0M4 0 Q22 -37 63 -13 Q25 -8 4 0M4 0 Q35 -4 70 33 Q28 10 4 0M4 0 Q-25 2 -48 32 Q-14 9 4 0" />
    </g>
  </g>;
  return <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className={`campus-scene ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={sky} /><stop offset="1" stopColor={glow} /></linearGradient>
      <linearGradient id={`${id}-water`} x2="0" y2="1"><stop stopColor="#739a91" /><stop offset="1" stopColor="#294e4e" /></linearGradient>
    </defs>
    <path fill={`url(#${id}-sky)`} d="M0 0h800v450H0z" />
    <circle cx="570" cy="102" r="42" fill={glow} opacity=".52" />
    <path d="M0 182Q70 159 130 176T260 173T410 177T560 173T800 167V280H0Z" fill={green} />
    <g fill={stone} stroke="#364f47" strokeWidth="2">
      <path d={kind === 'union' ? 'M160 155 L400 120 L640 155 V280 H160Z' : 'M180 153H620V280H180Z'} />
      <path d="M175 153H625V165H175Z" fill="#c9c4a8" />
      {[208, 267, 326, 385, 444, 503, 562].map(x => <g key={x}><path d={`M${x} 174h32v66h-32z`} fill="#344b4a" /><path d={`M${x - 6} 168h6v83h-6z`} fill="#d0c9a9" /></g>)}
      {kind === 'library' && <path d="M280 108h240v45H280z" />}
      <path d="M162 264h476v16H162z" fill="#c6c0a0" />
    </g>
    <path d="M0 267H800V450H0Z" fill={green} />
    <path d="M274 280H526L688 450H105Z" fill="#95977d" />
    <path d="M400 283L397 450" stroke="#bbc1a2" strokeWidth="2" opacity=".5" />
    {kind === 'pond' ? <>
      <ellipse cx="400" cy="352" rx="256" ry="62" fill="#b9b9a0" />
      <ellipse cx="400" cy="348" rx="234" ry="51" fill={`url(#${id}-water)`} />
      {[322, 338, 354, 369].map(y => <path key={y} d={`M230 ${y} Q395 ${y + 9} 566 ${y}`} stroke="#b1c8b8" opacity=".3" fill="none" />)}
      <path d="M392 339Q400 250 408 339M400 338V239M383 338Q400 282 417 338" stroke="#d1dfcb" strokeWidth="3" opacity=".7" fill="none" />
    </> : <path d="M313 303H485L554 450H232Z" fill={kind === 'mall' ? '#78936a' : '#acac8e'} />}
    {palm(89, 210, 1.35)}{palm(699, 221, 1.2)}{palm(147, 232, .75)}{palm(645, 237, .8)}
    <path d="M0 401Q160 360 180 450H0ZM800 383Q633 374 631 450H800Z" fill="#203e34" />
    {theme === 'future' && <g fill="none" stroke="#a1dfcb" opacity=".7"><path d="M170 150V130H630V150M180 169H620M330 108V79H470V108" /><path d="M400 30V62M385 45H415" /></g>}
    {theme === 'rocket' && <><path d="M592 121L630 38" stroke="#f5d9a0" strokeWidth="4" /><path d="M590 124L561 190" stroke="#c5c5b7" strokeWidth="12" opacity=".35" /></>}
    {theme === 'storm' && <g stroke="#bfd7d7" opacity=".26">{Array.from({ length: 28 }, (_, i) => <path key={i} d={`M${i * 32} 60l-30 150m0 60l-30 140`} />)}</g>}
    {theme === 'snow' && <g fill="#e0eae6">{Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 137) % 800} cy={(i * 73) % 450} r="2" />)}<path d="M175 150H625V158H175z" /></g>}
    {theme === 'homecoming' && <g>{Array.from({ length: 14 }, (_, i) => <g key={i} transform={`translate(${60 + ((i * 211) % 680)} ${50 + ((i * 97) % 190)})`}><path d="M0 18Q2 30 -2 42" stroke="#d8cfa8" fill="none" opacity=".6" /><ellipse rx="11" ry="14" fill={i % 2 ? '#d9b14a' : '#1d1d24'} stroke="#e8d8a0" strokeWidth="1" /></g>)}</g>}
    {theme === 'nature' && <g fill="#3c5a3a" stroke="#22382a" strokeWidth="2"><path d="M300 352Q340 334 420 338Q470 340 520 352Q470 360 420 362Q350 366 300 352ZM300 352Q270 350 238 356Q268 346 300 346Z" /><path d="M560 300v-46M560 256q22 -6 26 -24" fill="none" stroke="#e6e2d4" strokeWidth="4" /></g>}
    {theme === 'medieval' && <g><path d="M300 330L520 222" stroke="#d6d2c4" strokeWidth="4" /><path d="M520 222L586 238L522 254Z" fill="#d9b14a" /><path d="M520 222L586 238L522 230Z" fill="#1d1d24" /><path d="M262 360q30 -46 78 -36l26 -28q14 18 -4 38q22 22 6 56H270Z" fill="#e6e2d4" opacity=".85" /></g>}
    <path d="M0 449H800" stroke="#88b9a1" opacity=".35" />
  </svg>;
}
