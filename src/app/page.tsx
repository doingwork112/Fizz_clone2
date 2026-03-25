'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Post, Comment, Listing, Message } from '@/types'

type Theme = 'light' | 'dark' | 'auto'

function useTheme() {
  const [theme, setThemeState] = useState<Theme>('auto')
  const [resolved, setResolved] = useState<'light'|'dark'>('light')
  useEffect(() => {
    const saved = localStorage.getItem('fizz_theme') as Theme | null
    if (saved) setThemeState(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('fizz_theme', theme)
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      setResolved(mq.matches ? 'dark' : 'light')
      const h = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', h)
      return () => mq.removeEventListener('change', h)
    } else setResolved(theme)
  }, [theme])
  const setTheme = (t: Theme) => setThemeState(t)
  return { theme, setTheme, resolved }
}

const LIGHT = { bg:'#ffffff', surface:'#f5f5f5', surface2:'#ebebeb', border:'#e8e8e8', text:'#111111', muted:'#8e8e93', card:'#ffffff', accent:'#1a3a5c', accentBright:'#2563eb', upvote:'#2563eb', red:'#ef4444', green:'#16a34a', shadow:'rgba(0,0,0,0.08)' }
const DARK =  { bg:'#0f0f13', surface:'#18181f', surface2:'#222230', border:'#2e2e3f', text:'#e8e8f0', muted:'#888899', card:'#1e1e28', accent:'#1a3a5c', accentBright:'#7c6ff7', upvote:'#7c6ff7', red:'#f76f6f', green:'#4cd9a0', shadow:'rgba(0,0,0,0.4)' }

const ANON_EMOJIS = ['🦊','🐧','🎩','🦄','🌈','🔮','🎪','🦋','🌊','🎭','🐻','🦁']
const AV_COLORS = ['#1a3a5c','#2563eb','#7c3aed','#0891b2','#15803d','#b45309','#be123c','#0f766e']
const SCHOOLS = ['北京大学','清华大学','复旦大学','上海交通大学','浙江大学','南京大学','武汉大学','中山大学','华中科技大学','四川大学']

function ago(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'now'
  if (d < 3600000) return `${Math.floor(d/60000)}m`
  if (d < 86400000) return `${Math.floor(d/3600000)}h`
  return `${Math.floor(d/86400000)}d`
}
function anonEmoji(uid: string) { return ANON_EMOJIS[uid.charCodeAt(0) % ANON_EMOJIS.length] }
function avColor(uid: string) { return AV_COLORS[uid.charCodeAt(0) % AV_COLORS.length] }

export default function App() {
  const sb = createClient()
  const { theme, setTheme, resolved } = useTheme()
  const C = resolved === 'light' ? LIGHT : DARK

  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile|null>(null)
  const [authTab, setAuthTab] = useState<'login'|'register'>('login')
  const [af, setAf] = useState({ email:'', pwd:'', username:'', school: SCHOOLS[0] })
  const [authLoading, setAuthLoading] = useState(false)
  const [authErr, setAuthErr] = useState('')

  const [page, setPage] = useState<'feed'|'messages'|'search'|'market'|'profile'>('feed')
  const [feedTab, setFeedTab] = useState<'Top'|"Fizzin'"| 'New'>("Fizzin'")

  const [posts, setPosts] = useState<Post[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [convos, setConvos] = useState<{user:Profile, lastMsg?:Message}[]>([])
  const [chatMsgs, setChatMsgs] = useState<Message[]>([])
  const [chatTarget, setChatTarget] = useState<Profile|null>(null)
  const [chatInput, setChatInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [online, setOnline] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState<Post[]>([])
  const [openCmts, setOpenCmts] = useState<Record<string,Comment[]>>({})
  const [cmtInputs, setCmtInputs] = useState<Record<string,string>>({})
  const [mktCat, setMktCat] = useState('all')

  const [showPost, setShowPost] = useState(false)
  const [postText, setPostText] = useState('')
  const [postAnon, setPostAnon] = useState(true)
  const [posting, setPosting] = useState(false)
  const [postImgs, setPostImgs] = useState([])
  const [postPrevs, setPostPrevs] = useState([])

  const [showListing, setShowListing] = useState(false)
  const [lf, setLf] = useState({ title:'', price:'', cat:'clothes', desc:'', condition:'Good' })
  const [lFiles, setLFiles] = useState<File[]>([])
  const [lPreviews, setLPreviews] = useState<string[]>([])
  const [lUploading, setLUploading] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) loadProfile(data.session.user.id) })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) loadProfile(s.user.id); else setProfile(null) })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await sb.from('profiles').select('*').eq('id', uid).single()
    if (data) { setProfile(data); presence(data) }
  }
  async function presence(p: Profile) {
    await sb.from('presence').upsert({ user_id: p.id, last_seen: new Date().toISOString(), school: p.school })
    const { count } = await sb.from('presence').select('*',{count:'exact',head:true}).gte('last_seen', new Date(Date.now()-5*60*1000).toISOString())
    setOnline(count||0)
  }

  useEffect(() => {
    if (!profile) return
    loadPosts(); loadListings(); loadConvos(); loadUnread()
    const ch = sb.channel('rt-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadPosts()).subscribe()
    const mch = sb.channel('rt-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`to_user_id=eq.${profile.id}`},p=>{loadConvos();loadUnread();if(chatTarget?.id===p.new.from_user_id)setChatMsgs(x=>[...x,p.new as Message])}).subscribe()
    const iv = setInterval(()=>presence(profile),120000)
    return ()=>{ sb.removeChannel(ch); sb.removeChannel(mch); clearInterval(iv) }
  }, [profile?.id])

  async function handleLogin() {
    setAuthLoading(true); setAuthErr('')
    const { error } = await sb.auth.signInWithPassword({ email: af.email, password: af.pwd })
    if (error) setAuthErr('邮箱或密码错误')
    setAuthLoading(false)
  }
  async function handleRegister() {
    setAuthLoading(true); setAuthErr('')
    if (!af.username||!af.email||!af.pwd) { setAuthErr('请填写所有字段'); setAuthLoading(false); return }
    if (af.pwd.length < 6) { setAuthErr('密码至少6位'); setAuthLoading(false); return }
    const { error } = await sb.auth.signUp({ email: af.email, password: af.pwd, options: { data: { username: af.username, school: af.school, avatar_initials: af.username.slice(0,2).toUpperCase(), avatar_color: AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)] } } })
    if (error) setAuthErr(error.message); else setAuthErr('注册成功！请查收验证邮件后登录')
    setAuthLoading(false)
  }

  async function loadPosts() {
    const { data } = await sb.from('posts').select('*, profiles(*)').order('created_at',{ascending:false}).limit(100)
    if (!data) return
    if (profile) {
      const { data: votes } = await sb.from('fizzups').select('post_id,vote_type').eq('user_id',profile.id)
      const vm: Record<string,string> = {}; votes?.forEach(v=>vm[v.post_id]=v.vote_type)
      setPosts(data.map(p=>({...p,my_vote:vm[p.id]||null})))
    } else setPosts(data)
  }

  function sorted() {
    const p = [...posts]
    if (feedTab==='Top') return p.sort((a,b)=>b.likes_count-a.likes_count)
    if (feedTab==="Fizzin'") return p.sort((a,b)=>(b.likes_count-(b.dislikes_count||0))-(a.likes_count-(a.dislikes_count||0)))
    return p.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
  }

  async function vote(post: Post, type: 'up'|'down') {
    if (!profile) return
    const mv = (post as any).my_vote
    if (mv===type) { await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id) }
    else {
      if (mv) await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id)
      await sb.from('fizzups').insert({post_id:post.id,user_id:profile.id,vote_type:type})
    }
    loadPosts()
  }

  async function submitPost() {
    if (!profile||(!postText.trim()&&postImgs.length===0)) return
    setPosting(true)
    const urls=[]
    for(const file of postImgs){
      const path=profile.id+'/'+Date.now()+'_'+file.name
      const res=await sb.storage.from('post-images').upload(path,file,{upsert:true})
      if(!res.error){
        const{data:u}=sb.storage.from('post-images').getPublicUrl(path)
        urls.push(u.publicUrl)
      }
    }
    await sb.from('posts').insert({user_id:profile.id,text:postText.trim(),is_anon:postAnon,school:profile.school,images:urls})
    setPostText('');setPostImgs([]);setPostPrevs([]);setShowPost(false);setPosting(false);loadPosts()
  }
  function pickImgs(e){
    const files=Array.from(e.target.files||[]).slice(0,4)
    setPostImgs(files)
    setPostPrevs(files.map(f=>URL.createObjectURL(f)))
  }

  async function deletePst(id:string) { if(!confirm('确认删除？'))return; await sb.from('posts').delete().eq('id',id); loadPosts() }

  async function toggleCmts(pid:string) {
    if (openCmts[pid]) { const c={...openCmts}; delete c[pid]; setOpenCmts(c) }
    else { const { data } = await sb.from('comments').select('*,profiles(*)').eq('post_id',pid).order('created_at'); setOpenCmts(p=>({...p,[pid]:data||[]})) }
  }
  async function submitCmt(pid:string) {
    if (!profile||!cmtInputs[pid]?.trim()) return
    await sb.from('comments').insert({post_id:pid,user_id:profile.id,text:cmtInputs[pid].trim()})
    setCmtInputs(p=>({...p,[pid]:''}))
    const { data } = await sb.from('comments').select('*,profiles(*)').eq('post_id',pid).order('created_at')
    setOpenCmts(p=>({...p,[pid]:data||[]})); loadPosts()
  }

  async function loadListings() {
    const { data } = await sb.from('listings').select('*,profiles(*)').eq('is_sold',false).order('created_at',{ascending:false})
    setListings(data||[])
  }
  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files||[]).slice(0,8)
    setLFiles(files); setLPreviews(files.map(f=>URL.createObjectURL(f)))
  }
  async function submitListing() {
    if (!profile||!lf.title) return
    setLUploading(true)
    const urls: string[] = []
    for (const file of lFiles) {
      const path = `${profile.id}/${Date.now()}_${file.name}`
      const { error } = await sb.storage.from('listing-images').upload(path,file,{upsert:true})
      if (!error) { const { data: u } = sb.storage.from('listing-images').getPublicUrl(path); urls.push(u.publicUrl) }
    }
    await sb.from('listings').insert({user_id:profile.id,title:lf.title,price:parseFloat(lf.price)||0,category:lf.cat,description:lf.desc,emoji:'📦',school:profile.school,images:urls})
    setShowListing(false); setLf({title:'',price:'',cat:'clothes',desc:'',condition:'Good'}); setLFiles([]); setLPreviews([])
    setLUploading(false); loadListings()
  }

  async function loadConvos() {
    if (!profile) return
    const { data: users } = await sb.from('profiles').select('*').neq('id',profile.id)
    if (!users) return
    const c = await Promise.all(users.map(async u=>{
      const { data: m } = await sb.from('messages').select('*').or(`and(from_user_id.eq.${profile.id},to_user_id.eq.${u.id}),and(from_user_id.eq.${u.id},to_user_id.eq.${profile.id})`).order('created_at',{ascending:false}).limit(1)
      return {user:u as Profile,lastMsg:m?.[0]}
    }))
    c.sort((a,b)=>(b.lastMsg?.created_at||'')>(a.lastMsg?.created_at||'')?1:-1)
    setConvos(c)
  }
  async function loadUnread() {
    if (!profile) return
    const { count } = await sb.from('messages').select('*',{count:'exact',head:true}).eq('to_user_id',profile.id).eq('is_read',false)
    setUnread(count||0)
  }
  async function openChat(u:Profile) {
    setChatTarget(u)
    const { data } = await sb.from('messages').select('*').or(`and(from_user_id.eq.${profile!.id},to_user_id.eq.${u.id}),and(from_user_id.eq.${u.id},to_user_id.eq.${profile!.id})`).order('created_at')
    setChatMsgs(data||[])
    await sb.from('messages').update({is_read:true}).eq('to_user_id',profile!.id).eq('from_user_id',u.id)
    loadUnread(); setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100)
  }
  async function sendMsg() {
    if (!profile||!chatTarget||!chatInput.trim()) return
    await sb.from('messages').insert({from_user_id:profile.id,to_user_id:chatTarget.id,text:chatInput.trim()})
    setChatInput(''); openChat(chatTarget); loadConvos()
  }
  useEffect(()=>{ chatRef.current?.scrollTo(0,chatRef.current.scrollHeight) },[chatMsgs])

  useEffect(()=>{
    if (!searchQ.trim()) { setSearchRes([]); return }
    const t = setTimeout(async()=>{ const { data }=await sb.from('posts').select('*,profiles(*)').ilike('text',`%${searchQ}%`).limit(30); setSearchRes(data||[]) },300)
    return ()=>clearTimeout(t)
  },[searchQ])

  // ── shared styles ──
  const inp: React.CSSProperties = { width:'100%', background:C.surface, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'12px 14px', color:C.text, fontSize:'0.95rem', outline:'none', fontFamily:'inherit' }
  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }
  const sheet: React.CSSProperties = { background:C.bg, borderRadius:'20px 20px 0 0', padding:'20px 16px', maxHeight:'92vh', overflowY:'auto' }

  // ── Post Card ──
  function PostCard({ p }: { p: Post }) {
    const isAnon = p.is_anon
    const name = isAnon ? 'Anonymous' : (p.profiles?.username||'用户')
    const mv = (p as any).my_vote
    const score = p.likes_count - (p.dislikes_count||0)
    const cmtsOpen = !!openCmts[p.id]

    return (
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', gap:'10px', background:C.bg }}>
        {/* avatar */}
        <div style={{ width:'40px', height:'40px', borderRadius:'50%', background: isAnon ? avColor(p.user_id) : (p.profiles?.avatar_color||avColor(p.user_id)), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', color:'white', fontWeight:700, flexShrink:0 }}>
          {isAnon ? anonEmoji(p.user_id) : (p.profiles?.avatar_initials||'?')}
        </div>
        {/* main */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px',flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:'0.92rem',color:C.text}}>{name}</span>
            <span style={{color:C.muted,fontSize:'0.8rem'}}>{ago(p.created_at)}</span>
            {p.is_hot && <span style={{background:'#fef3c7',color:'#d97706',borderRadius:'4px',padding:'1px 6px',fontSize:'0.68rem',fontWeight:700}}>🔥 HOT</span>}
          </div>
          <div style={{fontSize:'0.95rem',lineHeight:'1.55',color:C.text,wordBreak:'break-word'}}>{p.text}</div>
          {p.images&&p.images.length>0&&<div style={{display:'grid',gridTemplateColumns:p.images.length===1?'1fr':'1fr 1fr',gap:'4px',marginTop:'10px',borderRadius:'12px',overflow:'hidden'}}>{p.images.slice(0,4).map((url,i)=><img key={i} src={url} alt="" style={{width:'100%',height:p.images.length===1?'220px':'130px',objectFit:'cover'}}/>)}</div>}
          {/* action row */}
          <div style={{display:'flex',alignItems:'center',gap:'14px',marginTop:'10px',color:C.muted}}>
            <button onClick={()=>toggleCmts(p.id)} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {p.comments_count}
            </button>
            <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
            </button>
            <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
            <span style={{fontSize:'0.9rem',cursor:'pointer',color:C.muted}}>•••</span>
            {p.user_id===profile!.id && <button onClick={()=>deletePst(p.id)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:'0.82rem',padding:0,marginLeft:'auto'}}>删除</button>}
          </div>
          {/* comments */}
          {cmtsOpen && (
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:`1px solid ${C.border}`}}>
              {openCmts[p.id].map(c=>(
                <div key={c.id} style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                  <div style={{width:'26px',height:'26px',borderRadius:'50%',background:c.profiles?.avatar_color||'#888',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',fontWeight:700,color:'white',flexShrink:0}}>{c.profiles?.avatar_initials||'?'}</div>
                  <div>
                    <span style={{fontWeight:700,fontSize:'0.82rem',color:C.text}}>{c.profiles?.username||'用户'} </span>
                    <span style={{fontSize:'0.72rem',color:C.muted}}>{ago(c.created_at)}</span>
                    <div style={{fontSize:'0.88rem',color:C.text}}>{c.text}</div>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                <input style={{...inp,fontSize:'0.88rem',padding:'8px 12px',flex:1}} placeholder="Reply…" value={cmtInputs[p.id]||''} onChange={e=>setCmtInputs(x=>({...x,[p.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&submitCmt(p.id)} />
                <button onClick={()=>submitCmt(p.id)} style={{padding:'8px 14px',background:C.accentBright,color:'white',border:'none',borderRadius:'10px',fontWeight:700,cursor:'pointer'}}>发</button>
              </div>
            </div>
          )}
        </div>
        {/* vote col */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',minWidth:'30px'}}>
          <button onClick={()=>vote(p,'up')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='up'?C.upvote:C.muted,padding:'2px'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={mv==='up'?C.upvote:'none'} stroke={mv==='up'?C.upvote:'currentColor'} strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <span style={{fontWeight:700,fontSize:'0.95rem',color:score>0?C.upvote:score<0?C.red:C.muted}}>{score}</span>
          <button onClick={()=>vote(p,'down')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='down'?C.red:C.muted,padding:'2px'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={mv==='down'?C.red:'none'} stroke={mv==='down'?C.red:'currentColor'} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    )
  }

  // ── AUTH ──
  if (!session||!profile) return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:'20px',fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
      <div style={{fontFamily:'Nunito,sans-serif',fontWeight:900,fontSize:'2.8rem',color:C.accentBright,letterSpacing:'-1px'}}>fizz.</div>
      <div style={{width:'100%',maxWidth:'360px'}}>
        <div style={{display:'flex',background:C.surface,borderRadius:'14px',padding:'4px',marginBottom:'20px'}}>
          {(['login','register'] as const).map(t=>(
            <div key={t} onClick={()=>setAuthTab(t)} style={{flex:1,padding:'10px',textAlign:'center',borderRadius:'12px',cursor:'pointer',fontWeight:700,fontSize:'0.92rem',background:authTab===t?C.accentBright:'transparent',color:authTab===t?'white':C.muted,transition:'all .2s'}}>
              {t==='login'?'登录':'注册'}
            </div>
          ))}
        </div>
        {authTab==='register' && <>
          <div style={{marginBottom:'12px'}}>
            <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'.5px'}}>昵称</label>
            <input style={inp} placeholder="你的名字" value={af.username} onChange={e=>setAf(f=>({...f,username:e.target.value}))} />
          </div>
          <div style={{marginBottom:'12px'}}>
            <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'.5px'}}>学校</label>
            <select style={{...inp,cursor:'pointer'}} value={af.school} onChange={e=>setAf(f=>({...f,school:e.target.value}))}>
              {SCHOOLS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </>}
        <div style={{marginBottom:'12px'}}>
          <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'.5px'}}>邮箱</label>
          <input style={inp} type="email" placeholder="you@university.edu" value={af.email} onChange={e=>setAf(f=>({...f,email:e.target.value}))} />
        </div>
        <div style={{marginBottom:'20px'}}>
          <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'.5px'}}>密码</label>
          <input style={inp} type="password" placeholder="至少6位" value={af.pwd} onChange={e=>setAf(f=>({...f,pwd:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(authTab==='login'?handleLogin():handleRegister())} />
        </div>
        {authErr && <div style={{background:resolved==='dark'?'rgba(247,111,111,.15)':'#fef2f2',border:`1px solid ${C.red}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'14px',fontSize:'0.88rem',color:C.red}}>{authErr}</div>}
        <button onClick={authTab==='login'?handleLogin:handleRegister} disabled={authLoading} style={{width:'100%',padding:'14px',background:C.accentBright,color:'white',border:'none',borderRadius:'14px',fontWeight:700,fontSize:'1rem',cursor:'pointer',opacity:authLoading?.6:1}}>
          {authLoading?'处理中…':authTab==='login'?'登录':'创建账号'}
        </button>
        <div style={{textAlign:'center',marginTop:'14px',fontSize:'0.85rem',color:C.muted}}>
          {authTab==='login'?'还没有账号？':'已有账号？'}
          <span onClick={()=>setAuthTab(authTab==='login'?'register':'login')} style={{color:C.accentBright,cursor:'pointer',marginLeft:'4px'}}>
            {authTab==='login'?'注册':'登录'}
          </span>
        </div>
      </div>
    </div>
  )

  const mktFiltered = mktCat==='all' ? listings : listings.filter(l=>l.category===mktCat)
  const topBar = (title: React.ReactNode, right?: React.ReactNode) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:`1px solid ${C.border}`}}>
      <div style={{fontWeight:700,fontSize:'1.05rem',display:'flex',alignItems:'center',gap:'8px'}}>{title}</div>
      {right}
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'DM Sans',-apple-system,sans-serif",maxWidth:'430px',margin:'0 auto',position:'relative',paddingBottom:'64px'}}>

      {/* ─── FEED ─── */}
      {page==='feed' && <>
        {topBar(
          <><div style={{width:'32px',height:'32px',borderRadius:'50%',background:C.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem'}}>🎓</div>{profile.school}</>,
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'0.78rem',color:C.green,fontWeight:700,display:'flex',alignItems:'center',gap:'4px'}}>
              <span style={{width:'7px',height:'7px',borderRadius:'50%',background:C.green,display:'inline-block'}}/>
              {online} online
            </span>
            <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:0}}>⚙️</button>
          </div>
        )}
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.bg,position:'sticky',top:'53px',zIndex:99}}>
          {(['Top',"Fizzin'",'New'] as const).map(t=>(
            <div key={t} onClick={()=>setFeedTab(t)} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:feedTab===t?700:400,color:feedTab===t?C.text:C.muted,borderBottom:feedTab===t?`2px solid ${C.text}`:'2px solid transparent',cursor:'pointer',transition:'all .15s'}}>
              {t}
            </div>
          ))}
        </div>
        {sorted().map(p=><PostCard key={p.id} p={p}/>)}
        {posts.length===0&&<div style={{textAlign:'center',padding:'60px',color:C.muted}}>还没有帖子，来发第一条吧！</div>}
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'72px',right:'50%',transform:'translateX(calc(50% - 16px + 215px - 16px)',background:C.accent,color:'white',border:'none',borderRadius:'24px',padding:'12px 22px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:`0 4px 16px ${C.shadow}`,zIndex:150}}>
          + Post
        </button>
      </>}

      {/* ─── MESSAGES ─── */}
      {page==='messages' && <>
        {topBar('Messages')}
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:700,borderBottom:`2px solid ${C.text}`,cursor:'pointer'}}>Posts</div>
          <div style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:400,color:C.muted,borderBottom:'2px solid transparent',cursor:'pointer'}}>Marketplace</div>
        </div>
        {!chatTarget ? (
          convos.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',gap:'16px',color:C.muted}}>
              <div style={{fontSize:'3.5rem'}}>✈️</div>
              <div style={{fontWeight:700,fontSize:'1.1rem',color:C.text}}>No messages yet.</div>
              <div style={{fontSize:'0.9rem',textAlign:'center',lineHeight:'1.5'}}>Start a conversation. Messages you send or receive will appear here.</div>
            </div>
          ) : convos.map(({user:u,lastMsg})=>(
            <div key={u.id} onClick={()=>openChat(u)} style={{display:'flex',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',alignItems:'center'}}>
              <div style={{width:'46px',height:'46px',borderRadius:'50%',background:u.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',flexShrink:0,fontSize:'0.95rem'}}>{u.avatar_initials}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.95rem'}}>{u.username}</div>
                <div style={{fontSize:'0.85rem',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lastMsg?.text||'开始对话'}</div>
              </div>
              {lastMsg&&<div style={{fontSize:'0.75rem',color:C.muted,flexShrink:0}}>{ago(lastMsg.created_at)}</div>}
            </div>
          ))
        ) : (
          <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`}}>
              <button onClick={()=>setChatTarget(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.text,fontSize:'1.3rem',padding:0}}>←</button>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:chatTarget.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:'0.88rem'}}>{chatTarget.avatar_initials}</div>
              <div style={{fontWeight:700}}>{chatTarget.username}</div>
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {chatMsgs.map(m=>{
                const mine = m.from_user_id===profile.id
                return (
                  <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'76%'}}>
                    <div style={{padding:'10px 14px',borderRadius:'18px',fontSize:'0.92rem',lineHeight:'1.4',background:mine?C.accentBright:(resolved==='light'?'#e5e7eb':C.surface2),color:mine?'white':C.text,borderBottomRightRadius:mine?'4px':'18px',borderBottomLeftRadius:mine?'18px':'4px'}}>{m.text}</div>
                    <div style={{fontSize:'0.7rem',color:C.muted,marginTop:'3px',textAlign:mine?'right':'left'}}>{ago(m.created_at)}</div>
                  </div>
                )
              })}
              {chatMsgs.length===0&&<div style={{color:C.muted,textAlign:'center',margin:'auto'}}>发个消息打个招呼 👋</div>}
            </div>
            <div style={{display:'flex',gap:'8px',padding:'12px 16px',borderTop:`1px solid ${C.border}`}}>
              <input style={{...inp,fontSize:'0.9rem',flex:1}} placeholder="Message…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} />
              <button onClick={sendMsg} style={{padding:'10px 16px',background:C.accentBright,color:'white',border:'none',borderRadius:'12px',fontWeight:700,cursor:'pointer'}}>发</button>
            </div>
          </div>
        )}
      </>}

      {/* ─── SEARCH ─── */}
      {page==='search' && <>
        {topBar('Search')}
        <div style={{display:'flex',alignItems:'center',gap:'10px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'24px',padding:'10px 16px',margin:'12px 16px'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:'0.95rem',outline:'none',fontFamily:'inherit'}} placeholder="Search Fizz" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        </div>
        {searchRes.map(p=><PostCard key={p.id} p={p}/>)}
        {searchQ&&searchRes.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px'}}>没有找到结果</div>}
        {!searchQ && <div style={{padding:'0 16px'}}>
          {['#期末备考','#食堂推荐','#校园生活','#选课攻略','#考研经验','#社团招新'].map((t,i)=>(
            <div key={t} onClick={()=>setSearchQ(t)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
              <span style={{color:C.muted,fontWeight:700,width:'22px',fontSize:'0.88rem'}}>{i+1}</span>
              <span style={{fontWeight:600,fontSize:'0.95rem'}}>{t}</span>
            </div>
          ))}
        </div>}
      </>}

      {/* ─── MARKET ─── */}
      {page==='market' && <>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'20px',padding:'8px 14px'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{color:C.muted,fontSize:'0.88rem'}}>Search listings…</span>
          </div>
          <div style={{fontSize:'1.3rem',cursor:'pointer'}}>🔖</div>
          <div style={{fontSize:'1.3rem',cursor:'pointer'}}>🏷️</div>
        </div>
        <div style={{display:'flex',gap:'8px',padding:'10px 12px',overflowX:'auto',borderBottom:`1px solid ${C.border}`}}>
          {[['all','All'],['clothes','Clothes'],['electronics','Electronics'],['books','Books'],['other','Other']].map(([c,l])=>(
            <div key={c} onClick={()=>setMktCat(c)} style={{flexShrink:0,padding:'6px 14px',borderRadius:'20px',border:`1px solid ${mktCat===c?C.accentBright:C.border}`,background:mktCat===c?(resolved==='dark'?'rgba(37,99,235,.2)':'#eff6ff'):'transparent',color:mktCat===c?C.accentBright:C.muted,fontSize:'0.85rem',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
              {l}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px',background:C.border}}>
          {mktFiltered.map(l=>(
            <div key={l.id} style={{background:C.bg,cursor:'pointer'}}>
              <div style={{height:'180px',background:C.surface,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                {l.images&&l.images.length>0
                  ? <img src={l.images[0]} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  : <span style={{fontSize:'2.5rem'}}>{l.emoji||'📦'}</span>
                }
                {l.is_sold&&<div style={{position:'absolute',top:'8px',left:'8px',background:'rgba(0,0,0,0.75)',color:'white',borderRadius:'6px',padding:'3px 8px',fontSize:'0.72rem',fontWeight:700}}>SOLD</div>}
              </div>
              <div style={{padding:'10px 10px 14px'}}>
                <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:'0.95rem'}}>¥{l.price}</span>
                  {l.description&&<span style={{fontSize:'0.75rem',color:C.muted}}>{l.description.slice(0,8)}</span>}
                </div>
                {l.user_id===profile.id&&<button onClick={()=>sb.from('listings').update({is_sold:true}).eq('id',l.id).then(()=>loadListings())} style={{marginTop:'6px',width:'100%',padding:'5px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:'6px',color:C.muted,fontSize:'0.75rem',cursor:'pointer',fontFamily:'inherit'}}>Mark Sold</button>}
              </div>
            </div>
          ))}
        </div>
        {mktFiltered.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px'}}>暂无商品</div>}
        <button onClick={()=>setShowListing(true)} style={{position:'fixed',bottom:'72px',right:'50%',transform:'translateX(calc(50% - 16px + 215px - 16px)',background:C.accent,color:'white',border:'none',borderRadius:'24px',padding:'12px 22px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:`0 4px 16px ${C.shadow}`,zIndex:150}}>
          + List
        </button>
      </>}

      {/* ─── PROFILE ─── */}
      {page==='profile' && <>
        {topBar(<>My Profile <span style={{color:C.muted,fontSize:'0.9rem'}}>▾</span></>, <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem'}}>⚙️</button>)}
        <div style={{display:'flex',margin:'16px',background:C.surface,borderRadius:'16px',overflow:'hidden',border:`1px solid ${C.border}`}}>
          <div style={{flex:1,padding:'16px',textAlign:'center',borderRight:`1px solid ${C.border}`}}>
            <div style={{fontSize:'1.4rem',marginBottom:'2px'}}>❤️</div>
            <div style={{fontWeight:700,fontSize:'1.4rem'}}>{profile.total_fizzups}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Karma</div>
          </div>
          <div style={{flex:1,padding:'16px',textAlign:'center'}}>
            <div style={{fontSize:'1.4rem',marginBottom:'2px'}}>🏆</div>
            <div style={{fontWeight:700,fontSize:'1.4rem'}}>#{posts.filter(p=>p.user_id===profile.id).length||'—'}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Posts</div>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
          {['Posts','Comments','Saved'].map((t,i)=>(
            <div key={t} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.92rem',fontWeight:i===0?700:400,color:i===0?C.text:C.muted,borderBottom:i===0?`2px solid ${C.text}`:'2px solid transparent',cursor:'pointer'}}>{t}</div>
          ))}
        </div>
        {posts.filter(p=>p.user_id===profile.id).map(p=><PostCard key={p.id} p={p}/>)}
        {posts.every(p=>p.user_id!==profile.id)&&(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
            <div style={{fontSize:'3rem',opacity:.4}}>✏️</div>
            <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>No posts yet.</div>
            <div style={{fontSize:'0.88rem',textAlign:'center'}}>Write a post and you'll see it here.</div>
          </div>
        )}
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'72px',right:'50%',transform:'translateX(calc(50% - 16px + 215px - 16px)',background:C.accent,color:'white',border:'none',borderRadius:'24px',padding:'12px 22px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:`0 4px 16px ${C.shadow}`,zIndex:150}}>
          + Post
        </button>
      </>}

      {/* ─── BOTTOM NAV ─── */}
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:C.bg,borderTop:`1px solid ${C.border}`,display:'flex',zIndex:200,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {[
          {id:'feed',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>},
          {id:'messages',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,badge:unread},
          {id:'search',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>},
          {id:'market',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>},
          {id:'profile',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>},
        ].map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id as any)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 0 8px',cursor:'pointer',border:'none',background:'none',position:'relative'}}>
            <div style={{position:'relative'}}>
              {n.icon(page===n.id)}
              {(n as any).badge ? <span style={{position:'absolute',top:'-4px',right:'-6px',background:'#ef4444',color:'white',borderRadius:'50%',width:'16px',height:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.6rem',fontWeight:700}}>{(n as any).badge}</span> : null}
            </div>
          </button>
        ))}
      </nav>

      {/* ─── POST MODAL ─── */}
      {showPost && (
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowPost(false)}>
          <div style={sheet}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>setShowPost(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontSize:'0.95rem',fontFamily:'inherit'}}>取消</button>
              <div style={{fontWeight:700}}>New Post</div>
              <button onClick={submitPost} disabled={posting||!postText.trim()} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',opacity:(!postText.trim()||posting)?.5:1,fontFamily:'inherit'}}>
                {posting?'…':'Post'}
              </button>
            </div>
            <div style={{display:'flex',gap:'12px',marginBottom:'16px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'50%',background:postAnon?avColor(profile.id):profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700,flexShrink:0}}>
                {postAnon?anonEmoji(profile.id):profile.avatar_initials}
              </div>
              <textarea style={{...inp,minHeight:'100px',resize:'none',border:'none',background:'transparent',padding:0,fontSize:'1rem',lineHeight:'1.5'}} placeholder="What's on your mind?" value={postText} onChange={e=>setPostText(e.target.value)} autoFocus />
            </div>
            {postPrevs.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'12px',borderRadius:'12px',overflow:'hidden'}}>{postPrevs.map((p,i)=><img key={i} src={p} alt="" style={{width:'100%',height:'120px',objectFit:'cover'}}/>)}</div>}
            <div style={{display:'flex',alignItems:'center',paddingTop:'12px',borderTop:`1px solid ${C.border}`}}>
              <label style={{display:'flex',alignItems:'center',gap:'7px',cursor:'pointer',fontSize:'0.9rem',fontWeight:600,color:postAnon?C.accentBright:C.muted}}>
                <input type="checkbox" checked={postAnon} onChange={e=>setPostAnon(e.target.checked)} style={{accentColor:C.accentBright,width:'16px',height:'16px',cursor:'pointer'}} />
                匿名发布
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ─── LISTING MODAL ─── */}
      {showListing && (
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowListing(false)}>
          <div style={sheet}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>setShowListing(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>取消</button>
              <div style={{fontWeight:700}}>发布商品</div>
              <button onClick={submitListing} disabled={lUploading||!lf.title} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',opacity:(!lf.title||lUploading)?.5:1,fontFamily:'inherit'}}>
                {lUploading?'上传中…':'发布'}
              </button>
            </div>
            {/* image upload area */}
            <label>
              <div style={{border:`2px dashed ${C.border}`,borderRadius:'14px',padding:'16px',marginBottom:'14px',cursor:'pointer',minHeight:'100px',display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:'8px'}}>
                {lPreviews.length>0 ? (
                  <>
                    {lPreviews.map((p,i)=><img key={i} src={p} alt="" style={{width:'72px',height:'72px',objectFit:'cover',borderRadius:'10px'}}/>)}
                    <div style={{width:'72px',height:'72px',background:C.surface2,borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',color:C.muted}}>+</div>
                  </>
                ) : (
                  <div style={{textAlign:'center',color:C.muted}}>
                    <div style={{fontSize:'2rem',marginBottom:'6px'}}>📸</div>
                    <div style={{fontSize:'0.88rem',fontWeight:600}}>点击添加照片</div>
                    <div style={{fontSize:'0.78rem',marginTop:'2px'}}>最多8张，支持多选</div>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickFiles} />
            </label>
            {/* fields */}
            {[['title','商品名称 *','例：Vintage 连衣裙'],['price','价格（元）','0'],['desc','描述','成色、尺码等…']].map(([k,l,ph])=>(
              <div key={k} style={{marginBottom:'12px'}}>
                <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'.5px'}}>{l}</label>
                <input style={inp} type={k==='price'?'number':'text'} placeholder={ph} value={(lf as any)[k]} onChange={e=>setLf(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.5px'}}>分类</label>
              <select style={{...inp,cursor:'pointer'}} value={lf.cat} onChange={e=>setLf(f=>({...f,cat:e.target.value}))}>
                <option value="clothes">👕 服装</option>
                <option value="electronics">💻 电子</option>
                <option value="books">📚 教材</option>
                <option value="other">🎁 其他</option>
              </select>
            </div>
            <div style={{marginBottom:'8px'}}>
              <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.5px'}}>成色</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {['New','Like New','Good','Fair'].map(c=>(
                  <div key={c} onClick={()=>setLf(f=>({...f,condition:c}))} style={{padding:'7px 16px',borderRadius:'20px',border:`1px solid ${lf.condition===c?C.accentBright:C.border}`,background:lf.condition===c?(resolved==='dark'?'rgba(37,99,235,.2)':'#eff6ff'):'transparent',color:lf.condition===c?C.accentBright:C.muted,fontSize:'0.85rem',fontWeight:600,cursor:'pointer'}}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SETTINGS MODAL ─── */}
      {showSettings && (
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowSettings(false)}>
          <div style={sheet}>
            <div style={{fontWeight:700,fontSize:'1.1rem',marginBottom:'20px'}}>设置</div>
            <div style={{marginBottom:'24px'}}>
              <div style={{fontWeight:600,marginBottom:'12px',color:C.muted,fontSize:'0.82rem',textTransform:'uppercase',letterSpacing:'.5px'}}>显示主题</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                {([['light','☀️','浅色'],['dark','🌙','深色'],['auto','🤖','跟随系统']] as const).map(([t,icon,label])=>(
                  <div key={t} onClick={()=>setTheme(t)} style={{padding:'14px 8px',textAlign:'center',borderRadius:'14px',border:`2px solid ${theme===t?C.accentBright:C.border}`,background:theme===t?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',cursor:'pointer'}}>
                    <div style={{fontSize:'1.5rem',marginBottom:'4px'}}>{icon}</div>
                    <div style={{fontSize:'0.82rem',fontWeight:700,color:theme===t?C.accentBright:C.text}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:'20px',padding:'14px',background:C.surface,borderRadius:'14px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'46px',height:'46px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',fontSize:'0.95rem'}}>{profile.avatar_initials}</div>
              <div>
                <div style={{fontWeight:700}}>{profile.username}</div>
                <div style={{fontSize:'0.85rem',color:C.muted}}>{profile.school}</div>
              </div>
            </div>
            <button onClick={()=>sb.auth.signOut()} style={{width:'100%',padding:'14px',background:'transparent',border:`1px solid ${C.red}`,borderRadius:'14px',color:C.red,fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'inherit'}}>
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
