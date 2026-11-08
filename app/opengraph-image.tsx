import {ImageResponse} from 'next/og';
export const runtime='edge';
export const alt='Overflow Partner — Engineering execution capacity';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){return new ImageResponse(
 <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',background:'#101311',color:'white',padding:'72px 82px',fontFamily:'Arial, sans-serif',justifyContent:'space-between'}}>
   <div style={{display:'flex',alignItems:'center',gap:18}}><div style={{width:34,height:34,background:'#ef6c24',transform:'rotate(45deg)'}}/><span style={{fontSize:31,fontWeight:700,letterSpacing:2}}>OVERFLOW PARTNER</span></div>
   <div style={{display:'flex',flexDirection:'column',gap:26}}>
    <div style={{display:'flex',fontSize:23,letterSpacing:3,color:'#ffa16e'}}>ENGINEERING EXECUTION CAPACITY</div>
    <div style={{display:'flex',fontSize:64,fontWeight:700,lineHeight:1.08,maxWidth:970}}>Keep engineering delivery moving.</div>
    <div style={{display:'flex',fontSize:25,color:'#cbd3cc'}}>CAD • Production Drawings • Managed Engineering Support</div>
   </div>
   <div style={{display:'flex',width:'100%',height:8,background:'#ef6c24'}}/>
 </div>,{...size});
}
