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
const AV_LOGOS = ['/av1.jpg','/av2.jpg','/av3.jpg']
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
function avImg(uid: string) { return AV_LOGOS[uid.charCodeAt(0) % AV_LOGOS.length] }

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
  const [showRepost, setShowRepost] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)

  const [repostTarget, setRepostTarget] = useState(null)
  const [repostText, setRepostText] = useState('')
  const [repostAnon, setRepostAnon] = useState(true)
  const [reposting, setReposting] = useState(false)
  const [showDm,setShowDm]=useState(false)
  const [dmTarget,setDmTarget]=useState<Post|null>(null)
  const [dmMsg,setDmMsg]=useState('')
  const [postComments,setPostComments]=useState<any[]>([])
  const [cmtInput,setCmtInput]=useState('')
  const [commentVotes, setCommentVotes] = useState({})
  const [online, setOnline] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState<Post[]>([])
  const [openCmts, setOpenCmts] = useState<Record<string,Comment[]>>({})
  const [cmtInputs, setCmtInputs] = useState<Record<string,string>>({})
  const [mktCat, setMktCat] = useState('all')
  const [userRank, setUserRank] = useState(0)
  const [replyToComment, setReplyToComment] = useState<any>(null)
  const [cmtImgs, setCmtImgs] = useState<File[]>([])
  const [cmtPrevs, setCmtPrevs] = useState<string[]>([])
  const [repostIsComment, setRepostIsComment] = useState(false)
  const [repostOriginalPostText, setRepostOriginalPostText] = useState('')
  const [selectedMsg, setSelectedMsg] = useState<any>(null)
  const [showChatMenu, setShowChatMenu] = useState(false)

  const [showPost, setShowPost] = useState(false)
  const [postText, setPostText] = useState('')
  const [postAnon, setPostAnon] = useState(true)
  const [posting, setPosting] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(true)
  const lastScrollY = useRef(0)
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    sb.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) loadProfile(data.session.user.id) })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) loadProfile(s.user.id); else setProfile(null) })
    const onScroll = () => {
      const y = window.scrollY
      setFabExpanded(y < 60 || y < lastScrollY.current)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { subscription.unsubscribe(); window.removeEventListener('scroll', onScroll) }
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
    // Batch fetch original posts for any reposts
    const repostIds = data.filter((p:any) => p.repost_of_id).map((p:any) => p.repost_of_id)
    let repostMap: Record<string,any> = {}
    if (repostIds.length > 0) {
      const { data: origPosts } = await sb.from('posts').select('*, profiles(*)').in('id', repostIds)
      origPosts?.forEach((p:any) => { repostMap[p.id] = p })
    }
    const withReposts = data.map((p:any) => ({...p, repost_of: p.repost_of_id ? repostMap[p.repost_of_id] : null}))
    if (profile) {
      const { data: votes } = await sb.from('fizzups').select('post_id,vote_type').eq('user_id',profile.id)
      const vm: Record<string,string> = {}; votes?.forEach((v:any)=>vm[v.post_id]=v.vote_type)
      setPosts(withReposts.map((p:any)=>({...p,my_vote:vm[p.id]||null})))
      // Reload profile so karma (total_fizzups) stays current
      const { data: freshProfile } = await sb.from('profiles').select('*').eq('id', profile.id).single()
      if (freshProfile) setProfile(freshProfile)
    } else setPosts(withReposts)
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
    if (mv===type) {
      // undo vote — trigger handles DB count
      await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id)
    } else {
      // remove old vote if exists
      if (mv) {
        await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id)
      }
      // add new vote — trigger handles DB count + total_fizzups
      await sb.from('fizzups').insert({post_id:post.id,user_id:profile.id,vote_type:type})
    }
    const newMyVote = mv===type ? null : type
    let newLikes = post.likes_count
    let newDislikes = post.dislikes_count||0
    if(type==='up'){
      if(mv==='up') newLikes--
      else { newLikes++; if(mv==='down') newDislikes-- }
    } else {
      if(mv==='down') newDislikes--
      else { newDislikes++; if(mv==='up') newLikes-- }
    }
    newLikes = Math.max(0, newLikes)
    newDislikes = Math.max(0, newDislikes)
    // optimistic update - update UI immediately
    setPosts(ps=>ps.map(p=>p.id===post.id?{...p,my_vote:newMyVote,likes_count:newLikes,dislikes_count:newDislikes}:p))
    if(selectedPost&&selectedPost.id===post.id){
      setSelectedPost(s=>s?{...s,my_vote:newMyVote,likes_count:newLikes,dislikes_count:newDislikes}:null)
    }
    // sync with db after 1 second
    setTimeout(()=>loadPosts(),1000)
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
    const files=Array.from(e.target.files||[]).slice(0,4) as File[]
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

  async function openPost(p:Post){
    setSelectedPost(p)
    setCmtInput('')
    const{data}=await sb.from('comments').select('*,profiles(*)').eq('post_id',p.id).order('created_at')
    setPostComments(data||[])
    if(data&&data.length>0&&profile){
      const ids=data.map((c:any)=>c.id)
      const{data:cv}=await sb.from('comment_votes').select('comment_id,vote_type').eq('user_id',profile.id).in('comment_id',ids)
      const vm:Record<string,string>={}
      cv?.forEach((v:any)=>vm[v.comment_id]=v.vote_type)
      setCommentVotes(vm)
    }
  }

  async function submitNewCmt(){
    if(!profile||(!cmtInput.trim()&&cmtImgs.length===0)||!selectedPost)return
    // Upload comment images if any
    const urls:string[]=[]
    for(const file of cmtImgs){
      const path=profile.id+'/cmt_'+Date.now()+'_'+file.name
      const res=await sb.storage.from('post-images').upload(path,file,{upsert:true})
      if(!res.error){const{data:u}=sb.storage.from('post-images').getPublicUrl(path);urls.push(u.publicUrl)}
    }
    await sb.from('comments').insert({
      post_id:selectedPost.id,
      user_id:profile.id,
      text:cmtInput.trim(),
      parent_id:replyToComment?.id||null,
      images:urls
    })
    setCmtInput('');setCmtImgs([]);setCmtPrevs([]);setReplyToComment(null)
    const{data}=await sb.from('comments').select('*,profiles(*)').eq('post_id',selectedPost.id).order('created_at')
    if(data){
      // Preserve local vote counts (DB may lag if triggers haven't run yet)
      const merged=data.map((c:any)=>{
        const existing=postComments.find((x:any)=>x.id===c.id)
        return existing?{...c,likes_count:existing.likes_count,dislikes_count:existing.dislikes_count}:c
      })
      setPostComments(merged)
    }
    loadPosts()
  }
  function pickCmtImgs(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files||[]).slice(0,4) as File[]
    setCmtImgs(files);setCmtPrevs(files.map(f=>URL.createObjectURL(f)))
  }

  async function voteComment(c:any,type:'up'|'down'){
    if(!profile)return
    const mv=commentVotes[c.id]
    // Optimistic update
    let nl=(c.likes_count||0),nd=(c.dislikes_count||0)
    if(type==='up'){if(mv==='up')nl--;else{nl++;if(mv==='down')nd--}}
    else{if(mv==='down')nd--;else{nd++;if(mv==='up')nl--}}
    nl=Math.max(0,nl);nd=Math.max(0,nd)
    const nv=mv===type?null:type
    setCommentVotes(v=>({...v,[c.id]:nv}))
    setPostComments(cs=>cs.map((x:any)=>x.id===c.id?{...x,likes_count:nl,dislikes_count:nd}:x))
    // DB update — trigger handles counts
    if(mv===type){
      await sb.from('comment_votes').delete().eq('comment_id',c.id).eq('user_id',profile.id)
    } else {
      if(mv)await sb.from('comment_votes').delete().eq('comment_id',c.id).eq('user_id',profile.id)
      await sb.from('comment_votes').insert({comment_id:c.id,user_id:profile.id,vote_type:type})
    }
  }

  async function submitRepost(){
    if(!profile||!repostTarget)return
    setReposting(true)
    // Insert as a real post with repost_of_id so it shows in feed
    await sb.from('posts').insert({
      user_id:profile.id,
      text:repostText.trim()||'',
      is_anon:repostAnon,
      school:profile.school,
      repost_of_id:repostTarget.id
    })
    // Increment reposts_count via security definer RPC (bypasses RLS)
    await sb.rpc('increment_reposts_count',{post_id:repostTarget.id})
    setRepostText('');setShowRepost(false);setReposting(false);setRepostTarget(null);setRepostIsComment(false);setRepostOriginalPostText('')
    loadPosts()
  }

  async function sendDm(){
    if(!profile||!dmTarget||!dmMsg.trim())return
    await sb.from('messages').insert({from_user_id:profile.id,to_user_id:dmTarget.user_id,text:dmMsg.trim()})
    setDmMsg('');setShowDm(false);setDmTarget(null)
    loadConvos()
  }

  async function loadConvos() {
    if (!profile) return
    // Only load users who have actually exchanged messages with current user
    const { data: msgs } = await sb.from('messages')
      .select('from_user_id,to_user_id')
      .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
    if (!msgs || msgs.length === 0) { setConvos([]); return }
    const partnerIds = Array.from(new Set(msgs.flatMap((m:any) =>
      [m.from_user_id, m.to_user_id].filter((id:string) => id !== profile.id)
    )))
    if (partnerIds.length === 0) { setConvos([]); return }
    const { data: users } = await sb.from('profiles').select('*').in('id', partnerIds)
    if (!users) return
    const c = await Promise.all(users.map(async (u:any)=>{
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
  async function recallMsg(msg: any) {
    if (!profile||msg.from_user_id!==profile.id) return
    const age = Date.now() - new Date(msg.created_at).getTime()
    if (age > 2*60*1000) return // older than 2 min
    await sb.from('messages').delete().eq('id', msg.id)
    setChatMsgs(ms=>ms.filter(m=>m.id!==msg.id))
    setSelectedMsg(null)
  }
  async function clearChat() {
    if (!profile||!chatTarget) return
    if (!confirm('确认删除与该用户的所有聊天记录？')) return
    await sb.from('messages').delete()
      .eq('from_user_id', profile.id)
      .eq('to_user_id', chatTarget.id)
    setChatMsgs(ms=>ms.filter(m=>m.from_user_id!==profile.id))
    setShowChatMenu(false)
    loadConvos()
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
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:'12px 16px', display:'flex', gap:'12px', background:C.bg }}>
        {/* avatar */}
        <img src={avImg(p.user_id)} alt="" style={{ width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
        {/* main */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px',flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:'0.92rem',color:C.text}}>{name}</span>
            <span style={{color:C.muted,fontSize:'0.8rem'}}>{ago(p.created_at)}</span>
            {p.is_hot && <span style={{background:'#fef3c7',color:'#d97706',borderRadius:'4px',padding:'1px 6px',fontSize:'0.68rem',fontWeight:700}}>🔥 HOT</span>}
          </div>
          <div onClick={()=>openPost(p)} style={{cursor:'pointer',fontSize:'0.95rem',lineHeight:'1.55',color:C.text,wordBreak:'break-word'}}>{p.text}</div>
          {p.images&&p.images.length>0&&<div style={{display:'grid',gridTemplateColumns:p.images.length===1?'1fr':'1fr 1fr',gap:'4px',marginTop:'10px',borderRadius:'12px',overflow:'hidden'}}>{p.images.slice(0,4).map((url,i)=><img key={i} src={url} alt="" style={{width:'100%',height:p.images.length===1?'220px':'130px',objectFit:'cover'}}/>)}</div>}
          {(p as any).repost_of&&(
            <div style={{border:`1px solid ${C.border}`,borderRadius:'12px',padding:'10px 12px',marginTop:'10px',background:C.surface}} onClick={()=>openPost((p as any).repost_of)}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                <div style={{width:'20px',height:'20px',borderRadius:'50%',background:(p as any).repost_of.is_anon?avColor((p as any).repost_of.user_id):((p as any).repost_of.profiles?.avatar_color||'#888'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.55rem',color:'white',fontWeight:700}}>{(p as any).repost_of.is_anon?anonEmoji((p as any).repost_of.user_id):((p as any).repost_of.profiles?.avatar_initials||'?')}</div>
                <span style={{fontSize:'0.78rem',fontWeight:600,color:C.muted}}>{(p as any).repost_of.is_anon?'Anonymous':((p as any).repost_of.profiles?.username||'User')}</span>
                <span style={{fontSize:'0.72rem',color:C.muted}}>{ago((p as any).repost_of.created_at)}</span>
              </div>
              <div style={{fontSize:'0.88rem',color:C.text,lineHeight:'1.45'}}>{(p as any).repost_of.text}</div>
              {(p as any).repost_of.images&&(p as any).repost_of.images.length>0&&<img src={(p as any).repost_of.images[0]} alt="" style={{width:'100%',maxHeight:'120px',objectFit:'cover',borderRadius:'8px',marginTop:'6px'}}/>}
            </div>
          )}
          {/* action row */}
          <div style={{display:'flex',alignItems:'center',gap:'14px',marginTop:'10px',color:C.muted}}>
            <button onClick={()=>openPost(p)} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {p.comments_count}
            </button>
            <button onClick={()=>{setRepostTarget(p);setShowRepost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              {(p as any).reposts_count||0}
            </button>
            <button onClick={()=>{setDmTarget(p);setShowDm(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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
      <div style={{fontFamily:'Nunito,sans-serif',fontWeight:900,fontSize:'2.8rem',color:C.accentBright,letterSpacing:'-1px'}}>heha</div>
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
    <div style={{minHeight:'100dvh',background:C.bg,color:C.text,fontFamily:"'DM Sans',-apple-system,sans-serif",maxWidth:'430px',margin:'0 auto',position:'relative',paddingBottom:'72px'}}>

      {/* ─── FEED ─── */}
      {page==='feed' && <>
        {topBar(
          <><img src="/av1.jpg" alt="" style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover'}}/>{profile.school}</>,
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
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'80px',right:'16px',background:'linear-gradient(135deg,#7c3aed,#2563eb)',color:'white',border:'none',borderRadius:'28px',padding:'13px 18px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:fabExpanded?'6px':'0',boxShadow:'0 4px 20px rgba(124,58,237,0.45)',zIndex:150,transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',whiteSpace:'nowrap'}}>
          <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0}}>＋</span>
          <span style={{maxWidth:fabExpanded?'50px':'0',overflow:'hidden',opacity:fabExpanded?1:0,transition:'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',whiteSpace:'nowrap'}}>Post</span>
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
              <img src={avImg(u.id)} alt="" style={{width:'46px',height:'46px',borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.95rem'}}>Anonymous</div>
                <div style={{fontSize:'0.85rem',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lastMsg?.text||'开始对话'}</div>
              </div>
              {lastMsg&&<div style={{fontSize:'0.75rem',color:C.muted,flexShrink:0}}>{ago(lastMsg.created_at)}</div>}
            </div>
          ))
        ) : (
          <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,position:'relative' as const}}>
              <button onClick={()=>setChatTarget(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.text,fontSize:'1.3rem',padding:0}}>←</button>
              <img src={avImg(chatTarget.id)} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              <div style={{fontWeight:700,flex:1}}>Anonymous</div>
              <button onClick={()=>setShowChatMenu(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'1.2rem',padding:'4px'}}>•••</button>
              {showChatMenu&&(
                <div style={{position:'absolute' as const,top:'52px',right:'12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'4px',zIndex:600,boxShadow:`0 4px 16px ${C.shadow}`,minWidth:'150px'}}>
                  <button onClick={clearChat} style={{width:'100%',padding:'10px 14px',background:'none',border:'none',color:C.red,cursor:'pointer',textAlign:'left' as const,fontFamily:'inherit',fontSize:'0.9rem',borderRadius:'8px'}}>🗑 删除聊天记录</button>
                </div>
              )}
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}} onClick={()=>{setSelectedMsg(null);setShowChatMenu(false)}}>
              {chatMsgs.map(m=>{
                const mine = m.from_user_id===profile.id
                const canRecall = mine && (Date.now()-new Date(m.created_at).getTime()) < 2*60*1000
                const isSel = selectedMsg?.id===m.id
                return (
                  <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'76%'}}>
                    <div onClick={e=>{e.stopPropagation();mine&&setSelectedMsg(isSel?null:m)}} style={{padding:'10px 14px',borderRadius:'18px',fontSize:'0.92rem',lineHeight:'1.4',background:mine?C.accentBright:(resolved==='light'?'#e5e7eb':C.surface2),color:mine?'white':C.text,borderBottomRightRadius:mine?'4px':'18px',borderBottomLeftRadius:mine?'18px':'4px',cursor:mine?'pointer':'default'}}>{m.text}</div>
                    <div style={{fontSize:'0.7rem',color:C.muted,marginTop:'3px',textAlign:mine?'right':'left'}}>{ago(m.created_at)}</div>
                    {isSel&&mine&&(
                      <div style={{display:'flex',justifyContent:'flex-end',marginTop:'4px',gap:'6px'}}>
                        {canRecall&&<button onClick={()=>recallMsg(m)} style={{background:C.red,color:'white',border:'none',borderRadius:'8px',padding:'4px 10px',fontSize:'0.75rem',cursor:'pointer',fontFamily:'inherit'}}>撤回</button>}
                        {!canRecall&&<span style={{fontSize:'0.72rem',color:C.muted}}>超过2分钟无法撤回</span>}
                      </div>
                    )}
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
          <input style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:'0.95rem',outline:'none',fontFamily:'inherit'}} placeholder="Search heha" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        </div>
        {searchRes.map(p=><PostCard key={p.id} p={p}/>)}
        {searchQ&&searchRes.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px'}}>没有找到结果</div>}
        {!searchQ && <div style={{padding:'0 16px'}}>
          <div style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'.5px',padding:'12px 0 6px'}}>Trending in your school</div>
          {(() => {
            // Extract hashtags from recent posts, fall back to post snippets
            const tagCount: Record<string,number> = {}
            posts.slice(0,80).forEach(p => {
              const matches = p.text.match(/#[\w\u4e00-\u9fa5]+/g)||[]
              matches.forEach(t => { tagCount[t] = (tagCount[t]||0) + 1 })
            })
            const tags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t])=>t)
            const fallback = posts.slice(0,6).map(p=>p.text.replace(/\n/g,' ').slice(0,20).trim()).filter(Boolean)
            const items = tags.length >= 3 ? tags : fallback.slice(0,6)
            return items.map((t,i)=>(
              <div key={t+i} onClick={()=>setSearchQ(t)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
                <span style={{color:C.muted,fontWeight:700,width:'22px',fontSize:'0.88rem'}}>{i+1}</span>
                <span style={{fontWeight:600,fontSize:'0.95rem'}}>{t}</span>
              </div>
            ))
          })()}
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
        <button onClick={()=>setShowListing(true)} style={{position:'fixed',bottom:'80px',right:'16px',background:'linear-gradient(135deg,#7c3aed,#2563eb)',color:'white',border:'none',borderRadius:'28px',padding:'13px 18px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:fabExpanded?'6px':'0',boxShadow:'0 4px 20px rgba(124,58,237,0.45)',zIndex:150,transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',whiteSpace:'nowrap'}}>
          <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0}}>＋</span>
          <span style={{maxWidth:fabExpanded?'60px':'0',overflow:'hidden',opacity:fabExpanded?1:0,transition:'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',whiteSpace:'nowrap'}}>List</span>
        </button>
      </>}

      {/* ─── PROFILE ─── */}
      {page==='profile' && <>
        {topBar(<>My Profile <span style={{color:C.muted,fontSize:'0.9rem'}}>▾</span></>, <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem'}}>⚙️</button>)}
        {/* Load rank when profile page is shown */}
        {page==='profile' && userRank===0 && (() => {
          sb.from('profiles').select('*',{count:'exact',head:true}).gt('total_fizzups',profile.total_fizzups).then(({count})=>setUserRank((count||0)+1))
          return null
        })()}
        <div style={{display:'flex',margin:'16px',background:C.surface,borderRadius:'16px',overflow:'hidden',border:`1px solid ${C.border}`}}>
          <div style={{flex:1,padding:'16px',textAlign:'center',borderRight:`1px solid ${C.border}`}}>
            <div style={{fontSize:'1.4rem',marginBottom:'2px'}}>❤️</div>
            <div style={{fontWeight:700,fontSize:'1.4rem'}}>{profile.total_fizzups}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Karma</div>
          </div>
          <div style={{flex:1,padding:'16px',textAlign:'center',borderRight:`1px solid ${C.border}`}}>
            <div style={{fontSize:'1.4rem',marginBottom:'2px'}}>🏆</div>
            <div style={{fontWeight:700,fontSize:'1.4rem'}}>#{userRank||'—'}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Ranking</div>
          </div>
          <div style={{flex:1,padding:'16px',textAlign:'center'}}>
            <div style={{fontSize:'1.4rem',marginBottom:'2px'}}>✏️</div>
            <div style={{fontWeight:700,fontSize:'1.4rem'}}>{posts.filter(p=>p.user_id===profile.id).length}</div>
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
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'80px',right:'16px',background:'linear-gradient(135deg,#7c3aed,#2563eb)',color:'white',border:'none',borderRadius:'28px',padding:'13px 18px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:fabExpanded?'6px':'0',boxShadow:'0 4px 20px rgba(124,58,237,0.45)',zIndex:150,transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',whiteSpace:'nowrap'}}>
          <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0}}>＋</span>
          <span style={{maxWidth:fabExpanded?'50px':'0',overflow:'hidden',opacity:fabExpanded?1:0,transition:'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',whiteSpace:'nowrap'}}>Post</span>
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
              <label style={{cursor:'pointer',color:C.accentBright,display:'flex',alignItems:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickImgs} />
              </label>
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

      {selectedPost&&(
        <div style={{position:'fixed',inset:0,background:C.bg,zIndex:400,display:'flex',flexDirection:'column' as const}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:'1px solid '+C.border,position:'sticky' as const,top:0,background:C.bg}}>
            <button onClick={()=>setSelectedPost(null)} style={{background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',cursor:'pointer',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>←</button>
            <span style={{fontWeight:700}}>Post</span>
          </div>
          <div style={{flex:1,overflowY:'auto' as const}}>
            <div style={{padding:'16px',borderBottom:'1px solid '+C.border}}>
              <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:selectedPost.is_anon?avColor(selectedPost.user_id):(selectedPost.profiles?.avatar_color||avColor(selectedPost.user_id)),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700,flexShrink:0}}>
                  {selectedPost.is_anon?anonEmoji(selectedPost.user_id):(selectedPost.profiles?.avatar_initials||'?')}
                </div>
                <div>
                  <div style={{fontWeight:600}}>{selectedPost.is_anon?'Anonymous':(selectedPost.profiles?.username||'User')}</div>
                  <div style={{fontSize:'0.78rem',color:C.muted}}>{ago(selectedPost.created_at)}</div>
                </div>
              </div>
              {selectedPost.text&&<div style={{fontSize:'1rem',lineHeight:'1.6',marginBottom:'12px'}}>{selectedPost.text}</div>}
              {(selectedPost as any).images&&(selectedPost as any).images.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:(selectedPost as any).images.length===1?'1fr':'1fr 1fr',gap:'3px',borderRadius:'12px',overflow:'hidden',marginBottom:'12px'}}>
                  {(selectedPost as any).images.slice(0,4).map((url:string,i:number)=><img key={i} src={url} alt="" style={{width:'100%',height:(selectedPost as any).images.length===1?'260px':'150px',objectFit:'cover' as const}}/>)}
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:'16px',paddingTop:'10px',borderTop:'1px solid '+C.border}}>
                <button onClick={()=>{setDmTarget(selectedPost);setShowDm(true)}} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',padding:0,display:'flex',alignItems:'center'}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <button onClick={()=>{setRepostTarget(selectedPost);setShowRepost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                  {(selectedPost as any).reposts_count||0}
                </button>
                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'4px'}}>
                  <button onClick={()=>vote(selectedPost,'up')} style={{background:'none',border:'none',cursor:'pointer',color:(selectedPost as any).my_vote==='up'?C.upvote:C.muted,padding:'2px',display:'flex'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={(selectedPost as any).my_vote==='up'?C.upvote:'none'} stroke={(selectedPost as any).my_vote==='up'?C.upvote:'currentColor'} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <span style={{fontWeight:700,minWidth:'24px',textAlign:'center' as const,color:(selectedPost.likes_count-(selectedPost.dislikes_count||0))>0?C.upvote:C.muted}}>{selectedPost.likes_count-(selectedPost.dislikes_count||0)}</span>
                  <button onClick={()=>vote(selectedPost,'down')} style={{background:'none',border:'none',cursor:'pointer',color:(selectedPost as any).my_vote==='down'?C.red:C.muted,padding:'2px',display:'flex'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={(selectedPost as any).my_vote==='down'?C.red:'none'} stroke={(selectedPost as any).my_vote==='down'?C.red:'currentColor'} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div style={{padding:'10px 16px 6px',borderBottom:'1px solid '+C.border,fontSize:'0.85rem',color:C.muted,fontWeight:600}}>Newest first</div>
            {postComments.length===0&&<div style={{textAlign:'center' as const,padding:'40px',color:C.muted}}>No comments yet. Start the conversation!</div>}
            {postComments.map((c:any)=>{
              const cmv=commentVotes[c.id]
              const cs=(c.likes_count||0)-(c.dislikes_count||0)
              const isReply=!!c.parent_id
              const parentCmt=isReply?postComments.find((x:any)=>x.id===c.parent_id):null
              return(
                <div key={c.id} style={{padding:'10px 16px',borderBottom:'1px solid '+C.border,paddingLeft:isReply?'36px':'16px'}}>
                  {isReply&&parentCmt&&(
                    <div style={{fontSize:'0.75rem',color:C.muted,marginBottom:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
                      replying to {parentCmt.profiles?.username||'User'}
                    </div>
                  )}
                  <div style={{display:'flex',gap:'10px'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'50%',background:c.profiles?.avatar_color||'#888',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.78rem',fontWeight:700,color:'white',flexShrink:0}}>{c.profiles?.avatar_initials||'?'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem'}}>{c.profiles?.username||'User'} <span style={{color:C.muted,fontWeight:400,fontSize:'0.75rem'}}>{ago(c.created_at)}</span></div>
                      <div style={{fontSize:'0.92rem',margin:'4px 0'}}>{c.text}</div>
                      {c.images&&c.images.length>0&&(
                        <div style={{display:'grid',gridTemplateColumns:c.images.length===1?'1fr':'1fr 1fr',gap:'3px',borderRadius:'8px',overflow:'hidden',marginBottom:'6px',maxWidth:'260px'}}>
                          {c.images.slice(0,4).map((url:string,i:number)=><img key={i} src={url} alt="" style={{width:'100%',height:c.images.length===1?'160px':'90px',objectFit:'cover'}}/>)}
                        </div>
                      )}
                      <div style={{display:'flex',gap:'10px',marginTop:'4px',alignItems:'center'}}>
                        <button onClick={()=>setReplyToComment(c)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'0.78rem',padding:0,fontFamily:'inherit'}}>Reply</button>
                        <button onClick={()=>{setRepostTarget({...selectedPost,text:c.text,is_anon:false,profiles:c.profiles,user_id:c.user_id,created_at:c.created_at} as any);setRepostIsComment(true);setRepostOriginalPostText(selectedPost.text);setShowRepost(true)}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'0.78rem',padding:0,display:'flex',alignItems:'center'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                        </button>
                        {c.user_id!==profile.id&&(
                          <button onClick={()=>{setDmTarget({...selectedPost,user_id:c.user_id,profiles:c.profiles} as any);setShowDm(true)}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'0.78rem',padding:0,display:'flex',alignItems:'center'}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* vote col — same style as PostCard */}
                    <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:'2px',minWidth:'28px',flexShrink:0}}>
                      <button onClick={()=>voteComment(c,'up')} style={{background:'none',border:'none',cursor:'pointer',color:cmv==='up'?C.upvote:C.muted,padding:'2px',display:'flex'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={cmv==='up'?C.upvote:'none'} stroke={cmv==='up'?C.upvote:'currentColor'} strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <span style={{fontWeight:700,fontSize:'0.82rem',color:cs>0?C.upvote:cs<0?C.red:C.muted}}>{cs}</span>
                      <button onClick={()=>voteComment(c,'down')} style={{background:'none',border:'none',cursor:'pointer',color:cmv==='down'?C.red:C.muted,padding:'2px',display:'flex'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={cmv==='down'?C.red:'none'} stroke={cmv==='down'?C.red:'currentColor'} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{borderTop:'1px solid '+C.border,background:C.bg}}>
            {replyToComment&&(
              <div style={{padding:'6px 16px 0',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.8rem',color:C.muted}}>
                <span>↩ Replying to {replyToComment.profiles?.username||'User'}</span>
                <button onClick={()=>setReplyToComment(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'1rem',padding:0}}>×</button>
              </div>
            )}
            {cmtPrevs.length>0&&(
              <div style={{display:'flex',gap:'6px',padding:'6px 16px 0',overflowX:'auto'}}>
                {cmtPrevs.map((p,i)=><img key={i} src={p} alt="" style={{height:'60px',width:'60px',objectFit:'cover',borderRadius:'8px',flexShrink:0}}/>)}
              </div>
            )}
            <div style={{padding:'8px 16px',display:'flex',gap:'8px',alignItems:'center'}}>
              <label style={{cursor:'pointer',color:C.muted,display:'flex',alignItems:'center',flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickCmtImgs} />
              </label>
              <input style={{flex:1,background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',borderRadius:'24px',padding:'10px 16px',color:C.text,fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} placeholder={replyToComment?`Reply to ${replyToComment.profiles?.username||'User'}…`:"Add a comment..."} value={cmtInput} onChange={e=>setCmtInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitNewCmt()} />
              <button onClick={submitNewCmt} style={{padding:'10px 18px',background:C.accentBright,color:'white',border:'none',borderRadius:'24px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Post</button>
            </div>
          </div>
        </div>
      )}

      {showRepost&&repostTarget&&(
        <div style={{position:'fixed',inset:0,background:C.bg,zIndex:500,display:'flex',flexDirection:'column' as const}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid '+C.border}}>
            <button onClick={()=>{setShowRepost(false);setRepostText('');setRepostIsComment(false);setRepostOriginalPostText('')}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.3rem',color:C.text}}>✕</button>
            <button onClick={submitRepost} disabled={reposting} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'8px 20px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{reposting?'...':'Post'}</button>
          </div>
          <div style={{flex:1,overflowY:'auto' as const,padding:'16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'50%',background:repostAnon?avColor(profile.id):profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700}}>{repostAnon?anonEmoji(profile.id):profile.avatar_initials}</div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',background:C.surface,borderRadius:'20px',padding:'6px 12px',cursor:'pointer'}} onClick={()=>setRepostAnon(!repostAnon)}>
                <span style={{fontWeight:600,fontSize:'0.9rem'}}>{repostAnon?'Anonymous':profile.username}</span>
                <span style={{color:C.muted}}>▾</span>
              </div>
            </div>
            <textarea style={{width:'100%',background:'transparent',border:'none',resize:'none' as const,color:C.text,fontFamily:'inherit',fontSize:'1rem',outline:'none',minHeight:'80px',lineHeight:'1.5',marginBottom:'16px'}} placeholder="Add caption..." value={repostText} onChange={e=>setRepostText(e.target.value)} autoFocus />
            <div style={{border:'1px solid '+C.border,borderRadius:'14px',padding:'14px',background:C.surface}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'50%',background:repostTarget.is_anon?avColor(repostTarget.user_id):(repostTarget.profiles?.avatar_color||avColor(repostTarget.user_id)),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',color:'white',fontWeight:700}}>{repostTarget.is_anon?anonEmoji(repostTarget.user_id):(repostTarget.profiles?.avatar_initials||'?')}</div>
                <span style={{fontWeight:600,fontSize:'0.88rem'}}>{repostTarget.is_anon?'Anonymous':(repostTarget.profiles?.username||'User')}</span>
                <span style={{fontSize:'0.75rem',color:C.muted}}>{ago(repostTarget.created_at)}</span>
              </div>
              {repostIsComment&&repostOriginalPostText&&(
                <div style={{fontSize:'0.78rem',color:C.accentBright,marginBottom:'4px'}}>
                  @Commenting on '{repostOriginalPostText.slice(0,40)}{repostOriginalPostText.length>40?'…':''}'
                </div>
              )}
              <div style={{fontSize:'0.92rem'}}>{repostTarget.text}</div>
            </div>
          </div>
        </div>
      )}

      {showDm&&dmTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',flexDirection:'column' as const,justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowDm(false)}>
          <div style={{background:C.bg,borderRadius:'20px 20px 0 0',padding:'20px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>{setShowDm(false);setDmMsg('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>Cancel</button>
              <div style={{fontWeight:700}}>Send Message</div>
              <button onClick={sendDm} disabled={!dmMsg.trim()} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:!dmMsg.trim()?.5:1}}>Send</button>
            </div>
            <div style={{background:C.surface,borderRadius:'12px',padding:'12px',marginBottom:'14px',borderLeft:'3px solid '+C.accentBright}}>
              <div style={{fontSize:'0.8rem',color:C.muted,marginBottom:'4px'}}>To: {dmTarget.is_anon?'Anonymous':(dmTarget.profiles?.username||'User')}</div>
              <div style={{fontSize:'0.9rem'}}>{dmTarget.text?.slice(0,100)}</div>
            </div>
            <textarea style={{width:'100%',background:C.surface,border:'1px solid '+C.border,borderRadius:'12px',padding:'12px',color:C.text,fontFamily:'inherit',fontSize:'0.95rem',outline:'none',minHeight:'80px',resize:'none' as const,lineHeight:'1.5'}} placeholder="Write a message..." value={dmMsg} onChange={e=>setDmMsg(e.target.value)} autoFocus />
          </div>
        </div>
      )}
    </div>
  )
}
