import { useEffect, useState } from 'react';
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

  const latestResponse = chatSession.length > 0 ? chatSession[chatSession.length - 1].response : null;
  const logoUrl = chrome.runtime.getURL('public/icons/128.png?v=3');
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
    const handleMessage = (message: any) => {
      if (message.type === 'INLINE_EXTRACT_QUESTION' && message.payload?.text) {
        handleSend({ text: message.payload.text, images: [], styleMode: "standard" });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleSend]);

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
        showCredits={!!latestResponse}
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
              <div className="w-full max-w-2xl mx-auto mb-4 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-[13px] font-bold text-rose-600 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300 dark:border-rose-900/30 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-between">
                <span>{sendError}</span>
                <button onClick={() => setSendError(null)} className="ml-2 rounded-full p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-rose-500">
                  <span className="sr-only">Dismiss</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}

            {!latestResponse ? (
              <HeroView
                logoUrl={logoUrl}
                onSend={handleSend}
                onCaptureScreen={async () => null} 
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
                    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-5 py-3.5 text-[14px] font-medium text-white shadow-md">
                        {turn.question || "Captured Screen"}
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
        <div className="fixed bottom-0 left-0 right-0 w-full z-20 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.5)]">
           <div className="mx-auto max-w-2xl w-full">
              <MessageComposer
                onSend={handleSend}
                onCaptureScreen={async () => null}
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
                  .select('id, question, answer, explanation, conversation_id, created_at')
                  .eq('conversation_id', conversationId)
                  .order('created_at', { ascending: true });
                
                if (!error && data && data.length > 0) {
                  const turns = data.map(entry => ({
                    id: entry.id,
                    question: entry.question,
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
        onToggleAnalytics={setUseAnalytics}
        onClearHistory={handleClearHistoryAction}
        onDeleteAccount={() => {}}
        profileMessage={profileMessage}
        isBusy={isAuthBusy}
        settingsPanel={settingsPanel}
        onSetSettingsPanel={setSettingsPanel}
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
