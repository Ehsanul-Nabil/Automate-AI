import { ArrowLeft, ArrowUpRight, Check, Mail, Unplug, Workflow } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendar, FaInstagram } from "react-icons/fa";
import { SlCalender } from "react-icons/sl";
import { connectGoogle, connectInstagram, disconnectGoogle, disconnectInstagram, getAllIntegrations } from '../features/integration';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const integrationList = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and manage emails through your AI agent.",
    icon: Mail,
    provider: "google",
  },
  {
    id: "google_calender",
    name: "Google Calender",
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [integrations, setIntegrations] = useState({});

  const handleConnect = async (id) => {
    setConnecting(id);
    setError("");
    setSuccess("");
    if (id === "gmail" || id === "google_calender" || id === "google" || id === "googleCalendar") {
      const data = await connectGoogle();
      if (!data?.url) {
        setError(data?.response?.data?.message || "Google authorization URL not received.");
        setConnecting(null);
        return;
      }
      window.location.assign(data.url);
      return;
    }
    if (id === "instagram") {
      const data = await connectInstagram();
      if (!data?.url) {
        setError(data?.response?.data?.message || "Instagram authorization URL not received.");
        setConnecting(null);
        return;
      }
      window.location.assign(data.url);
      return;
    }
  };

  const handleDisconnect = async (id) => {
    setDisconnecting(id);
    setError("");
    setSuccess("");
    const confirmed = window.confirm(`Are you sure you want to disconnect ${id}?`);
    if (!confirmed) {
      setDisconnecting(null);
      return;
    }
    if (id === "gmail" || id === "google_calender" || id === "google" || id === "googleCalendar") {
      await disconnectGoogle();
      setSuccess("Disconnected Successfully");
      setDisconnecting(null);
      fetchAllIntegrations();
    }
    if (id === "instagram") {
      await disconnectInstagram();
      setSuccess("Disconnected Successfully");
      setDisconnecting(null);
      fetchAllIntegrations();
    }
  };

  const fetchAllIntegrations = async () => {
    const data = await getAllIntegrations();
    setIntegrations(data?.integrations || {});
    console.log(data?.integrations);
  };

  useEffect(() => {
    fetchAllIntegrations();
  }, [connecting,disconnecting]);

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

          <Separator />
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
              <p className="text-sm text-emerald-300">{success}</p>
            </div>
          )}

          <div className='space-y-4'>
            {integrationList.map((item) => {
              const integration = integrations?.[item?.id];
              const connected = Boolean(integration?.connected);
              const Icon = item.icon;
              const isConnecting = connecting == item?.id;
              const isDisconnecting = disconnecting == item?.id;

              return (
                <Card
                  key={item?.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className='flex items-start gap-4'>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-900 shadow-[0_8px_24px_rgba(255,255,255,0.1)]">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className='space-y-1.5'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h2 className="font-medium text-white">
                            {item.name}
                          </h2>

                          {!connecting && connected && (
                            <Badge
                              variant="secondary"
                              className="gap-1 border border-emerald-400/20 bg-emerald-400/10 font-normal text-emerald-300"
                            >
                              <Check className="h-3 w-3" />
                              connected
                            </Badge>
                          )}
                        </div>

                        <CardTitle className="sr-only">
                          {item.name}
                        </CardTitle>
                        <CardDescription className="max-w-md leading-relaxed text-zinc-500">
                          {item.description}
                        </CardDescription>

                        {connected && (
                          <p className="pt-1 text-xs text-zinc-500">
                            {integration?.email ||
                              integration?.username ||
                              integration?.displayName ||
                              ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className='flex shrink-0 gap-2'>
                      {connected ? (
                        <Button
                          variant="outline"
                          disabled={isDisconnecting}
                          onClick={() => handleDisconnect(item.id)}
                          className="rounded-xl border-red-400/20 bg-red-400/[0.06] text-red-300 hover:bg-red-400/10 hover:text-red-200"
                        >
                          <Unplug className="mr-2 h-4 w-4" />
                          {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                        </Button>
                      ) : (
                        <Button
                          disabled={isConnecting}
                          onClick={() => handleConnect(item.id)}
                          className="rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900"
                        >
                          {isConnecting
                            ? "Connecting..."
                            : "Connect"}

                          {!isConnecting && (
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Integration;
