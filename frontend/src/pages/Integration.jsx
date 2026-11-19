// import { ArrowLeft, Workflow } from 'lucide-react';
// import React from 'react';
// import { Link } from 'react-router-dom';

// const Integration = () => {
//     return (
//             <div className='relative min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white'>
//       <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />
//       <div className='relative z-10'>
//         <header className='z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6'>
//           <Link to="/" className='flex items-center gap-2.5'>
//             <span className='grid size-8 place-items-center rounded-lg bg-white text-zinc-900'>
//               <Workflow size={17} />
//             </span>
//             <span className='text-sm font-medium tracking-tight'>Automate AI</span>
//           </Link>

//           <Link to="/" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white">
//             <ArrowLeft size={14} />
//             <span>Back to chat</span>
//           </Link>
//         </header>
//         </div>
//         </div>
//     );
// };

// export default Integration;



import { ArrowLeft, Mail, Workflow } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendar, FaInstagram } from "react-icons/fa";
import { SlCalender } from "react-icons/sl";
import { connectGoogle, connectInstagram } from '../features/integration';

const integrationList = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and manage emails through your AI agent.",
    icon: Mail,
    provider: "google",
  },
  {
    id: "googleCalendar",
    name: "Google Calendar",
    description: "Manage calendar events using your AI agent.",
    icon: SlCalender,
    provider: "google",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Publish images with AI-generated captions and hashtags.",
    icon: FaInstagram,
    provider: "instagram",
  },
];

function Integration() {
  const [error,setError]=useState("")
  const [success,setSuccess]=useState("")
  const [connecting,setConnecting]=useState(null)
  const [disconnecting,setDisconnecting]=useState(null)

  const handleConnect=async (id)=>{
    setConnecting(id)
    setError("")
    setSuccess("")
    if(id=="google" || id=="googleCalendar"){
      const data=await connectGoogle()
      if(!data.url){
        throw new Error("Google authorization URL not received.")
      }
      if(!data.success){
        setError(data.response.data.message || "Unable to connect integration.")
        setConnecting(null)
      }
      window.location.assign(data.url)
      return;
    }
    if(id=="instagram"){
      const data=await connectInstagram()
      if(!data.url){
        throw new Error("instagram authorization URL not received.")
      }
      if(!data.success){
        setError(data.response.data.message || "Unable to connect integration.")
        setConnecting(null)
      }
      window.location.assign(data.url)
      return;
    }
  }

  return (
    <div className='relative min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white'>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />
      <div className='relative z-10'>
        <header className='z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6'>
          <Link to="/" className='flex items-center gap-2.5'>
            <span className='grid size-8 place-items-center rounded-lg bg-white text-zinc-900'>
              <Workflow size={17} />
            </span>
            <span className='text-sm font-medium tracking-tight'>Automate AI</span>
          </Link>

          <Link to="/" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={14} />
            <span>Back to chat</span>
          </Link>
        </header>

        <div className='relative z-10 mx-auto max-w-3xl space-y-8'>
          <div className='space-y-2'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-violet-300/80'>
              Settings/Integrations
            </p>
            <h1 className='text-3xl font-semibold tracking-tight'>Integrations</h1>
            <p className='text-sm text-zinc-500'>Connect your accounts and let AutoMate AI handle tasks for you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Integration;