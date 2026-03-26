'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile, Post, Comment, Listing, Message } from '@/types'

type Theme = 'light'|'dark'|'auto'

function useTheme() {
  const [theme, setThemeState] = useState<Theme>('auto')
  const [resolved, setResolved] = useState<'light'|'dark'>('light')
  useEffect(()=>{ const s=localStorage.getItem('fizz_theme') as Theme|null; if(s) setThemeState(s) },[])
  useEffect(()=>{
    localStorage.setItem('fizz_theme',theme)
    if(theme==='auto'){
      const mq=window.matchMedia('(prefers-color-scheme: dark)')
      setResolved(mq.matches?'dark':'light')
      const h=(e:MediaQueryListEvent)=>setResolved(e.matches?'dark':'light')
      mq.addEventListener('change',h); return ()=>mq.removeEventListener('change',h)
    } else setResolved(theme)
  },[theme])
  return { theme, setTheme: setThemeState, resolved }
}

const LIGHT = { bg:'#ffffff', surface:'#f5f5f5', surface2:'#ebebeb', border:'#e8e8e8', text:'#111111', muted:'#8e8e93', accent:'#1a3a5c', accentBright:'#2563eb', upvote:'#2563eb', red:'#ef4444', green:'#16a34a', shadow:'rgba(0,0,0,0.1)' }
const DARK  = { bg:'#0f0f13', surface:'#18181f', surface2:'#222230', border:'#2e2e3f', text:'#e8e8f0', muted:'#888899', accent:'#1a3a5c', accentBright:'#7c6ff7', upvote:'#7c6ff7', red:'#f76f6f', green:'#4cd9a0', shadow:'rgba(0,0,0,0.4)' }

const EMOJIS = ['🦊','🐧','🎩','🦄','🌈','🔮','🎪','🦋','🌊','🎭','🐻','🦁']
const COLORS = ['#1a3a5c','#2563eb','#7c3aed','#0891b2','#15803d','#b45309','#be123c','#0f766e']
const SCHOOLS = ['北京大学','清华大学','复旦大学','上海交通大学','浙江大学','南京大学','武汉大学','中山大学','华中科技大学','四川大学']

function ago(ts:string){const d=Date.now()-new Date(ts).getTime();if(d<60000)return'now';if(d<3600000)return Math.floor(d/60000)+'m';if(d<86400000)return Math.floor(d/3600000)+'h';return Math.floor(d/86400000)+'d'}
function anonEmoji(uid:string){return EMOJIS[uid.charCodeAt(0)%EMOJIS.length]}
function avColor(uid:string){return COLORS[uid.charCodeAt(0)%COLORS.length]}

export default function App() {
  const sb = createClient()
  const {theme,setTheme,resolved} = useTheme()
  const C = resolved==='light'?LIGHT:DARK

  // auth
  const [session,setSession]=useState<any>(null)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [authTab,setAuthTab]=useState<'login'|'register'>('login')
  const [af,setAf]=useState({email:'',pwd:'',username:'',school:SCHOOLS[0]})
  const [authLoading,setAuthLoading]=useState(false)
  const [authErr,setAuthErr]=useState('')

  // nav & pages
  const [page,setPage]=useState<'feed'|'messages'|'search'|'market'|'profile'>('feed')
  const [feedTab,setFeedTab]=useState<'Top'|"Fizzin'"| 'New'>("Fizzin'")

  // data
  const [posts,setPosts]=useState<Post[]>([])
  const [listings,setListings]=useState<Listing[]>([])
  const [convos,setConvos]=useState<{user:Profile,lastMsg?:Message}[]>([])
  const [chatMsgs,setChatMsgs]=useState<Message[]>([])
  const [chatTarget,setChatTarget]=useState<Profile|null>(null)
  const [chatInput,setChatInput]=useState('')
  const [unread,setUnread]=useState(0)
  const [online,setOnline]=useState(0)
  const [searchQ,setSearchQ]=useState('')
  const [searchRes,setSearchRes]=useState<Post[]>([])
  const [mktCat,setMktCat]=useState('all')

  // post detail
  const [selectedPost,setSelectedPost]=useState<Post|null>(null)
  const [postComments,setPostComments]=useState<Comment[]>([])
  const [cmtInput,setCmtInput]=useState('')
  const [commentVotes,setCommentVotes]=useState<Record<string,string|null>>({})
  const [submittingCmt,setSubmittingCmt]=useState(false)

  // compose
  const [showPost,setShowPost]=useState(false)
  const [postText,setPostText]=useState('')
  const [postAnon,setPostAnon]=useState(true)
  const [postImgs,setPostImgs]=useState<File[]>([])
  const [postPrevs,setPostPrevs]=useState<string[]>([])
  const [posting,setPosting]=useState(false)

  // repost
  const [showRepost,setShowRepost]=useState(false)
  const [repostTarget,setRepostTarget]=useState<Post|null>(null)
  const [repostText,setRepostText]=useState('')
  const [repostAnon,setRepostAnon]=useState(true)
  const [reposting,setReposting]=useState(false)

  // dm from post
  const [showDmPost,setShowDmPost]=useState(false)
  const [dmPostTarget,setDmPostTarget]=useState<Post|null>(null)
  const [dmPostMsg,setDmPostMsg]=useState('')

  // listing
  const [showListing,setShowListing]=useState(false)
  const [lf,setLf]=useState({title:'',price:'',cat:'clothes',desc:'',condition:'Good'})
  const [lFiles,setLFiles]=useState<File[]>([])
  const [lPrevs,setLPrevs]=useState<string[]>([])
  const [lUploading,setLUploading]=useState(false)

  // settings
  const [showSettings,setShowSettings]=useState(false)
  const chatRef=useRef<HTMLDivElement>(null)

  // init auth
  useEffect(()=>{
    sb.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)loadProfile(data.session.user.id)})
    const{data:{subscription}}=sb.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)loadProfile(s.user.id);else setProfile(null)})
    return()=>subscription.unsubscribe()
  },[])

  async function loadProfile(uid:string){
    const{data}=await sb.from('profiles').select('*').eq('id',uid).single()
    if(data){setProfile(data);presence(data)}
  }
  async function presence(p:Profile){
    await sb.from('presence').upsert({user_id:p.id,last_seen:new Date().toISOString(),school:p.school})
    const{count}=await sb.from('presence').select('*',{count:'exact',head:true}).gte('last_seen',new Date(Date.now()-5*60*1000).toISOString())
    setOnline(count||0)
  }

  useEffect(()=>{
    if(!profile)return
    loadPosts();loadListings();loadConvos();loadUnread()
    const ch=sb.channel('rt-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadPosts()).subscribe()
    const mch=sb.channel('rt-msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'to_user_id=eq.'+profile.id},p=>{
      loadConvos();loadUnread()
      if(chatTarget?.id===p.new.from_user_id)setChatMsgs(x=>[...x,p.new as Message])
    }).subscribe()
    const iv=setInterval(()=>presence(profile),120000)
    return()=>{sb.removeChannel(ch);sb.removeChannel(mch);clearInterval(iv)}
  },[profile?.id])

  // auth
  async function handleLogin(){
    setAuthLoading(true);setAuthErr('')
    const{error}=await sb.auth.signInWithPassword({email:af.email,password:af.pwd})
    if(error)setAuthErr('Wrong email or password')
    setAuthLoading(false)
  }
  async function handleRegister(){
    setAuthLoading(true);setAuthErr('')
    if(!af.username||!af.email||!af.pwd){setAuthErr('Please fill all fields');setAuthLoading(false);return}
    if(af.pwd.length<6){setAuthErr('Password must be 6+ chars');setAuthLoading(false);return}
    const ini=af.username.slice(0,2).toUpperCase()
    const col=COLORS[Math.floor(Math.random()*COLORS.length)]
    const{error}=await sb.auth.signUp({email:af.email,password:af.pwd,options:{data:{username:af.username,school:af.school,avatar_initials:ini,avatar_color:col}}})
    if(error)setAuthErr(error.message)
    else setAuthErr('Success! Check your email to verify.')
    setAuthLoading(false)
  }

  // posts
  async function loadPosts(){
    const{data}=await sb.from('posts').select('*,profiles(*)').order('created_at',{ascending:false}).limit(100)
    if(!data)return
    if(profile){
      const{data:votes}=await sb.from('fizzups').select('post_id,vote_type').eq('user_id',profile.id)
      const vm:Record<string,string>={}
      votes?.forEach(v=>vm[v.post_id]=v.vote_type)
      setPosts(data.map(p=>({...p,my_vote:vm[p.id]||null})))
    } else setPosts(data)
  }

  function sorted(){
    const p=[...posts]
    if(feedTab==='Top')return p.sort((a,b)=>b.likes_count-a.likes_count)
    if(feedTab==="Fizzin'")return p.sort((a,b)=>(b.likes_count-(b.dislikes_count||0))-(a.likes_count-(a.dislikes_count||0)))
    return p.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
  }

  async function vote(post:Post,type:'up'|'down'){
    if(!profile)return
    const mv=(post as any).my_vote
    // optimistic update
    let nl=post.likes_count, nd=post.dislikes_count||0
    if(type==='up'){if(mv==='up')nl--;else{nl++;if(mv==='down')nd--}}
    else{if(mv==='down')nd--;else{nd++;if(mv==='up')nl--}}
    nl=Math.max(0,nl);nd=Math.max(0,nd)
    const nv=mv===type?null:type
    setPosts(ps=>ps.map(p=>p.id===post.id?{...p,my_vote:nv,likes_count:nl,dislikes_count:nd}:p))
    if(selectedPost?.id===post.id)setSelectedPost(s=>s?{...s,my_vote:nv,likes_count:nl,dislikes_count:nd}:null)
    // db update
    if(mv===type){
      await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id)
    } else {
      if(mv)await sb.from('fizzups').delete().eq('post_id',post.id).eq('user_id',profile.id)
      await sb.from('fizzups').insert({post_id:post.id,user_id:profile.id,vote_type:type})
    }
    setTimeout(()=>loadPosts(),2000)
  }

  async function openPost(p:Post){
    setSelectedPost(p)
    setCmtInput('')
    const{data}=await sb.from('comments').select('*,profiles(*)').eq('post_id',p.id).order('created_at')
    setPostComments(data||[])
    if(data&&data.length>0&&profile){
      const ids=data.map(c=>c.id)
      const{data:cv}=await sb.from('comment_votes').select('comment_id,vote_type').eq('user_id',profile.id).in('comment_id',ids)
      const vm:Record<string,string>={}
      cv?.forEach(v=>vm[v.comment_id]=v.vote_type)
      setCommentVotes(vm)
    }
  }

  async function submitCmt(){
    if(!profile||!cmtInput.trim()||!selectedPost)return
    setSubmittingCmt(true)
    await sb.from('comments').insert({post_id:selectedPost.id,user_id:profile.id,text:cmtInput.trim()})
    setCmtInput('')
    const{data}=await sb.from('comments').select('*,profiles(*)').eq('post_id',selectedPost.id).order('created_at')
    setPostComments(data||[])
    setSubmittingCmt(false)
    loadPosts()
  }

  async function voteComment(c:Comment,type:'up'|'down'){
    if(!profile)return
    const mv=commentVotes[c.id]
    let nl=(c.likes_count||0), nd=(c.dislikes_count||0)
    if(type==='up'){if(mv==='up')nl--;else{nl++;if(mv==='down')nd--}}
    else{if(mv==='down')nd--;else{nd++;if(mv==='up')nl--}}
    nl=Math.max(0,nl);nd=Math.max(0,nd)
    const nv=mv===type?null:type
    setCommentVotes(v=>({...v,[c.id]:nv}))
    setPostComments(cs=>cs.map(x=>x.id===c.id?{...x,likes_count:nl,dislikes_count:nd}:x))
    if(mv===type){
      await sb.from('comment_votes').delete().eq('comment_id',c.id).eq('user_id',profile.id)
      if(type==='up')await sb.from('comments').update({likes_count:nl}).eq('id',c.id)
      else await sb.from('comments').update({dislikes_count:nd}).eq('id',c.id)
    } else {
      if(mv)await sb.from('comment_votes').delete().eq('comment_id',c.id).eq('user_id',profile.id)
      await sb.from('comment_votes').insert({comment_id:c.id,user_id:profile.id,vote_type:type})
      if(type==='up')await sb.from('comments').update({likes_count:nl}).eq('id',c.id)
      else await sb.from('comments').update({dislikes_count:nd}).eq('id',c.id)
    }
  }

  async function submitPost(){
    if(!profile||(!postText.trim()&&postImgs.length===0))return
    setPosting(true)
    const urls:string[]=[]
    for(const file of postImgs){
      const path=profile.id+'/post/'+Date.now()+'_'+file.name
      const res=await sb.storage.from('post-images').upload(path,file,{upsert:true})
      if(!res.error){const{data:u}=sb.storage.from('post-images').getPublicUrl(path);urls.push(u.publicUrl)}
    }
    await sb.from('posts').insert({user_id:profile.id,text:postText.trim(),is_anon:postAnon,school:profile.school,images:urls})
    setPostText('');setPostImgs([]);setPostPrevs([]);setShowPost(false);setPosting(false)
    loadPosts()
  }

  async function submitRepost(){
    if(!profile||!repostTarget)return
    setReposting(true)
    await sb.from('reposts').insert({user_id:profile.id,original_post_id:repostTarget.id,text:repostText.trim(),is_anon:repostAnon,school:profile.school})
    await sb.from('posts').update({reposts_count:(repostTarget.reposts_count||0)+1}).eq('id',repostTarget.id)
    setRepostText('');setShowRepost(false);setReposting(false);setRepostTarget(null)
    loadPosts()
  }

  async function sendDmFromPost(){
    if(!profile||!dmPostTarget||!dmPostMsg.trim())return
    const authorId=dmPostTarget.user_id
    await sb.from('messages').insert({from_user_id:profile.id,to_user_id:authorId,text:dmPostMsg.trim()})
    setDmPostMsg('');setShowDmPost(false);setDmPostTarget(null)
    loadConvos()
  }

  async function deletePst(id:string){
    if(!confirm('Delete this post?'))return
    await sb.from('posts').delete().eq('id',id)
    loadPosts()
    if(selectedPost?.id===id)setSelectedPost(null)
  }

  // listings
  async function loadListings(){
    const{data}=await sb.from('listings').select('*,profiles(*)').eq('is_sold',false).order('created_at',{ascending:false})
    setListings(data||[])
  }
  function pickFiles(e:React.ChangeEvent<HTMLInputElement>){
    const f=Array.from(e.target.files||[]).slice(0,8)
    setLFiles(f);setLPrevs(f.map(x=>URL.createObjectURL(x)))
  }
  async function submitListing(){
    if(!profile||!lf.title)return
    setLUploading(true)
    const urls:string[]=[]
    for(const file of lFiles){
      const path=profile.id+'/listing/'+Date.now()+'_'+file.name
      const res=await sb.storage.from('listing-images').upload(path,file,{upsert:true})
      if(!res.error){const{data:u}=sb.storage.from('listing-images').getPublicUrl(path);urls.push(u.publicUrl)}
    }
    await sb.from('listings').insert({user_id:profile.id,title:lf.title,price:parseFloat(lf.price)||0,category:lf.cat,description:lf.desc,emoji:'📦',school:profile.school,images:urls})
    setShowListing(false);setLf({title:'',price:'',cat:'clothes',desc:'',condition:'Good'})
    setLFiles([]);setLPrevs([]);setLUploading(false);loadListings()
  }

  // messages
  async function loadConvos(){
    if(!profile)return
    const{data:users}=await sb.from('profiles').select('*').neq('id',profile.id)
    if(!users)return
    const c=await Promise.all(users.map(async u=>{
      const{data:m}=await sb.from('messages').select('*').or('and(from_user_id.eq.'+profile.id+',to_user_id.eq.'+u.id+'),and(from_user_id.eq.'+u.id+',to_user_id.eq.'+profile.id+')').order('created_at',{ascending:false}).limit(1)
      return{user:u as Profile,lastMsg:m?.[0]}
    }))
    c.sort((a,b)=>(b.lastMsg?.created_at||'')>(a.lastMsg?.created_at||'')?1:-1)
    setConvos(c)
  }
  async function loadUnread(){
    if(!profile)return
    const{count}=await sb.from('messages').select('*',{count:'exact',head:true}).eq('to_user_id',profile.id).eq('is_read',false)
    setUnread(count||0)
  }
  async function openChat(u:Profile){
    setChatTarget(u)
    const{data}=await sb.from('messages').select('*').or('and(from_user_id.eq.'+profile!.id+',to_user_id.eq.'+u.id+'),and(from_user_id.eq.'+u.id+',to_user_id.eq.'+profile!.id+')').order('created_at')
    setChatMsgs(data||[])
    await sb.from('messages').update({is_read:true}).eq('to_user_id',profile!.id).eq('from_user_id',u.id)
    loadUnread()
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100)
  }
  async function sendMsg(){
    if(!profile||!chatTarget||!chatInput.trim())return
    await sb.from('messages').insert({from_user_id:profile.id,to_user_id:chatTarget.id,text:chatInput.trim()})
    setChatInput('');openChat(chatTarget);loadConvos()
  }
  useEffect(()=>{chatRef.current?.scrollTo(0,chatRef.current.scrollHeight)},[chatMsgs])

  // search
  useEffect(()=>{
    if(!searchQ.trim()){setSearchRes([]);return}
    const t=setTimeout(async()=>{
      const{data}=await sb.from('posts').select('*,profiles(*)').ilike('text','%'+searchQ+'%').limit(30)
      setSearchRes(data||[])
    },300)
    return()=>clearTimeout(t)
  },[searchQ])

  const inp:React.CSSProperties={width:'100%',background:C.surface,border:'1px solid '+C.border,borderRadius:'12px',padding:'12px 14px',color:C.text,fontSize:'0.95rem',outline:'none',fontFamily:'inherit'}
  const overlay:React.CSSProperties={position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}
  const sheet:React.CSSProperties={background:C.bg,borderRadius:'20px 20px 0 0',padding:'20px 16px',maxHeight:'92vh',overflowY:'auto'}

  // AUTH SCREEN


  // POST ROW - Fizz style: actions bottom-left, vote right
  function PostRow({p,compact}:{p:Post,compact?:boolean}){
    const isAnon=p.is_anon
    const name=isAnon?'Anonymous':(p.profiles?.username||'User')
    const mv=(p as any).my_vote
    const score=p.likes_count-(p.dislikes_count||0)
    const imgs=(p as any).images as string[]|undefined

    return(
      <div style={{borderBottom:'1px solid '+C.border,padding:'14px 16px 10px',background:C.bg,cursor:'pointer'}} onClick={()=>openPost(p)}>
        <div style={{display:'flex',gap:'10px'}}>
          {/* avatar */}
          <div style={{width:'40px',height:'40px',borderRadius:'50%',background:isAnon?avColor(p.user_id):(p.profiles?.avatar_color||avColor(p.user_id)),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700,flexShrink:0}}>
            {isAnon?anonEmoji(p.user_id):(p.profiles?.avatar_initials||'?')}
          </div>
          {/* content */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
              <span style={{fontWeight:600,fontSize:'0.92rem'}}>{name}</span>
              <span style={{color:C.muted,fontSize:'0.8rem'}}>{ago(p.created_at)}</span>
              {isAnon&&<span style={{fontSize:'0.7rem',color:C.muted,fontWeight:600}}>{p.school}</span>}
            </div>
            {p.text&&<div style={{fontSize:'0.95rem',lineHeight:'1.5',color:C.text,marginBottom:imgs&&imgs.length>0?'10px':'0'}}>{p.text}</div>}
            {imgs&&imgs.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:imgs.length===1?'1fr':'1fr 1fr',gap:'3px',borderRadius:'12px',overflow:'hidden',marginTop:'8px'}}>
                {imgs.slice(0,4).map((url,i)=><img key={i} src={url} alt="" style={{width:'100%',height:imgs.length===1?'220px':'130px',objectFit:'cover',display:'block'}}/>)}
              </div>
            )}
          </div>
          {/* vote col - right side like real Fizz */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',minWidth:'36px'}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>vote(p,'up')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:mv==='up'?C.upvote:C.muted,display:'flex',alignItems:'center'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={mv==='up'?C.upvote:'none'} stroke={mv==='up'?C.upvote:'currentColor'} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <span style={{fontWeight:700,fontSize:'1rem',color:score>0?C.upvote:score<0?C.red:C.muted,lineHeight:1}}>{score}</span>
            <button onClick={()=>vote(p,'down')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:mv==='down'?C.red:C.muted,display:'flex',alignItems:'center'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={mv==='down'?C.red:'none'} stroke={mv==='down'?C.red:'currentColor'} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
        {/* action bar - bottom, like real Fizz */}
        <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'10px',paddingLeft:'50px'}} onClick={e=>e.stopPropagation()}>
          {/* dm / paper plane */}
          <button onClick={()=>{setDmPostTarget(p);setShowDmPost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.82rem',padding:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          {/* comment */}
          <button onClick={()=>openPost(p)} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.82rem',padding:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span>{p.comments_count||0}</span>
          </button>
          {/* repost */}
          <button onClick={()=>{setRepostTarget(p);setShowRepost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.82rem',padding:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
            <span>{(p as any).reposts_count||0}</span>
          </button>
          {/* share */}
          <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.82rem',padding:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          {/* more */}
          <span style={{color:C.muted,fontSize:'1rem',cursor:'pointer'}}>···</span>
          {p.user_id===profile.id&&<button onClick={()=>deletePst(p.id)} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:'0.8rem',padding:0,marginLeft:'auto'}}>Delete</button>}
        </div>
      </div>
    )
  }


  if(!session||!profile) return(
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:'20px',fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
      <div style={{fontFamily:'Nunito,sans-serif',fontWeight:900,fontSize:'2.8rem',color:C.accentBright}}>沸点</div>
      <div style={{width:'100%',maxWidth:'360px'}}>
        <div style={{display:'flex',background:C.surface,borderRadius:'14px',padding:'4px',marginBottom:'20px'}}>
          {(['login','register'] as const).map(tab=>(
            <div key={tab} onClick={()=>setAuthTab(tab)} style={{flex:1,padding:'10px',textAlign:'center',borderRadius:'12px',cursor:'pointer',fontWeight:700,fontSize:'0.92rem',background:authTab===tab?C.accentBright:'transparent',color:authTab===tab?'white':C.muted}}>
              {tab==='login'?'Login':'Register'}
            </div>
          ))}
        </div>
        {authTab==='register'&&<>
          <div style={{marginBottom:'12px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>Username</label><input style={inp} placeholder="用户名" value={af.username} onChange={e=>setAf(f=>({...f,username:e.target.value}))} /></div>
          <div style={{marginBottom:'12px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>School</label><select style={{...inp,cursor:'pointer'}} value={af.school} onChange={e=>setAf(f=>({...f,school:e.target.value}))}>{SCHOOLS.map(s=><option key={s}>{s}</option>)}</select></div>
        </>}
        <div style={{marginBottom:'12px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>Email</label><input style={inp} type="email" placeholder="you@university.edu" value={af.email} onChange={e=>setAf(f=>({...f,email:e.target.value}))} /></div>
        <div style={{marginBottom:'20px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>Password</label><input style={inp} type="password" placeholder="6+ chars" value={af.pwd} onChange={e=>setAf(f=>({...f,pwd:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(authTab==='login'?handleLogin():handleRegister())} /></div>
        {authErr&&<div style={{background:'#fef2f2',border:'1px solid '+C.red,borderRadius:'10px',padding:'10px 14px',marginBottom:'14px',fontSize:'0.88rem',color:C.red}}>{authErr}</div>}
        <button onClick={authTab==='login'?handleLogin:handleRegister} disabled={authLoading} style={{width:'100%',padding:'14px',background:C.accentBright,color:'white',border:'none',borderRadius:'14px',fontWeight:700,fontSize:'1rem',cursor:'pointer',fontFamily:'inherit'}}>{authLoading?'...':authTab==='login'?'Login':'Create Account'}</button>
        <div style={{textAlign:'center',marginTop:'14px',fontSize:'0.85rem',color:C.muted}}>{authTab==='login'?'No account?':'Have account?'}<span onClick={()=>setAuthTab(authTab==='login'?'register':'login')} style={{color:C.accentBright,cursor:'pointer',marginLeft:'4px'}}>{authTab==='login'?'Register':'Login'}</span></div>
      </div>
    </div>
  )
  const mktFiltered=mktCat==='all'?listings:listings.filter(l=>l.category===mktCat)

  return(
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'DM Sans',-apple-system,sans-serif",maxWidth:'430px',margin:'0 auto',position:'relative',paddingBottom:'64px'}}>

      {/* ===== FEED ===== */}
      {page==='feed'&&<>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:'1px solid '+C.border}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',fontWeight:700,fontSize:'1rem'}}>
            <span style={{fontSize:'1.2rem'}}>🐝</span>{profile.school}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{fontSize:'0.75rem',color:C.green,fontWeight:700,display:'flex',alignItems:'center',gap:'4px'}}>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:C.green,display:'inline-block'}}/>
              {online} online
            </span>
            <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:0}}>⚙️</button>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid '+C.border,background:C.bg,position:'sticky',top:'53px',zIndex:99}}>
          {(['Top',"Fizzin'",'New'] as const).map(tab=>(
            <div key={tab} onClick={()=>setFeedTab(tab)} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:feedTab===tab?700:400,color:feedTab===tab?C.text:C.muted,borderBottom:feedTab===tab?'2px solid '+C.text:'2px solid transparent',cursor:'pointer'}}>
              {tab}
            </div>
          ))}
        </div>
        {sorted().map(p=><PostRow key={p.id} p={p}/>)}
        {posts.length===0&&<div style={{textAlign:'center',padding:'60px',color:C.muted}}>No posts yet. Be the first!</div>}
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'72px',right:'16px',background:C.accent,color:'white',border:'none',borderRadius:'28px',padding:'13px 24px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 4px 16px '+C.shadow,zIndex:150}}>
          <span style={{fontSize:'1.2rem',fontWeight:400}}>+</span> Post
        </button>
      </>}

      {/* ===== MESSAGES ===== */}
      {page==='messages'&&<>
        <div style={{padding:'14px 16px 10px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:'1px solid '+C.border,fontWeight:700,fontSize:'1.1rem'}}>Messages</div>
        <div style={{display:'flex',borderBottom:'1px solid '+C.border}}>
          <div style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',fontWeight:700,borderBottom:'2px solid '+C.text}}>Posts</div>
          <div style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.95rem',color:C.muted,borderBottom:'2px solid transparent'}}>Marketplace</div>
        </div>
        {!chatTarget?(
          convos.length===0?
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',gap:'16px',color:C.muted}}>
            <div style={{fontSize:'3rem'}}>✈️</div>
            <div style={{fontWeight:700,color:C.text}}>No messages yet.</div>
            <div style={{fontSize:'0.9rem',textAlign:'center'}}>Start a conversation. Messages you send or receive will appear here.</div>
          </div>
          :convos.map(({user:u,lastMsg})=>(
            <div key={u.id} onClick={()=>openChat(u)} style={{display:'flex',gap:'12px',padding:'14px 16px',borderBottom:'1px solid '+C.border,cursor:'pointer',alignItems:'center'}}>
              <div style={{width:'46px',height:'46px',borderRadius:'50%',background:u.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white',flexShrink:0}}>{u.avatar_initials}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700}}>{u.username}</div>
                <div style={{fontSize:'0.85rem',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lastMsg?.text||'Start a conversation'}</div>
              </div>
              {lastMsg&&<div style={{fontSize:'0.75rem',color:C.muted}}>{ago(lastMsg.created_at)}</div>}
            </div>
          ))
        ):(
          <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 120px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:'1px solid '+C.border}}>
              <button onClick={()=>setChatTarget(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.text,fontSize:'1.3rem',padding:0}}>←</button>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:chatTarget.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white'}}>{chatTarget.avatar_initials}</div>
              <div style={{fontWeight:700}}>{chatTarget.username}</div>
            </div>
            <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {chatMsgs.map(m=>{
                const mine=m.from_user_id===profile.id
                return(
                  <div key={m.id} style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'76%'}}>
                    <div style={{padding:'10px 14px',borderRadius:'18px',fontSize:'0.92rem',background:mine?C.accentBright:(resolved==='light'?'#e5e7eb':C.surface2),color:mine?'white':C.text,borderBottomRightRadius:mine?'4px':'18px',borderBottomLeftRadius:mine?'18px':'4px'}}>{m.text}</div>
                    <div style={{fontSize:'0.7rem',color:C.muted,marginTop:'3px',textAlign:mine?'right':'left'}}>{ago(m.created_at)}</div>
                  </div>
                )
              })}
              {chatMsgs.length===0&&<div style={{color:C.muted,textAlign:'center',margin:'auto'}}>Say hello 👋</div>}
            </div>
            <div style={{display:'flex',gap:'8px',padding:'12px 16px',borderTop:'1px solid '+C.border}}>
              <input style={{...inp,flex:1}} placeholder="Send a message..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} />
              <button onClick={sendMsg} style={{padding:'10px 16px',background:C.accentBright,color:'white',border:'none',borderRadius:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Send</button>
            </div>
          </div>
        )}
      </>}

      {/* ===== SEARCH ===== */}
      {page==='search'&&<>
        <div style={{padding:'12px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:'1px solid '+C.border}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'24px',padding:'10px 16px'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:'0.95rem',outline:'none',fontFamily:'inherit'}} placeholder="Search Fizz" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          </div>
        </div>
        {searchRes.map(p=><PostRow key={p.id} p={p}/>)}
        {searchQ&&searchRes.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px'}}>No results found</div>}
        {!searchQ&&<div style={{padding:'0 16px'}}>
          {['#期末备考','#食堂推荐','#校园生活','#选课攻略','#考研经验','#社团招新'].map((top,i)=>(
            <div key={top} onClick={()=>setSearchQ(top)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px 0',borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
              <span style={{color:C.muted,fontWeight:700,width:'22px'}}>{i+1}</span>
              <span style={{fontWeight:600}}>{top}</span>
            </div>
          ))}
        </div>}
      </>}

      {/* ===== MARKET ===== */}
      {page==='market'&&<>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:'1px solid '+C.border}}>
          <div style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:resolved==='light'?'#f0f0f0':C.surface2,borderRadius:'20px',padding:'8px 14px'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{color:C.muted,fontSize:'0.88rem'}}>Search listings</span>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',padding:'10px 12px',overflowX:'auto',borderBottom:'1px solid '+C.border}}>
          {[['all','All'],['clothes','Clothes'],['electronics','Electronics'],['books','Books'],['other','Other']].map(([c,l])=>(
            <div key={c} onClick={()=>setMktCat(c)} style={{flexShrink:0,padding:'6px 14px',borderRadius:'20px',border:'1px solid '+(mktCat===c?C.accentBright:C.border),background:mktCat===c?(resolved==='dark'?'rgba(37,99,235,.2)':'#eff6ff'):'transparent',color:mktCat===c?C.accentBright:C.muted,fontSize:'0.85rem',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{l}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px',background:C.border}}>
          {mktFiltered.map(l=>(
            <div key={l.id} style={{background:C.bg}}>
              <div style={{height:'180px',background:C.surface,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                {l.images&&l.images.length>0?<img src={l.images[0]} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'2.5rem'}}>{l.emoji||'📦'}</span>}
                {l.is_sold&&<div style={{position:'absolute',top:'8px',left:'8px',background:'rgba(0,0,0,0.75)',color:'white',borderRadius:'6px',padding:'3px 8px',fontSize:'0.72rem',fontWeight:700}}>SOLD</div>}
              </div>
              <div style={{padding:'10px'}}>
                <div style={{fontWeight:700,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                <div style={{fontWeight:700,fontSize:'0.95rem',marginTop:'2px'}}>¥{l.price}</div>
                {l.user_id===profile.id&&<button onClick={()=>sb.from('listings').update({is_sold:true}).eq('id',l.id).then(()=>loadListings())} style={{marginTop:'6px',width:'100%',padding:'5px',background:'transparent',border:'1px solid '+C.border,borderRadius:'6px',color:C.muted,fontSize:'0.75rem',cursor:'pointer',fontFamily:'inherit'}}>Mark Sold</button>}
              </div>
            </div>
          ))}
        </div>
        {mktFiltered.length===0&&<div style={{color:C.muted,textAlign:'center',padding:'60px'}}>No listings yet</div>}
        <button onClick={()=>setShowListing(true)} style={{position:'fixed',bottom:'72px',right:'16px',background:C.accent,color:'white',border:'none',borderRadius:'28px',padding:'13px 24px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 4px 16px '+C.shadow,zIndex:150}}>+ List</button>
      </>}

      {/* ===== PROFILE ===== */}
      {page==='profile'&&<>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:C.bg,position:'sticky',top:0,zIndex:100,borderBottom:'1px solid '+C.border}}>
          <div style={{fontWeight:700,fontSize:'1.05rem'}}>My Profile ▾</div>
          <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem'}}>⚙️</button>
        </div>
        <div style={{display:'flex',margin:'16px',background:C.surface,borderRadius:'16px',overflow:'hidden',border:'1px solid '+C.border}}>
          <div style={{flex:1,padding:'16px',textAlign:'center',borderRight:'1px solid '+C.border}}>
            <div style={{fontSize:'1.3rem'}}>❤️</div>
            <div style={{fontWeight:700,fontSize:'1.3rem'}}>{profile.total_fizzups}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Karma</div>
          </div>
          <div style={{flex:1,padding:'16px',textAlign:'center'}}>
            <div style={{fontSize:'1.3rem'}}>📝</div>
            <div style={{fontWeight:700,fontSize:'1.3rem'}}>{posts.filter(p=>p.user_id===profile.id).length}</div>
            <div style={{fontSize:'0.82rem',color:C.muted}}>Posts</div>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid '+C.border}}>
          {['Posts','Comments','Saved'].map((tab,i)=><div key={tab} style={{flex:1,padding:'10px',textAlign:'center',fontSize:'0.92rem',fontWeight:i===0?700:400,color:i===0?C.text:C.muted,borderBottom:i===0?'2px solid '+C.text:'2px solid transparent',cursor:'pointer'}}>{tab}</div>)}
        </div>
        {posts.filter(p=>p.user_id===profile.id).map(p=><PostRow key={p.id} p={p}/>)}
        {posts.every(p=>p.user_id!==profile.id)&&<div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 20px',gap:'12px',color:C.muted}}><div style={{fontSize:'2.5rem',opacity:.4}}>✏️</div><div style={{fontWeight:700,color:C.text}}>No posts yet.</div></div>}
        <button onClick={()=>setShowPost(true)} style={{position:'fixed',bottom:'72px',right:'16px',background:C.accent,color:'white',border:'none',borderRadius:'28px',padding:'13px 24px',fontWeight:700,fontSize:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 4px 16px '+C.shadow,zIndex:150}}>+ Post</button>
      </>}

      {/* ===== BOTTOM NAV ===== */}
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'430px',background:C.bg,borderTop:'1px solid '+C.border,display:'flex',zIndex:200,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {[
          {id:'feed',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>},
          {id:'messages',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,badge:unread},
          {id:'search',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>},
          {id:'market',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>},
          {id:'profile',icon:(a:boolean)=><svg width="24" height="24" viewBox="0 0 24 24" fill={a?C.text:'none'} stroke={a?C.text:C.muted} strokeWidth={a?2.5:2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>},
        ].map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id as any)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10px 0 8px',cursor:'pointer',border:'none',background:'none',position:'relative'}}>
            <div style={{position:'relative'}}>{n.icon(page===n.id)}{(n as any).badge?<span style={{position:'absolute',top:'-4px',right:'-6px',background:'#ef4444',color:'white',borderRadius:'50%',width:'16px',height:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.6rem',fontWeight:700}}>{(n as any).badge}</span>:null}</div>
          </button>
        ))}
      </nav>

      {/* ===== POST DETAIL (full screen) ===== */}
      {selectedPost&&(
        <div style={{position:'fixed',inset:0,background:C.bg,zIndex:400,display:'flex',flexDirection:'column'}}>
          {/* header */}
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',borderBottom:'1px solid '+C.border,position:'sticky',top:0,background:C.bg}}>
            <button onClick={()=>setSelectedPost(null)} style={{background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',cursor:'pointer',borderRadius:'50%',width:'32px',height:'32px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem'}}>←</button>
          </div>
          {/* scrollable content */}
          <div style={{flex:1,overflowY:'auto'}}>
            {/* post body */}
            <div style={{padding:'16px',borderBottom:'1px solid '+C.border}}>
              <div style={{display:'flex',gap:'10px',marginBottom:'12px'}}>
                <div style={{width:'42px',height:'42px',borderRadius:'50%',background:selectedPost.is_anon?avColor(selectedPost.user_id):(selectedPost.profiles?.avatar_color||avColor(selectedPost.user_id)),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700,flexShrink:0}}>
                  {selectedPost.is_anon?anonEmoji(selectedPost.user_id):(selectedPost.profiles?.avatar_initials||'?')}
                </div>
                <div>
                  <div style={{fontWeight:600,fontSize:'0.95rem'}}>{selectedPost.is_anon?'Anonymous':(selectedPost.profiles?.username||'User')}</div>
                  <div style={{fontSize:'0.78rem',color:C.muted}}>{ago(selectedPost.created_at)} · {selectedPost.school}</div>
                </div>
              </div>
              {selectedPost.text&&<div style={{fontSize:'1rem',lineHeight:'1.6',marginBottom:'12px'}}>{selectedPost.text}</div>}
              {(selectedPost as any).images&&(selectedPost as any).images.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:(selectedPost as any).images.length===1?'1fr':'1fr 1fr',gap:'3px',borderRadius:'12px',overflow:'hidden',marginBottom:'12px'}}>
                  {(selectedPost as any).images.slice(0,4).map((url:string,i:number)=><img key={i} src={url} alt="" style={{width:'100%',height:(selectedPost as any).images.length===1?'280px':'160px',objectFit:'cover',display:'block'}}/>)}
                </div>
              )}
              {/* vote + actions */}
              <div style={{display:'flex',alignItems:'center',gap:'16px',paddingTop:'10px',borderTop:'1px solid '+C.border}}>
                <button onClick={()=>{setDmPostTarget(selectedPost);setShowDmPost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <span style={{color:C.muted,fontSize:'0.85rem'}}>{selectedPost.comments_count||0} comments</span>
                <button onClick={()=>{setRepostTarget(selectedPost);setShowRepost(true)}} style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.85rem',padding:0}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                  <span>{(selectedPost as any).reposts_count||0}</span>
                </button>
                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'4px'}}>
                  <button onClick={()=>vote(selectedPost,'up')} style={{background:'none',border:'none',cursor:'pointer',color:(selectedPost as any).my_vote==='up'?C.upvote:C.muted,padding:'2px',display:'flex',alignItems:'center'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={(selectedPost as any).my_vote==='up'?C.upvote:'none'} stroke={(selectedPost as any).my_vote==='up'?C.upvote:'currentColor'} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <span style={{fontWeight:700,minWidth:'24px',textAlign:'center',color:(selectedPost.likes_count-(selectedPost.dislikes_count||0))>0?C.upvote:(selectedPost.likes_count-(selectedPost.dislikes_count||0))<0?C.red:C.muted}}>
                    {selectedPost.likes_count-(selectedPost.dislikes_count||0)}
                  </span>
                  <button onClick={()=>vote(selectedPost,'down')} style={{background:'none',border:'none',cursor:'pointer',color:(selectedPost as any).my_vote==='down'?C.red:C.muted,padding:'2px',display:'flex',alignItems:'center'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={(selectedPost as any).my_vote==='down'?C.red:'none'} stroke={(selectedPost as any).my_vote==='down'?C.red:'currentColor'} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              </div>
            </div>
            {/* comments */}
            <div style={{padding:'12px 16px 8px',borderBottom:'1px solid '+C.border}}>
              <div style={{fontSize:'0.85rem',color:C.muted,fontWeight:600}}>Newest first ▾</div>
            </div>
            {postComments.length===0&&(
              <div style={{textAlign:'center',padding:'40px 20px',color:C.muted}}>
                <div style={{fontSize:'1.5rem',marginBottom:'8px'}}>💬</div>
                <div style={{fontWeight:600,color:C.text}}>No comments yet</div>
                <div style={{fontSize:'0.88rem'}}>Start the conversation</div>
              </div>
            )}
            {postComments.map(c=>{
              const cmv=commentVotes[c.id]
              const cscore=(c.likes_count||0)-(c.dislikes_count||0)
              return(
                <div key={c.id} style={{padding:'12px 16px',borderBottom:'1px solid '+C.border}}>
                  <div style={{display:'flex',gap:'10px'}}>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:c.profiles?.avatar_color||'#888',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.82rem',fontWeight:700,color:'white',flexShrink:0}}>{c.profiles?.avatar_initials||'?'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem'}}>{c.profiles?.username||'User'} <span style={{color:C.muted,fontWeight:400,fontSize:'0.75rem'}}>{ago(c.created_at)}</span></div>
                      <div style={{fontSize:'0.92rem',margin:'4px 0 8px'}}>{c.text}</div>
                      <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
                        <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.8rem',padding:0}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                        <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'0.8rem',padding:0}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                          Reply
                        </button>
                      </div>
                    </div>
                    {/* comment vote */}
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',minWidth:'30px'}}>
                      <button onClick={()=>voteComment(c,'up')} style={{background:'none',border:'none',cursor:'pointer',color:cmv==='up'?C.upvote:C.muted,padding:'2px',display:'flex',alignItems:'center'}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={cmv==='up'?C.upvote:'none'} stroke={cmv==='up'?C.upvote:'currentColor'} strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <span style={{fontWeight:700,fontSize:'0.88rem',color:cscore>0?C.upvote:cscore<0?C.red:C.muted}}>{cscore}</span>
                      <button onClick={()=>voteComment(c,'down')} style={{background:'none',border:'none',cursor:'pointer',color:cmv==='down'?C.red:C.muted,padding:'2px',display:'flex',alignItems:'center'}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={cmv==='down'?C.red:'none'} stroke={cmv==='down'?C.red:'currentColor'} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* comment input */}
          <div style={{padding:'10px 16px',borderTop:'1px solid '+C.border,background:C.bg,display:'flex',gap:'8px',alignItems:'center'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,color:'white',flexShrink:0}}>{profile.avatar_initials}</div>
            <input style={{flex:1,background:resolved==='light'?'#f0f0f0':C.surface2,border:'none',borderRadius:'24px',padding:'10px 16px',color:C.text,fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} placeholder="Add a comment..." value={cmtInput} onChange={e=>setCmtInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitCmt()} />
            <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',padding:'0 4px'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
            </button>
            <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',padding:'0 4px',fontSize:'0.8rem',fontWeight:600}}>GIF</button>
            <button style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:C.muted,cursor:'pointer',padding:'0 4px',fontSize:'0.8rem',fontWeight:600}}>MEME</button>
          </div>
        </div>
      )}

      {/* ===== COMPOSE POST ===== */}
      {showPost&&(
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowPost(false)}>
          <div style={sheet}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>{setShowPost(false);setPostText('');setPostImgs([]);setPostPrevs([])}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>Cancel</button>
              <div style={{fontWeight:700}}>New Post</div>
              <button onClick={submitPost} disabled={posting||(!postText.trim()&&postImgs.length===0)} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:(!postText.trim()&&postImgs.length===0)||posting?.5:1}}>{posting?'Posting...':'Post'}</button>
            </div>
            <div style={{display:'flex',gap:'12px',marginBottom:'12px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'50%',background:postAnon?avColor(profile.id):profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700,flexShrink:0}}>{postAnon?anonEmoji(profile.id):profile.avatar_initials}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                  <span style={{fontWeight:600,fontSize:'0.9rem'}}>{postAnon?'Anonymous':profile.username}</span>
                  <span style={{fontSize:'0.75rem',color:C.muted,background:C.surface,borderRadius:'12px',padding:'2px 8px',cursor:'pointer'}} onClick={()=>setPostAnon(!postAnon)}>▾</span>
                </div>
                <textarea style={{width:'100%',background:'transparent',border:'none',resize:'none',color:C.text,fontFamily:'inherit',fontSize:'1rem',outline:'none',minHeight:'80px',lineHeight:'1.5'}} placeholder="What's on your mind?" value={postText} onChange={e=>setPostText(e.target.value)} autoFocus />
              </div>
            </div>
            {postPrevs.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:postPrevs.length===1?'1fr':'1fr 1fr',gap:'4px',marginBottom:'12px',borderRadius:'12px',overflow:'hidden'}}>
                {postPrevs.map((p,i)=>(
                  <div key={i} style={{position:'relative'}}>
                    <img src={p} alt="" style={{width:'100%',height:postPrevs.length===1?'200px':'120px',objectFit:'cover',display:'block'}}/>
                    <button onClick={()=>{const f=[...postImgs];const pv=[...postPrevs];f.splice(i,1);pv.splice(i,1);setPostImgs(f);setPostPrevs(pv)}} style={{position:'absolute',top:'4px',right:'4px',background:'rgba(0,0,0,0.6)',color:'white',border:'none',borderRadius:'50%',width:'22px',height:'22px',cursor:'pointer',fontSize:'0.8rem'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex',alignItems:'center',paddingTop:'12px',borderTop:'1px solid '+C.border,gap:'16px'}}>
              <label style={{cursor:'pointer',color:C.accentBright,display:'flex',alignItems:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
                <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{const f=Array.from(e.target.files||[]).slice(0,4);setPostImgs(f);setPostPrevs(f.map(x=>URL.createObjectURL(x)))}} />
              </label>
              <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'0.88rem',fontWeight:600,color:postAnon?C.accentBright:C.muted,marginLeft:'auto'}}>
                <input type="checkbox" checked={postAnon} onChange={e=>setPostAnon(e.target.checked)} style={{accentColor:C.accentBright,width:'16px',height:'16px',cursor:'pointer'}} />
                Post Anonymously
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ===== REPOST MODAL - like Fizz ===== */}
      {showRepost&&repostTarget&&(
        <div style={{position:'fixed',inset:0,background:C.bg,zIndex:500,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid '+C.border}}>
            <button onClick={()=>{setShowRepost(false);setRepostText('');setRepostTarget(null)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.3rem',color:C.text,padding:0}}>✕</button>
            <div style={{fontWeight:700}}></div>
            <button onClick={submitRepost} disabled={reposting} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'8px 20px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{reposting?'...':'Post'}</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
            {/* who posting as */}
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'50%',background:repostAnon?avColor(profile.id):profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'white',fontWeight:700}}>{repostAnon?anonEmoji(profile.id):profile.avatar_initials}</div>
              <div style={{display:'flex',alignItems:'center',gap:'6px',background:C.surface,borderRadius:'20px',padding:'6px 12px',cursor:'pointer'}} onClick={()=>setRepostAnon(!repostAnon)}>
                <span style={{fontWeight:600,fontSize:'0.9rem'}}>{repostAnon?'Anonymous':profile.username}</span>
                <span style={{color:C.muted}}>▾</span>
              </div>
            </div>
            <textarea style={{width:'100%',background:'transparent',border:'none',resize:'none',color:C.text,fontFamily:'inherit',fontSize:'1rem',outline:'none',minHeight:'80px',lineHeight:'1.5',marginBottom:'16px'}} placeholder="Add ReFizz caption..." value={repostText} onChange={e=>setRepostText(e.target.value)} autoFocus />
            {/* original post preview */}
            <div style={{border:'1px solid '+C.border,borderRadius:'14px',padding:'14px',background:C.surface}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'50%',background:repostTarget.is_anon?avColor(repostTarget.user_id):(repostTarget.profiles?.avatar_color||avColor(repostTarget.user_id)),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',color:'white',fontWeight:700}}>{repostTarget.is_anon?anonEmoji(repostTarget.user_id):(repostTarget.profiles?.avatar_initials||'?')}</div>
                <span style={{fontWeight:600,fontSize:'0.88rem'}}>{repostTarget.is_anon?'Anonymous':(repostTarget.profiles?.username||'User')}</span>
                <span style={{fontSize:'0.75rem',color:C.muted}}>{ago(repostTarget.created_at)}</span>
              </div>
              <div style={{fontSize:'0.92rem',color:C.text}}>{repostTarget.text}</div>
              {(repostTarget as any).images&&(repostTarget as any).images.length>0&&(
                <img src={(repostTarget as any).images[0]} alt="" style={{width:'100%',height:'160px',objectFit:'cover',borderRadius:'10px',marginTop:'10px'}}/>
              )}
            </div>
          </div>
          {/* bottom toolbar like Fizz */}
          <div style={{display:'flex',alignItems:'center',gap:'16px',padding:'12px 16px',borderTop:'1px solid '+C.border,background:C.bg}}>
            <label style={{cursor:'pointer',color:C.accentBright}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
              <input type="file" accept="image/*" style={{display:'none'}} />
            </label>
            <span style={{color:C.muted,fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>MEME</span>
            <span style={{color:C.muted,fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>GIF</span>
          </div>
        </div>
      )}

      {/* ===== DM FROM POST ===== */}
      {showDmPost&&dmPostTarget&&(
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowDmPost(false)}>
          <div style={sheet}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>{setShowDmPost(false);setDmPostMsg('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>Cancel</button>
              <div style={{fontWeight:700}}>Send Message</div>
              <button onClick={sendDmFromPost} disabled={!dmPostMsg.trim()} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:!dmPostMsg.trim()?.5:1}}>Send</button>
            </div>
            <div style={{background:C.surface,borderRadius:'12px',padding:'12px',marginBottom:'14px',borderLeft:'3px solid '+C.accentBright}}>
              <div style={{fontSize:'0.8rem',color:C.muted,marginBottom:'4px'}}>Sending to: {dmPostTarget.is_anon?'Anonymous':(dmPostTarget.profiles?.username||'User')}</div>
              <div style={{fontSize:'0.9rem',color:C.text}}>{dmPostTarget.text?.slice(0,100)}{dmPostTarget.text&&dmPostTarget.text.length>100?'...':''}</div>
            </div>
            <textarea style={{...inp,minHeight:'80px',resize:'none',lineHeight:'1.5'}} placeholder="Write a message..." value={dmPostMsg} onChange={e=>setDmPostMsg(e.target.value)} autoFocus />
          </div>
        </div>
      )}

      {/* ===== LISTING MODAL ===== */}
      {showListing&&(
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowListing(false)}>
          <div style={sheet}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <button onClick={()=>setShowListing(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontWeight:600,fontFamily:'inherit'}}>Cancel</button>
              <div style={{fontWeight:700}}>List Item</div>
              <button onClick={submitListing} disabled={lUploading||!lf.title} style={{background:C.accentBright,color:'white',border:'none',borderRadius:'20px',padding:'7px 18px',fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:(!lf.title||lUploading)?.5:1}}>{lUploading?'Uploading...':'Publish'}</button>
            </div>
            <label>
              <div style={{border:'2px dashed '+C.border,borderRadius:'14px',padding:'16px',marginBottom:'14px',cursor:'pointer',minHeight:'100px',display:'flex',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:'8px'}}>
                {lPrevs.length>0?(<>
                  {lPrevs.map((p,i)=><img key={i} src={p} alt="" style={{width:'72px',height:'72px',objectFit:'cover',borderRadius:'8px'}}/>)}
                  <div style={{width:'72px',height:'72px',background:C.surface2,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',color:C.muted}}>+</div>
                </>)
              </div>
              <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={pickFiles} />
            </label>
            {[['title','Item Name *','Vintage dress'],['price','Price (¥)','0'],['desc','Description','Condition, size...']].map(([k,l,ph])=>(
              <div key={k} style={{marginBottom:'12px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>{l}</label><input style={inp} type={k==='price'?'number':'text'} placeholder={ph} value={(lf as any)[k]} onChange={e=>setLf(f=>({...f,[k]:e.target.value}))} /></div>
            ))}
            <div style={{marginBottom:'12px'}}><label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'5px'}}>Category</label><select style={{...inp,cursor:'pointer'}} value={lf.cat} onChange={e=>setLf(f=>({...f,cat:e.target.value}))}><option value="clothes">Clothes</option><option value="electronics">Electronics</option><option value="books">Books</option><option value="other">Other</option></select></div>
            <div style={{marginBottom:'8px'}}>
              <label style={{fontSize:'0.78rem',fontWeight:700,color:C.muted,display:'block',marginBottom:'8px'}}>Condition</label>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {['New','Like New','Good','Fair'].map(c=>(
                  <div key={c} onClick={()=>setLf(f=>({...f,condition:c}))} style={{padding:'7px 16px',borderRadius:'20px',border:'1px solid '+(lf.condition===c?C.accentBright:C.border),background:lf.condition===c?(resolved==='dark'?'rgba(37,99,235,.2)':'#eff6ff'):'transparent',color:lf.condition===c?C.accentBright:C.muted,fontSize:'0.85rem',fontWeight:600,cursor:'pointer'}}>{c}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SETTINGS ===== */}
      {showSettings&&(
        <div style={overlay} onClick={e=>e.target===e.currentTarget&&setShowSettings(false)}>
          <div style={sheet}>
            <div style={{fontWeight:700,fontSize:'1.1rem',marginBottom:'20px'}}>Settings</div>
            <div style={{marginBottom:'20px'}}>
              <div style={{fontWeight:600,marginBottom:'12px',color:C.muted,fontSize:'0.82rem',textTransform:'uppercase',letterSpacing:'.5px'}}>Theme</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                {([['light','☀️','Light'],['dark','🌙','Dark'],['auto','🤖','Auto']] as const).map(([th,icon,label])=>(
                  <div key={th} onClick={()=>setTheme(th)} style={{padding:'14px 8px',textAlign:'center',borderRadius:'14px',border:'2px solid '+(theme===th?C.accentBright:C.border),background:theme===th?(resolved==='dark'?'rgba(37,99,235,.15)':'#eff6ff'):'transparent',cursor:'pointer'}}>
                    <div style={{fontSize:'1.5rem',marginBottom:'4px'}}>{icon}</div>
                    <div style={{fontSize:'0.82rem',fontWeight:700,color:theme===th?C.accentBright:C.text}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:'20px',padding:'14px',background:C.surface,borderRadius:'14px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'46px',height:'46px',borderRadius:'50%',background:profile.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'white'}}>{profile.avatar_initials}</div>
              <div><div style={{fontWeight:700}}>{profile.username}</div><div style={{fontSize:'0.85rem',color:C.muted}}>{profile.school}</div></div>
            </div>
            <button onClick={()=>sb.auth.signOut()} style={{width:'100%',padding:'14px',background:'transparent',border:'1px solid '+C.red,borderRadius:'14px',color:C.red,fontWeight:700,fontSize:'0.95rem',cursor:'pointer',fontFamily:'inherit'}}>Sign Out</button>
          </div>
        </div>
      )}
    </div>
  )
}
