import { useState, useEffect, useRef } from 'react';
import MessageComposer from './components/MessageComposer';
import SidePanelHeader from './components/SidePanelHeader';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import AuthView from './components/AuthView';
import HeroView from './components/HeroView';
import ProfileModal from './components/modals/ProfileModal';
import UpgradeModal from './components/modals/UpgradeModal';

import { useAuth } from './hooks/useAuth';
import { useUsage } from './hooks/useUsage';
import { useSolve } from './hooks/useSolve';

import { supabase } from './services/supabaseClient';
import type { StyleMode } from './types';

export default function App() {
  // --- Global State & Hooks ---
  const { usage, setUsage, syncProfile, resetUsage, upgradeMoment } = useUsage();
  
  const [quotedStep, setQuotedStep] = useState<{ text: string; index: number } | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  
  const { 
    authUser, isAuthLoading, isAuthBusy, authMessage, authEmail, authPassword, 
    authOtpCode, isOtpRequested, authView, authMethod, resendCooldown,
    setAuthEmail, setAuthPassword, setAuthOtpCode, setAuthView, setAuthMethod,
    handleSignIn, handleSignUp, handleVerifyOtpCode, signOut, updateProfile,
    resetAuthState 
  } = useAuth(syncProfile);

  const {
    isSending, sendError, chatSession, setChatSession,
    activeConversationId, setActiveConversationId, handleSend, clearSession, setSendError
  } = useSolve(usage, setUsage, quotedStep, setQuotedStep, () => setIsUpgradeModalOpen(true));

  // --- UI State ---
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('oryx_dark_mode') === 'true');
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'profile' | 'settings' | 'password'>('menu');
  const [styleMode, setStyleMode] = useState<StyleMode>('standard');
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saveHistory, setSaveHistory] = useState(() => localStorage.getItem('oryx_save_history') !== 'false');
  const [useAnalytics, setUseAnalytics] = useState(() => localStorage.getItem('oryx_analytics') !== 'false');
  const [autoCopy, setAutoCopy] = useState(() => localStorage.getItem('oryx_auto_copy') === 'true');
  const lastHandledRef = useRef<string | null>(null);

  const latestResponse = chatSession.length > 0 ? chatSession[chatSession.length - 1].response : null;
  const logoUrl = chrome.runtime.getURL('icons/128.png?v=3');
  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL;

  // --- Effects & Lifecycle ---
  useEffect(() => {
    const saved = localStorage.getItem('oryx_current_session');
    const savedId = localStorage.getItem('oryx_active_conv_id');
    if (saved) {
      try { setChatSession(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    if (savedId) setActiveConversationId(savedId);
  }, [setChatSession, setActiveConversationId]);

  useEffect(() => {
    localStorage.setItem('oryx_current_session', JSON.stringify(chatSession));
    if (activeConversationId) localStorage.setItem('oryx_active_conv_id', activeConversationId);
    else localStorage.removeItem('oryx_active_conv_id');
  }, [chatSession, activeConversationId]);

  useEffect(() => {
    localStorage.setItem('oryx_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (authUser) {
      setProfileName(authUser.displayName || '');
      setProfilePhotoUrl(authUser.photoURL || '');
    }
  }, [authUser]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (!(e.ctrlKey && e.shiftKey && e.key === 'H') && !(e.ctrlKey && e.key === 'n')) return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); setIsHistoryOpen(p => !p); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); clearSession(); document.getElementById('composer-input')?.focus(); }
      if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString() && latestResponse?.answer) {
        navigator.clipboard.writeText(latestResponse.answer);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [latestResponse, clearSession]);

  useEffect(() => {
    if (autoCopy && latestResponse?.answer && !isSending) {
      navigator.clipboard.writeText(latestResponse.answer).catch(e => console.error('Auto-copy failed', e));
    }
  }, [latestResponse, autoCopy, isSending]);

  useEffect(() => {
    const checkPending = async () => {
      const result = await chrome.storage.local.get(['pendingInlineQuestion']);
      if (result.pendingInlineQuestion) {
        const { text, images, timestamp, type, injectionId, isBulk, tabId } = result.pendingInlineQuestion as { text: string; images?: string[]; timestamp: number; type?: string; injectionId?: string; isBulk?: boolean, tabId?: number };
        const intentId = injectionId || String(timestamp);
        if (lastHandledRef.current === intentId) return;
        lastHandledRef.current = intentId;

        if (Date.now() - timestamp < 4000) {
          if (isBulk && usage.subscriptionTier !== 'pro') {
            const bulkData = await chrome.storage.local.get('oryx_bulk_used_count');
            const count = Number(bulkData.oryx_bulk_used_count || 0);
            if (count >= 999999) {
              setSendError("Free limit reached for Bulk Answers. Upgrade to Pro!");
              setIsUpgradeModalOpen(true);
              await chrome.storage.local.remove('pendingInlineQuestion');
              return;
            }
            await chrome.storage.local.set({ oryx_bulk_used_count: count + 1 });
          }

          // Convert URL strings to mock File objects if needed, though handleSend expects File[]
          // For now, let's just make sure we pass them. solveApi might need to handle URLs vs Files.
          handleSend({ text, images: (images || []).map(url => ({ url })), styleMode: "standard", isBulk }).then((res) => {
            if (type === 'INLINE_SOLVE_AND_INJECT' && res?.answer) {
              const msgPayload = { type: 'INLINE_SOLVE_RESULT', payload: { injectionId, answer: res.answer, explanation: res.explanation } };
              if (tabId) {
                chrome.tabs.sendMessage(tabId, msgPayload);
              } else {
                chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                  if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, msgPayload);
                });
              }
            }
          });
        }
        await chrome.storage.local.remove('pendingInlineQuestion');
      }
    };
    checkPending();

    const handleMessage = async (message: any, sender: chrome.runtime.MessageSender) => {
      if ((message.type === 'INLINE_EXTRACT_QUESTION' || message.type === 'INLINE_SOLVE_AND_INJECT') && message.payload?.text) {
        const intentId = message.payload.injectionId || String(message.payload.timestamp || Date.now());
        if (lastHandledRef.current === intentId) return;
        lastHandledRef.current = intentId;

        if (message.payload.isBulk && usage.subscriptionTier !== 'pro') {
          const bulkData = await chrome.storage.local.get('oryx_bulk_used_count');
          const count = Number(bulkData.oryx_bulk_used_count || 0);
          if (count >= 999999) {
            setSendError("Free limit reached for Bulk Answers. Upgrade to Pro!");
            setIsUpgradeModalOpen(true);
            setTimeout(() => chrome.storage.local.remove('pendingInlineQuestion'), 100);
            return;
          }
          await chrome.storage.local.set({ oryx_bulk_used_count: count + 1 });
        }

        handleSend({ 
          text: message.payload.text, 
          images: (message.payload.images || []).map((url: string) => ({ url })), 
          styleMode: "standard",
          isBulk: message.payload.isBulk 
        }).then((res) => {
          if (message.type === 'INLINE_SOLVE_AND_INJECT' && res?.answer && message.payload?.injectionId) {
            const msgPayload = { type: 'INLINE_SOLVE_RESULT', payload: { injectionId: message.payload.injectionId, answer: res.answer, explanation: res.explanation } };
            const reqTabId = sender.tab?.id;
            if (reqTabId) {
              chrome.tabs.sendMessage(reqTabId, msgPayload);
            } else {
              chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                if (tabs[0]?.id) chrome.tabs.sendMessage(tabs[0].id, msgPayload);
              });
            }
          }
        });
        setTimeout(() => chrome.storage.local.remove('pendingInlineQuestion'), 100);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleSend, usage.subscriptionTier]);

  // --- Handlers ---
  const handleSignOutAction = async () => {
    await signOut();
    clearSession();
    resetUsage();
    resetAuthState();
    setIsProfileOpen(false);
  };

  const handleSaveProfileAction = async () => {
    try {
      await updateProfile({ displayName: profileName, photoURL: profilePhotoUrl });
      setProfileMessage('Profile updated.');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (e: any) {
      setProfileMessage(e.message || 'Update failed');
    }
  };

  const handleClearHistoryAction = async () => {
    if (!supabase || !authUser?.id) return;
    if (!confirm('Clear all question history?')) return;
    try {
      await supabase.from('history_entries').delete().eq('user_id', authUser.id);
      clearSession();
      setProfileMessage('History cleared.');
    } catch (e) { setProfileMessage('Failed to clear history.'); }
  };

  const handleDeleteConversation = async (id: string | null) => {
    if (!supabase || !authUser?.id) return;
    await supabase.from('history_entries').delete().eq('user_id', authUser.id).eq('conversation_id', id);
    if (activeConversationId === id) clearSession();
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    if (!supabase || !authUser?.id) return;
    await supabase.from('history_entries').update({ question: newTitle }).eq('user_id', authUser.id).eq('conversation_id', id);
    if (activeConversationId === id) {
       setChatSession(prev => prev.map((turn, i) => i === 0 ? { ...turn, question: newTitle } : turn));
    }
  };

  // --- Screen Capture Handler ---
  const handleCaptureScreen = async (): Promise<File | null> => {
    return new Promise((resolve) => {
      const listener = (message: any) => {
        if (message?.type === 'CROP_CAPTURE_READY') {
          chrome.runtime.onMessage.removeListener(listener);
          try {
            const dataUrl = message.imageDataUrl;
            const [meta, b64] = dataUrl.split(',');
            const mimeMatch = meta?.match(/data:(.*?);base64/);
            const mime = mimeMatch?.[1] || 'image/png';
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const file = new File([bytes], 'capture.png', { type: mime });
            resolve(file);
          } catch {
            resolve(null);
          }
        }
        if (message?.type === 'CROP_CAPTURE_ERROR') {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(null);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      chrome.runtime.sendMessage({ type: 'START_CROP_CAPTURE' }, (res) => {
        if (!res?.ok) {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(null);
        }
      });
      // Safety timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        resolve(null);
      }, 30000);
    });
  };

  // --- Render ---
  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,#f1f5f9_0%,#e2e8f0_54%,#f8fafc_100%)] opacity-1 transition-opacity dark:opacity-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-0 transition-opacity dark:opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_-10%,rgba(79,70,229,0.15),transparent_70%)] dark:bg-[radial-gradient(circle_at_52%_-10%,rgba(99,102,241,0.2),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.015] [background-image:radial-gradient(#000000_1px,transparent_1px)] [background-size:20px_20px] dark:[background-image:radial-gradient(#ffffff_0.5px,transparent_0.5px)] dark:opacity-[0.03]" />

      <SidePanelHeader
        logoUrl={logoUrl}
        appName="Oryx Solver"
        usedCredits={usage.usedCredits}
        totalCredits={usage.totalCredits}
        isSignedIn={!!authUser}
        userEmail={authUser?.email}
        userPhotoUrl={authUser?.photoURL}
        isPro={usage.subscriptionTier === 'pro'}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        onOpenSettings={() => setIsProfileOpen(true)}
        showCredits={!!authUser}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      <div className="flex flex-1 min-h-0">
        {!authUser && !isAuthLoading ? (
          <AuthView
            view={authView}
            method={authMethod}
            email={authEmail}
            password={authPassword}
            otpCode={authOtpCode}
            isOtpRequested={isOtpRequested}
            isBusy={isAuthBusy}
            message={authMessage}
            resendCooldown={resendCooldown}
            logoUrl={logoUrl}
            onSetEmail={setAuthEmail}
            onSetPassword={setAuthPassword}
            onSetOtpCode={setAuthOtpCode}
            onSetView={setAuthView}
            onSetMethod={setAuthMethod}
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            onVerifyOtp={handleVerifyOtpCode}
            onResendOtp={() => {}}
          />
        ) : (
          <main className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-transparent custom-scrollbar ${!latestResponse ? 'items-center px-4 transition-all' : 'space-y-4 p-4 pb-32'}`}>
            {sendError && (
              <div className="w-full max-w-2xl mx-auto mb-4 rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-500/10 to-rose-400/5 p-4 text-[13px] text-rose-700 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 dark:border-rose-400/20 dark:from-rose-500/20 dark:to-rose-400/10 dark:text-rose-300 flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-rose-100 p-1 flex-shrink-0 dark:bg-rose-900/50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600 dark:text-rose-400">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="flex-1 font-medium leading-relaxed">
                  {sendError}
                </div>
                <button onClick={() => setSendError(null)} className="ml-2 rounded-full p-1 hover:bg-rose-200/50 dark:hover:bg-rose-800/50 transition-colors text-rose-500 flex-shrink-0">
                  <span className="sr-only">Dismiss</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}

            {!latestResponse ? (
              <HeroView
                logoUrl={logoUrl}
                onSend={handleSend}
                onCaptureScreen={handleCaptureScreen} 
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                isSending={isSending}
                usage={usage}
                onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {chatSession.map((turn) => (
                  <div key={turn.id} className="flex flex-col gap-4">
                    {/* User Question Bubble */}
                    <div className="flex flex-col items-end gap-1 px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-indigo-600 px-5 py-3.5 text-[14px] font-medium text-white shadow-md relative overflow-hidden group">
                        {turn.isBulk && (
                           <div className="absolute top-0 right-0 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 border-b border-l border-white/5">
                             Bulk Request
                           </div>
                        )}
                        <div className={turn.isBulk ? "mt-2" : ""}>
                          {turn.question || "Captured Screen"}
                        </div>
                        {turn.images && turn.images.length > 0 && (
                          <div className={`mt-3 grid gap-1.5 ${turn.images.length > 3 ? 'grid-cols-4' : turn.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {turn.images.map((src, i) => (
                              <div key={i} className="relative aspect-square w-full min-w-[40px] overflow-hidden rounded-lg border border-white/20 bg-black/10">
                                <img src={src} className="h-full w-full object-cover transition-transform hover:scale-110" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* AI Response Panel */}
                    <ResponsePanel
                      response={turn.response}
                      onQuoteStep={(text, index) => setQuotedStep({ text, index })}
                      onSuggestionClick={(s: any) => handleSend({ text: s.prompt, images: [], styleMode: s.styleMode || 'standard' })}
                    />
                  </div>
                ))}
              </div>
            )}
          </main>
        )}
      </div>

      {latestResponse && (
        <div className="fixed bottom-0 left-0 right-0 w-full z-20">
           <div className="w-full">
              <MessageComposer
                onSend={handleSend}
                onCaptureScreen={handleCaptureScreen}
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                isHero={false}
                isSending={isSending}
                quotedStep={quotedStep}
                onClearQuote={() => setQuotedStep(null)}
              />
           </div>
        </div>
      )}

      {isHistoryOpen && (
        <HistoryPanel
          onClose={() => setIsHistoryOpen(false)}
          onSelect={async (conversationId: string) => {
            setIsHistoryOpen(false);
            // Load all turns for this conversation from Supabase
            if (supabase) {
              try {
                const { data, error } = await supabase
                  .from('history_entries')
                  .select('id, question, answer, explanation, conversation_id, created_at, image_urls, is_bulk')
                  .eq('conversation_id', conversationId)
                  .order('created_at', { ascending: true });
                
                if (!error && data && data.length > 0) {
                  const turns = data.map(entry => ({
                    id: entry.id,
                    question: entry.question,
                    images: entry.image_urls || [],
                    isBulk: entry.is_bulk || false,
                    response: {
                      answer: entry.answer,
                      explanation: entry.explanation || '',
                      suggestions: [],
                    },
                  }));
                  setChatSession(turns);
                  setActiveConversationId(conversationId);
                }
              } catch (e) {
                console.error('Failed to load conversation', e);
              }
            }
          }}
          onNewSolve={() => { clearSession(); setIsHistoryOpen(false); }}
          onOpenSettings={() => { setIsHistoryOpen(false); setIsProfileOpen(true); }}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
        />
      )}

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        authUser={authUser}
        profileName={profileName}
        profilePhotoUrl={profilePhotoUrl}
        onSetProfileName={setProfileName}
        onSetProfilePhotoUrl={setProfilePhotoUrl}
        onSaveProfile={handleSaveProfileAction}
        onSignOut={handleSignOutAction}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        saveHistory={saveHistory}
        onToggleSaveHistory={setSaveHistory}
        useAnalytics={useAnalytics}
        onToggleAnalytics={(val) => {
          setUseAnalytics(val);
          localStorage.setItem('oryx_analytics', String(val));
        }}
        onClearHistory={handleClearHistoryAction}
        onDeleteAccount={() => {}}
        profileMessage={profileMessage}
        isBusy={isAuthBusy}
        tier={usage?.subscriptionTier || 'free'}
        settingsPanel={settingsPanel}
        onSetSettingsPanel={setSettingsPanel}
        autoCopy={autoCopy}
        onToggleAutoCopy={(val) => {
          setAutoCopy(val);
          localStorage.setItem('oryx_auto_copy', String(val));
        }}
        newPassword={newPassword}
        confirmNewPassword={confirmNewPassword}
        onSetNewPassword={setNewPassword}
        onSetConfirmNewPassword={setConfirmNewPassword}
        onChangePassword={async () => {}}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        upgradeMoment={upgradeMoment}
        upgradeUrl={upgradeUrl}
      />
    </div>
  );
}
