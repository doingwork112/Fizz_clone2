'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Post, Comment, Listing, Event, Message } from '@/types'

// ─── helpers ───────────────────────────────────────────────
const COLORS = ['#7c6ff7','#4cd9a0','#f7a456','#f76f6f','#56c9f7','#e97cf7']
const EMOJIS = ['🦊','🐧','🎩','🦄','🌈','🔮','🎪','🦋','🌊','🎭']
const EMOJI_CATS: Record<string,string> = {books:'📚',electronics:'💻',clothes:'👕',other:'🎁'}

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return '刚刚'
  if (d < 3600000) return `${Math.floor(d/60000)} 分钟前`
  if (d < 86400000) return `${Math.floor(d/3600000)} 小时前`
  return `${Math.floor(d/86400000)} 天前`
}
function anonName(userId: string) {
  const idx = userId.charCodeAt(0) % EMOJIS.length
  return EMOJIS[idx] + ' 匿名用户'
}
function anonColor(userId: string) {
  return COLORS[userId.charCodeAt(0) % COLORS.length]
}

// ─── main component ────────────────────────────────────────
export default function FizzApp() {
  const supabase = createClient()

  // auth
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authTab, setAuthTab] = useState<'login'|'register'>('login')
  const [authForm, setAuthForm] = useState({ email:'', pwd:'', username:'', school:'北京大学' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authErr, setAuthErr] = useState('')

  // nav
  const [page, setPage] = useState<'feed'|'fizzin'|'market'|'events'|'messages'|'search'|'profile'>('feed')
  const [feedTab, setFeedTab] = useState<'trending'|'new'|'following'>('trending')
  const [marketCat, setMarketCat] = useState('all')

  // data
  const [posts, setPosts] = useState<Post[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [leaderboard, setLeaderboard] = useState<Profile[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [conversations, setConversations] = useState<{user: Profile, lastMsg?: Message}[]>([])
  const [chatMsgs, setChatMsgs] = useState<Message[]>([])
  const [chatTarget, setChatTarget] = useState<Profile | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [openComments, setOpenComments] = useState<Record<string,Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({})
  const [unreadCount, setUnreadCount] = useState(0)

  // composer
  const [postText, setPostText] = useState('')
  const [postAnon, setPostAnon] = useState(true)
  const [pendingPoll, setPendingPoll] = useState<{question:string,options:string[]}|null>(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollForm, setPollForm] = useState({q:'',o1:'',o2:'',o3:''})
  const [posting, setPosting] = useState(false)

  // market modal
  const [showListingModal, setShowListingModal] = useState(false)
  const [listingForm, setListingForm] = useState({title:'',price:'',cat:'books',desc:''})

  // event modal
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState({title:'',date:'',loc:'',desc:''})

  // chat
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  const SCHOOLS = ['北京大学','清华大学','复旦大学','上海交通大学','浙江大学','南京大学','武汉大学','中山大学','华中科技大学','四川大学']

  // ── init & auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      updatePresence(data)
    }
  }

  async function updatePresence(p: Profile) {
    await supabase.from('presence').upsert({ user_id: p.id, last_seen: new Date().toISOString(), school: p.school })
    // count online (seen in last 5 min)
    const { count } = await supabase.from('presence')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    setOnlineCount(count || 0)
  }

  // ── load data when logged in ──
  useEffect(() => {
    if (!profile) return
    loadPosts()
    loadListings()
    loadEvents()
    loadLeaderboard()
    loadConversations()
    loadUnread()

    // realtime posts
    const ch = supabase.channel('posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => loadPosts())
      .subscribe()
    // realtime messages
    const mch = supabase.channel('msgs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
        filter: `to_user_id=eq.${profile.id}` },
        (payload) => {
          loadConversations()
          loadUnread()
          if (chatTarget && payload.new.from_user_id === chatTarget.id) {
            setChatMsgs(prev => [...prev, payload.new as Message])
          }
        })
      .subscribe()

    // update presence every 2 min
    const interval = setInterval(() => updatePresence(profile), 120000)
    return () => { supabase.removeChannel(ch); supabase.removeChannel(mch); clearInterval(interval) }
  }, [profile?.id])

  // ── auth handlers ──
  async function handleLogin() {
    setAuthLoading(true); setAuthErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.pwd })
    if (error) setAuthErr(error.message)
    setAuthLoading(false)
  }

  async function handleRegister() {
    setAuthLoading(true); setAuthErr('')
    if (!authForm.username || !authForm.email || !authForm.pwd) {
      setAuthErr('请填写所有字段'); setAuthLoading(false); return
    }
    const initials = authForm.username.slice(0,2).toUpperCase()
    const color = COLORS[Math.floor(Math.random()*COLORS.length)]
    const { error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.pwd,
      options: { data: { username: authForm.username, school: authForm.school, avatar_initials: initials, avatar_color: color } }
    })
    if (error) setAuthErr(error.message)
    else setAuthErr('注册成功！请检查邮箱验证（如果 Supabase 开了邮件验证的话）')
    setAuthLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setProfile(null); setSession(null)
  }

  // ── posts ──
  async function loadPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!data) return
    // check which ones current user has fizzupped
    if (profile) {
      const { data: myFizzups } = await supabase
        .from('fizzups').select('post_id').eq('user_id', profile.id)
      const fizzedIds = new Set(myFizzups?.map(f => f.post_id))
      setPosts(data.map(p => ({ ...p, has_fizzupped: fizzedIds.has(p.id) })))
    } else {
      setPosts(data)
    }
  }

  function sortedPosts() {
    if (feedTab === 'trending') return [...posts].sort((a,b) => b.likes_count - a.likes_count)
    if (feedTab === 'new') return [...posts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return posts.filter(p => p.user_id === profile?.id)
  }

  async function submitPost() {
    if (!profile || (!postText.trim() && !pendingPoll)) return
    setPosting(true)
    await supabase.from('posts').insert({
      user_id: profile.id,
      text: postText.trim(),
      is_anon: postAnon,
      school: profile.school,
      poll: pendingPoll ? { question: pendingPoll.question, options: pendingPoll.options, votes: pendingPoll.options.map(()=>0), voted_option: null } : null,
    })
    setPostText(''); setPendingPoll(null); setPosting(false)
    loadPosts()
  }

  async function toggleFizzup(post: Post) {
    if (!profile) return
    if (post.has_fizzupped) {
      await supabase.from('fizzups').delete().eq('post_id', post.id).eq('user_id', profile.id)
    } else {
      await supabase.from('fizzups').insert({ post_id: post.id, user_id: profile.id })
    }
    loadPosts(); loadLeaderboard()
  }

  async function deletePost(postId: string) {
    if (!confirm('确认删除？')) return
    await supabase.from('posts').delete().eq('id', postId)
    loadPosts()
  }

  async function votePoll(post: Post, optIdx: number) {
    if (!post.poll || post.poll.voted_option !== null) return
    const newVotes = [...post.poll.votes]
    newVotes[optIdx]++
    const newPoll = { ...post.poll, votes: newVotes, voted_option: optIdx }
    await supabase.from('posts').update({ poll: newPoll }).eq('id', post.id)
    loadPosts()
  }

  // ── comments ──
  async function toggleComments(postId: string) {
    if (openComments[postId]) {
      const copy = { ...openComments }; delete copy[postId]
      setOpenComments(copy)
    } else {
      const { data } = await supabase
        .from('comments').select('*, profiles(*)').eq('post_id', postId).order('created_at')
      setOpenComments(prev => ({ ...prev, [postId]: data || [] }))
    }
  }

  async function submitComment(postId: string) {
    if (!profile || !commentInputs[postId]?.trim()) return
    await supabase.from('comments').insert({ post_id: postId, user_id: profile.id, text: commentInputs[postId].trim() })
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', postId).order('created_at')
    setOpenComments(prev => ({ ...prev, [postId]: data || [] }))
    loadPosts()
  }

  // ── poll modal ──
  function confirmPoll() {
    if (!pollForm.q || !pollForm.o1 || !pollForm.o2) return
    const opts = [pollForm.o1, pollForm.o2, ...(pollForm.o3 ? [pollForm.o3] : [])]
    setPendingPoll({ question: pollForm.q, options: opts })
    setShowPollModal(false); setPollForm({q:'',o1:'',o2:'',o3:''})
  }

  // ── marketplace ──
  async function loadListings() {
    const { data } = await supabase.from('listings').select('*, profiles(*)').eq('is_sold', false).order('created_at', { ascending: false })
    setListings(data || [])
  }

  async function submitListing() {
    if (!profile || !listingForm.title) return
    await supabase.from('listings').insert({
      user_id: profile.id,
      title: listingForm.title,
      price: parseFloat(listingForm.price)||0,
      category: listingForm.cat,
      description: listingForm.desc,
      emoji: EMOJI_CATS[listingForm.cat]||'📦',
      school: profile.school,
    })
    setShowListingModal(false); setListingForm({title:'',price:'',cat:'books',desc:''})
    loadListings()
  }

  async function markSold(id: string) {
    await supabase.from('listings').update({ is_sold: true }).eq('id', id)
    loadListings()
  }

  // ── events ──
  async function loadEvents() {
    const { data } = await supabase.from('events').select('*, profiles(*)').order('event_date')
    if (!data) return
    if (profile) {
      const { data: myGoing } = await supabase.from('event_going').select('event_id').eq('user_id', profile.id)
      const goingIds = new Set(myGoing?.map(g => g.event_id))
      setEvents(data.map(e => ({ ...e, has_going: goingIds.has(e.id) })))
    } else setEvents(data)
  }

  async function toggleGoing(ev: Event) {
    if (!profile) return
    if (ev.has_going) {
      await supabase.from('event_going').delete().eq('event_id', ev.id).eq('user_id', profile.id)
    } else {
      await supabase.from('event_going').insert({ event_id: ev.id, user_id: profile.id })
    }
    loadEvents()
  }

  async function submitEvent() {
    if (!profile || !eventForm.title || !eventForm.date) return
    await supabase.from('events').insert({
      user_id: profile.id, title: eventForm.title, event_date: eventForm.date,
      location: eventForm.loc, description: eventForm.desc, school: profile.school,
    })
    setShowEventModal(false); setEventForm({title:'',date:'',loc:'',desc:''})
    loadEvents()
  }

  // ── leaderboard ──
  async function loadLeaderboard() {
    const { data } = await supabase.from('profiles').select('*').order('total_fizzups', { ascending: false }).limit(5)
    setLeaderboard(data || [])
  }

  // ── messages ──
  async function loadConversations() {
    if (!profile) return
    const { data: allUsers } = await supabase.from('profiles').select('*').neq('id', profile.id)
    if (!allUsers) return
    const convos = await Promise.all(allUsers.map(async (u) => {
      const { data: msgs } = await supabase.from('messages')
        .select('*').or(`and(from_user_id.eq.${profile.id},to_user_id.eq.${u.id}),and(from_user_id.eq.${u.id},to_user_id.eq.${profile.id})`)
        .order('created_at', { ascending: false }).limit(1)
      return { user: u, lastMsg: msgs?.[0] }
    }))
    convos.sort((a,b) => (b.lastMsg?.created_at||'') > (a.lastMsg?.created_at||'') ? 1 : -1)
    setConversations(convos)
  }

  async function loadUnread() {
    if (!profile) return
    const { count } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', profile.id).eq('is_read', false)
    setUnreadCount(count || 0)
  }

  async function openChat(u: Profile) {
    setChatTarget(u)
    const { data } = await supabase.from('messages')
      .select('*').or(`and(from_user_id.eq.${profile!.id},to_user_id.eq.${u.id}),and(from_user_id.eq.${u.id},to_user_id.eq.${profile!.id})`)
      .order('created_at')
    setChatMsgs(data || [])
    // mark read
    await supabase.from('messages').update({ is_read: true }).eq('to_user_id', profile!.id).eq('from_user_id', u.id)
    loadUnread()
    setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight) }, 100)
  }

  async function sendMsg() {
    if (!profile || !chatTarget || !chatInput.trim()) return
    await supabase.from('messages').insert({ from_user_id: profile.id, to_user_id: chatTarget.id, text: chatInput.trim() })
    setChatInput('')
    openChat(chatTarget)
    loadConversations()
  }

  // ── search ──
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('posts').select('*, profiles(*)').ilike('text', `%${searchQ}%`).limit(20)
      setSearchResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ])

  // ── scroll chat to bottom ──
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [chatMsgs])

  // ═══════════════════════════════════════════════════════════
  //  AUTH SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!session || !profile) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'24px',padding:'24px'}}>
      <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'3rem',color:'var(--primary)',letterSpacing:'-2px'}}>
        fizz<span style={{color:'var(--accent)'}}>.</span>
      </div>
      <div className="fizz-card" style={{padding:'32px',width:'100%',maxWidth:'400px'}}>
        <h2 style={{fontFamily:'Nunito',fontWeight:800,fontSize:'1.4rem',marginBottom:'6px'}}>加入你的社区</h2>
        <p style={{color:'var(--muted)',fontSize:'0.9rem',marginBottom:'24px'}}>匿名真实地与你的校友连接</p>

        <div style={{display:'flex',background:'var(--surface2)',borderRadius:'12px',padding:'4px',marginBottom:'20px'}}>
          {(['login','register'] as const).map(t => (
            <div key={t} onClick={() => setAuthTab(t)} style={{flex:1,padding:'8px',textAlign:'center',borderRadius:'10px',cursor:'pointer',fontWeight:700,fontSize:'0.9rem',background:authTab===t?'var(--primary)':'transparent',color:authTab===t?'white':'var(--muted)',transition:'all .2s'}}>
              {t==='login'?'登录':'注册'}
            </div>
          ))}
        </div>

        {authTab === 'register' && (
          <>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>昵称</label>
              <input className="fizz-input" placeholder="你的显示名称" value={authForm.username} onChange={e=>setAuthForm(f=>({...f,username:e.target.value}))} />
            </div>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>学校</label>
              <select className="fizz-input" value={authForm.school} onChange={e=>setAuthForm(f=>({...f,school:e.target.value}))} style={{cursor:'pointer'}}>
                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
        <div style={{marginBottom:'14px'}}>
          <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>学校邮箱</label>
          <input className="fizz-input" type="email" placeholder="you@university.edu" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))} />
        </div>
        <div style={{marginBottom:'20px'}}>
          <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>密码</label>
          <input className="fizz-input" type="password" placeholder="••••••••" value={authForm.pwd} onChange={e=>setAuthForm(f=>({...f,pwd:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(authTab==='login'?handleLogin():handleRegister())} />
        </div>
        {authErr && <div style={{background:'rgba(247,111,111,.15)',border:'1px solid var(--red)',borderRadius:'10px',padding:'10px 14px',marginBottom:'14px',fontSize:'0.88rem',color:'var(--red)'}}>{authErr}</div>}
        <button className="btn-primary" style={{width:'100%'}} disabled={authLoading} onClick={authTab==='login'?handleLogin:handleRegister}>
          {authLoading ? '处理中…' : authTab==='login' ? '登录 Fizz' : '创建账号'}
        </button>
        <div style={{textAlign:'center',marginTop:'14px',fontSize:'0.82rem',color:'var(--muted)'}}>
          {authTab==='login'?'还没有账号？':'已有账号？'}
          <span onClick={()=>setAuthTab(authTab==='login'?'register':'login')} style={{color:'var(--primary)',cursor:'pointer',marginLeft:'4px'}}>
            {authTab==='login'?'立即注册':'立即登录'}
          </span>
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════
  //  MAIN APP
  // ═══════════════════════════════════════════════════════════
  const navItems = [
    { id: 'feed', label: '主页', icon: '🏠' },
    { id: 'fizzin', label: "热门 Fizzin'", icon: '⚡' },
    { id: 'market', label: '校园市场', icon: '🛒' },
    { id: 'events', label: '活动', icon: '📅' },
    { id: 'messages', label: '消息', icon: '💬', badge: unreadCount },
    { id: 'search', label: '搜索', icon: '🔍' },
    { id: 'profile', label: '我的主页', icon: '👤' },
  ]

  function PostCard({ post }: { post: Post }) {
    const isAnon = post.is_anon
    const name = isAnon ? anonName(post.user_id) : (post.profiles?.username || '匿名')
    const color = isAnon ? anonColor(post.user_id) : (post.profiles?.avatar_color || '#888')
    const initials = isAnon ? '👤' : (post.profiles?.avatar_initials || '??')
    const isOpen = !!openComments[post.id]
    const comments = openComments[post.id] || []
    const isMine = post.user_id === profile?.id

    return (
      <div className="fizz-card" style={{padding:'18px',marginBottom:'14px'}}>
        {/* header */}
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
          <div style={{width:'38px',height:'38px',borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.88rem',flexShrink:0}}>{initials}</div>
          <div style={{flex:1}}>
            <span style={{fontWeight:700,fontSize:'0.9rem'}}>{name}</span>
            {isAnon && <span style={{marginLeft:'6px',background:'#2a2a3a',color:'var(--muted)',borderRadius:'6px',padding:'2px 7px',fontSize:'0.7rem',fontWeight:800}}>匿名</span>}
            {post.is_hot && <span style={{marginLeft:'4px',background:'rgba(247,164,86,.15)',color:'var(--accent)',borderRadius:'6px',padding:'2px 7px',fontSize:'0.7rem',fontWeight:800}}>🔥 热门</span>}
            <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{timeAgo(post.created_at)}</div>
          </div>
          <span style={{fontSize:'0.75rem',color:'var(--muted)',background:'var(--surface2)',padding:'3px 8px',borderRadius:'6px'}}>{post.school}</span>
        </div>
        {/* body */}
        <div style={{fontSize:'0.95rem',lineHeight:'1.6',marginBottom:'14px'}}>{post.text}</div>
        {/* poll */}
        {post.poll && (
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:700,marginBottom:'8px',fontSize:'0.92rem'}}>{post.poll.question}</div>
            {post.poll.options.map((opt, i) => {
              const total = post.poll!.votes.reduce((a,b)=>a+b,0)||1
              const pct = Math.round(post.poll!.votes[i]/total*100)
              const voted = post.poll!.voted_option !== null
              return (
                <div key={i} onClick={()=>votePoll(post,i)} style={{position:'relative',background:'var(--surface2)',border:`1px solid ${post.poll!.voted_option===i?'var(--primary)':'var(--border)'}`,borderRadius:'10px',padding:'10px 14px',marginBottom:'8px',cursor:voted?'default':'pointer',display:'flex',alignItems:'center',gap:'10px'}}>
                  {voted && <div className="poll-bar" style={{width:`${pct}%`}} />}
                  <span style={{position:'relative',fontWeight:600,fontSize:'0.9rem'}}>{opt}</span>
                  {voted && <span style={{position:'relative',marginLeft:'auto',fontFamily:'Nunito',fontWeight:800,color:'var(--primary)',fontSize:'0.88rem'}}>{pct}%</span>}
                </div>
              )
            })}
          </div>
        )}
        {/* actions */}
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <button onClick={()=>toggleFizzup(post)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'10px',border:'none',background:post.has_fizzupped?'rgba(124,111,247,.2)':'var(--surface2)',color:post.has_fizzupped?'var(--primary)':'var(--text)',cursor:'pointer',fontFamily:'Nunito',fontWeight:800,fontSize:'0.88rem'}}>
            👍 {post.likes_count}
          </button>
          <button onClick={()=>toggleComments(post.id)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',borderRadius:'10px',border:'none',background:'transparent',color:'var(--muted)',cursor:'pointer',fontWeight:600,fontSize:'0.82rem'}}>
            💬 {post.comments_count}
          </button>
          {isMine && <button onClick={()=>deletePost(post.id)} style={{marginLeft:'auto',padding:'6px 12px',borderRadius:'8px',border:'none',background:'transparent',color:'var(--red)',cursor:'pointer',fontSize:'0.82rem'}}>删除</button>}
        </div>
        {/* comments */}
        {isOpen && (
          <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px solid var(--border)'}}>
            {comments.map(c => (
              <div key={c.id} style={{display:'flex',gap:'9px',marginBottom:'12px'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'50%',background:c.profiles?.avatar_color||'#888',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.7rem',flexShrink:0}}>{c.profiles?.avatar_initials||'?'}</div>
                <div>
                  <span style={{fontWeight:700,fontSize:'0.82rem'}}>{c.profiles?.username||'用户'}</span>
                  <span style={{fontSize:'0.72rem',color:'var(--muted)',marginLeft:'6px'}}>{timeAgo(c.created_at)}</span>
                  <div style={{fontSize:'0.88rem',lineHeight:'1.5'}}>{c.text}</div>
                </div>
              </div>
            ))}
            <div style={{display:'flex',gap:'9px',marginTop:'10px'}}>
              <input className="fizz-input" style={{fontSize:'0.88rem',padding:'9px 12px'}} placeholder="写评论…" value={commentInputs[post.id]||''} onChange={e=>setCommentInputs(p=>({...p,[post.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&submitComment(post.id)} />
              <button className="btn-primary" style={{padding:'9px 16px',fontSize:'0.82rem',whiteSpace:'nowrap'}} onClick={()=>submitComment(post.id)}>回复</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const filteredListings = marketCat==='all' ? listings : listings.filter(l=>l.category===marketCat)

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      {/* ── SIDEBAR ── */}
      <div style={{width:'220px',minHeight:'100vh',background:'var(--surface)',borderRight:'1px solid var(--border)',padding:'20px 10px',display:'flex',flexDirection:'column',gap:'4px',position:'fixed',top:0,left:0}}>
        <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.8rem',color:'var(--primary)',padding:'8px 12px 20px',letterSpacing:'-1px'}}>
          fizz<span style={{color:'var(--accent)'}}>.</span>
        </div>
        {navItems.map(n => (
          <div key={n.id} onClick={()=>setPage(n.id as any)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',borderRadius:'12px',cursor:'pointer',fontWeight:600,fontSize:'0.92rem',background:page===n.id?'var(--primary)':'transparent',color:page===n.id?'white':'var(--muted)',transition:'all .2s'}}>
            {n.icon} {n.label}
            {n.badge ? <span style={{marginLeft:'auto',background:'var(--red)',color:'white',borderRadius:'50%',width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:900}}>{n.badge}</span> : null}
          </div>
        ))}
        <div style={{marginTop:'auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'12px',background:'var(--surface2)',cursor:'pointer'}} onClick={()=>setPage('profile')}>
            <div style={{width:'34px',height:'34px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.88rem',color:'white',flexShrink:0}}>{profile.avatar_initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.username}</div>
              <div style={{fontSize:'0.75rem',color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.school}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{marginLeft:'220px',flex:1,maxWidth:'660px',padding:'24px 20px'}}>

        {/* FEED */}
        {page==='feed' && <>
          {/* school banner */}
          <div style={{background:'linear-gradient(135deg,rgba(124,111,247,.25),rgba(76,217,160,.1))',border:'1px solid rgba(124,111,247,.3)',borderRadius:'var(--radius)',padding:'16px',marginBottom:'20px',display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'1.8rem'}}>🏫</span>
            <div>
              <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1rem'}}>{profile.school}</div>
              <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>校园社区</div>
            </div>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'6px',fontSize:'0.82rem',color:'var(--green)',fontWeight:700}}>
              <div className="pulse" style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--green)'}} />
              {onlineCount} 人在线
            </div>
          </div>

          {/* composer */}
          <div className="fizz-card" style={{padding:'18px',marginBottom:'20px'}}>
            <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.85rem',flexShrink:0}}>{profile.avatar_initials}</div>
              <textarea style={{flex:1,background:'transparent',border:'none',resize:'none',color:'var(--text)',fontFamily:'DM Sans',fontSize:'1rem',outline:'none',minHeight:'64px',lineHeight:'1.5'}} placeholder={pendingPoll?`📊 "${pendingPoll.question}" 已添加`:'今天校园里有什么新鲜事？'} value={postText} onChange={e=>setPostText(e.target.value)} />
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
              <button onClick={()=>setShowPollModal(true)} style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',borderRadius:'8px',border:'none',background:'var(--surface2)',color:'var(--muted)',cursor:'pointer',fontWeight:600,fontSize:'0.82rem'}}>
                📊 投票
              </button>
              {pendingPoll && <button onClick={()=>setPendingPoll(null)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:'0.82rem'}}>✕ 取消投票</button>}
              <label style={{display:'flex',alignItems:'center',gap:'6px',marginLeft:'auto',cursor:'pointer',fontSize:'0.82rem',fontWeight:700,color:'var(--primary)'}}>
                <input type="checkbox" checked={postAnon} onChange={e=>setPostAnon(e.target.checked)} style={{accentColor:'var(--primary)',cursor:'pointer'}} />
                匿名发布
              </label>
              <button className="btn-primary" style={{padding:'8px 20px',fontSize:'0.9rem'}} disabled={posting} onClick={submitPost}>
                {posting?'发布中…':'发布'}
              </button>
            </div>
          </div>

          {/* tabs */}
          <div style={{display:'flex',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'12px',padding:'4px',marginBottom:'20px'}}>
            {([['trending','🔥 热门'],['new','✨ 最新'],['following','👥 我的']] as const).map(([t,l])=>(
              <div key={t} onClick={()=>setFeedTab(t)} style={{flex:1,padding:'8px',textAlign:'center',borderRadius:'10px',cursor:'pointer',fontWeight:700,fontSize:'0.85rem',background:feedTab===t?'var(--primary)':'transparent',color:feedTab===t?'white':'var(--muted)',transition:'all .2s'}}>{l}</div>
            ))}
          </div>

          {sortedPosts().map(p=><PostCard key={p.id} post={p}/>)}
        </>}

        {/* FIZZIN' */}
        {page==='fizzin' && <>
          <span className="fizzin-badge">⚡ Fizzin' 热门榜</span>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.4rem',margin:'12px 0 20px'}}>正在 Fizzin'</div>
          {[...posts].filter(p=>p.likes_count>=10||p.is_hot).sort((a,b)=>b.likes_count-a.likes_count).map(p=><PostCard key={p.id} post={p}/>)}
          {posts.every(p=>p.likes_count<10&&!p.is_hot)&&<div style={{color:'var(--muted)',textAlign:'center',padding:'60px'}}>暂时没有热门内容，快去给帖子点赞吧！</div>}
        </>}

        {/* MARKET */}
        {page==='market' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.4rem'}}>校园市场</div>
            <button className="btn-primary" style={{fontSize:'0.88rem',padding:'8px 18px'}} onClick={()=>setShowListingModal(true)}>+ 发布商品</button>
          </div>
          <div style={{display:'flex',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'12px',padding:'4px',marginBottom:'20px',overflowX:'auto',gap:'2px'}}>
            {[['all','全部'],['books','📚 教材'],['electronics','💻 电子'],['clothes','👕 服装'],['other','🎁 其他']].map(([c,l])=>(
              <div key={c} onClick={()=>setMarketCat(c)} style={{flex:'0 0 auto',padding:'8px 14px',textAlign:'center',borderRadius:'10px',cursor:'pointer',fontWeight:700,fontSize:'0.82rem',background:marketCat===c?'var(--primary)':'transparent',color:marketCat===c?'white':'var(--muted)',whiteSpace:'nowrap'}}>{l}</div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
            {filteredListings.map(l=>{
              const u = l.profiles
              return (
                <div key={l.id} className="fizz-card" style={{overflow:'hidden',cursor:'pointer'}} onClick={()=>alert(`${l.emoji} ${l.title}\n\n价格：¥${l.price}\n描述：${l.description||'无'}\n卖家：${u?.username||'匿名'}\n\n联系方式：请通过私信联系卖家`)}>
                  <div style={{height:'120px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'3rem',background:'var(--surface2)'}}>{l.emoji}</div>
                  <div style={{padding:'12px'}}>
                    <div style={{fontWeight:700,fontSize:'0.9rem',marginBottom:'4px'}}>{l.title}</div>
                    <div style={{color:'var(--green)',fontFamily:'Nunito',fontWeight:800,fontSize:'1rem'}}>¥{l.price}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'4px'}}>{u?.username||'匿名'} · {timeAgo(l.created_at)}</div>
                    {l.user_id===profile.id&&<button onClick={e=>{e.stopPropagation();markSold(l.id)}} style={{marginTop:'8px',padding:'4px 10px',background:'rgba(76,217,160,.15)',border:'none',borderRadius:'6px',color:'var(--green)',fontSize:'0.75rem',fontWeight:700,cursor:'pointer'}}>标记已售</button>}
                  </div>
                </div>
              )
            })}
          </div>
          {filteredListings.length===0&&<div style={{color:'var(--muted)',textAlign:'center',padding:'60px'}}>暂无商品，发布第一个吧！</div>}
        </>}

        {/* EVENTS */}
        {page==='events' && <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.4rem'}}>校园活动</div>
            <button className="btn-primary" style={{fontSize:'0.88rem',padding:'8px 18px'}} onClick={()=>setShowEventModal(true)}>+ 创建活动</button>
          </div>
          {events.map(e=>{
            const d = new Date(e.event_date)
            const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            return (
              <div key={e.id} className="fizz-card" style={{padding:'16px',marginBottom:'12px',display:'flex',gap:'14px',cursor:'pointer',borderColor:e.has_going?'var(--primary)':'var(--border)'}} onClick={()=>toggleGoing(e)}>
                <div style={{background:e.has_going?'var(--green)':'var(--primary)',color:'white',borderRadius:'10px',padding:'8px 12px',textAlign:'center',fontFamily:'Nunito',fontWeight:900,minWidth:'52px',flexShrink:0}}>
                  <div style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'1px'}}>{months[d.getMonth()]}</div>
                  <div style={{fontSize:'1.5rem',lineHeight:'1'}}>{d.getDate()}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:'4px'}}>{e.title}</div>
                  <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>📍 {e.location} · {e.description}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--green)',fontWeight:700,marginTop:'4px'}}>✅ {e.going_count} 人感兴趣 {e.has_going?'（已参加）':''}</div>
                </div>
              </div>
            )
          })}
          {events.length===0&&<div style={{color:'var(--muted)',textAlign:'center',padding:'60px'}}>暂无活动</div>}
        </>}

        {/* MESSAGES */}
        {page==='messages' && <>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.4rem',marginBottom:'20px'}}>私信</div>
          {!chatTarget ? (
            conversations.map(({user:u,lastMsg})=>(
              <div key={u.id} onClick={()=>openChat(u)} style={{display:'flex',gap:'10px',padding:'12px',borderRadius:'12px',cursor:'pointer',alignItems:'center',marginBottom:'4px',transition:'background .15s'}} onMouseOver={e=>(e.currentTarget.style.background='var(--surface2)')} onMouseOut={e=>(e.currentTarget.style.background='transparent')}>
                <div style={{width:'42px',height:'42px',borderRadius:'50%',background:u.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,flexShrink:0}}>{u.avatar_initials}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'0.9rem'}}>{u.username} <span style={{fontSize:'0.72rem',color:'var(--muted)',fontWeight:400}}>{u.school}</span></div>
                  <div style={{fontSize:'0.8rem',color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lastMsg?.text||'开始对话'}</div>
                </div>
                {lastMsg&&<div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{timeAgo(lastMsg.created_at)}</div>}
              </div>
            ))
          ) : (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:'36px',height:'36px',borderRadius:'50%',background:chatTarget.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.88rem'}}>{chatTarget.avatar_initials}</div>
                <div style={{fontWeight:700}}>{chatTarget.username}</div>
                <button onClick={()=>setChatTarget(null)} style={{marginLeft:'auto',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'1.2rem'}}>✕</button>
              </div>
              <div ref={chatRef} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px',height:'400px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'10px'}}>
                {chatMsgs.map(m=>{
                  const mine = m.from_user_id===profile.id
                  return (
                    <div key={m.id} style={{maxWidth:'70%',alignSelf:mine?'flex-end':'flex-start'}}>
                      <div style={{padding:'10px 14px',borderRadius:'14px',fontSize:'0.88rem',lineHeight:'1.5',background:mine?'var(--primary)':'var(--surface2)',color:mine?'white':'var(--text)',borderBottomRightRadius:mine?'4px':'14px',borderBottomLeftRadius:mine?'14px':'4px'}}>{m.text}</div>
                      <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:'3px',textAlign:mine?'right':'left'}}>{timeAgo(m.created_at)}</div>
                    </div>
                  )
                })}
                {chatMsgs.length===0&&<div style={{color:'var(--muted)',textAlign:'center',margin:'auto'}}>发个消息打个招呼吧 👋</div>}
              </div>
              <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                <input className="fizz-input" style={{fontSize:'0.9rem'}} placeholder="发送消息…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} />
                <button className="btn-primary" style={{padding:'10px 18px',whiteSpace:'nowrap'}} onClick={sendMsg}>发送</button>
              </div>
            </div>
          )}
        </>}

        {/* SEARCH */}
        {page==='search' && <>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.4rem',marginBottom:'20px'}}>搜索</div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'12px',padding:'10px 14px',marginBottom:'20px'}}>
            <span style={{color:'var(--muted)'}}>🔍</span>
            <input style={{flex:1,background:'transparent',border:'none',color:'var(--text)',fontFamily:'DM Sans',fontSize:'0.95rem',outline:'none'}} placeholder="搜索帖子内容…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          </div>
          {searchResults.map(p=><PostCard key={p.id} post={p}/>)}
          {searchQ&&searchResults.length===0&&<div style={{color:'var(--muted)',textAlign:'center',padding:'60px'}}>没有找到相关内容</div>}
        </>}

        {/* PROFILE */}
        {page==='profile' && <>
          <div className="fizz-card" style={{padding:'24px',marginBottom:'20px'}}>
            <div style={{display:'flex',gap:'16px',alignItems:'center',marginBottom:'16px'}}>
              <div style={{width:'64px',height:'64px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'1.5rem',color:'white'}}>{profile.avatar_initials}</div>
              <div>
                <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.3rem'}}>{profile.username}</div>
                <div style={{color:'var(--muted)',fontSize:'0.88rem'}}>{profile.school}</div>
              </div>
              <button onClick={handleLogout} style={{marginLeft:'auto',padding:'8px 18px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--muted)',cursor:'pointer',fontWeight:600,fontSize:'0.85rem'}}>退出登录</button>
            </div>
            <div style={{display:'flex',gap:'24px'}}>
              <div style={{textAlign:'center'}}><div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.3rem'}}>{posts.filter(p=>p.user_id===profile.id).length}</div><div style={{fontSize:'0.75rem',color:'var(--muted)'}}>帖子</div></div>
              <div style={{textAlign:'center'}}><div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.3rem'}}>{profile.total_fizzups}</div><div style={{fontSize:'0.75rem',color:'var(--muted)'}}>FizzUps</div></div>
            </div>
          </div>
          <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.2rem',marginBottom:'16px'}}>我的帖子</div>
          {posts.filter(p=>p.user_id===profile.id).map(p=><PostCard key={p.id} post={p}/>)}
          {posts.every(p=>p.user_id!==profile.id)&&<div style={{color:'var(--muted)',textAlign:'center',padding:'60px'}}>还没有发帖，快去发一条吧！</div>}
        </>}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{width:'280px',position:'sticky',top:0,height:'100vh',padding:'24px 16px',overflowY:'auto',borderLeft:'1px solid var(--border)'}}>
        {/* leaderboard */}
        <div className="fizz-card" style={{padding:'18px',marginBottom:'14px'}}>
          <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:'1.05rem',marginBottom:'14px'}}>🏆 FizzUp 排行榜</div>
          {leaderboard.map((u,i)=>(
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:i<leaderboard.length-1?'1px solid var(--border)':'none'}}>
              <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'0.95rem',color:['#ffd700','#c0c0c0','#cd7f32','var(--muted)','var(--muted)'][i],width:'22px',textAlign:'center'}}>{i+1}</div>
              <div style={{width:'30px',height:'30px',borderRadius:'50%',background:u.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Nunito',fontWeight:900,fontSize:'0.75rem',flexShrink:0}}>{u.avatar_initials}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.username}</div>
                <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>{u.school}</div>
              </div>
              <div style={{fontFamily:'Nunito',fontWeight:800,color:'var(--primary)',fontSize:'0.85rem'}}>{u.total_fizzups}</div>
            </div>
          ))}
        </div>
        {/* trending */}
        <div className="fizz-card" style={{padding:'18px'}}>
          <div style={{fontFamily:'Nunito',fontWeight:800,fontSize:'1.05rem',marginBottom:'14px'}}>🔥 热门话题</div>
          {['期末备考','食堂推荐','校园市场','选课攻略','考研经验','社团招新'].map((t,i)=>(
            <div key={t} onClick={()=>{setPage('search');setSearchQ('#'+t)}} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',cursor:'pointer',borderBottom:i<5?'1px solid var(--border)':'none'}}>
              <span style={{fontFamily:'Nunito',fontWeight:900,fontSize:'0.78rem',color:'var(--muted)',width:'18px'}}>{i+1}</span>
              <span style={{fontWeight:700,fontSize:'0.88rem'}}>#{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODALS ── */}
      {/* poll modal */}
      {showPollModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&setShowPollModal(false)}>
          <div className="fizz-card" style={{padding:'28px',width:'100%',maxWidth:'440px'}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.2rem',marginBottom:'20px',display:'flex',justifyContent:'space-between'}}>
              创建投票 <span onClick={()=>setShowPollModal(false)} style={{cursor:'pointer',color:'var(--muted)'}}>✕</span>
            </div>
            {[['q','问题','你想问什么？'],['o1','选项 1','选项一'],['o2','选项 2','选项二'],['o3','选项 3（可选）','选项三']].map(([k,l,p])=>(
              <div key={k} style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>{l}</label>
                <input className="fizz-input" placeholder={p} value={(pollForm as any)[k]} onChange={e=>setPollForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <button className="btn-primary" style={{width:'100%'}} onClick={confirmPoll}>添加到帖子</button>
          </div>
        </div>
      )}

      {/* listing modal */}
      {showListingModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&setShowListingModal(false)}>
          <div className="fizz-card" style={{padding:'28px',width:'100%',maxWidth:'440px'}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.2rem',marginBottom:'20px',display:'flex',justifyContent:'space-between'}}>
              发布商品 <span onClick={()=>setShowListingModal(false)} style={{cursor:'pointer',color:'var(--muted)'}}>✕</span>
            </div>
            {[['title','商品名称','例：高数教材（全新）'],['price','价格（元）','0'],['desc','描述','商品描述…']].map(([k,l,p])=>(
              <div key={k} style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>{l}</label>
                <input className="fizz-input" type={k==='price'?'number':'text'} placeholder={p} value={(listingForm as any)[k]} onChange={e=>setListingForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>分类</label>
              <select className="fizz-input" style={{cursor:'pointer'}} value={listingForm.cat} onChange={e=>setListingForm(f=>({...f,cat:e.target.value}))}>
                <option value="books">📚 教材</option>
                <option value="electronics">💻 电子</option>
                <option value="clothes">👕 服装</option>
                <option value="other">🎁 其他</option>
              </select>
            </div>
            <button className="btn-primary" style={{width:'100%'}} onClick={submitListing}>发布商品</button>
          </div>
        </div>
      )}

      {/* event modal */}
      {showEventModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&setShowEventModal(false)}>
          <div className="fizz-card" style={{padding:'28px',width:'100%',maxWidth:'440px'}}>
            <div style={{fontFamily:'Nunito',fontWeight:900,fontSize:'1.2rem',marginBottom:'20px',display:'flex',justifyContent:'space-between'}}>
              创建活动 <span onClick={()=>setShowEventModal(false)} style={{cursor:'pointer',color:'var(--muted)'}}>✕</span>
            </div>
            {[['title','活动名称','活动名称'],['date','日期',''],['loc','地点','地点'],['desc','描述','活动详情…']].map(([k,l,p])=>(
              <div key={k} style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'0.78rem',fontWeight:700,color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'.5px'}}>{l}</label>
                <input className="fizz-input" type={k==='date'?'date':'text'} placeholder={p} value={(eventForm as any)[k]} onChange={e=>setEventForm(f=>({...f,[k]:e.target.value}))} />
              </div>
            ))}
            <button className="btn-primary" style={{width:'100%'}} onClick={submitEvent}>发布活动</button>
          </div>
        </div>
      )}
    </div>
  )
}
