"use client";

import React, { useState } from "react";
import { MessageSquarePlus, X, CheckCircle2, AlertTriangle, Bug, Sparkles, MapPin, Send } from "lucide-react";
import { getApiUrl } from "@/config";

export interface BetaFeedbackModalProps {
  currentCampsiteName?: string | null;
  isOpen?: boolean;
  onClose?: () => void;
}

type FeedbackCategory = "data_issue" | "bug" | "feature_request" | "general";

const CATEGORIES: { id: FeedbackCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "data_issue",
    label: "Campsite Data",
    icon: <MapPin className="w-4 h-4 text-[#C9822B]" />,
    desc: "Incorrect fire rule, amenities, road access, or fees"
  },
  {
    id: "feature_request",
    label: "Feature Idea",
    icon: <Sparkles className="w-4 h-4 text-[#2F5D50]" />,
    desc: "A filter, map layer, or workflow you'd love"
  },
  {
    id: "bug",
    label: "Bug / Glitch",
    icon: <Bug className="w-4 h-4 text-[#B3261E]" />,
    desc: "Something is broken or didn't load properly"
  },
  {
    id: "general",
    label: "General Vibe",
    icon: <MessageSquarePlus className="w-4 h-4 text-[#1F6FB2]" />,
    desc: "Thoughts on design, speed, or usefulness"
  }
];

export default function BetaFeedbackModal({
  currentCampsiteName,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose
}: BetaFeedbackModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  
  const handleClose = () => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalOpen(false);
    }
  };

  const [category, setCategory] = useState<FeedbackCategory>("data_issue");
  const [rating, setRating] = useState<number>(5);
  const [customCampsiteName, setCustomCampsiteName] = useState<string | null>(null);
  const campsiteName = customCampsiteName !== null ? customCampsiteName : (currentCampsiteName || "");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMessage("Please enter a short description or note.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const sessionId = typeof window !== "undefined" ? sessionStorage.getItem("cs_session_id") || "sess_anon" : "sess_anon";
      const payload = {
        event_type: "beta_feedback",
        path: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
        session_id: sessionId,
        user_email: email.trim() || undefined,
        meta_data: {
          category,
          rating,
          message: message.trim(),
          campsite_name: campsiteName.trim() || undefined,
          viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
          timestamp: new Date().toISOString()
        }
      };

      const res = await fetch(`${getApiUrl()}/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setMessage("");
          handleClose();
        }, 1800);
      } else {
        setErrorMessage("Could not record feedback right now. Please try again.");
      }
    } catch {
      setErrorMessage("Network error. Please try again when online.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button for Standalone Usage */}
      {controlledIsOpen === undefined && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 bg-[#FFFFFF] hover:bg-[#FAF6EF] text-[#1E2A24] border border-[#E2DAC8] hover:border-[#CDC3AF] px-3.5 py-2 rounded-full shadow-lg text-xs font-semibold transition-all hover:scale-105 cursor-pointer group"
          aria-label="Open Beta Feedback"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F5D50] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F5D50]"></span>
          </span>
          <MessageSquarePlus className="w-3.5 h-3.5 text-[#2F5D50] group-hover:rotate-12 transition-transform" />
          <span>Beta Feedback</span>
        </button>
      )}

      {/* Feedback Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="relative w-full max-w-lg bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl shadow-2xl p-6 text-[#1E2A24] max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-[#536259] hover:text-[#1E2A24] rounded-full bg-[#FAF6EF] hover:bg-[#F6F1E7] transition-colors cursor-pointer"
              aria-label="Close Feedback Modal"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="mb-5 pr-8">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-[#FAF2E6] text-[#C9822B] border border-[#E2DAC8]">
                  Camp Smart Beta
                </span>
                <span className="text-xs text-[#536259]">Direct to Founders</span>
              </div>
              <h2 id="feedback-title" className="text-xl font-bold tracking-tight text-[#1E2A24]">
                Help Shape Camp Smart AU
              </h2>
              <p className="text-xs text-[#536259] mt-1 leading-relaxed">
                Notice an outdated park fee, a closed road, or have a feature idea for your weekend setup? Tell us below.
              </p>
            </div>

            {submitted ? (
              <div className="py-10 text-center flex flex-col items-center justify-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-[#2E7D32] animate-bounce" />
                <h3 className="text-lg font-bold text-[#1E2A24]">Feedback Logged!</h3>
                <p className="text-xs text-[#536259] max-w-xs">
                  Thank you for testing the Camp Smart Australia Beta. Your notes help ensure campers get verified truth.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Banner */}
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-[#B3261E]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-[#536259] uppercase tracking-wider mb-2">
                    Feedback Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          category === cat.id
                            ? "bg-[#EBF2EE] border-[#2F5D50] text-[#1E2A24] shadow-xs"
                            : "bg-[#FAF6EF] border-[#E8E1D3] text-[#536259] hover:bg-[#F6F1E7]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {cat.icon}
                          <span className="text-xs font-bold">{cat.label}</span>
                        </div>
                        <span className="text-[10.5px] text-[#536259] leading-tight line-clamp-2">
                          {cat.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campsite Context (optional) */}
                <div>
                  <label className="block text-xs font-bold text-[#536259] uppercase tracking-wider mb-1">
                    Campground Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={campsiteName}
                    onChange={(e) => setCustomCampsiteName(e.target.value)}
                    placeholder="e.g. Euroka Campground, Blue Mountains"
                    className="w-full text-xs px-3 py-2 bg-[#FAF6EF] border border-[#E2DAC8] rounded-lg focus:outline-none focus:border-[#2F5D50] text-[#1E2A24]"
                  />
                </div>

                {/* Rating / Experience Satisfaction */}
                <div>
                  <label className="block text-xs font-bold text-[#536259] uppercase tracking-wider mb-1.5">
                    Beta Experience Rating
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[
                      { val: 5, emoji: "😍", label: "Loved it" },
                      { val: 4, emoji: "🙂", label: "Good" },
                      { val: 3, emoji: "😐", label: "Okay" },
                      { val: 2, emoji: "🙁", label: "Confusing" },
                      { val: 1, emoji: "⚠️", label: "Issues" }
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setRating(item.val)}
                        className={`flex-1 py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                          rating === item.val
                            ? "bg-[#2F5D50] text-white border-[#2F5D50] shadow-xs font-bold"
                            : "bg-[#FAF6EF] border-[#E2DAC8] text-[#536259] hover:bg-[#F6F1E7]"
                        }`}
                      >
                        <div className="text-sm">{item.emoji}</div>
                        <div className="text-[9.5px] mt-0.5">{item.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details / Message */}
                <div>
                  <label className="block text-xs font-bold text-[#536259] uppercase tracking-wider mb-1">
                    Your Notes / Suggestions <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      category === "data_issue"
                        ? "e.g. Visited last weekend — road had severe corrugations requiring high-clearance, and toilets had no paper."
                        : category === "feature_request"
                        ? "e.g. Would love a filter for caravan lengths over 20ft or generator hours."
                        : "Tell us what could make your weekend trip planning easier..."
                    }
                    className="w-full text-xs p-3 bg-[#FAF6EF] border border-[#E2DAC8] rounded-lg focus:outline-none focus:border-[#2F5D50] text-[#1E2A24] resize-none"
                  />
                </div>

                {/* Optional Email */}
                <div>
                  <label className="block text-xs font-bold text-[#536259] uppercase tracking-wider mb-1">
                    Email for Updates (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com.au"
                    className="w-full text-xs px-3 py-2 bg-[#FAF6EF] border border-[#E2DAC8] rounded-lg focus:outline-none focus:border-[#2F5D50] text-[#1E2A24]"
                  />
                  <p className="text-[10px] text-[#8B9891] mt-1">
                    We will only reach out if you request follow-up or when your feature ships.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-xs text-[#536259] hover:text-[#1E2A24] font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#2F5D50] hover:bg-[#24493F] text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
