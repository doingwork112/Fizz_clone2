'use client'
import React, { useState, useEffect, useRef } from 'react'
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
function splitTaggedText(text: string) {
  const firstLine = text.split('\n')[0]
  const maybeTag = firstLine && firstLine === firstLine.toUpperCase() ? firstLine : ''
  return { tagLine: maybeTag, body: maybeTag ? text.slice(firstLine.length).trim() : text }
}
function trimPreview(text: string, max = 80) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > max ? `${clean.slice(0, max)}...` : clean
}
function formatMessagePreview(msg?: Message) {
  if (!msg) return '开始对话'
  if (msg.metadata?.type === 'post_context') return `来自帖子: ${msg.metadata.post_preview || '查看原帖'}`
  return msg.text || '开始对话'
}

export default function App() {
  const sb = createClient()
  const { theme, setTheme, resolved } = useTheme()
  const C = resolved === 'light' ? LIGHT : DARK

  // Splash screen: logo sits for 1.4s, then zooms out in 0.45s, then cuts to app
  useEffect(() => {
    // Set html/body to purple so status bar area matches splash
    document.documentElement.style.background = '#4c1d95'
    document.body.style.background = '#4c1d95'
    const zoomTimer = setTimeout(() => setSplashZoom(true), 1400)
    const hideTimer = setTimeout(() => {
      setShowSplash(false)
      // Restore normal background after splash
      document.documentElement.style.background = ''
      document.body.style.background = ''
    }, 1850)
    return () => { clearTimeout(zoomTimer); clearTimeout(hideTimer) }
  }, [])

  // Sync html/body background with theme so no dark flash behind keyboard
  useEffect(() => {
    const bg = resolved === 'light' ? LIGHT.bg : DARK.bg
    document.documentElement.style.background = bg
    document.body.style.background = bg
  }, [resolved])

  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile|null>(null)
  const profileRef = useRef<Profile|null>(null)
  const [authTab, setAuthTab] = useState<'login'|'register'>('login')
  const [af, setAf] = useState({ email:'', pwd:'', username:'' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authErr, setAuthErr] = useState('')

  const [page, setPage] = useState<'feed'|'messages'|'search'|'market'|'profile'>('feed')
  const [feedTab, setFeedTab] = useState<'Top'|'Heha!'|'New'>('Heha!')

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
  const [showListingMenu, setShowListingMenu] = useState(false)
  const [pendingChat, setPendingChat] = useState<{ user: Profile; tab: 'posts' | 'market' } | null>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [profileTab, setProfileTab] = useState<'Posts'|'Comments'|'Saved'>('Posts')
  const [userComments, setUserComments] = useState<any[]>([])

  const [showSplash, setShowSplash] = useState(true)
  const [splashZoom, setSplashZoom] = useState(false)

  const [showPost, setShowPost] = useState(false)
  const [postText, setPostText] = useState('')
  const [postAnon, setPostAnon] = useState(true)
  const [posting, setPosting] = useState(false)
  const [postTag, setPostTag] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(true)
  const lastScrollY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [mktRefreshing, setMktRefreshing] = useState(false)
  const [mktPullY, setMktPullY] = useState(0)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)
  const [postDragY, setPostDragY] = useState(0)
  const [postClosing, setPostClosing] = useState(false)
  const [detailClosing, setDetailClosing] = useState(false)
  const selectedPostRef = useRef<any>(null)
  const postDetailRef = useRef<HTMLDivElement>(null)
  const [repostClosing, setRepostClosing] = useState(false)
  const [repostDragY, setRepostDragY] = useState(0)
  const repostDragStart = useRef(0)
  const [showPostMenu, setShowPostMenu] = useState<string|null>(null)
  const showPostRef = useRef(false)
  const showRepostRef = useRef(false)
  const postSheetRef = useRef<HTMLDivElement>(null)
  const postDragTrack = useRef(0)
  const repostSheetRef = useRef<HTMLDivElement>(null)
  const repostDragTrack = useRef(0)
  const chatDetailRef = useRef<HTMLDivElement>(null)
  const chatTargetRef = useRef<Profile|null>(null)
  const chatBackdropRef = useRef<HTMLDivElement>(null)
  const detailBackdropRef = useRef<HTMLDivElement>(null)
  const listingDetailRef = useRef<HTMLDivElement>(null)
  const listingBackdropRef = useRef<HTMLDivElement>(null)
  const selectedListingRef = useRef<Listing|null>(null)
  const mktMyViewBackdropRef = useRef<HTMLDivElement>(null)
  const postDragStart = useRef(0)
  const postDragAllowed = useRef(false)
  const postScrollAreaRef = useRef<HTMLDivElement>(null)
  const [postImgs, setPostImgs] = useState([])
  const [postPrevs, setPostPrevs] = useState([])


  const [showListing, setShowListing] = useState(false)
  const [listingClosing, setListingClosing] = useState(false)
  const [lf, setLf] = useState({ title:'', price:'', cat:'', desc:'', condition:'' })
  const [lFiles, setLFiles] = useState<File[]>([])
  const [selectedListing, setSelectedListing] = useState<Listing|null>(null)
  const [mktSearch, setMktSearch] = useState('')
  const [mktHideSold, setMktHideSold] = useState(false)
  const [mktCondFilter, setMktCondFilter] = useState('')
  const [savedListings, setSavedListings] = useState<string[]>([])
  const [listingView, setListingView] = useState<'cat'|'cond'|null>(null)
  const [lPreviews, setLPreviews] = useState<string[]>([])
  const [lUploading, setLUploading] = useState(false)
  const [listingPublished, setListingPublished] = useState(false)
  const [listingPhotoIdx, setListingPhotoIdx] = useState(0)
  const listingPhotoIdxRef = useRef(0)
  const [showSortSheet, setShowSortSheet] = useState(false)
  const [showCatSheet, setShowCatSheet] = useState(false)
  const [showCondSheet, setShowCondSheet] = useState(false)
  const [mktSort, setMktSort] = useState<'newest'|'oldest'|'lowest'|'highest'>('newest')
  const [mktMyView, setMktMyView] = useState<null|'saved'|'mine'>(null)
  const [msgPullY, setMsgPullY] = useState(0)
  const [msgRefreshing, setMsgRefreshing] = useState(false)
  const msgPullYRef = useRef(0)
  const [profPullY, setProfPullY] = useState(0)
  const [profRefreshing, setProfRefreshing] = useState(false)
  const profPullYRef = useRef(0)
  const [srchPullY, setSrchPullY] = useState(0)
  const [srchRefreshing, setSrchRefreshing] = useState(false)
  const srchPullYRef = useRef(0)
  const [msgTab, setMsgTab] = useState<'posts'|'market'>('posts')
  const [mktConvoPartners, setMktConvoPartners] = useState<string[]>(()=>{
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('heha_mkt_convos')||'[]') } catch { return [] }
  })

  const mktMyViewRef = useRef<HTMLDivElement>(null)
  const mktMyViewOpenRef = useRef<null|'saved'|'mine'>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const activityRef = useRef<HTMLDivElement>(null)
  const activityBackdropRef = useRef<HTMLDivElement>(null)
  const [searchOverlay, setSearchOverlay] = useState(false)
  const searchOverlayRef = useRef<HTMLDivElement>(null)
  const searchBackdropRef = useRef<HTMLDivElement>(null)
  const searchOverlayOpenRef = useRef(false)
  const [lightboxImg, setLightboxImg] = useState<string|null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const carouselInnerRef = useRef<HTMLDivElement>(null)
  const carouselTouchRef = useRef({startX:0,dx:0,dragging:false,startTime:0})
  const chatRef = useRef<HTMLDivElement>(null)
  const postDetailScrollRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const dmInputRef = useRef<HTMLTextAreaElement>(null)
  const profileIndicatorRef = useRef<HTMLDivElement>(null)
  const profileBodyRef = useRef<HTMLDivElement>(null)
  const profileTabRef = useRef<'Posts'|'Comments'|'Saved'>('Posts')
  const profileSwipeDir = useRef(0)

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
    loadUserComments()
    const ch = sb.channel('rt-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadPosts()).subscribe()
    const mch = sb.channel('rt-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`to_user_id=eq.${profile.id}`},p=>{
      if(chatTargetRef.current?.id===p.new.from_user_id){
        setChatMsgs(x=>[...x,p.new as Message])
        sb.from('messages').update({is_read:true}).eq('id',p.new.id).then(()=>{loadConvos();loadUnread()})
      } else {
        loadConvos();loadUnread()
      }
    }).subscribe()
    const iv = setInterval(()=>presence(profile),120000)
    return ()=>{ sb.removeChannel(ch); sb.removeChannel(mch); clearInterval(iv) }
  }, [profile?.id])
  useEffect(() => {
    if (page !== 'messages' || !pendingChat) return
    const timer = window.setTimeout(() => {
      setMsgTab(pendingChat.tab)
      openChat(pendingChat.user)
      setPendingChat(null)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [page, pendingChat])
  useEffect(() => {
    if (!window.visualViewport) return
    const updateInset = () => {
      const viewport = window.visualViewport
      const nextInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(nextInset > 80 ? nextInset : 0)
    }
    updateInset()
    window.visualViewport.addEventListener('resize', updateInset)
    window.visualViewport.addEventListener('scroll', updateInset)
    return () => {
      window.visualViewport?.removeEventListener('resize', updateInset)
      window.visualViewport?.removeEventListener('scroll', updateInset)
    }
  }, [])

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
    const { error } = await sb.auth.signUp({ email: af.email, password: af.pwd, options: { data: { username: af.username, avatar_initials: af.username.slice(0,2).toUpperCase(), avatar_color: AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)] } } })
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
    const currentProfile = profileRef.current
    if (currentProfile) {
      const { data: votes } = await sb.from('fizzups').select('post_id,vote_type').eq('user_id',currentProfile.id)
      const vm: Record<string,string> = {}; votes?.forEach((v:any)=>vm[v.post_id]=v.vote_type)
      setPosts(withReposts.map((p:any)=>({...p,my_vote:vm[p.id]||null})))
      // Reload profile so karma (total_fizzups) stays current
      const { data: freshProfile } = await sb.from('profiles').select('*').eq('id', currentProfile.id).single()
      if (freshProfile) setProfile(freshProfile)
    } else setPosts(withReposts)
  }
  async function loadUserComments() {
    if (!profileRef.current) return
    const { data } = await sb.from('comments').select('*, posts(*, profiles(*))').eq('user_id', profileRef.current.id).order('created_at', { ascending: false })
    setUserComments(data || [])
  }

  function sorted() {
    const p = [...posts]
    if (feedTab==='Top') return p.sort((a,b)=>b.likes_count-a.likes_count)
    if (feedTab==='Heha!') return p.sort((a,b)=>(b.likes_count-(b.dislikes_count||0))-(a.likes_count-(a.dislikes_count||0)))
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
    const finalText = postTag ? `${postTag}\n${postText.trim()}` : postText.trim()
    await sb.from('posts').insert({user_id:profile.id,text:finalText,is_anon:postAnon,school:profile.school,images:urls})
    setPostText('');setPostImgs([]);setPostPrevs([]);setPostTag('');setShowPost(false);setPosting(false);loadPosts()
  }
  function pickImgs(e){
    const files=Array.from(e.target.files||[]).slice(0,4) as File[]
    setPostImgs(files)
    setPostPrevs(files.map(f=>URL.createObjectURL(f)))
  }

  async function deletePst(id:string) {
    if (!confirm('确认删除这条帖子吗？')) return
    const { error } = await sb.from('posts').delete().eq('id', id).eq('user_id', profile!.id)
    if (error) {
      console.error('Delete post error:', error)
      alert('删除失败: ' + error.message)
      return
    }
    setPosts(prev => prev.filter(p => p.id !== id))
    if (selectedPost && (selectedPost as any).id === id) {
      setSelectedPost(null)
      setPostComments([])
    }
    loadPosts()
  }

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
    const { data } = await sb.from('listings').select('*,profiles(*)').order('created_at',{ascending:false})
    setListings(data||[])
  }
  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files||[]).slice(0,8)
    setLFiles(files); setLPreviews(files.map(f=>URL.createObjectURL(f)))
  }
  async function submitListing() {
    if (!profile||!lf.title) return
    setLUploading(true)
    try {
      const urls: string[] = []
      for (const file of lFiles) {
        const path = `${profile.id}/${Date.now()}_${file.name}`
        const { error } = await sb.storage.from('listing-images').upload(path,file,{upsert:true})
        if (!error) { const { data: u } = sb.storage.from('listing-images').getPublicUrl(path); urls.push(u.publicUrl) }
      }
      const ins: Record<string,any> = {user_id:profile.id,title:lf.title,price:parseFloat(lf.price)||0,emoji:'📦',category:lf.cat||'Other',description:lf.desc||'',school:profile.school||'Heha'}
      if (urls.length > 0) ins.images = urls
      const { error: insertErr } = await sb.from('listings').insert(ins)
      if (insertErr) { console.error('Listing insert error:', insertErr); alert('发布失败: ' + insertErr.message); setLUploading(false); return }
      setLUploading(false)
      setLf({title:'',price:'',cat:'',desc:'',condition:''}); setLFiles([]); setLPreviews([]); setListingView(null)
      // Show "已发布" confirmation then navigate to marketplace
      setListingPublished(true)
      await loadListings()
      setTimeout(() => { setShowListing(false); setListingPublished(false); setPage('market') }, 1200)
      return
    } catch(e) { console.error('submitListing error:', e) }
    setLUploading(false)
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
    const { body } = splitTaggedText(dmTarget.text || '')
    const postPreview = trimPreview(body || dmTarget.text || '', 80)
    if (postPreview) {
      await sb.from('messages').insert({
        from_user_id:profile.id,
        to_user_id:dmTarget.user_id,
        text:'📌 来自帖子',
        metadata:{type:'post_context',post_id:dmTarget.id,post_preview:postPreview}
      })
    }
    await sb.from('messages').insert({from_user_id:profile.id,to_user_id:dmTarget.user_id,text:dmMsg.trim()})
    const target = {id:dmTarget.user_id,...(dmTarget.profiles as any)} as Profile
    setDmMsg('');setShowDm(false);setDmTarget(null)
    setPendingChat({ user: target, tab: 'posts' })
    setPage('messages')
    await loadConvos()
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
    setShowChatMenu(false)
    const { data } = await sb.from('messages').select('*').or(`and(from_user_id.eq.${profile!.id},to_user_id.eq.${u.id}),and(from_user_id.eq.${u.id},to_user_id.eq.${profile!.id})`).order('created_at')
    setChatMsgs(data||[])
    await sb.from('messages').update({is_read:true}).eq('to_user_id',profile!.id).eq('from_user_id',u.id)
    loadUnread()
    setUnread(0) // optimistic clear — DB update confirmed above
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100)
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
  useEffect(() => { setListingPhotoIdx(0) }, [selectedListing?.id])
  useEffect(() => { setShowListingMenu(false) }, [selectedListing?.id])

  // Lock body scroll on iOS — position:fixed is the only reliable method for PWA
  // Post/repost modal: prevent background scroll via backdrop touchmove preventDefault
  // Do NOT use position:fixed on body — it breaks iOS keyboard behavior

  // Clear unread badge when user navigates to messages page
  useEffect(()=>{ if(page==='messages'&&profile) loadUnread() },[page])

  useEffect(()=>{
    if (!searchQ.trim()) { setSearchRes([]); return }
    const t = setTimeout(async()=>{ const { data }=await sb.from('posts').select('*,profiles(*)').ilike('text',`%${searchQ}%`).limit(30); setSearchRes(data||[]) },300)
    return ()=>clearTimeout(t)
  },[searchQ])

  // ── shared styles ──
  const inp: React.CSSProperties = { width:'100%', background:C.surface, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'12px 14px', color:C.text, fontSize:'0.95rem', outline:'none', fontFamily:'inherit' }
  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', flexDirection:'column', justifyContent:'flex-end' }
  const sheet: React.CSSProperties = { background:C.bg, borderRadius:'20px 20px 0 0', padding:'20px 16px', maxHeight:'92vh', overflowY:'auto' }

  // Lock/unlock body scroll for modals
  const savedScrollY = useRef(0)
  function lockBody() {
    savedScrollY.current = window.scrollY
    document.body.classList.add('modal-open')
    document.body.style.top = `-${savedScrollY.current}px`
  }
  function unlockBody() {
    document.body.classList.remove('modal-open')
    document.body.style.top = ''
    window.scrollTo(0, savedScrollY.current)
  }

  function openPostModal() {
    setShowPost(true)
  }
  function closePost() {
    setPostClosing(true)
    setPostDragY(0)
    setTimeout(()=>{ setShowPost(false); setPostClosing(false); setPostText(''); setPostImgs([]); setPostPrevs([]); setPostTag(''); setShowTagPicker(false) }, 350)
  }
  function closeDetail() {
    if (postDetailRef.current) {
      postDetailRef.current.style.animation = 'none'
      postDetailRef.current.style.transition = 'transform 0.38s ease'
      postDetailRef.current.style.transform = 'translateX(100%)'
    }
    if (detailBackdropRef.current) {
      detailBackdropRef.current.style.transition = 'opacity 0.38s ease'
      detailBackdropRef.current.style.opacity = '0'
    }
    setTimeout(() => setSelectedPost(null), 400)
  }
  function closeListing() {
    setListingClosing(true)
    setTimeout(()=>{ setShowListing(false); setListingClosing(false); setLf({title:'',price:'',cat:'',desc:'',condition:''}); setLFiles([]); setLPreviews([]); setListingView(null) }, 340)
  }
  function closeChat() {
    if (chatDetailRef.current) {
      chatDetailRef.current.style.transition = 'transform 0.38s ease'
      chatDetailRef.current.style.transform = 'translateX(100%)'
    }
    if (chatBackdropRef.current) {
      chatBackdropRef.current.style.transition = 'opacity 0.38s ease'
      chatBackdropRef.current.style.opacity = '0'
    }
    setTimeout(() => setChatTarget(null), 400)
  }
  function closeListingDetail() {
    if (listingDetailRef.current) {
      listingDetailRef.current.style.transition = 'transform 0.38s ease'
      listingDetailRef.current.style.transform = 'translateX(100%)'
    }
    if (listingBackdropRef.current) {
      listingBackdropRef.current.style.transition = 'opacity 0.38s ease'
      listingBackdropRef.current.style.opacity = '0'
    }
    setTimeout(() => setSelectedListing(null), 400)
  }
  function closeSearchOverlay() {
    if (searchOverlayRef.current) {
      searchOverlayRef.current.style.transition = 'transform 0.38s ease'
      searchOverlayRef.current.style.transform = 'translateX(100%)'
    }
    if (searchBackdropRef.current) {
      searchBackdropRef.current.style.transition = 'opacity 0.38s ease'
      searchBackdropRef.current.style.opacity = '0'
    }
    setTimeout(() => setSearchOverlay(false), 400)
  }
  function closeActivity() {
    if (activityRef.current) {
      activityRef.current.style.transition = 'transform 0.38s ease'
      activityRef.current.style.transform = 'translateX(100%)'
    }
    if (activityBackdropRef.current) {
      activityBackdropRef.current.style.transition = 'opacity 0.38s ease'
      activityBackdropRef.current.style.opacity = '0'
    }
    setTimeout(() => setShowActivity(false), 400)
  }
  function closeRepost() {
    setRepostClosing(true)
    setRepostDragY(0)
    setTimeout(() => {
      setShowRepost(false); setRepostClosing(false); setRepostText('')
      setRepostIsComment(false); setRepostOriginalPostText(''); setRepostTarget(null)
    }, 350)
  }

    const FEED_TABS = ['Top','Heha!','New'] as const
  const POST_TAGS = [
    {tag:'LOST & FOUND',emoji:'❓',bg:'#fde8d0',color:'#d97706'},
    {tag:'SHOUT OUT',emoji:'👏',bg:'#fde8d0',color:'#ea580c'},
    {tag:'QUESTION',emoji:'❔',bg:'#dbeafe',color:'#2563eb'},
    {tag:'FIT CHECK',emoji:'👔',bg:'#fde8d0',color:'#d97706'},
    {tag:'LOCAL REC',emoji:'🏛',bg:'#dbeafe',color:'#2563eb'},
    {tag:'CONFESSION',emoji:'👋',bg:'#fce7f3',color:'#db2777'},
    {tag:'EVENT',emoji:'📅',bg:'#fce7f3',color:'#c084fc'},
    {tag:'STORY TIME',emoji:'👥',bg:'#fef9c3',color:'#ca8a04'},
    {tag:'PSA',emoji:'📢',bg:'#ede9fe',color:'#7c3aed'},
    {tag:'BREAKING NEWS',emoji:'❗',bg:'#fce7f3',color:'#dc2626'},
    {tag:'DM ME',emoji:'💬',bg:'#dbeafe',color:'#2563eb'},
    {tag:'HOT',emoji:'🔥',bg:'#fde8d0',color:'#ea580c'},
    {tag:'CRUSH',emoji:'❤️',bg:'#fce7f3',color:'#ec4899'},
    {tag:'TEA',emoji:'🍵',bg:'#d1fae5',color:'#059669'},
    {tag:'GREEN FLAG',emoji:'🟢',bg:'#d1fae5',color:'#16a34a'},
    {tag:'RED FLAG',emoji:'🚩',bg:'#fce7f3',color:'#dc2626'},
  ]

  // Swipe — document listeners with refs to avoid stale closures
  // Use refs for swipeX to avoid re-renders (which cause avatar flash)
  const swipeLocked = useRef<'h'|'v'|null>(null)
  const feedTabRef = useRef(feedTab)
  const pageRef = useRef(page)
  const pullYRef = useRef(pullY)
  const mktPullYRef = useRef(mktPullY)
  const swipeXRef = useRef(0)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const feedBodyRef = useRef<HTMLDivElement>(null)
  const feedSwipeDir = useRef(0)
  profileTabRef.current = profileTab
  feedTabRef.current = feedTab
  profileRef.current = profile
  pageRef.current = page
  pullYRef.current = pullY
  mktPullYRef.current = mktPullY
  selectedPostRef.current = selectedPost
  showPostRef.current = showPost
  showRepostRef.current = showRepost
  chatTargetRef.current = chatTarget
  selectedListingRef.current = selectedListing
  listingPhotoIdxRef.current = listingPhotoIdx
  msgPullYRef.current = msgPullY
  mktMyViewOpenRef.current = mktMyView
  profPullYRef.current = profPullY
  srchPullYRef.current = srchPullY
  searchOverlayOpenRef.current = searchOverlay
  const showActivityRef = useRef(false)
  showActivityRef.current = showActivity

  useEffect(() => {
    let sx = 0, sy = 0
    let touchOnCarousel = false
    function onTS(e: TouchEvent) {
      sx = e.touches[0].clientX
      sy = e.touches[0].clientY
      swipeLocked.current = null
      touchOnCarousel = !!(carouselRef.current && carouselRef.current.contains(e.target as Node))
    }
    function onTM(e: TouchEvent) {
      if (touchOnCarousel) return
      const dx = e.touches[0].clientX - sx
      const dy = e.touches[0].clientY - sy
      if (!swipeLocked.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        swipeLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      }
      // Bottom sheet open: let the sheet handle its own drag, don't touch background
      if (showPostRef.current || showRepostRef.current) return
      // Activity page: swipe-back
      if (showActivityRef.current && activityRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          activityRef.current.style.animation = 'none'
          activityRef.current.style.transition = 'none'
          activityRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          if (activityBackdropRef.current) {
            activityBackdropRef.current.style.animation = 'none'
            activityBackdropRef.current.style.transition = 'none'
            activityBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      // Post detail open: swipe-back (right). Only from left edge, not during vertical scroll.
      if (selectedPostRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          if (postDetailRef.current) {
            postDetailRef.current.style.animation = 'none'
            postDetailRef.current.style.transition = 'none'
            postDetailRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          }
          if (detailBackdropRef.current) {
            detailBackdropRef.current.style.animation = 'none'
            detailBackdropRef.current.style.transition = 'none'
            detailBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      // Chat detail open: swipe-back only from left edge, not during vertical scroll
      if (chatDetailRef.current && chatTargetRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          chatDetailRef.current.style.animation = 'none'
          chatDetailRef.current.style.transition = 'none'
          chatDetailRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          if (chatBackdropRef.current) {
            chatBackdropRef.current.style.animation = 'none'
            chatBackdropRef.current.style.transition = 'none'
            chatBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      // My Saved / My Listings overlay: swipe-back
      if (mktMyViewOpenRef.current && mktMyViewRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          mktMyViewRef.current.style.animation = 'none'
          mktMyViewRef.current.style.transition = 'none'
          mktMyViewRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          if (mktMyViewBackdropRef.current) {
            mktMyViewBackdropRef.current.style.animation = 'none'
            mktMyViewBackdropRef.current.style.transition = 'none'
            mktMyViewBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      // Listing detail open: swipe-back (right)
      if (selectedListingRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          if (listingDetailRef.current) {
            listingDetailRef.current.style.animation = 'none'
            listingDetailRef.current.style.transition = 'none'
            listingDetailRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          }
          if (listingBackdropRef.current) {
            listingBackdropRef.current.style.animation = 'none'
            listingBackdropRef.current.style.transition = 'none'
            listingBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      // Search results overlay: swipe-back
      if (searchOverlayOpenRef.current && searchOverlayRef.current) {
        if (dx > 12 && sx < 40 && swipeLocked.current !== 'v') swipeLocked.current = 'h'
        if (swipeLocked.current === 'h' && dx > 0) {
          if (e.cancelable) e.preventDefault()
          swipeXRef.current = dx
          searchOverlayRef.current.style.animation = 'none'
          searchOverlayRef.current.style.transition = 'none'
          searchOverlayRef.current.style.transform = `translateX(${Math.max(0, dx)}px)`
          if (searchBackdropRef.current) {
            searchBackdropRef.current.style.animation = 'none'
            searchBackdropRef.current.style.transition = 'none'
            searchBackdropRef.current.style.opacity = String(Math.max(0, 1 - dx / window.innerWidth))
          }
        }
        return
      }
      if (pageRef.current !== 'feed' && pageRef.current !== 'market' && pageRef.current !== 'messages' && pageRef.current !== 'profile' && pageRef.current !== 'search') return
      // Vertical pull-to-refresh — runs for all content pages
      if (swipeLocked.current === 'v' && window.scrollY < 5 && dy > 0) {
        if (e.cancelable) e.preventDefault()
        if (pageRef.current === 'market') setMktPullY(Math.min(dy * 0.45, 72))
        else if (pageRef.current === 'messages') setMsgPullY(Math.min(dy * 0.45, 72))
        else if (pageRef.current === 'profile') setProfPullY(Math.min(dy * 0.45, 72))
        else if (pageRef.current === 'search') setSrchPullY(Math.min(dy * 0.45, 72))
        else setPullY(Math.min(dy * 0.45, 72))
      }
      if (pageRef.current === 'profile') {
        if (swipeLocked.current === 'h' && e.cancelable) {
          e.preventDefault()
          swipeXRef.current = dx
          profileSwipeDir.current = dx > 0 ? 1 : -1
          if (profileIndicatorRef.current) {
            const tabIdx = ['Posts','Comments','Saved'].indexOf(profileTabRef.current)
            const pct = Math.max(0, Math.min(66.666, tabIdx * 33.333 + (-dx / window.innerWidth * 100)))
            profileIndicatorRef.current.style.left = pct + '%'
            profileIndicatorRef.current.style.transition = 'none'
          }
          if (profileBodyRef.current) {
            profileBodyRef.current.style.transition = 'none'
            profileBodyRef.current.style.transform = `translateX(${dx}px)`
          }
        }
        return
      }
      if (pageRef.current === 'market' || pageRef.current === 'messages' || pageRef.current === 'search') return
      // Feed horizontal tab swipe
      if (swipeLocked.current === 'h' && e.cancelable) {
        e.preventDefault()
        swipeXRef.current = dx
        feedSwipeDir.current = dx > 0 ? 1 : -1
        // Move indicator
        if (indicatorRef.current) {
          const tabIdx = ['Top','Heha!','New'].indexOf(feedTabRef.current)
          const pct = Math.max(0, Math.min(66.666, tabIdx * 33.333 + (-dx / window.innerWidth * 100)))
          indicatorRef.current.style.left = pct + '%'
          indicatorRef.current.style.transition = 'none'
        }
        // Move feed content with finger
        if (feedBodyRef.current) {
          feedBodyRef.current.style.transition = 'none'
          feedBodyRef.current.style.transform = `translateX(${dx}px)`
        }
      }
    }
    async function onTE() {
      if (touchOnCarousel) { touchOnCarousel = false; swipeLocked.current = null; swipeXRef.current = 0; return }
      if (showPostRef.current || showRepostRef.current) { swipeLocked.current = null; swipeXRef.current = 0; return }
      // Activity page: complete swipe-back or snap back
      if (showActivityRef.current && activityRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          activityRef.current.style.animation = 'none'
          activityRef.current.style.transition = 'transform 0.38s ease'
          activityRef.current.style.transform = 'translateX(100%)'
          if (activityBackdropRef.current) { activityBackdropRef.current.style.transition = 'opacity 0.38s ease'; activityBackdropRef.current.style.opacity = '0' }
          setTimeout(() => setShowActivity(false), 400)
        } else {
          activityRef.current.style.animation = 'none'
          activityRef.current.style.transition = 'transform 0.25s ease'
          activityRef.current.style.transform = 'translateX(0)'
          if (activityBackdropRef.current) { activityBackdropRef.current.style.transition = 'opacity 0.25s ease'; activityBackdropRef.current.style.opacity = '1' }
          setTimeout(() => { if (activityRef.current) activityRef.current.style.transition = ''; if (activityBackdropRef.current) activityBackdropRef.current.style.transition = '' }, 260)
        }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      // Chat detail: complete swipe-back or snap back
      if (chatDetailRef.current && chatTargetRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          chatDetailRef.current.style.animation = 'none'
          chatDetailRef.current.style.transition = 'transform 0.38s ease'
          chatDetailRef.current.style.transform = 'translateX(100%)'
          if (chatBackdropRef.current) { chatBackdropRef.current.style.transition = 'opacity 0.38s ease'; chatBackdropRef.current.style.opacity = '0' }
          setTimeout(() => setChatTarget(null), 400)
        } else {
          chatDetailRef.current.style.animation = 'none'
          chatDetailRef.current.style.transition = 'transform 0.25s ease'
          chatDetailRef.current.style.transform = 'translateX(0)'
          if (chatBackdropRef.current) { chatBackdropRef.current.style.transition = 'opacity 0.25s ease'; chatBackdropRef.current.style.opacity = '1' }
          setTimeout(() => { if (chatDetailRef.current) chatDetailRef.current.style.transition = ''; if (chatBackdropRef.current) chatBackdropRef.current.style.transition = '' }, 260)
        }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      // Post detail: complete swipe-back or snap back
      if (selectedPostRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          if (postDetailRef.current) {
            postDetailRef.current.style.animation = 'none'
            postDetailRef.current.style.transition = 'transform 0.38s ease'
            postDetailRef.current.style.transform = 'translateX(100%)'
          }
          if (detailBackdropRef.current) {
            detailBackdropRef.current.style.transition = 'opacity 0.38s ease'
            detailBackdropRef.current.style.opacity = '0'
          }
          setTimeout(() => setSelectedPost(null), 400)
        } else if (postDetailRef.current) {
          postDetailRef.current.style.animation = 'none'
          postDetailRef.current.style.transition = 'transform 0.25s ease'
          postDetailRef.current.style.transform = 'translateX(0)'
          if (detailBackdropRef.current) {
            detailBackdropRef.current.style.transition = 'opacity 0.25s ease'
            detailBackdropRef.current.style.opacity = '1'
            setTimeout(() => { if (detailBackdropRef.current) detailBackdropRef.current.style.transition = '' }, 260)
          }
          setTimeout(() => { if (postDetailRef.current) postDetailRef.current.style.transition = '' }, 260)
        }
        swipeLocked.current = null
        swipeXRef.current = 0
        return
      }
      // My Saved / My Listings: complete swipe-back or snap back
      if (mktMyViewOpenRef.current && mktMyViewRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          mktMyViewRef.current.style.animation = 'none'
          mktMyViewRef.current.style.transition = 'transform 0.38s ease'
          mktMyViewRef.current.style.transform = 'translateX(100%)'
          if (mktMyViewBackdropRef.current) { mktMyViewBackdropRef.current.style.transition = 'opacity 0.38s ease'; mktMyViewBackdropRef.current.style.opacity = '0' }
          setTimeout(() => setMktMyView(null), 290)
        } else {
          mktMyViewRef.current.style.animation = 'none'
          mktMyViewRef.current.style.transition = 'transform 0.25s ease'
          mktMyViewRef.current.style.transform = 'translateX(0)'
          if (mktMyViewBackdropRef.current) { mktMyViewBackdropRef.current.style.transition = 'opacity 0.25s ease'; mktMyViewBackdropRef.current.style.opacity = '1' }
          setTimeout(() => { if (mktMyViewRef.current) mktMyViewRef.current.style.transition = ''; if (mktMyViewBackdropRef.current) mktMyViewBackdropRef.current.style.transition = '' }, 260)
        }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      // Search overlay: swipe-back or snap back
      if (searchOverlayOpenRef.current && searchOverlayRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          searchOverlayRef.current.style.animation = 'none'
          searchOverlayRef.current.style.transition = 'transform 0.38s ease'
          searchOverlayRef.current.style.transform = 'translateX(100%)'
          if (searchBackdropRef.current) { searchBackdropRef.current.style.transition = 'opacity 0.38s ease'; searchBackdropRef.current.style.opacity = '0' }
          setTimeout(() => setSearchOverlay(false), 400)
        } else {
          searchOverlayRef.current.style.animation = 'none'
          searchOverlayRef.current.style.transition = 'transform 0.25s ease'
          searchOverlayRef.current.style.transform = 'translateX(0)'
          if (searchBackdropRef.current) { searchBackdropRef.current.style.transition = 'opacity 0.25s ease'; searchBackdropRef.current.style.opacity = '1' }
          setTimeout(() => { if (searchOverlayRef.current) searchOverlayRef.current.style.transition = ''; if (searchBackdropRef.current) searchBackdropRef.current.style.transition = '' }, 260)
        }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      // Listing detail: swipe-back or snap back
      if (selectedListingRef.current) {
        if (swipeLocked.current === 'h' && swipeXRef.current > 80) {
          if (listingDetailRef.current) {
            listingDetailRef.current.style.animation = 'none'
            listingDetailRef.current.style.transition = 'transform 0.38s ease'
            listingDetailRef.current.style.transform = 'translateX(100%)'
          }
          if (listingBackdropRef.current) { listingBackdropRef.current.style.transition = 'opacity 0.38s ease'; listingBackdropRef.current.style.opacity = '0' }
          setTimeout(() => setSelectedListing(null), 400)
        } else {
          if (listingDetailRef.current) {
            listingDetailRef.current.style.animation = 'none'
            listingDetailRef.current.style.transition = 'transform 0.25s ease'
            listingDetailRef.current.style.transform = 'translateX(0)'
            setTimeout(() => { if (listingDetailRef.current) listingDetailRef.current.style.transition = '' }, 260)
          }
          if (listingBackdropRef.current) { listingBackdropRef.current.style.transition = 'opacity 0.25s ease'; listingBackdropRef.current.style.opacity = '1'; setTimeout(() => { if (listingBackdropRef.current) listingBackdropRef.current.style.transition = '' }, 260) }
        }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      if (pageRef.current !== 'feed' && pageRef.current !== 'market' && pageRef.current !== 'messages' && pageRef.current !== 'profile' && pageRef.current !== 'search') return
      if (pageRef.current === 'profile') {
        const tabs = ['Posts','Comments','Saved'] as const
        const idx = tabs.indexOf(profileTabRef.current)
        let newTab: typeof tabs[number] | null = null
        if (swipeLocked.current === 'h' && Math.abs(swipeXRef.current) > 40) {
          if (swipeXRef.current < 0 && idx < tabs.length - 1) newTab = tabs[idx + 1]
          if (swipeXRef.current > 0 && idx > 0) newTab = tabs[idx - 1]
        }
        if (newTab) {
          const dir = profileSwipeDir.current
          if (profileBodyRef.current) {
            profileBodyRef.current.style.transition = 'transform 0.18s ease'
            profileBodyRef.current.style.transform = `translateX(${dir * window.innerWidth}px)`
          }
          const newIdx = tabs.indexOf(newTab)
          if (profileIndicatorRef.current) {
            profileIndicatorRef.current.style.transition = 'left 0.22s cubic-bezier(0.4,0,0.2,1)'
            profileIndicatorRef.current.style.left = `${newIdx * 33.333}%`
          }
          setTimeout(() => {
            setProfileTab(newTab!)
            if (profileBodyRef.current) {
              profileBodyRef.current.style.transition = 'none'
              profileBodyRef.current.style.transform = `translateX(${-dir * window.innerWidth}px)`
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (profileBodyRef.current) {
                    profileBodyRef.current.style.transition = 'transform 0.22s ease'
                    profileBodyRef.current.style.transform = 'translateX(0)'
                    setTimeout(() => { if (profileBodyRef.current) profileBodyRef.current.style.transition = '' }, 230)
                  }
                })
              })
            }
          }, 190)
        } else if (swipeLocked.current === 'h') {
          if (profileBodyRef.current) {
            profileBodyRef.current.style.transition = 'transform 0.25s ease'
            profileBodyRef.current.style.transform = 'translateX(0)'
            setTimeout(() => { if (profileBodyRef.current) profileBodyRef.current.style.transition = '' }, 260)
          }
          if (profileIndicatorRef.current) {
            profileIndicatorRef.current.style.transition = 'left 0.25s cubic-bezier(0.4,0,0.2,1)'
            profileIndicatorRef.current.style.left = `${idx * 33.333}%`
          }
        } else if (profPullYRef.current > 52) {
          setProfRefreshing(true); setProfPullY(0)
          await loadPosts()
          await loadUserComments()
          setProfRefreshing(false)
        } else { setProfPullY(0) }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      if (pageRef.current === 'search') {
        if (srchPullYRef.current > 52) {
          setSrchRefreshing(true); setSrchPullY(0)
          await loadPosts()
          setSrchRefreshing(false)
        } else { setSrchPullY(0) }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      if (pageRef.current === 'market') {
        if (mktPullYRef.current > 52) {
          setMktRefreshing(true); setMktPullY(0)
          await loadListings()
          setMktRefreshing(false)
        } else { setMktPullY(0) }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      if (pageRef.current === 'messages') {
        if (msgPullYRef.current > 52) {
          setMsgRefreshing(true); setMsgPullY(0)
          await loadConvos()
          setMsgRefreshing(false)
        } else { setMsgPullY(0) }
        swipeLocked.current = null; swipeXRef.current = 0; return
      }
      // Reset indicator transition (feed only)
      if (indicatorRef.current) indicatorRef.current.style.transition = 'left 0.25s cubic-bezier(0.4,0,0.2,1)'
      if (pullYRef.current > 52) {
        setRefreshing(true); setPullY(0)
        await loadPosts()
        setRefreshing(false)
      } else { setPullY(0) }
      const tabs = ['Top','Heha!','New'] as const
      const idx = tabs.indexOf(feedTabRef.current as any)
      let newTab: typeof tabs[number] | null = null
      if (swipeLocked.current === 'h' && Math.abs(swipeXRef.current) > 40) {
        if (swipeXRef.current < 0 && idx < tabs.length - 1) newTab = tabs[idx + 1]
        if (swipeXRef.current > 0 && idx > 0) newTab = tabs[idx - 1]
      }
      if (newTab) {
        const dir = feedSwipeDir.current // 1 = swiped right (going prev), -1 = swiped left (going next)
        // Slide current content out
        if (feedBodyRef.current) {
          feedBodyRef.current.style.transition = 'transform 0.18s ease'
          feedBodyRef.current.style.transform = `translateX(${dir * window.innerWidth}px)`
        }
        // Animate indicator to new tab
        const newIdx = tabs.indexOf(newTab)
        if (indicatorRef.current) {
          indicatorRef.current.style.transition = 'left 0.22s cubic-bezier(0.4,0,0.2,1)'
          indicatorRef.current.style.left = `${newIdx * 33.333}%`
        }
        setTimeout(() => {
          setFeedTab(newTab!)
          window.scrollTo(0, 0)
          // Position new content from opposite side, then slide in
          if (feedBodyRef.current) {
            feedBodyRef.current.style.transition = 'none'
            feedBodyRef.current.style.transform = `translateX(${-dir * window.innerWidth}px)`
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (feedBodyRef.current) {
                  feedBodyRef.current.style.transition = 'transform 0.22s ease'
                  feedBodyRef.current.style.transform = 'translateX(0)'
                  setTimeout(() => { if (feedBodyRef.current) feedBodyRef.current.style.transition = '' }, 230)
                }
              })
            })
          }
        }, 190)
      } else {
        // Snap back — no tab change
        if (feedBodyRef.current) {
          feedBodyRef.current.style.transition = 'transform 0.25s ease'
          feedBodyRef.current.style.transform = 'translateX(0)'
          setTimeout(() => { if (feedBodyRef.current) feedBodyRef.current.style.transition = '' }, 260)
        }
        if (indicatorRef.current) {
          indicatorRef.current.style.transition = 'left 0.25s cubic-bezier(0.4,0,0.2,1)'
          indicatorRef.current.style.left = `${idx * 33.333}%`
        }
      }
      swipeLocked.current = null
      swipeXRef.current = 0
    }
    document.addEventListener('touchstart', onTS, { passive: true })
    document.addEventListener('touchmove', onTM, { passive: false })
    document.addEventListener('touchend', onTE, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTS)
      document.removeEventListener('touchmove', onTM)
      document.removeEventListener('touchend', onTE)
    }
  }, [])

  // ── Post Card ──
  function PostCard({ p }: { p: Post }) {
    const isAnon = p.is_anon
    const name = isAnon ? 'Anonymous' : (p.profiles?.username||'用户')
    const mv = (p as any).my_vote
    const score = p.likes_count - (p.dislikes_count||0)
    const cmtsOpen = !!openCmts[p.id]
    const { tagLine, body } = splitTaggedText(p.text)
    const matchTag = POST_TAGS.find(t => t.tag === tagLine)
    const commentCount = p.comments_count || 0
    const repostCount = (p as any).reposts_count || 0
    const useCompactVoteRow = !matchTag && (!p.images || p.images.length === 0) && !(p as any).repost_of

    return (
      <div onClick={()=>openPost(p)} style={{ borderBottom:`1px solid ${C.border}`, padding:'12px 16px 10px', display:'flex', gap:'12px', background:C.bg, cursor:'pointer' }}>
        {/* avatar — wrapper div shows bg color while img loads, preventing flash */}
        <div style={{width:'36px',height:'36px',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:avColor(p.user_id)}}>
          <img src={avImg(p.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
        </div>
        {/* main */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'3px',flexWrap:'wrap'}}>
            <span style={{fontWeight:700,fontSize:'0.92rem',color:C.text}}>{name}</span>
            <span style={{color:C.muted,fontSize:'0.8rem'}}>{ago(p.created_at)}</span>
            {p.is_hot && <span style={{background:'#fef3c7',color:'#d97706',borderRadius:'4px',padding:'1px 6px',fontSize:'0.68rem',fontWeight:700}}>🔥 HOT</span>}
          </div>
          {matchTag && <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'16px',fontSize:'0.72rem',fontWeight:800,marginBottom:'6px',background:matchTag.bg,color:matchTag.color}}>{matchTag.emoji} {matchTag.tag}</span>}
          <div onClick={()=>openPost(p)} style={{cursor:'pointer',fontSize:'0.95rem',lineHeight:'1.55',color:C.text,wordBreak:'break-word'}}>{body}</div>
          {p.images&&p.images.length>0&&<div style={{display:'grid',gridTemplateColumns:p.images.length===1?'1fr':'1fr 1fr',gap:'4px',marginTop:'10px',borderRadius:'12px',overflow:'hidden'}}>{p.images.slice(0,4).map((url,i)=><img key={i} src={url} alt="" style={{width:'100%',height:p.images.length===1?'220px':'130px',objectFit:'cover'}}/>)}</div>}
          {(p as any).repost_of&&(
            <div style={{border:`1.5px solid ${C.border}`,borderRadius:'14px',padding:'14px 14px',marginTop:'10px',background:C.bg,cursor:'pointer'}} onClick={e=>{e.stopPropagation();openPost((p as any).repost_of)}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <img src={avImg((p as any).repost_of.user_id)} alt="" style={{width:'24px',height:'24px',borderRadius:'50%',objectFit:'cover'}}/>
                <span style={{fontSize:'0.85rem',fontWeight:700,color:C.text}}>{(p as any).repost_of.is_anon?'Anonymous':((p as any).repost_of.profiles?.username||'User')}</span>
                <span style={{fontSize:'0.78rem',color:C.muted}}>{ago((p as any).repost_of.created_at)}</span>
              </div>
              <div style={{fontSize:'0.92rem',color:C.text,lineHeight:'1.5'}}>{(p as any).repost_of.text}</div>
              {(p as any).repost_of.images&&(p as any).repost_of.images.length>0&&<img src={(p as any).repost_of.images[0]} alt="" style={{width:'100%',maxHeight:'160px',objectFit:'cover',borderRadius:'10px',marginTop:'8px'}}/>}
            </div>
          )}
          {/* action row — matches Fizz: DM, Comment, Repost, Share, ••• */}
          {(() => { const ic = resolved==='light'?'#555':'#aaa'; return (
          <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'6px',paddingBottom:0}}>
            <button onClick={()=>{setDmTarget(p);setShowDm(true)}} style={{display:'flex',alignItems:'center',background:'none',border:'none',color:ic,cursor:'pointer',padding:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
            <button onClick={()=>openPost(p)} style={{display:'flex',alignItems:'center',gap:'5px',background:'none',border:'none',color:ic,cursor:'pointer',fontSize:'0.88rem',fontWeight:700,padding:0,fontFamily:'inherit'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              {commentCount > 0 ? commentCount : null}
            </button>
            <button onClick={()=>{setRepostTarget(p);setShowRepost(true)}} style={{display:'flex',alignItems:'center',gap:'5px',background:'none',border:'none',color:ic,cursor:'pointer',fontSize:'0.88rem',fontWeight:700,padding:0,fontFamily:'inherit'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              {repostCount > 0 ? repostCount : null}
            </button>
            <button style={{display:'flex',alignItems:'center',background:'none',border:'none',color:ic,cursor:'pointer',padding:0}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </button>
            {useCompactVoteRow && (
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'2px'}}>
                <button onClick={()=>vote(p,'up')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='up'?C.upvote:C.muted,padding:'4px',display:'flex'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={mv==='up'?C.upvote:'none'} stroke={mv==='up'?C.upvote:'currentColor'} strokeWidth="2.1"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <span style={{fontWeight:800,fontSize:'0.96rem',minWidth:'12px',textAlign:'center',color:score>0?C.upvote:score<0?C.red:C.muted}}>{score}</span>
                <button onClick={()=>vote(p,'down')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='down'?C.red:C.muted,padding:'4px',display:'flex'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={mv==='down'?C.red:'none'} stroke={mv==='down'?C.red:'currentColor'} strokeWidth="2.1"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
            )}
            <div style={{position:'relative',marginLeft:useCompactVoteRow?'8px':'auto'}}>
              <button onClick={e=>{e.stopPropagation();setShowPostMenu(showPostMenu===p.id?null:p.id)}} style={{display:'flex',alignItems:'center',background:'none',border:'none',color:ic,cursor:'pointer',padding:'2px 4px',fontSize:'1.1rem',letterSpacing:'1px',fontWeight:800}}>•••</button>
              {showPostMenu===p.id&&(
                <div style={{position:'absolute',right:0,bottom:'30px',background:resolved==='light'?'rgba(255,255,255,0.45)':'rgba(40,40,60,0.4)',backdropFilter:'blur(40px) saturate(200%)',WebkitBackdropFilter:'blur(40px) saturate(200%)',borderRadius:'14px',overflow:'hidden',zIndex:200,minWidth:'170px',boxShadow:`0 8px 32px ${resolved==='light'?'rgba(0,0,0,0.1)':'rgba(0,0,0,0.35)'}`,border:`1px solid ${resolved==='light'?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.08)'}`,transformOrigin:'bottom right',animation:'bubblePop 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards'}}>
                  <button onClick={()=>setShowPostMenu(null)} style={{width:'100%',padding:'13px 16px',background:'none',border:'none',cursor:'pointer',color:C.text,fontFamily:'inherit',fontWeight:700,fontSize:'0.9rem',textAlign:'left' as const,display:'flex',alignItems:'center',gap:'10px'}}>
                    <span>🚨</span> Report
                  </button>
                  {p.user_id===profile!.id&&(
                    <button onClick={()=>{deletePst(p.id);setShowPostMenu(null)}} style={{width:'100%',padding:'13px 16px',background:'none',border:'none',borderTop:`1px solid ${resolved==='light'?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',color:C.red,fontFamily:'inherit',fontWeight:700,fontSize:'0.9rem',textAlign:'left' as const,display:'flex',alignItems:'center',gap:'10px'}}>
                      <span>🗑️</span> Delete
                    </button>
                  )}
                  {p.user_id!==profile!.id&&(
                    <button onClick={()=>setShowPostMenu(null)} style={{width:'100%',padding:'13px 16px',background:'none',border:'none',borderTop:`1px solid ${resolved==='light'?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',color:C.text,fontFamily:'inherit',fontWeight:700,fontSize:'0.9rem',textAlign:'left' as const,display:'flex',alignItems:'center',gap:'10px'}}>
                      <span>🚫</span> Block this user
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          )})()}
          {/* comments */}
          {cmtsOpen && (
            <div style={{marginTop:'12px',paddingTop:'12px',borderTop:`1px solid ${C.border}`}}>
              {openCmts[p.id].map(c=>(
                <div key={c.id} style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                  <div style={{width:'26px',height:'26px',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:avColor(c.user_id)}}>
                    <img src={avImg(c.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                  <div>
                    <span style={{fontWeight:700,fontSize:'0.82rem',color:C.text}}>Anonymous </span>
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
        {!useCompactVoteRow && <div onClick={e=>e.stopPropagation()} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',minWidth:'44px',padding:'4px 0'}}>
          <button onClick={()=>vote(p,'up')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='up'?C.upvote:C.muted,padding:'6px'}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill={mv==='up'?C.upvote:'none'} stroke={mv==='up'?C.upvote:'currentColor'} strokeWidth="2.2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <span style={{fontWeight:800,fontSize:'1.1rem',color:score>0?C.upvote:score<0?C.red:C.muted}}>{score}</span>
          <button onClick={()=>vote(p,'down')} style={{background:'none',border:'none',cursor:'pointer',color:mv==='down'?C.red:C.muted,padding:'6px'}}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill={mv==='down'?C.red:'none'} stroke={mv==='down'?C.red:'currentColor'} strokeWidth="2.2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>}
      </div>
    )
  }

  // ── SPLASH ──
  if (showSplash) return (
    <div className="splash-bg" style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9999,overflow:'hidden'}}>
      {splashZoom && <div className="splash-flash" style={{position:'absolute',inset:0,background:'white',zIndex:2,pointerEvents:'none'}}/>}
      <img
        src="/logo-main.jpg"
        alt="heha"
        className={splashZoom ? 'splash-logo-zoom' : 'splash-logo-in'}
        style={{width:'90px',height:'90px',borderRadius:'22px',objectFit:'cover',position:'relative',zIndex:1}}
      />
      {!splashZoom && (
        <div className="splash-logo-in" style={{marginTop:'20px',color:'white',fontSize:'1.5rem',fontWeight:900,letterSpacing:'0.15em',fontFamily:"'Nunito',sans-serif",animationDelay:'0.15s',opacity:0}}>
          HEHA
        </div>
      )}
    </div>
  )

  // ── AUTH ──
  if (!session||!profile) return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:'20px',fontFamily:"'Varela Round','Nunito','SF Pro Rounded',-apple-system,sans-serif"}}>
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

  const mktFiltered = listings.filter(l=>{
    if (mktHideSold && l.is_sold) return false
    if (mktCat && mktCat!=='all' && l.category!==mktCat) return false
    if (mktCondFilter && (l as any).condition !== mktCondFilter) return false
    if (mktSearch && !l.title.toLowerCase().includes(mktSearch.toLowerCase()) && !l.description?.toLowerCase().includes(mktSearch.toLowerCase())) return false
    return true
  }).sort((a,b)=>{
    if (mktSort==='oldest') return new Date(a.created_at).getTime()-new Date(b.created_at).getTime()
    if (mktSort==='lowest') return a.price-b.price
    if (mktSort==='highest') return b.price-a.price
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime() // newest
  })
  const topBar = (title: React.ReactNode, right?: React.ReactNode, noBorder?: boolean) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px',background:C.bg,position:'sticky',top:0,zIndex:100,...(noBorder?{}:{borderBottom:`1px solid ${C.border}`})}}>
      <div style={{fontWeight:700,fontSize:'1.05rem',display:'flex',alignItems:'center',gap:'8px'}}>{title}</div>
      {right}
    </div>
  )

  return (
    <div
      style={{minHeight:'100dvh',background:C.bg,color:C.text,fontFamily:"'Varela Round','Nunito','SF Pro Rounded',-apple-system,sans-serif",fontWeight:700,maxWidth:'430px',margin:'0 auto',position:'relative',paddingBottom:'100px',WebkitFontSmoothing:'antialiased',letterSpacing:'0.01em',overscrollBehavior:'none'}}
    >

      {/* ─── FEED ─── */}
      {page==='feed' && <div className="feed-swipe">
        {topBar(
          <><img src="/logo-main.jpg" alt="" style={{width:'30px',height:'30px',borderRadius:'50%',objectFit:'cover',border:`1.5px solid ${C.border}`}}/><span style={{fontWeight:800,fontSize:'1rem'}}>Heha</span></>,
          <button onClick={()=>setShowActivity(true)} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </button>,
          true
        )}
        <div style={{background:C.bg,position:'sticky',top:'53px',zIndex:99,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',position:'relative'}}>
            {(['Top','Heha!','New'] as const).map(t=>(
              <div key={t} onClick={()=>setFeedTab(t)} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:feedTab===t?900:700,color:feedTab===t?C.text:C.muted,cursor:'pointer',transition:'color .2s'}}>
                {t}
              </div>
            ))}
            {/* sliding indicator — follows finger via ref, no re-render */}
            <div ref={indicatorRef} style={{position:'absolute',bottom:0,height:'2.5px',width:'33.333%',background:C.text,borderRadius:'2px',left:`${(['Top','Heha!','New'].indexOf(feedTab))*33.333}%`,transition:'left 0.25s cubic-bezier(0.4,0,0.2,1)'}}/>
          </div>
        </div>
        {/* pull-to-refresh indicator */}
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden',height: refreshing ? '52px' : `${pullY}px`,transition: pullY===0 ? 'height 0.25s ease' : 'none'}}>
          <div className={refreshing ? 'spin' : ''} style={{width:'22px',height:'22px',borderRadius:'50%',border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accentBright}`,transform: refreshing ? undefined : `rotate(${pullY*4}deg)`,transition: refreshing ? 'none' : 'transform 0.1s'}}/>
        </div>
        <div ref={feedBodyRef} style={{willChange:'transform'}}>
          {sorted().map(p=><React.Fragment key={p.id}>{PostCard({p})}</React.Fragment>)}
          {posts.length===0&&!refreshing&&<div style={{textAlign:'center',padding:'60px',color:C.muted}}>还没有帖子，来发第一条吧！</div>}
        </div>
        <button onClick={()=>openPostModal()} style={{position:'fixed',bottom:'105px',right:'16px',background:'#1a3a5c',color:'white',border:'none',borderRadius:'28px',padding:'13px 18px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:fabExpanded?'6px':'0',boxShadow:'0 4px 20px rgba(26,58,92,0.5)',zIndex:150,transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',whiteSpace:'nowrap'}}>
          <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0}}>＋</span>
          <span style={{maxWidth:fabExpanded?'50px':'0',overflow:'hidden',opacity:fabExpanded?1:0,transition:'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',whiteSpace:'nowrap'}}>Post</span>
        </button>
      </div>}

      {/* ─── MESSAGES ─── */}
      {page==='messages' && <>
        {topBar('Messages', undefined, true)}
        {/* Messages pull-to-refresh indicator */}
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden',height:msgRefreshing?'52px':`${msgPullY}px`,transition:msgPullY===0?'height 0.25s ease':'none'}}>
          <div className={msgRefreshing?'spin':''} style={{width:'22px',height:'22px',borderRadius:'50%',border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accentBright}`,transform:msgRefreshing?undefined:`rotate(${msgPullY*4}deg)`,transition:msgRefreshing?'none':'transform 0.1s'}}/>
        </div>
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
          <div onClick={()=>setMsgTab('posts')} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:msgTab==='posts'?700:400,color:msgTab==='posts'?C.text:C.muted,borderBottom:msgTab==='posts'?`2px solid ${C.text}`:'2px solid transparent',cursor:'pointer'}}>Posts</div>
          <div onClick={()=>setMsgTab('market')} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:msgTab==='market'?700:400,color:msgTab==='market'?C.text:C.muted,borderBottom:msgTab==='market'?`2px solid ${C.text}`:'2px solid transparent',cursor:'pointer'}}>Marketplace</div>
        </div>
        {(()=>{
          const filtered = convos.filter(({user:u})=>msgTab==='market'?mktConvoPartners.includes(u.id):!mktConvoPartners.includes(u.id))
          return filtered.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',gap:'16px',color:C.muted}}>
              <div style={{fontSize:'3.5rem'}}>{msgTab==='market'?'🛒':'✈️'}</div>
              <div style={{fontWeight:700,fontSize:'1.1rem',color:C.text}}>{msgTab==='market'?'No marketplace messages.':'No messages yet.'}</div>
              <div style={{fontSize:'0.9rem',textAlign:'center',lineHeight:'1.5'}}>{msgTab==='market'?'Messages with sellers will appear here.':'Start a conversation. Messages you send or receive will appear here.'}</div>
            </div>
          ) : filtered.map(({user:u,lastMsg})=>(
            <div key={u.id} onClick={()=>openChat(u)} style={{display:'flex',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',alignItems:'center'}}>
            <img src={avImg(u.id)} alt="" style={{width:'46px',height:'46px',borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:'0.95rem'}}>Anonymous</div>
              <div style={{fontSize:'0.85rem',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formatMessagePreview(lastMsg)}</div>
            </div>
            {lastMsg&&<div style={{fontSize:'0.75rem',color:C.muted,flexShrink:0}}>{ago(lastMsg.created_at)}</div>}
          </div>
          ))
        })()}
        {/* Chat detail — fixed overlay, slides in from right like post detail */}
        {chatTarget&&(<>
          <div ref={chatBackdropRef} className="fade-in" style={{position:'fixed',inset:0,zIndex:299,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
          <div ref={chatDetailRef} className="slide-in-right" style={{position:'fixed',inset:0,zIndex:300,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden',overscrollBehavior:'contain'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,position:'relative' as const,paddingTop:'calc(14px + env(safe-area-inset-top))',background:C.bg,zIndex:10,flexShrink:0}}>
              <button onClick={closeChat} style={{background:'none',border:'none',cursor:'pointer',color:C.text,fontSize:'1.3rem',padding:0}}>←</button>
              <img src={avImg(chatTarget.id)} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              <div style={{fontWeight:700,flex:1}}>Anonymous</div>
              <button onClick={()=>setShowChatMenu(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'1.2rem',padding:'4px'}}>•••</button>
              {showChatMenu&&(
                <div style={{position:'absolute' as const,top:'52px',right:'12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'4px',zIndex:600,boxShadow:`0 4px 16px ${C.shadow}`,minWidth:'150px'}}>
                  <button onClick={clearChat} style={{width:'100%',padding:'10px 14px',background:'none',border:'none',color:C.red,cursor:'pointer',textAlign:'left' as const,fontFamily:'inherit',fontSize:'0.9rem',borderRadius:'8px'}}>🗑 删除聊天记录</button>
                </div>
              )}
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px',overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}} onClick={()=>{setSelectedMsg(null);setShowChatMenu(false)}}>
              {chatMsgs.map(m=>{
                const mine = m.from_user_id===profile.id
                const canRecall = mine && (Date.now()-new Date(m.created_at).getTime()) < 2*60*1000
                const isSel = selectedMsg?.id===m.id
                const isPostContext = m.metadata?.type === 'post_context'
                return (
                  <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'76%'}}>
                    <div onClick={e=>{e.stopPropagation();mine&&setSelectedMsg(isSel?null:m)}} style={{padding:isPostContext?'12px':'10px 14px',borderRadius:'18px',fontSize:'0.92rem',lineHeight:'1.4',background:isPostContext?(resolved==='light'?'#fff1de':'#2d2118'):(mine?C.accentBright:(resolved==='light'?'#e5e7eb':C.surface2)),color:mine&&!isPostContext?'white':C.text,border:isPostContext?`1px solid ${C.border}`:'none',borderBottomRightRadius:mine&&!isPostContext?'4px':'18px',borderBottomLeftRadius:mine?'18px':'4px',cursor:mine?'pointer':'default'}}>
                      {isPostContext ? (
                        <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                          <div style={{fontSize:'0.72rem',fontWeight:800,color:C.accentBright,textTransform:'uppercase',letterSpacing:'0.04em'}}>Post Context</div>
                          <div style={{fontSize:'0.9rem',fontWeight:700}}>来自这条帖子</div>
                          <div style={{fontSize:'0.86rem',color:C.muted}}>{m.metadata?.post_preview || '查看原帖'}</div>
                        </div>
                      ) : m.text}
                    </div>
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
            <div style={{padding:'10px 12px',paddingBottom:`calc(${10 + keyboardInset}px + env(safe-area-inset-bottom))`,flexShrink:0,background:C.bg,zIndex:10,borderTop:`1px solid ${C.border}`}}>
              <div style={{display:'flex',gap:'8px',alignItems:'center',background:resolved==='light'?'rgba(240,240,240,0.85)':'rgba(255,255,255,0.08)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderRadius:'24px',padding:'6px 6px 6px 16px'}}>
                <input ref={chatInputRef} style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.text,fontSize:'0.92rem',fontFamily:'inherit',fontWeight:600}} placeholder="Message…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} />
                <button onClick={sendMsg} style={{width:'36px',height:'36px',borderRadius:'50%',background:C.accentBright,color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </>)}
      </>}

      {/* ─── SEARCH / DISCOVER ─── */}
      {page==='search' && <div className="feed-swipe">
        {/* Sticky search bar */}
        <div style={{position:'sticky',top:0,zIndex:100,background:C.bg,padding:'12px 16px',borderBottom:searchQ?`1px solid ${C.border}`:'none'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'24px',padding:'10px 16px'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:'0.95rem',outline:'none',fontFamily:'inherit'}} placeholder="Search heha" value={searchQ} onChange={e=>{setSearchQ(e.target.value);setSearchOverlay(false)}} onKeyDown={e=>{if(e.key==='Enter'&&searchQ.trim()) setSearchOverlay(true)}}/>
            {searchQ&&<button onClick={()=>{setSearchQ('');setSearchOverlay(false)}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:0,fontSize:'1.1rem'}}>✕</button>}
          </div>
        </div>
        {/* Search results — tapping a suggestion or pressing enter opens overlay */}
        {searchQ && !searchOverlay && <>
          <div style={{padding:'8px 16px'}}>
            {searchRes.length>0 ? searchRes.slice(0,5).map(p=>(
              <div key={p.id} onClick={()=>setSearchOverlay(true)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div style={{flex:1,fontSize:'0.92rem',color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.text.slice(0,80)}</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            )) : <div style={{color:C.muted,textAlign:'center',padding:'60px'}}>没有找到结果</div>}
            {searchRes.length>5&&<button onClick={()=>setSearchOverlay(true)} style={{width:'100%',padding:'14px',textAlign:'center',color:C.accentBright,fontWeight:700,fontSize:'0.92rem',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>查看全部 {searchRes.length} 个结果 →</button>}
          </div>
        </>}
        {/* Discover sections */}
        {!searchQ && (()=>{
          const pullEl = (
            <div key="pull" style={{display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden',height:srchRefreshing?'52px':`${srchPullY}px`,transition:srchPullY===0?'height 0.25s ease':'none'}}>
              <div className={srchRefreshing?'spin':''} style={{width:'22px',height:'22px',borderRadius:'50%',border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accentBright}`,transform:srchRefreshing?undefined:`rotate(${srchPullY*4}deg)`,transition:srchRefreshing?'none':'transform 0.1s'}}/>
            </div>
          )
          const taggedSections = POST_TAGS.map(tagDef=>{
            const tagPosts = posts.filter(p=>p.text.startsWith(tagDef.tag+'\n')||p.text===tagDef.tag)
            return {tagDef,tagPosts}
          }).filter(s=>s.tagPosts.length>0)
          const taggedIds = new Set(taggedSections.flatMap(s=>s.tagPosts.map(p=>p.id)))
          const recentPosts = posts.filter(p=>!taggedIds.has(p.id)).slice(0,10)
          const sections = [...taggedSections,...(recentPosts.length>0?[{tagDef:{tag:'RECENT',emoji:'🆕',bg:resolved==='light'?'#f0f4ff':'rgba(99,102,241,0.15)',color:'#6366f1'},tagPosts:recentPosts}]:[])]
          return <>
            {pullEl}
            <div style={{paddingBottom:'20px'}}>
              {sections.map(({tagDef,tagPosts})=>(
                <div key={tagDef.tag}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px'}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 14px',borderRadius:'20px',background:tagDef.bg,color:tagDef.color,fontWeight:800,fontSize:'0.82rem',letterSpacing:'0.5px'}}>
                      <span>{tagDef.emoji}</span><span>{tagDef.tag}</span>
                    </div>
                    <button onClick={()=>{setSearchQ(tagDef.tag);setSearchOverlay(true)}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'0.82rem',fontWeight:700,display:'flex',alignItems:'center',gap:'3px',fontFamily:'inherit'}}>
                      VIEW MORE <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                  <div style={{display:'flex',gap:'10px',overflowX:'auto',paddingLeft:'16px',paddingRight:'16px',paddingBottom:'12px',scrollbarWidth:'none'} as React.CSSProperties}>
                    {tagPosts.slice(0,8).map(p=>{
                      const displayText=p.text.startsWith(tagDef.tag+'\n')?p.text.slice(tagDef.tag.length+1).trim():p.text
                      const hasImg=p.images&&p.images.length>0
                      return (
                        <div key={p.id} onClick={()=>openPost(p)} style={{flexShrink:0,width:'210px',borderRadius:'16px',border:`1px solid ${C.border}`,background:C.bg,cursor:'pointer',overflow:'hidden',boxShadow:resolved==='light'?'0 2px 10px rgba(0,0,0,0.07)':'none'}}>
                          <div style={{padding:'12px 12px 8px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'7px'}}>
                              <div style={{width:'28px',height:'28px',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:avColor(p.user_id)}}>
                                <img src={avImg(p.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              </div>
                              <span style={{fontWeight:700,fontSize:'0.8rem',color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.is_anon?'Anonymous':(p.profiles?.username||'User')}</span>
                              <span style={{color:C.muted,fontSize:'0.72rem',flexShrink:0}}>{ago(p.created_at)}</span>
                            </div>
                            <div style={{fontSize:'0.87rem',color:C.text,lineHeight:'1.45',display:'-webkit-box',overflow:'hidden',WebkitBoxOrient:'vertical',WebkitLineClamp:hasImg?2:4} as React.CSSProperties}>{displayText}</div>
                          </div>
                          {hasImg&&<img src={(p.images as string[])[0]} alt="" style={{width:'100%',height:'120px',objectFit:'cover',display:'block'}}/>}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{height:'1px',background:C.border}}/>
                </div>
              ))}
              {sections.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'80px 20px',fontSize:'0.95rem'}}>暂无内容，快去发帖吧！</div>}
            </div>
          </>
        })()}
      </div>}

      {/* ─── SEARCH RESULTS OVERLAY ─── */}
      {searchOverlay&&searchQ&&(<>
        <div ref={searchBackdropRef} className="fade-in" style={{position:'fixed',inset:0,zIndex:249,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
        <div ref={searchOverlayRef} className="slide-in-right" style={{position:'fixed',inset:0,zIndex:250,background:C.bg,display:'flex',flexDirection:'column',overflowY:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',paddingTop:'calc(14px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,background:C.bg,zIndex:10}}>
            <button onClick={closeSearchOverlay} style={{width:'36px',height:'36px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>‹</button>
            <span style={{fontWeight:800,fontSize:'1.05rem',color:C.text,flex:1}}>「{searchQ}」的搜索结果</span>
            <span style={{fontSize:'0.85rem',color:C.muted}}>{searchRes.length}条</span>
          </div>
          {searchRes.length>0
            ? searchRes.map(p=><React.Fragment key={p.id}>{PostCard({p})}</React.Fragment>)
            : <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
                <div style={{fontSize:'3rem',opacity:.4}}>🔍</div>
                <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>没有找到结果</div>
              </div>
          }
        </div>
      </>)}

      {/* ─── MARKET ─── */}
      {page==='market' && <>
        {/* Search bar */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:`1px solid ${C.border}`}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'22px',padding:'10px 14px'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={mktSearch} onChange={e=>setMktSearch(e.target.value)} placeholder="Search Rice Marketplace" style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.text,fontSize:'0.9rem',fontFamily:'inherit'}}/>
          </div>
          <button onClick={()=>setMktMyView('saved')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={mktMyView==='saved'?C.text:'none'} stroke={C.text} strokeWidth="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
          <button onClick={()=>setMktMyView('mine')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={mktMyView==='mine'?C.accentBright:C.text} strokeWidth="2.2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </button>
        </div>
        {/* Filter pills */}
        <div style={{display:'flex',gap:'8px',padding:'10px 12px',overflowX:'auto',borderBottom:`1px solid ${C.border}`,scrollbarWidth:'none'}}>
          <button onClick={()=>setShowSortSheet(true)} style={{flexShrink:0,display:'flex',alignItems:'center',gap:'4px',padding:'7px 14px',borderRadius:'20px',border:`1px solid ${mktSort!=='newest'?C.accentBright:C.border}`,background:mktSort!=='newest'?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',color:mktSort!=='newest'?C.accentBright:C.text,fontSize:'0.84rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {mktSort==='newest'?'Sort by':mktSort==='oldest'?'Oldest':mktSort==='lowest'?'Lowest $':'Highest $'} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 16 12 21 17 16"/><polyline points="7 8 12 3 17 8"/></svg>
          </button>
          <button onClick={()=>setMktHideSold(v=>!v)} style={{flexShrink:0,padding:'7px 14px',borderRadius:'20px',border:`1px solid ${mktHideSold?C.accentBright:C.border}`,background:mktHideSold?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',color:mktHideSold?C.accentBright:C.text,fontSize:'0.84rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            Hide Sold
          </button>
          <button style={{flexShrink:0,display:'flex',alignItems:'center',gap:'4px',padding:'7px 14px',borderRadius:'20px',border:`1px solid ${mktCat&&mktCat!=='all'?C.accentBright:C.border}`,background:mktCat&&mktCat!=='all'?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',color:mktCat&&mktCat!=='all'?C.accentBright:C.text,fontSize:'0.84rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={()=>setShowCatSheet(true)}>
            {mktCat&&mktCat!=='all'?mktCat:'Category'} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button style={{flexShrink:0,display:'flex',alignItems:'center',gap:'4px',padding:'7px 14px',borderRadius:'20px',border:`1px solid ${mktCondFilter?C.accentBright:C.border}`,background:mktCondFilter?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',color:mktCondFilter?C.accentBright:C.text,fontSize:'0.84rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}} onClick={()=>setShowCondSheet(true)}>
            {mktCondFilter||'Condition'} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
        {/* Pull-to-refresh indicator — between filters and grid */}
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden',height:mktRefreshing?'52px':`${mktPullY}px`,transition:mktPullY===0?'height 0.25s ease':'none'}}>
          <div className={mktRefreshing?'spin':''} style={{width:'22px',height:'22px',borderRadius:'50%',border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accentBright}`,transform:mktRefreshing?undefined:`rotate(${mktPullY*4}deg)`,transition:mktRefreshing?'none':'transform 0.1s'}}/>
        </div>
        {/* Grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',padding:'12px'}}>
          {mktFiltered.map(l=>(
            <div key={l.id} onClick={()=>setSelectedListing(l)} style={{background:C.bg,borderRadius:'16px',overflow:'hidden',cursor:'pointer',border:`1px solid ${C.border}`,boxShadow:resolved==='light'?'0 2px 8px rgba(0,0,0,0.07)':'none'}}>
              <div style={{aspectRatio:'1',background:C.surface,position:'relative',overflow:'hidden'}}>
                {l.images&&l.images.length>0
                  ? <img src={l.images[0]} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.5rem'}}>{l.emoji||'📦'}</div>
                }
                {l.is_sold&&<div style={{position:'absolute',top:'8px',left:'8px',background:'rgba(0,0,0,0.82)',color:'white',borderRadius:'8px',padding:'3px 10px',fontSize:'0.75rem',fontWeight:800,letterSpacing:'.5px'}}>SOLD</div>}
              </div>
              <div style={{padding:'10px 12px 12px'}}>
                <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.text}}>{l.title}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:800,fontSize:'0.97rem',color:C.text}}>${l.price}</span>
                  <span style={{fontSize:'0.75rem',color:C.muted}}>{(l as any).condition||'Good'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {mktFiltered.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px',fontSize:'0.95rem'}}>No listings found</div>}
        {/* List FAB */}
        <button onClick={()=>setShowListing(true)} style={{position:'fixed',bottom:'105px',right:'16px',background:C.accentBright,color:'white',border:'none',borderRadius:'28px',padding:'14px 20px',fontWeight:800,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',boxShadow:'0 4px 20px rgba(37,99,235,0.4)',zIndex:150}}>
          <span style={{fontSize:'1.1rem',lineHeight:1}}>＋</span>
          <span>List</span>
        </button>


        {/* ─── MY SAVED / MY LISTINGS OVERLAY ─── */}
        {mktMyView&&(<>
          <div ref={mktMyViewBackdropRef} className="fade-in" style={{position:'fixed',inset:0,zIndex:449,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
          <div ref={mktMyViewRef} className="slide-in-right" style={{position:'fixed',inset:0,zIndex:450,background:C.bg,display:'flex',flexDirection:'column',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',paddingTop:'calc(14px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,background:C.bg,zIndex:10}}>
              <button onClick={()=>setMktMyView(null)} style={{width:'36px',height:'36px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>‹</button>
              <span style={{fontWeight:800,fontSize:'1.05rem',color:C.text}}>{mktMyView==='saved'?'My Saved':'My Listings'}</span>
            </div>
            {(() => {
              const items = mktMyView==='saved'
                ? listings.filter(l=>savedListings.includes(l.id))
                : listings.filter(l=>l.user_id===profile.id)
              return items.length===0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
                  <div style={{fontSize:'3rem',opacity:.4}}>{mktMyView==='saved'?'🔖':'🏷️'}</div>
                  <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>{mktMyView==='saved'?'No saved listings yet.':'No listings yet.'}</div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',padding:'12px'}}>
                  {items.map(l=>(
                    <div key={l.id} onClick={()=>{setSelectedListing(l);setMktMyView(null)}} style={{background:C.bg,borderRadius:'16px',overflow:'hidden',cursor:'pointer',border:`1px solid ${C.border}`,boxShadow:resolved==='light'?'0 2px 8px rgba(0,0,0,0.07)':'none'}}>
                      <div style={{aspectRatio:'1',background:C.surface,position:'relative',overflow:'hidden'}}>
                        {l.images&&l.images.length>0
                          ? <img src={l.images[0]} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.5rem'}}>{l.emoji||'📦'}</div>
                        }
                        {l.is_sold&&<div style={{position:'absolute',top:'8px',left:'8px',background:'rgba(0,0,0,0.82)',color:'white',borderRadius:'8px',padding:'3px 10px',fontSize:'0.75rem',fontWeight:800,letterSpacing:'.5px'}}>SOLD</div>}
                      </div>
                      <div style={{padding:'10px 12px 12px'}}>
                        <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.text}}>{l.title}</div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontWeight:800,fontSize:'0.97rem',color:C.text}}>${l.price}</span>
                          <span style={{fontSize:'0.75rem',color:C.muted}}>{(l as any).condition||'Good'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>)}

        {/* ─── SORT BOTTOM SHEET ─── */}
        {showSortSheet&&(
          <>
            <div onClick={()=>setShowSortSheet(false)} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.45)'}}/>
            <div className="slide-up" style={{position:'fixed',left:0,right:0,bottom:0,zIndex:501,background:C.bg,borderRadius:'20px 20px 0 0',padding:'20px 16px 40px',boxShadow:'0 -8px 40px rgba(0,0,0,0.12)'}}>
              <div style={{width:'36px',height:'4px',borderRadius:'2px',background:C.border,margin:'0 auto 20px'}}/>
              <div style={{fontWeight:800,fontSize:'1.05rem',color:C.text,marginBottom:'16px',textAlign:'center'}}>Sort by</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'10px',justifyContent:'center'}}>
                {([['newest','Newest First'],['oldest','Oldest First'],['lowest','Lowest Price First'],['highest','Highest Price First']] as const).map(([val,label])=>(
                  <button key={val} onClick={()=>{setMktSort(val);setShowSortSheet(false)}} style={{padding:'12px 22px',borderRadius:'24px',border:`2px solid ${mktSort===val?C.accentBright:C.border}`,background:mktSort===val?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',color:mktSort===val?C.accentBright:C.text,fontWeight:700,fontSize:'0.97rem',cursor:'pointer',fontFamily:'inherit'}}>{label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── CATEGORY BOTTOM SHEET ─── */}
        {showCatSheet&&(
          <>
            <div onClick={()=>setShowCatSheet(false)} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.45)'}}/>
            <div className="slide-up" style={{position:'fixed',left:0,right:0,bottom:0,zIndex:501,background:C.bg,borderRadius:'20px 20px 0 0',maxHeight:'75vh',overflowY:'auto',boxShadow:'0 -8px 40px rgba(0,0,0,0.12)'}}>
              <div style={{padding:'20px 16px 8px'}}>
                <div style={{width:'36px',height:'4px',borderRadius:'2px',background:C.border,margin:'0 auto 20px'}}/>
                <div style={{fontWeight:800,fontSize:'1.05rem',color:C.text,marginBottom:'12px',textAlign:'center'}}>Category</div>
              </div>
              <div style={{padding:'0 12px 40px',display:'flex',flexDirection:'column',gap:'6px'}}>
                <button onClick={()=>{setMktCat('all');setShowCatSheet(false)}} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderRadius:'14px',background:(!mktCat||mktCat==='all')?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):resolved==='light'?'#f5f5f7':C.surface,border:(!mktCat||mktCat==='all')?`2px solid ${C.accentBright}`:'2px solid transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%'}}>
                  <span style={{fontSize:'1.4rem',width:'32px',textAlign:'center'}}>🔍</span>
                  <span style={{fontWeight:700,fontSize:'0.97rem',color:C.text,flex:1}}>All Categories</span>
                  {(!mktCat||mktCat==='all')&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accentBright} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                {[{emoji:'👕',label:'Clothes'},{emoji:'👠',label:'Shoes'},{emoji:'🧢',label:'Hats'},{emoji:'💍',label:'Jewelry'},{emoji:'🕶️',label:'Accessories'},{emoji:'📚',label:'Books'},{emoji:'🎒',label:'School Gear'},{emoji:'📱',label:'Electronics'},{emoji:'🚲',label:'Bikes'},{emoji:'🏠',label:'Home Goods'},{emoji:'🪑',label:'Furniture'},{emoji:'🎟️',label:'Tickets'},{emoji:'❓',label:'Other'}].map(({emoji,label})=>(
                  <button key={label} onClick={()=>{setMktCat(label);setShowCatSheet(false)}} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 16px',borderRadius:'14px',background:mktCat===label?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):resolved==='light'?'#f5f5f7':C.surface,border:mktCat===label?`2px solid ${C.accentBright}`:'2px solid transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%'}}>
                    <span style={{fontSize:'1.4rem',width:'32px',textAlign:'center'}}>{emoji}</span>
                    <span style={{fontWeight:700,fontSize:'0.97rem',color:C.text,flex:1}}>{label}</span>
                    {mktCat===label&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accentBright} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ─── CONDITION BOTTOM SHEET ─── */}
        {showCondSheet&&(
          <>
            <div onClick={()=>setShowCondSheet(false)} style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.45)'}}/>
            <div className="slide-up" style={{position:'fixed',left:0,right:0,bottom:0,zIndex:501,background:C.bg,borderRadius:'20px 20px 0 0',padding:'20px 16px 40px',boxShadow:'0 -8px 40px rgba(0,0,0,0.12)'}}>
              <div style={{width:'36px',height:'4px',borderRadius:'2px',background:C.border,margin:'0 auto 20px'}}/>
              <div style={{fontWeight:800,fontSize:'1.05rem',color:C.text,marginBottom:'16px',textAlign:'center'}}>Condition</div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <button onClick={()=>{setMktCondFilter('');setShowCondSheet(false)}} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'4px',padding:'18px',borderRadius:'14px',background:!mktCondFilter?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):resolved==='light'?'#f5f5f7':C.surface,border:!mktCondFilter?`2px solid ${C.accentBright}`:'2px solid transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%'}}>
                  <span style={{fontWeight:800,fontSize:'1rem',color:C.text}}>Any Condition</span>
                  <span style={{fontWeight:400,fontSize:'0.87rem',color:C.muted}}>Show all listings regardless of condition.</span>
                </button>
                {[{label:'Brand New',desc:'Sealed or unused, with original packaging.'},{label:'Like New',desc:'Barely used, no visible wear or flaws.'},{label:'New',desc:'New with tags, or unopened packaging.'},{label:'Good',desc:'Gently used, few flaws, fully functional.'},{label:'Fair',desc:'Moderate wear, minor cosmetic flaws, works fine.'},{label:'Poor',desc:'Major flaws, may be damaged, or missing parts.'}].map(({label,desc})=>(
                  <button key={label} onClick={()=>{setMktCondFilter(label);setShowCondSheet(false)}} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'4px',padding:'18px',borderRadius:'14px',background:mktCondFilter===label?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):resolved==='light'?'#f5f5f7':C.surface,border:mktCondFilter===label?`2px solid ${C.accentBright}`:'2px solid transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%'}}>
                    <span style={{fontWeight:800,fontSize:'1rem',color:C.text}}>{label}</span>
                    <span style={{fontWeight:400,fontSize:'0.87rem',color:C.muted}}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </>}

      {/* ─── PROFILE ─── */}
      {page==='profile' && <div className="feed-swipe">
        {/* Load rank when profile page is shown */}
        {userRank===0 && (() => {
          sb.from('profiles').select('*',{count:'exact',head:true}).gt('total_fizzups',profile.total_fizzups).then(({count})=>setUserRank((count||0)+1))
          return null
        })()}
        {/* Banner + avatar header */}
        <div style={{position:'relative',marginBottom:'0'}}>
          {/* Blue gradient banner */}
          <div style={{height:'100px',background:`linear-gradient(135deg, #1a3a5c 0%, #2563eb 100%)`,position:'relative'}}>
            {/* Settings button */}
            <button onClick={()=>setShowSettings(true)} style={{position:'absolute',top:'calc(10px + env(safe-area-inset-top))',right:'14px',background:'rgba(255,255,255,0.18)',border:'none',cursor:'pointer',borderRadius:'50%',width:'34px',height:'34px',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'1.1rem',backdropFilter:'blur(4px)'}}>⚙️</button>
          </div>
          {/* Avatar overlapping banner */}
          <div style={{position:'absolute',bottom:'-36px',left:'16px',width:'72px',height:'72px',borderRadius:'50%',overflow:'hidden',border:`3px solid ${C.bg}`,background:avColor(profile.id),boxShadow:'0 2px 12px rgba(0,0,0,0.15)'}}>
            <img src={avImg(profile.id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
        </div>
        {/* Username + bio area */}
        <div style={{paddingTop:'46px',paddingLeft:'16px',paddingRight:'16px',paddingBottom:'16px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontWeight:900,fontSize:'1.25rem',color:C.text,marginBottom:'2px'}}>{profile.username}</div>
          <div style={{fontSize:'0.84rem',color:C.muted,marginBottom:'12px'}}>{profile.school}</div>
          {/* Stats */}
          <div style={{display:'flex',gap:'12px'}}>
            <div style={{background:C.surface,borderRadius:'14px',padding:'12px 18px',flex:1,border:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}>
                <span style={{fontSize:'1rem'}}>❤️</span>
                <span style={{fontWeight:900,fontSize:'1.3rem',color:C.text}}>{profile.total_fizzups}</span>
              </div>
              <div style={{fontSize:'0.78rem',color:C.muted,fontWeight:600}}>Karma</div>
            </div>
            <div style={{background:C.surface,borderRadius:'14px',padding:'12px 18px',flex:1,border:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}>
                <span style={{fontSize:'1rem'}}>🏆</span>
                <span style={{fontWeight:900,fontSize:'1.3rem',color:C.text}}>#{userRank||'—'}</span>
              </div>
              <div style={{fontSize:'0.78rem',color:C.muted,fontWeight:600}}>Leaderboard</div>
            </div>
          </div>
        </div>
        {/* Pull-to-refresh indicator */}
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',overflow:'hidden',height:profRefreshing?'52px':`${profPullY}px`,transition:profPullY===0?'height 0.25s ease':'none'}}>
          <div className={profRefreshing?'spin':''} style={{width:'22px',height:'22px',borderRadius:'50%',border:`2px solid ${C.border}`,borderTop:`2px solid ${C.accentBright}`,transform:profRefreshing?undefined:`rotate(${profPullY*4}deg)`,transition:profRefreshing?'none':'transform 0.1s'}}/>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,background:C.bg,zIndex:50}}>
          {(['Posts','Comments','Saved'] as const).map(t=>(
            <div key={t} onClick={()=>setProfileTab(t)} style={{flex:1,padding:'12px 10px',textAlign:'center',fontSize:'0.92rem',fontWeight:profileTab===t?800:600,color:profileTab===t?C.text:C.muted,cursor:'pointer',transition:'color 0.15s',position:'relative'}}>{t}</div>
          ))}
          <div ref={profileIndicatorRef} style={{position:'absolute',bottom:0,height:'2.5px',width:'33.333%',background:C.text,borderRadius:'2px',left:`${(['Posts','Comments','Saved'] as const).indexOf(profileTab)*33.333}%`,transition:'left 0.25s cubic-bezier(0.4,0,0.2,1)'}}/>
        </div>
        <div ref={profileBodyRef} style={{willChange:'transform'}}>
        {profileTab==='Posts' && posts.filter(p=>p.user_id===profile.id).map(p=><React.Fragment key={p.id}>{PostCard({p})}</React.Fragment>)}
        {profileTab==='Posts' && posts.every(p=>p.user_id!==profile.id)&&(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
            <div style={{fontSize:'3rem',opacity:.4}}>✏️</div>
            <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>No posts yet.</div>
            <div style={{fontSize:'0.88rem',textAlign:'center'}}>Write a post and you'll see it here.</div>
          </div>
        )}
        {profileTab==='Comments' && userComments.map((comment:any)=>(
          <div key={comment.id} onClick={()=>comment.posts && openPost(comment.posts as Post)} style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
            <div style={{fontSize:'0.8rem',color:C.muted,marginBottom:'6px'}}>{ago(comment.created_at)} · Commented on a post</div>
            <div style={{fontSize:'0.95rem',color:C.text,lineHeight:'1.5',marginBottom:'8px'}}>{comment.text}</div>
            {comment.posts?.text && <div style={{fontSize:'0.83rem',color:C.muted,lineHeight:'1.45'}}>Post: {trimPreview(splitTaggedText(comment.posts.text).body || comment.posts.text, 120)}</div>}
          </div>
        ))}
        {profileTab==='Comments' && userComments.length===0 && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
            <div style={{fontSize:'3rem',opacity:.4}}>💬</div>
            <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>No comments yet.</div>
          </div>
        )}
        {profileTab==='Saved' && savedListings.filter(id=>listings.some(l=>l.id===id)).map(id=>{
          const listing = listings.find(l=>l.id===id)
          if (!listing) return null
          return (
            <div key={id} onClick={()=>setSelectedListing(listing)} style={{display:'flex',gap:'12px',padding:'14px 16px',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}>
              <div style={{width:'72px',height:'72px',borderRadius:'12px',overflow:'hidden',background:C.surface,flexShrink:0}}>
                {listing.images?.[0] ? <img src={listing.images[0]} alt={listing.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem'}}>{listing.emoji || '📦'}</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:C.text,marginBottom:'4px'}}>{listing.title}</div>
                <div style={{fontSize:'0.9rem',color:C.text,marginBottom:'4px'}}>${listing.price}</div>
                <div style={{fontSize:'0.8rem',color:C.muted}}>{listing.category}</div>
              </div>
            </div>
          )
        })}
        {profileTab==='Saved' && savedListings.filter(id=>listings.some(l=>l.id===id)).length===0 && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'80px 20px',gap:'14px',color:C.muted}}>
            <div style={{fontSize:'3rem',opacity:.4}}>🔖</div>
            <div style={{fontWeight:700,color:C.text,fontSize:'1.05rem'}}>No saved items yet.</div>
          </div>
        )}
        </div>
        <button onClick={()=>openPostModal()} style={{position:'fixed',bottom:'105px',right:'16px',background:'#1a3a5c',color:'white',border:'none',borderRadius:'28px',padding:'13px 18px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:fabExpanded?'6px':'0',boxShadow:'0 4px 20px rgba(26,58,92,0.5)',zIndex:150,transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',overflow:'hidden',whiteSpace:'nowrap'}}>
          <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0}}>＋</span>
          <span style={{maxWidth:fabExpanded?'50px':'0',overflow:'hidden',opacity:fabExpanded?1:0,transition:'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',whiteSpace:'nowrap'}}>Post</span>
        </button>
      </div>}

      {/* Dismiss post menu backdrop */}
      {showPostMenu&&<div onClick={()=>setShowPostMenu(null)} style={{position:'fixed',inset:0,zIndex:199}}/>}

      {/* ─── BOTTOM NAV ─── */}
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:C.bg,borderTop:`1px solid ${C.border}`,display:'flex',zIndex:200,paddingBottom:`calc(34px + env(safe-area-inset-bottom, 0px))`}}>
        {[
          {id:'feed',icon:(a:boolean)=><svg width="26" height="26" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.8:2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>},
          {id:'messages',icon:(a:boolean)=><svg width="26" height="26" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.8:2.4} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,badge:unread},
          {id:'search',icon:(a:boolean)=><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={a?C.text:C.muted} strokeWidth={a?2.8:2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>},
          {id:'market',icon:(a:boolean)=><svg width="26" height="26" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.8:2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>},
          {id:'profile',icon:(a:boolean)=><svg width="26" height="26" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.8:2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>},
        ].map(n=>(
          <button key={n.id} onClick={()=>{setPage(n.id as any);window.scrollTo(0,0)}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 0 8px',cursor:'pointer',border:'none',background:'none',position:'relative'}}>
            <div style={{position:'relative'}}>
              {n.icon(page===n.id)}
              {(n as any).badge ? <span style={{position:'absolute',top:'-4px',right:'-6px',background:'#ef4444',color:'white',borderRadius:'50%',width:'16px',height:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.6rem',fontWeight:700}}>{(n as any).badge}</span> : null}
            </div>
          </button>
        ))}
      </nav>

      {/* ─── POST MODAL — bottom sheet ─── */}
      {showPost && (<>
        <div onClick={closePost} onTouchMove={e=>e.preventDefault()} className={postClosing?'fade-out':'fade-in'} style={{position:'fixed',inset:0,zIndex:399,background:'rgba(0,0,0,0.35)'}}/>
        <div
          ref={postSheetRef}
          className={postClosing?'fade-out':'fade-in'}
          style={{position:'fixed',inset:0,zIndex:400,background:resolved==='light'?'#ffffff':C.bg,display:'flex',flexDirection:'column',willChange:'transform',overflow:'hidden',overscrollBehavior:'contain'}}
          onTouchStart={e=>{
            if (keyboardInset > 0) return
            postDragStart.current=e.touches[0].clientY
            postDragTrack.current=0
            // Allow drag if: touch is NOT inside scrollable content, OR scrollable content is at top
            const scrollArea = postScrollAreaRef.current
            const touchInScroll = scrollArea && scrollArea.contains(e.target as Node)
            postDragAllowed.current = !touchInScroll || (scrollArea ? scrollArea.scrollTop <= 0 : true)
          }}
          onTouchMove={e=>{
            if (keyboardInset > 0) return
            const dy=e.touches[0].clientY-postDragStart.current
            // If we started dragging (sheet is moving), keep allowing it
            if(postDragTrack.current > 0) postDragAllowed.current = true
            // If touch is in scroll area and content can scroll up, don't drag
            const scrollArea = postScrollAreaRef.current
            if(scrollArea && scrollArea.contains(e.target as Node) && scrollArea.scrollTop > 0 && dy > 0) {
              postDragAllowed.current = false
            }
            if(dy>0 && postSheetRef.current && postDragAllowed.current){
              postDragTrack.current=dy
              postSheetRef.current.style.transition='none'
              postSheetRef.current.style.transform=`translateY(${dy}px)`
            }
          }}
          onTouchEnd={()=>{
            if (keyboardInset > 0) return
            if(postDragTrack.current>80){
              if(postSheetRef.current){
                postSheetRef.current.style.transition='transform 0.3s ease'
                postSheetRef.current.style.transform='translateY(100%)'
              }
              setTimeout(()=>{setShowPost(false);setPostClosing(false);setPostText('');setPostImgs([]);setPostPrevs([]);setPostTag('');setShowTagPicker(false)},300)
            } else if(postSheetRef.current){
              postSheetRef.current.style.transition='transform 0.3s cubic-bezier(0.32,0.72,0,1)'
              postSheetRef.current.style.transform='translateY(0)'
              setTimeout(()=>{if(postSheetRef.current)postSheetRef.current.style.transition=''},300)
            }
            postDragTrack.current=0
            postDragAllowed.current=false
          }}
        >
            <div style={{display:'flex',justifyContent:'center',paddingTop:'calc(8px + env(safe-area-inset-top))',paddingBottom:'8px',cursor:keyboardInset>0?'default':'grab',flexShrink:0}}>
              <div style={{width:'36px',height:'4px',borderRadius:'2px',background:C.border,opacity:0.8}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 16px 10px',flexShrink:0}}>
              <button onClick={closePost} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:'2px',display:'flex'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <img src={avImg(profile.id)} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover'}}/>
              <button onClick={()=>setPostAnon(a=>!a)} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.92rem',color:C.text,fontFamily:'inherit',padding:0}}>
                {postAnon ? 'Anonymous' : profile.username}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            {/* selected tag badge */}
            {postTag && (
              <div style={{padding:'0 16px 6px',flexShrink:0}}>
                <span onClick={()=>{setPostTag('');setShowTagPicker(false)}} style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'4px 12px',borderRadius:'20px',fontSize:'0.78rem',fontWeight:800,cursor:'pointer',background:POST_TAGS.find(t=>t.tag===postTag)?.bg||'#f0f0f0',color:POST_TAGS.find(t=>t.tag===postTag)?.color||'#333'}}>
                  {POST_TAGS.find(t=>t.tag===postTag)?.emoji} {postTag} ✕
                </span>
              </div>
            )}
            {/* tag picker or text area */}
            {showTagPicker ? (
              <div style={{flex:1,padding:'8px 16px',overflowY:'auto'}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
                  {POST_TAGS.map(t=>(
                    <button key={t.tag} onClick={()=>{setPostTag(t.tag);setShowTagPicker(false)}} style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'10px 18px',borderRadius:'24px',fontSize:'0.85rem',fontWeight:800,border:'none',cursor:'pointer',background:t.bg,color:t.color,fontFamily:'inherit'}}>
                      {t.emoji} {t.tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div ref={postScrollAreaRef} style={{flex:1,padding:'0 16px',overflowY:'auto',minHeight:'80px',overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}}>
                <textarea
                  style={{width:'100%',background:'transparent',border:'none',color:C.text,fontSize:'1rem',lineHeight:'1.6',outline:'none',fontFamily:'inherit',resize:'none',minHeight:'240px'}}
                  placeholder="Share what's really on your mind..."
                  value={postText}
                  onChange={e=>setPostText(e.target.value)}
                  autoFocus
                />
                {postPrevs.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',borderRadius:'12px',overflow:'hidden',marginBottom:'8px'}}>{postPrevs.map((p,i)=><div key={i} style={{position:'relative'}}><img src={p} alt="" style={{width:'100%',height:'100px',objectFit:'cover',display:'block'}}/><button onClick={()=>{setPostPrevs(pr=>pr.filter((_,j)=>j!==i));setPostImgs(im=>(im as any).filter((_:any,j:number)=>j!==i))}} style={{position:'absolute',top:'4px',right:'4px',width:'22px',height:'22px',borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,lineHeight:1}}>×</button></div>)}</div>}
              </div>
            )}
            {/* toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',paddingBottom:`calc(${8 + keyboardInset}px + env(safe-area-inset-bottom, 0px))`,borderTop:`1px solid ${C.border}`,flexShrink:0,background:C.bg}}>
              <button onClick={()=>setShowTagPicker(v=>!v)} style={{display:'flex',alignItems:'center',gap:'4px',background:showTagPicker?C.accentBright:C.surface,border:`1px solid ${showTagPicker?C.accentBright:C.border}`,borderRadius:'20px',padding:'5px 10px',fontSize:'0.8rem',fontWeight:700,color:showTagPicker?'white':C.text,cursor:'pointer',fontFamily:'inherit'}}>+ Tag</button>
              <label style={{cursor:'pointer',color:C.muted,display:'flex',alignItems:'center',padding:'5px'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickImgs} />
              </label>
              <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',fontWeight:800,fontSize:'0.78rem',color:C.muted,fontFamily:'inherit'}}>MEME</button>
              <button style={{background:'none',border:`1px solid ${C.border}`,cursor:'pointer',padding:'5px',fontWeight:800,fontSize:'0.78rem',color:C.muted,fontFamily:'inherit',borderRadius:'5px'}}>GIF</button>
              <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',color:C.muted}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </button>
              <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',color:C.muted}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              </button>
              <button onClick={submitPost} disabled={posting||(!postText.trim()&&postImgs.length===0&&!postTag)} style={{marginLeft:'auto',background:'#a78bfa',color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,fontSize:'0.88rem',cursor:'pointer',opacity:(!postText.trim()&&postImgs.length===0&&!postTag)||posting?.5:1,fontFamily:'inherit'}}>
                {posting?'…':'Post'}
              </button>
            </div>
          </div>
      </>)}

      {/* ─── LISTING MODAL ─── */}
      {showListing&&(
        <div className={listingClosing?'slide-down':'slide-in-right'} style={{position:'fixed',inset:0,zIndex:500,background:resolved==='light'?'#ffffff':C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',paddingTop:'calc(16px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,flexShrink:0,background:resolved==='light'?'#ffffff':C.bg,zIndex:5}}>
            <button onClick={closeListing} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontSize:'0.95rem',fontFamily:'inherit'}}>Cancel</button>
            <span style={{fontWeight:800,fontSize:'1rem',color:C.text}}>New Listing</span>
            <div style={{width:'60px'}}/>
          </div>

          {/* category picker sub-view */}
          {listingView==='cat'&&(
            <div className="slide-in-right" style={{position:'fixed',inset:0,zIndex:510,background:resolved==='light'?'#ffffff':C.bg,display:'flex',flexDirection:'column'}}>
              <div style={{display:'flex',alignItems:'center',gap:'14px',padding:'16px 20px',paddingTop:'calc(16px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
                <button onClick={()=>setListingView(null)} style={{width:'32px',height:'32px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>‹</button>
                <span style={{fontWeight:800,fontSize:'1.1rem',color:C.text}}>Select Category</span>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}}>
                {[{emoji:'👕',label:'Clothes'},{emoji:'👠',label:'Shoes'},{emoji:'🧢',label:'Hats'},{emoji:'💍',label:'Jewelry'},{emoji:'🕶️',label:'Accessories'},{emoji:'📚',label:'Books'},{emoji:'🎒',label:'School Gear'},{emoji:'📱',label:'Electronics'},{emoji:'🚲',label:'Bikes'},{emoji:'🏠',label:'Home Goods'},{emoji:'🪑',label:'Furniture'},{emoji:'🎟️',label:'Tickets'},{emoji:'❓',label:'Other'}].map(({emoji,label})=>(
                  <button key={label} onClick={()=>{setLf(f=>({...f,cat:label}));setListingView(null)}} style={{display:'flex',alignItems:'center',gap:'14px',padding:'16px',borderRadius:'14px',background:resolved==='light'?'#f5f5f7':C.surface,border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const,width:'100%',flexShrink:0}}>
                    <span style={{fontSize:'1.4rem',width:'32px',textAlign:'center'}}>{emoji}</span>
                    <span style={{fontWeight:700,fontSize:'0.97rem',color:C.text,flex:1}}>{label}</span>
                    {lf.cat===label&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accentBright} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* condition picker sub-view */}
          {listingView==='cond'&&(
            <div className="slide-in-right" style={{position:'fixed',inset:0,zIndex:510,background:resolved==='light'?'#ffffff':C.bg,display:'flex',flexDirection:'column'}}>
              <div style={{display:'flex',alignItems:'center',gap:'14px',padding:'16px 20px',paddingTop:'calc(16px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
                <button onClick={()=>setListingView(null)} style={{width:'32px',height:'32px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>‹</button>
                <span style={{fontWeight:800,fontSize:'1.1rem',color:C.text}}>Select Condition</span>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'10px'}}>
                {[{label:'Brand New',desc:'Sealed or unused, with original packaging.'},{label:'Like New',desc:'Barely used, no visible wear or flaws.'},{label:'New',desc:'New with tags, or unopened packaging.'},{label:'Good',desc:'Gently used, few flaws, fully functional.'},{label:'Fair',desc:'Moderate wear, minor cosmetic flaws, works fine.'},{label:'Poor',desc:'Major flaws, may be damaged, or missing parts.'}].map(({label,desc})=>(
                  <button key={label} onClick={()=>{setLf(f=>({...f,condition:label}));setListingView(null)}} style={{display:'flex',flexDirection:'column' as const,alignItems:'flex-start',gap:'4px',padding:'18px',borderRadius:'14px',background:resolved==='light'?'#f5f5f7':C.surface,border:lf.condition===label?`2px solid ${C.accentBright}`:'2px solid transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const,width:'100%'}}>
                    <span style={{fontWeight:800,fontSize:'1rem',color:C.text}}>{label}</span>
                    <span style={{fontWeight:400,fontSize:'0.87rem',color:C.muted}}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* form body */}
          <div style={{flex:1,overflowY:'auto',padding:'20px 20px 40px',display:'flex',flexDirection:'column',gap:'0'}}>
            {/* PHOTO */}
            <div style={{marginBottom:'24px'}}>
              <div style={{fontWeight:800,fontSize:'0.82rem',letterSpacing:'.5px',color:C.text,marginBottom:'12px'}}>PHOTO</div>
              <input id="limg" type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickFiles}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'auto auto',gap:'8px',height:'220px'}}>
                {/* main large slot */}
                <label htmlFor="limg" style={{gridRow:'1/3',borderRadius:'14px',border:`2px dashed ${C.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',background:lPreviews[0]?'transparent':C.surface,overflow:'hidden',position:'relative' as const}}>
                  {lPreviews[0]?<><img src={lPreviews[0]} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/><button onClick={e=>{e.preventDefault();e.stopPropagation();setLPreviews(p=>p.filter((_,j)=>j!==0));setLFiles(f=>f.filter((_,j)=>j!==0))}} style={{position:'absolute',top:'8px',right:'8px',width:'24px',height:'24px',borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,zIndex:5}}>×</button></>:<>
                    <div style={{position:'relative',marginBottom:'8px'}}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <div style={{position:'absolute',top:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'#ef4444',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700}}>+</div>
                    </div>
                    <span style={{fontSize:'0.78rem',color:C.muted}}>Add up to 5 photos</span>
                  </>}
                </label>
                {/* 4 small slots */}
                {[1,2,3,4].map(i=>(
                  <label key={i} htmlFor="limg" style={{borderRadius:'12px',border:`2px dashed ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:lPreviews[i]?'transparent':C.surface,overflow:'hidden',position:'relative' as const}}>
                    {lPreviews[i]?<><img src={lPreviews[i]} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/><button onClick={e=>{e.preventDefault();e.stopPropagation();setLPreviews(p=>p.filter((_,j)=>j!==i));setLFiles(f=>f.filter((_,j)=>j!==i))}} style={{position:'absolute',top:'4px',right:'4px',width:'20px',height:'20px',borderRadius:'50%',background:'rgba(0,0,0,0.6)',color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,zIndex:5}}>×</button></>:<div style={{position:'relative'}}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <div style={{position:'absolute',top:'-4px',right:'-4px',width:'13px',height:'13px',borderRadius:'50%',background:'#ef4444',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700}}>+</div>
                    </div>}
                  </label>
                ))}
              </div>
            </div>

            {/* TITLE */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:'20px',marginBottom:'0'}}>
              <div style={{fontWeight:800,fontSize:'0.82rem',letterSpacing:'.5px',color:C.text,marginBottom:'12px'}}>TITLE</div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',borderBottom:`1px solid ${C.border}`,paddingBottom:'12px'}}>
                <input value={lf.title} onChange={e=>setLf(f=>({...f,title:e.target.value.slice(0,50)}))} placeholder="What are you selling?" style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.text,fontSize:'1rem',fontFamily:'inherit'}}/>
                <span style={{fontSize:'0.8rem',color:C.muted,flexShrink:0}}>{50-lf.title.length}</span>
              </div>
            </div>

            {/* PRICE */}
            <div style={{paddingTop:'16px',borderBottom:`1px solid ${C.border}`,paddingBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontWeight:800,color:C.text,fontSize:'1rem'}}>$</span>
              <input value={lf.price} onChange={e=>setLf(f=>({...f,price:e.target.value}))} placeholder="0.00" type="number" style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.text,fontSize:'1rem',fontFamily:'inherit'}}/>
            </div>

            {/* DESCRIPTION */}
            <div style={{paddingTop:'20px',marginBottom:'0'}}>
              <div style={{fontWeight:800,fontSize:'0.82rem',letterSpacing:'.5px',color:C.text,marginBottom:'12px'}}>Description</div>
              <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:'12px'}}>
                <textarea value={lf.desc} onChange={e=>setLf(f=>({...f,desc:e.target.value.slice(0,500)}))} placeholder="Describe your item" rows={5} style={{width:'100%',background:'transparent',border:'none',outline:'none',color:C.text,fontSize:'0.97rem',fontFamily:'inherit',resize:'none' as const,lineHeight:'1.5'}}/>
                <div style={{textAlign:'right',fontSize:'0.78rem',color:C.muted}}>{500-lf.desc.length}</div>
              </div>
            </div>

            {/* DETAILS */}
            <div style={{paddingTop:'20px',marginBottom:'0'}}>
              <div style={{fontWeight:800,fontSize:'0.82rem',letterSpacing:'.5px',color:C.text,marginBottom:'12px'}}>DETAILS</div>
              <button onClick={()=>setListingView('cat')} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',borderBottom:`1px solid ${C.border}`,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                <span style={{color:lf.cat?C.text:C.muted,fontSize:'0.97rem',fontWeight:lf.cat?700:400}}>{lf.cat||'Select Category'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onClick={()=>setListingView('cond')} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0',background:'none',border:'none',borderBottom:`1px solid ${C.border}`,cursor:'pointer',fontFamily:'inherit'}}>
                <span style={{color:lf.condition?C.text:C.muted,fontSize:'0.97rem',fontWeight:lf.condition?700:400}}>{lf.condition||'Select Condition'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* LIST BUTTON */}
            <button onClick={submitListing} disabled={!lf.title||lUploading||listingPublished} style={{marginTop:'32px',width:'100%',padding:'16px',borderRadius:'14px',background:listingPublished?C.green:lf.title&&!lUploading?C.accentBright:'#888',color:'white',border:'none',fontWeight:800,fontSize:'1rem',cursor:lf.title&&!lUploading&&!listingPublished?'pointer':'not-allowed',fontFamily:'inherit',transition:'background 0.3s'}}>
              {listingPublished?'已发布 ✓':lUploading?'Listing…':'List item'}
            </button>
          </div>
        </div>
      )}

      {/* ─── LISTING DETAIL ─── */}
      {selectedListing&&(<>
        <div ref={listingBackdropRef} className="fade-in" style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:399,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
        <div ref={listingDetailRef} className="slide-in-right" style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:400,background:resolved==='light'?'#ffffff':C.bg,display:'flex',flexDirection:'column',overflowY:'auto'}}>
          {/* top bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',paddingTop:'calc(14px + env(safe-area-inset-top))'}}>
            <button onClick={closeListingDetail} style={{width:'36px',height:'36px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>‹</button>
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowListingMenu(v=>!v)} style={{width:'36px',height:'36px',borderRadius:'50%',background:resolved==='light'?'rgba(0,0,0,0.07)':C.surface2,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.text}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              </button>
              {showListingMenu && (
                <div style={{position:'absolute',top:'42px',right:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:'14px',boxShadow:`0 12px 28px ${C.shadow}`,overflow:'hidden',minWidth:'170px',zIndex:3}}>
                  {selectedListing.user_id===profile.id ? (
                    <>
                      <button onClick={()=>{setShowListingMenu(false);sb.from('listings').update({is_sold:true}).eq('id',selectedListing.id).then(()=>{loadListings();setSelectedListing(null)})}} style={{width:'100%',padding:'12px 14px',background:'none',border:'none',cursor:'pointer',color:C.text,textAlign:'left',fontFamily:'inherit',fontWeight:700}}>Mark as Sold</button>
                      <button onClick={()=>{setShowListingMenu(false);sb.from('listings').delete().eq('id',selectedListing.id).then(({error})=>{if(error){alert('删除失败: '+error.message);return}loadListings();setSelectedListing(null)})}} style={{width:'100%',padding:'12px 14px',background:'none',border:'none',borderTop:`1px solid ${C.border}`,cursor:'pointer',color:C.red,textAlign:'left',fontFamily:'inherit',fontWeight:700}}>Delete Listing</button>
                    </>
                  ) : (
                    <button onClick={()=>setShowListingMenu(false)} style={{width:'100%',padding:'12px 14px',background:'none',border:'none',cursor:'pointer',color:C.text,textAlign:'left',fontFamily:'inherit',fontWeight:700}}>Report Listing</button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* image carousel — touch-swipeable with tap-to-enlarge */}
          <div style={{padding:'0 16px 12px'}}>
            {selectedListing.images&&selectedListing.images.length>0 ? (
              <div ref={carouselRef} style={{position:'relative',width:'100%',height:'300px',borderRadius:'18px',overflow:'hidden',background:C.surface,touchAction:'none'}}
                onTouchStart={e=>{
                  e.stopPropagation()
                  const t=e.touches[0]
                  carouselTouchRef.current={startX:t.clientX,dx:0,dragging:true,startTime:Date.now()}
                }}
                onTouchMove={e=>{
                  e.stopPropagation()
                  const ct=carouselTouchRef.current
                  if(!ct.dragging) return
                  if(e.cancelable) e.preventDefault()
                  const dx=e.touches[0].clientX-ct.startX
                  ct.dx=dx
                  if(carouselInnerRef.current){
                    carouselInnerRef.current.style.transition='none'
                    carouselInnerRef.current.style.transform=`translateX(calc(${-listingPhotoIdxRef.current*100}% + ${dx}px))`
                  }
                }}
                onTouchEnd={e=>{
                  e.stopPropagation()
                  const ct=carouselTouchRef.current
                  if(!ct.dragging) return
                  ct.dragging=false
                  const velocity=Math.abs(ct.dx)/(Date.now()-ct.startTime)*1000
                  const threshold=velocity>800?20:50
                  const imgs=selectedListing.images!
                  let newIdx=listingPhotoIdxRef.current
                  if(ct.dx<-threshold && newIdx<imgs.length-1) newIdx++
                  else if(ct.dx>threshold && newIdx>0) newIdx--
                  setListingPhotoIdx(newIdx)
                  if(carouselInnerRef.current){
                    carouselInnerRef.current.style.transition='transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)'
                    carouselInnerRef.current.style.transform=`translateX(${-newIdx*100}%)`
                  }
                  if(Math.abs(ct.dx)<5) setLightboxImg(imgs[newIdx])
                }}
              >
                <div ref={carouselInnerRef} style={{display:'flex',height:'100%',transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',transform:`translateX(${-listingPhotoIdx*100}%)`}}>
                  {selectedListing.images.map((img,i)=>(
                    <img key={i} src={img} alt={selectedListing.title} style={{width:'100%',flexShrink:0,height:'100%',objectFit:'cover',cursor:'pointer',userSelect:'none',pointerEvents:'none'} as React.CSSProperties} draggable={false}/>
                  ))}
                </div>
                {selectedListing.images.length>1&&(
                  <div style={{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:'6px',zIndex:2}}>
                    {selectedListing.images.map((_,i)=>(
                      <div key={i} onClick={()=>setListingPhotoIdx(i)} style={{width:'7px',height:'7px',borderRadius:'50%',background:i===listingPhotoIdx?'white':'rgba(255,255,255,0.5)',cursor:'pointer',transition:'background 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.4)'}}/>
                    ))}
                  </div>
                )}
                <div style={{position:'absolute',top:'12px',right:'12px',background:'rgba(0,0,0,0.5)',borderRadius:'12px',padding:'3px 10px',fontSize:'0.75rem',color:'white',fontWeight:700,zIndex:2}}>{listingPhotoIdx+1}/{selectedListing.images.length}</div>
              </div>
            ) : (
              <div style={{width:'100%',height:'300px',borderRadius:'18px',background:C.surface,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'4rem'}}>{selectedListing.emoji||'📦'}</div>
            )}
          </div>
          {/* info */}
          <div style={{padding:'16px 18px 32px'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'4px'}}>
              <div style={{fontSize:'1.7rem',fontWeight:900,color:C.text}}>${selectedListing.price}</div>
              <div style={{display:'flex',gap:'12px'}}>
                <button style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                </button>
                <button style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
              </div>
            </div>
            <div style={{fontSize:'1.15rem',fontWeight:700,color:C.text,marginBottom:'16px'}}>{selectedListing.title}</div>
            {/* action buttons */}
            <div style={{display:'flex',gap:'10px',marginBottom:'22px'}}>
              <button onClick={()=>setSavedListings(s=>s.includes(selectedListing.id)?s.filter(x=>x!==selectedListing.id):[...s,selectedListing.id])} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'7px',padding:'13px',borderRadius:'28px',border:'none',background:resolved==='light'?'#f0f0f0':C.surface2,color:C.text,fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'inherit'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={savedListings.includes(selectedListing.id)?C.text:'none'} stroke={C.text} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                {savedListings.includes(selectedListing.id)?'Saved':'Save for later'}
              </button>
              <button onClick={()=>{ if(selectedListing.profiles){ const pid=(selectedListing.profiles as any).id||selectedListing.user_id; setMktConvoPartners(p=>{const n=p.includes(pid)?p:[...p,pid];localStorage.setItem('heha_mkt_convos',JSON.stringify(n));return n}); setPendingChat({ user: selectedListing.profiles as Profile, tab: 'market' }); setSelectedListing(null); setPage('messages'); setMsgTab('market') } }} style={{flex:1.4,display:'flex',alignItems:'center',justifyContent:'center',gap:'7px',padding:'13px',borderRadius:'28px',border:'none',background:C.accentBright,color:'white',fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'inherit'}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Message Seller
              </button>
            </div>
            {/* description */}
            {selectedListing.description&&<>
              <div style={{fontWeight:800,fontSize:'1rem',color:C.text,marginBottom:'6px'}}>Description</div>
              <div style={{fontSize:'0.95rem',color:resolved==='light'?'#333':C.text,lineHeight:'1.6',marginBottom:'20px'}}>{selectedListing.description}</div>
            </>}
            {/* details */}
            <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'20px'}}>
              {(selectedListing as any).condition&&<div style={{display:'flex',gap:'16px'}}><span style={{fontWeight:800,color:C.text,minWidth:'90px'}}>Condition</span><span style={{color:resolved==='light'?'#555':C.muted}}>{(selectedListing as any).condition}</span></div>}
              {selectedListing.category&&<div style={{display:'flex',gap:'16px'}}><span style={{fontWeight:800,color:C.text,minWidth:'90px'}}>Category</span><span style={{color:resolved==='light'?'#555':C.muted,textTransform:'capitalize'}}>{selectedListing.category}</span></div>}
            </div>
            <div style={{fontSize:'0.85rem',color:C.muted,marginBottom:'28px'}}>Posted {ago(selectedListing.created_at)}</div>
            {/* similar items */}
            {listings.filter(l=>l.id!==selectedListing.id&&l.category===selectedListing.category&&!l.is_sold).length>0&&<>
              <div style={{fontWeight:800,fontSize:'1.05rem',color:C.text,marginBottom:'14px'}}>Similar Items</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                {listings.filter(l=>l.id!==selectedListing.id&&l.category===selectedListing.category&&!l.is_sold).slice(0,4).map(l=>(
                  <div key={l.id} onClick={()=>setSelectedListing(l)} style={{borderRadius:'12px',overflow:'hidden',border:`1px solid ${C.border}`,cursor:'pointer'}}>
                    {l.images&&l.images.length>0
                      ? <img src={l.images[0]} alt={l.title} style={{width:'100%',aspectRatio:'1',objectFit:'cover',display:'block'}}/>
                      : <div style={{aspectRatio:'1',background:C.surface,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem'}}>{l.emoji||'📦'}</div>
                    }
                    <div style={{padding:'8px'}}>
                      <div style={{fontWeight:700,fontSize:'0.82rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                      <div style={{fontWeight:800,fontSize:'0.88rem'}}>${l.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>}
            {/* own listing actions */}
            {selectedListing.user_id===profile.id&&(<>
              <button onClick={()=>sb.from('listings').update({is_sold:true}).eq('id',selectedListing.id).then(()=>{loadListings();setSelectedListing(null)})} style={{marginTop:'20px',width:'100%',padding:'14px',background:'transparent',border:`1.5px solid ${C.border}`,borderRadius:'14px',color:C.muted,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                Mark as Sold
              </button>
              <button onClick={()=>{sb.from('listings').delete().eq('id',selectedListing.id).then(({error})=>{if(error){alert('删除失败: '+error.message);return}loadListings();setSelectedListing(null)})}} style={{marginTop:'10px',width:'100%',padding:'14px',background:'transparent',border:`1.5px solid ${C.red}`,borderRadius:'14px',color:C.red,fontSize:'0.9rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                Delete Listing
              </button>
            </>)}
          </div>
        </div>
      </>)}

      {/* ─── IMAGE LIGHTBOX ─── */}
      {lightboxImg&&(
        <div onClick={()=>setLightboxImg(null)} style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn 0.2s ease',cursor:'zoom-out'}}>
          <img src={lightboxImg} alt="" style={{maxWidth:'95vw',maxHeight:'90vh',objectFit:'contain',borderRadius:'8px',animation:'lightboxZoom 0.3s cubic-bezier(0.32,0.72,0,1) forwards'}}/>
          <button onClick={e=>{e.stopPropagation();setLightboxImg(null)}} style={{position:'absolute',top:'calc(16px + env(safe-area-inset-top))',right:'16px',width:'36px',height:'36px',borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:'1.2rem',backdropFilter:'blur(4px)'}}>✕</button>
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
              </div>
            </div>
            <button onClick={()=>sb.auth.signOut()} style={{width:'100%',padding:'14px',background:'transparent',border:`1px solid ${C.red}`,borderRadius:'14px',color:C.red,fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'inherit'}}>
              退出登录
            </button>
          </div>
        </div>
      )}

      {/* ─── ACTIVITY PAGE ─── */}
      {showActivity&&(<>
        <div ref={activityBackdropRef} className="fade-in" style={{position:'fixed',inset:0,zIndex:449,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
        <div ref={activityRef} className="slide-in-right" style={{position:'fixed',inset:0,zIndex:450,background:C.bg,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',paddingTop:'calc(14px + env(safe-area-inset-top))',borderBottom:`1px solid ${C.border}`,background:C.bg}}>
            <button onClick={closeActivity} style={{background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',cursor:'pointer',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>←</button>
            <span style={{fontWeight:800,fontSize:'1.05rem'}}>Activity</span>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'0'}}>
            {/* System notifications */}
            {[
              {icon:'🎉',title:'Welcome to Heha!',desc:'Start posting and connect with your community anonymously.',time:'Just now',color:C.accentBright},
              {icon:'📢',title:'Community Guidelines',desc:'Be respectful, stay anonymous, and have fun. Report any inappropriate content.',time:'1h',color:C.green},
              {icon:'🔔',title:'Stay Updated',desc:'Turn on notifications to never miss what\'s happening around you.',time:'2h',color:'#f59e0b'},
            ].map((n,i)=>(
              <div key={i} style={{display:'flex',gap:'14px',padding:'16px 20px',borderBottom:`1px solid ${C.border}`,alignItems:'flex-start'}}>
                <div style={{width:'42px',height:'42px',borderRadius:'50%',background:resolved==='light'?'#f0f0f0':C.surface2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0}}>{n.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'0.95rem',color:C.text,marginBottom:'3px'}}>{n.title}</div>
                  <div style={{fontSize:'0.88rem',color:C.muted,lineHeight:'1.4'}}>{n.desc}</div>
                  <div style={{fontSize:'0.78rem',color:C.muted,marginTop:'6px'}}>{n.time}</div>
                </div>
              </div>
            ))}
            <div style={{textAlign:'center',padding:'40px 20px',color:C.muted,fontSize:'0.88rem'}}>
              That's all for now
            </div>
          </div>
        </div>
      </>)}

      {selectedPost&&(<>
        <div ref={detailBackdropRef} className="fade-in" style={{position:'fixed',inset:0,zIndex:399,background:'rgba(0,0,0,0.32)',pointerEvents:'none'}}/>
        <div ref={postDetailRef} className="slide-in-right" style={{position:'fixed',inset:0,background:C.bg,zIndex:400,display:'flex',flexDirection:'column' as const}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:'1px solid '+C.border,position:'sticky' as const,top:0,background:C.bg}}>
            <button onClick={closeDetail} style={{background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',cursor:'pointer',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',color:C.text}}>←</button>
            <span style={{fontWeight:700}}>Post</span>
          </div>
          <div ref={postDetailScrollRef} style={{flex:1,overflowY:'auto' as const,WebkitOverflowScrolling:'touch',overscrollBehavior:'contain',minHeight:0}}>
            <div style={{padding:'16px',borderBottom:'1px solid '+C.border}}>
              <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:avColor(selectedPost.user_id)}}>
                  <img src={avImg(selectedPost.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
                <div>
                  <div style={{fontWeight:600}}>{selectedPost.is_anon?'Anonymous':(selectedPost.profiles?.username||'User')}</div>
                  <div style={{fontSize:'0.78rem',color:C.muted}}>{ago(selectedPost.created_at)}</div>
                </div>
              </div>
              {(() => {
                const { tagLine, body } = splitTaggedText(selectedPost.text || '')
                const detailTag = POST_TAGS.find(t => t.tag === tagLine)
                return (
                  <>
                    {detailTag && <div style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'4px 11px',borderRadius:'999px',fontSize:'0.76rem',fontWeight:800,marginBottom:'10px',background:detailTag.bg,color:detailTag.color}}>{detailTag.emoji} {detailTag.tag}</div>}
                    {body && <div style={{fontSize:'1rem',lineHeight:'1.6',marginBottom:'12px'}}>{body}</div>}
                  </>
                )
              })()}
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
                      replying to Anonymous
                    </div>
                  )}
                  <div style={{display:'flex',gap:'10px'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:avColor(c.user_id)}}>
                      <img src={avImg(c.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem'}}>Anonymous <span style={{color:C.muted,fontWeight:400,fontSize:'0.75rem'}}>{ago(c.created_at)}</span></div>
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
          <div style={{borderTop:'1px solid '+C.border,background:C.bg,flexShrink:0}}>
            {replyToComment&&(
              <div style={{padding:'6px 16px 0',display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.8rem',color:C.muted}}>
                <span>↩ Replying to Anonymous</span>
                <button onClick={()=>setReplyToComment(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:'1rem',padding:0}}>×</button>
              </div>
            )}
            {cmtPrevs.length>0&&(
              <div style={{display:'flex',gap:'6px',padding:'6px 16px 0',overflowX:'auto'}}>
                {cmtPrevs.map((p,i)=><img key={i} src={p} alt="" style={{height:'60px',width:'60px',objectFit:'cover',borderRadius:'8px',flexShrink:0}}/>)}
              </div>
            )}
            <div style={{padding:'8px 16px',paddingBottom:`calc(${8 + keyboardInset}px + env(safe-area-inset-bottom, 0px))`,display:'flex',gap:'8px',alignItems:'center'}}>
              <label style={{cursor:'pointer',color:C.muted,display:'flex',alignItems:'center',flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickCmtImgs} />
              </label>
              <input ref={commentInputRef} style={{flex:1,background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',borderRadius:'24px',padding:'10px 16px',color:C.text,fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} placeholder={replyToComment?`Reply to ${replyToComment.profiles?.username||'User'}…`:"Add a comment..."} value={cmtInput} onChange={e=>setCmtInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitNewCmt()} />
              <button onClick={submitNewCmt} style={{padding:'10px 18px',background:C.accentBright,color:'white',border:'none',borderRadius:'24px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>Post</button>
            </div>
          </div>
        </div>
      </>)}

      {showRepost&&repostTarget&&(<>
        <div onClick={closeRepost} onTouchMove={e=>e.preventDefault()} className={repostClosing?'fade-out':'fade-in'} style={{position:'fixed',inset:0,zIndex:499,background:'rgba(0,0,0,0.18)'}}/>
        <div
          className={repostClosing?'slide-down':'slide-up'}
          ref={repostSheetRef}
          style={{position:'fixed',left:0,right:0,bottom:0,zIndex:500,background:C.bg,borderRadius:'22px 22px 0 0',maxHeight:'75vh',display:'flex',flexDirection:'column' as const,boxShadow:'0 -8px 40px rgba(0,0,0,0.12)',willChange:'transform'}}
          onTouchStart={e=>{repostDragStart.current=e.touches[0].clientY; repostDragTrack.current=0}}
          onTouchMove={e=>{
            const dy=e.touches[0].clientY-repostDragStart.current
            if(dy>0 && repostSheetRef.current){
              repostDragTrack.current=dy
              repostSheetRef.current.style.transition='none'
              repostSheetRef.current.style.transform=`translateY(${dy}px)`
            }
          }}
          onTouchEnd={()=>{
            if(repostDragTrack.current>80){
              if(repostSheetRef.current){
                repostSheetRef.current.style.transition='transform 0.3s ease'
                repostSheetRef.current.style.transform='translateY(100%)'
              }
              setTimeout(()=>{setShowRepost(false);setRepostClosing(false);setRepostText('');setRepostIsComment(false);setRepostOriginalPostText('');setRepostTarget(null)},300)
            } else if(repostSheetRef.current){
              repostSheetRef.current.style.transition='transform 0.3s cubic-bezier(0.32,0.72,0,1)'
              repostSheetRef.current.style.transform='translateY(0)'
              setTimeout(()=>{if(repostSheetRef.current)repostSheetRef.current.style.transition=''},300)
            }
            repostDragTrack.current=0
          }}
        >
          {/* drag handle */}
          <div style={{display:'flex',justifyContent:'center',padding:'8px 0 0',flexShrink:0}}>
            <div style={{width:'36px',height:'4px',borderRadius:'2px',background:C.border}}/>
          </div>
          {/* header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px 8px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <button onClick={closeRepost} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:'2px',display:'flex'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <span style={{fontWeight:700,fontSize:'0.95rem'}}>ReFizz</span>
            <button onClick={submitRepost} disabled={reposting} style={{background:'#a78bfa',color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'0.88rem'}}>{reposting?'…':'Post'}</button>
          </div>
          {/* body */}
          <div style={{flex:1,overflowY:'auto' as const,padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
              <div style={{width:'38px',height:'38px',borderRadius:'50%',overflow:'hidden',background:avColor(profile.id)}}>
                <img src={avImg(profile.id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',background:C.surface,borderRadius:'20px',padding:'6px 12px',cursor:'pointer'}} onClick={()=>setRepostAnon(!repostAnon)}>
                <span style={{fontWeight:600,fontSize:'0.9rem'}}>{repostAnon?'Anonymous':profile.username}</span>
                <span style={{color:C.muted}}>▾</span>
              </div>
            </div>
            <textarea style={{width:'100%',background:'transparent',border:'none',resize:'none' as const,color:C.text,fontFamily:'inherit',fontSize:'1rem',outline:'none',minHeight:'60px',lineHeight:'1.5',marginBottom:'12px'}} placeholder="Add ReFizz caption..." value={repostText} onChange={e=>setRepostText(e.target.value)} autoFocus />
            {/* quoted post */}
            <div style={{border:`1.5px solid ${C.border}`,borderRadius:'14px',padding:'12px 14px',background:C.surface}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <div style={{width:'26px',height:'26px',borderRadius:'50%',overflow:'hidden',background:avColor(repostTarget.user_id)}}>
                  <img src={avImg(repostTarget.user_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
                <span style={{fontWeight:700,fontSize:'0.85rem'}}>{repostTarget.is_anon?'Anonymous':(repostTarget.profiles?.username||'User')}</span>
                <span style={{fontSize:'0.75rem',color:C.muted}}>{ago(repostTarget.created_at)}</span>
              </div>
              {repostIsComment&&repostOriginalPostText&&(
                <div style={{fontSize:'0.78rem',color:C.accentBright,marginBottom:'4px'}}>
                  @Commenting on '{repostOriginalPostText.slice(0,40)}{repostOriginalPostText.length>40?'…':''}'
                </div>
              )}
              <div style={{fontSize:'0.92rem',color:C.text,lineHeight:'1.5'}}>{repostTarget.text}</div>
            </div>
          </div>
        </div>
      </>)}

      {showDm&&dmTarget&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:500,display:'flex',flexDirection:'column' as const,justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setShowDm(false)}>
          <div className="slide-up" style={{background:resolved==='light'?'rgba(255,255,255,0.88)':'rgba(30,30,40,0.88)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderRadius:'20px 20px 0 0',padding:'20px 16px',paddingBottom:`calc(${16 + keyboardInset}px + env(safe-area-inset-bottom))`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>{setShowDm(false);setDmMsg('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>Cancel</button>
              <div style={{fontWeight:700}}>Send Message</div>
              <button onClick={sendDm} disabled={!dmMsg.trim()} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:!dmMsg.trim()?.5:1}}>Send</button>
            </div>
            <div style={{background:resolved==='light'?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.06)',borderRadius:'12px',padding:'12px',marginBottom:'14px',borderLeft:'3px solid '+C.accentBright}}>
              <div style={{fontSize:'0.8rem',color:C.muted,marginBottom:'4px'}}>To: {dmTarget.is_anon?'Anonymous':(dmTarget.profiles?.username||'User')}</div>
              <div style={{fontSize:'0.76rem',fontWeight:800,color:C.accentBright,marginBottom:'6px'}}>From post</div>
              <div style={{fontSize:'0.9rem'}}>{trimPreview(splitTaggedText(dmTarget.text || '').body || dmTarget.text || '', 100)}</div>
            </div>
            <div style={{background:resolved==='light'?'rgba(240,240,240,0.8)':'rgba(255,255,255,0.06)',borderRadius:'20px',padding:'4px 4px 4px 16px',display:'flex',alignItems:'flex-end',gap:'8px'}}>
              <textarea ref={dmInputRef} style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.text,fontFamily:'inherit',fontSize:'0.95rem',minHeight:'36px',maxHeight:'120px',resize:'none' as const,lineHeight:'1.5',padding:'8px 0'}} placeholder="Write a message..." value={dmMsg} onChange={e=>setDmMsg(e.target.value)} autoFocus />
              <button onClick={sendDm} disabled={!dmMsg.trim()} style={{width:'36px',height:'36px',borderRadius:'50%',background:dmMsg.trim()?C.accentBright:(resolved==='light'?'#ddd':'#444'),color:'white',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginBottom:'2px'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
