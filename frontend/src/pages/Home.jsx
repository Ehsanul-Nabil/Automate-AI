import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowUpIcon,
  Bot,
  Calendar,
  Check,
  Clock,
  Coins,
  ImagePlus,
  LogOut,
  Mail,
  Plus,
  Settings2,
  Workflow,
  X,
} from "lucide-react";
import { FaInstagram } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth";
import { agentChat, agentResume, chat } from "@/features/chat";
import { setUserData } from "@/redux/userSlice";
import { setSelectedAgent } from "@/redux/agentSlice";
import api from "@/api";

const darkPanel =
  "border border-white/[0.08] bg-[#16161c]/90 backdrop-blur-xl shadow-2xl";
const whiteBtn =
  "rounded-xl bg-white text-zinc-950 font-medium hover:bg-zinc-200 transition";
const menuSeparator = "bg-white/[0.08]";

function Home() {
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const { userData } = useSelector((state) => state.user);
  const { agents, selectedAgent } = useSelector((state) => state.agent);
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  const [pendingApproval, setPendingApproval] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const fileInputRef = useRef(null);
  const dispatch = useDispatch();

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      await logout();
      dispatch(setUserData(null));
    } catch (error) {
      console.log(error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const clearSelectedImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview("");
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadedImage(null);
  };

  // const uploadToCloudinary = async () => {
  //   if (!selectedImage) return null;
  //   try {
  //     const formData = new FormData();
  //     formData.append("image", selectedImage);
  //     const { data } = await api.post("/api/upload", formData, {
  //       headers: { "Content-Type": "multipart/form-data" },
  //     });
  //     setUploadedImage(data);
  //     return data;
  //   } catch (error) {
  //     console.log(error);
  //     return null;
  //   }
  // };
const uploadToCloudinary = async () => {
    if (!selectedImage) return null;
    try {
      const formData = new FormData();
      formData.append("file", selectedImage);
      formData.append(
        "upload_preset",
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      );

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        }/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      setUploadedImage(data);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  };


  const createPendingApproval = (res) => {
    if (!res?.interrupted) return false;

    if (res?.approvalType === "email" || res?.email) {
      setPendingApproval({
        type: "email",
        email: res.email || res.payload || {},
      });
      return true;
    }

    if (
      res?.approvalType === "calender" ||
      res?.approvalType === "calendar" ||
      res?.event
    ) {
      setPendingApproval({
        type: "calender",
        event: res.event || res.payload || {},
      });
      return true;
    }

    if (
      res?.approvalType === "instagram" ||
      res?.caption !== undefined ||
      res?.imageUrl
    ) {
      setPendingApproval({
        type: "instagram",
        imageUrl: res.imageUrl || res.payload?.imageUrl || "",
        caption: res.caption || res.payload?.caption || "",
      });
      return true;
    }

    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!message.trim() && !selectedImage) || pendingApproval || approvalLoading) {
      return;
    }

    try {
      setAiLoading(true);
      let image = uploadedImage;

      if (selectedImage && !image?.secure_url) {
        setImageUploading(true);
        image = await uploadToCloudinary();
        setImageUploading(false);
      }

      let finalMessage = message;
      if (image?.secure_url) {
        finalMessage += `\n\nImage URL: ${image.secure_url}`;
        finalMessage += `\nImage public ID: ${image.public_id || ""}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: finalMessage,
          image_url: image?.secure_url,
        },
      ]);

      setMessage("");

      if (selectedAgent === "") {
        const res = await chat(message);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              res?.aiResponse ||
              res?.response?.data?.message ||
              "something went wrong",
          },
        ]);
        clearSelectedImage();
        return;
      } else {
        const res = await agentChat(finalMessage, selectedAgent);
        if (res?.interrupted && createPendingApproval(res)) {
          clearSelectedImage();
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              res?.aiResponse ||
              res?.response?.data?.message ||
              "something went wrong",
          },
        ]);
        clearSelectedImage();
      }
    } catch (error) {
      console.log(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong while processing your request.",
        },
      ]);
    } finally {
      setImageUploading(false);
      setAiLoading(false);
    }
  };

  const renderApprovalDetails = () => {
    if (!pendingApproval) return null;

    if (pendingApproval?.type === "email") {
      return (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
          <div>
            <p className="mb-1 text-xs text-zinc-500">To</p>
            <p className="break-all text-sm">
              {pendingApproval?.email?.to || "Not provided"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Subject</p>
            <p className="text-sm">
              {pendingApproval?.email?.subject || "Not provided"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Body</p>
            <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">
              {pendingApproval?.email?.body || "Not provided"}
            </p>
          </div>
        </div>
      );
    }

    if (pendingApproval?.type === "calender") {
      return (
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
          <div>
            <p className="mb-1 text-xs text-zinc-500">Title</p>
            <p className="break-all text-sm">
              {pendingApproval?.event?.summary || "Not provided"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Description</p>
            <p className="text-sm">
              {pendingApproval?.event?.description || "Not provided"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Start</p>
            <p className="flex items-center gap-2 text-sm">
              <Calendar size={15} />
              {pendingApproval?.event?.startDateTime
                ? new Date(pendingApproval.event.startDateTime).toLocaleString(
                    "en-IN",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: pendingApproval.event.timeZone,
                    }
                  )
                : "Not provided"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">End</p>
            <p className="flex items-center gap-2 text-sm">
              <Clock size={15} />
              {pendingApproval?.event?.endDateTime
                ? new Date(pendingApproval.event.endDateTime).toLocaleString(
                    "en-IN",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: pendingApproval.event.timeZone,
                    }
                  )
                : "Not provided"}
            </p>
            <p className="text-xs text-zinc-500">
              Timezone: {pendingApproval?.event?.timeZone}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
        {pendingApproval.imageUrl && (
          <img
            src={pendingApproval.imageUrl}
            alt="Instagram post preview"
            className="max-h-72 w-full rounded-lg object-contain"
          />
        )}

        <div>
          <p className="mb-1 text-xs text-zinc-500">Caption</p>
          <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">
            {pendingApproval.caption || "No caption provided"}
          </p>
        </div>
      </div>
    );
  };

  const handleApproval = async (approved) => {
    try {
      if (!pendingApproval || approvalLoading) return;
      setApprovalLoading(true);
      const res = await agentResume({ approved, agent: selectedAgent });

      if (res?.interrupted && createPendingApproval(res)) {
        clearSelectedImage();
        return;
      }

      setMessage("");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            res?.aiResponse ||
            (approved
              ? pendingApproval.type === "instagram"
                ? "Instagram publish workflow resumed. Verify the publish result above."
                : "Approval process complete. Verify the action status."
              : "Action reject kar di gayi hai."),
        },
      ]);

      setPendingApproval(null);
    } catch (error) {
      console.log(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to process approval.",
        },
      ]);
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleNewChat = () => {
    if (aiLoading || imageUploading || approvalLoading) return;
    setMessages([]);
    setMessage("");
    clearSelectedImage();
    setPendingApproval(null);
  };

  const selectedAgentObj = agents?.find((a) => a._id === selectedAgent);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#2b2f3a_0%,#191b21_55%,#121317_100%)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <header className="z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900">
              <Workflow size={17} />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Automate AI
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Agent & Navigation Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-200 hover:bg-white/[0.08] hover:text-white"
                  />
                }
              >
                {selectedAgentObj ? selectedAgentObj.name : "Default Chat"}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border-white/10 bg-[#18181f] text-zinc-200"
              >
                <DropdownMenuItem className="flex items-center gap-2.5 py-2.5">
                  <Coins color="yellow" /> {userData?.credits ?? 0} Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator className={menuSeparator} />

                <DropdownMenuItem
                  onClick={() => dispatch(setSelectedAgent(""))}
                  className="py-2"
                >
                  Default Chat
                </DropdownMenuItem>
                {agents?.map((agent) => (
                  <DropdownMenuItem
                    key={agent._id}
                    onClick={() => dispatch(setSelectedAgent(agent._id))}
                    className="py-2"
                  >
                    {agent.name}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem
                  render={
                    <Link
                      to="/agents"
                      className="flex items-center gap-2.5 py-2.5"
                    />
                  }
                >
                  <Bot /> My Agents
                </DropdownMenuItem>

                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem
                  render={
                    <Link
                      to="/agents/new"
                      className="flex items-center gap-2.5 py-2.5"
                    />
                  }
                >
                  <Plus /> Create New Agent
                </DropdownMenuItem>

                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem
                  render={
                    <Link
                      to="/integrations"
                      className="flex items-center gap-2.5 py-2.5"
                    />
                  }
                >
                  <Settings2 /> Integration
                </DropdownMenuItem>

                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem
                  render={
                    <Link
                      to="/pricing"
                      className="flex items-center gap-2.5 py-2.5"
                    />
                  }
                >
                  <Coins /> Pricing
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Open profile menu"
                    className="flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05]"
                  />
                }
              >
                {userData?.profilePicture ? (
                  <img
                    src={userData.profilePicture}
                    alt={userData?.name || "Profile"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium">
                    {userData?.name?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border-white/10 bg-[#18181f] text-zinc-200"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-white">
                    {userData?.name}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {userData?.email}
                  </p>
                </div>
                <DropdownMenuSeparator className={menuSeparator} />
                <DropdownMenuItem
                  disabled={logoutLoading}
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 py-2.5 text-red-400 focus:text-red-300"
                >
                  <LogOut size={15} />
                  {logoutLoading ? "Logging out..." : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Chat Section */}
        <section className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-3 sm:px-5">
          <div className="flex-1 space-y-5 overflow-y-auto py-4">
            {messages.length === 0 && !pendingApproval && !aiLoading ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
                  <Workflow size={22} />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                  How can Automate AI help today?
                </h1>
                <p className="mt-1 max-w-md text-sm text-zinc-400">
                  Send emails, schedule calendar events, or publish Instagram
                  posts with built-in approval controls.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="mr-3 mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-900">
                      <Workflow size={15} />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] break-words px-4 py-3 text-sm leading-7 sm:max-w-[80%] ${
                      msg.role === "user"
                        ? `rounded-2xl rounded-br-md text-white ${darkPanel}`
                        : "text-zinc-200"
                    }`}
                  >
                    {msg?.image_url && (
                      <img
                        src={msg?.image_url}
                        alt="Attached image"
                        className="mb-3 max-h-64 rounded-lg object-contain"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}

            {/* Human-in-the-Loop Approval Card */}
            {pendingApproval && (
              <div className={`rounded-2xl p-4 ${darkPanel}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      pendingApproval.type === "calender"
                        ? "bg-violet-400/10"
                        : pendingApproval.type === "instagram"
                        ? "bg-pink-400/10"
                        : "bg-amber-400/10"
                    }`}
                  >
                    {pendingApproval.type === "calender" ? (
                      <Calendar className="size-5 text-violet-400" />
                    ) : pendingApproval.type === "instagram" ? (
                      <FaInstagram className="size-5 text-pink-400" />
                    ) : (
                      <Mail className="size-5 text-amber-400" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">
                      {pendingApproval.type === "calender"
                        ? "Calendar Approval Required"
                        : pendingApproval.type === "instagram"
                        ? "Instagram Publish Approval"
                        : "Email Approval Required"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {pendingApproval.type === "instagram"
                        ? "Review the image and caption before publishing."
                        : pendingApproval.type === "calender"
                        ? "Review the event before creating it."
                        : "Review the email before sending."}
                    </p>
                  </div>
                </div>

                {renderApprovalDetails()}

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={approvalLoading}
                    onClick={() => handleApproval(false)}
                    className="rounded-xl border-red-500/25 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <X className="mr-2 size-4" />
                    {approvalLoading ? "Processing..." : "Reject"}
                  </Button>
                  <Button
                    type="button"
                    disabled={approvalLoading}
                    onClick={() => handleApproval(true)}
                    className={whiteBtn}
                  >
                    <Check className="mr-2 size-4" />
                    {approvalLoading
                      ? "Processing..."
                      : pendingApproval.type === "calender"
                      ? "Approve & Create"
                      : pendingApproval.type === "instagram"
                      ? "Approve & Publish"
                      : "Approve & Send"}
                  </Button>
                </div>
              </div>
            )}

            {/* AI / Upload Loading State */}
            {aiLoading && (
              <div className="flex items-center gap-3">
                <div className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900">
                  <Workflow size={15} className="animate-pulse" />
                </div>
                <div className="text-sm text-zinc-400">
                  {imageUploading
                    ? "Uploading image to Cloudinary..."
                    : "Automate AI is thinking..."}
                </div>
              </div>
            )}
          </div>

          {/* Prompt Composer */}
          <div className="z-20 w-full shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
            <form
              onSubmit={handleSubmit}
              className={`mx-auto w-full max-w-2xl rounded-2xl p-3 transition focus-within:border-white/25 ${darkPanel}`}
            >
              {imagePreview && (
                <div className="relative mb-3 inline-block">
                  <img
                    src={imagePreview}
                    alt="Selected preview"
                    className="max-h-28 rounded-xl border border-white/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    aria-label="Remove selected image"
                    className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-zinc-900 text-zinc-200 ring-1 ring-white/15 hover:bg-zinc-800"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask Automate AI anything..."
                className="w-full resize-none bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />

              <div className="mt-2 flex items-center justify-between">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={aiLoading || approvalLoading || imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach image"
                    className="size-8 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <ImagePlus size={16} />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={aiLoading || approvalLoading || imageUploading}
                    onClick={handleNewChat}
                    className="h-8 rounded-lg px-3 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    New Chat
                  </Button>
                  <Button
                    disabled={
                      aiLoading ||
                      approvalLoading ||
                      imageUploading ||
                      Boolean(pendingApproval) ||
                      (!message.trim() && !selectedImage)
                    }
                    type="submit"
                    size="icon"
                    aria-label="Send message"
                    className={`size-8 shrink-0 ${whiteBtn} disabled:bg-white/10 disabled:text-zinc-500`}
                  >
                    <ArrowUpIcon size={16} />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;