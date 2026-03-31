/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Layout, 
  Package, 
  BookOpen, 
  Cpu, 
  MessageSquare, 
  Smartphone, 
  User, 
  Settings, 
  Facebook, 
  MessageCircle, 
  Share2, 
  CheckCircle2, 
  TrendingUp, 
  Plus, 
  Search,
  Bell,
  Power,
  Wifi,
  Signal,
  BarChart3,
  Globe,
  ShieldCheck,
  Shield,
  Zap,
  Trash2,
  ExternalLink,
  LogOut,
  LogIn,
  AlertTriangle,
  ArrowRight,
  Camera,
  Upload,
  Image as ImageIcon,
  DollarSign,
  TrendingDown,
  Minus,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { GoogleGenAI } from "@google/genai";

const chartData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type WindowID = 'social' | 'inventory' | 'ledger' | 'ai' | 'sms' | 'profile' | 'settings';

interface WindowState {
  id: WindowID;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  icon: React.ReactNode;
}

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  price: number;
  discount: number;
  minPrice: number;
  imageUrl?: string;
  uid?: string;
}

interface Transaction {
  id: string;
  customer: string;
  amount: number;
  time: string;
  channel: string;
  uid?: string;
}

interface SocialAccount {
  id: string;
  name: string;
  platform: 'Facebook' | 'WhatsApp' | 'TikTok' | 'Instagram' | 'X' | 'LinkedIn' | 'Red X' | 'YouTube';
  status: 'Connected' | 'Disconnected' | 'Wrong Login' | 'Pending';
  icon: React.ReactNode;
  uid?: string;
  selectedPage?: string;
  availablePages?: string[];
}

interface SocialActivity {
  id: string;
  platform: string;
  action: 'Post' | 'Message' | 'Comment';
  content: string;
  timestamp: string;
  uid?: string;
}

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      let details: FirestoreErrorInfo | null = null;
      try {
        details = JSON.parse(this.state.errorInfo || '');
      } catch (e) {}

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-space-black p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">System Error Detected</h1>
          <p className="text-white/60 mb-8 max-w-md">
            {details ? `A database error occurred during ${details.operationType}.` : "An unexpected error occurred in the AGX AI OS kernel."}
          </p>
          {details && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-8 text-left font-mono text-[10px] max-w-xl overflow-auto">
              <div className="text-red-400 mb-2">ERROR: {details.error}</div>
              <div className="text-white/40">PATH: {details.path}</div>
              <div className="text-white/40">OP: {details.operationType}</div>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/80 transition-all"
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
  uid: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
  plan: 'Free' | 'Enterprise';
  twoFactorEnabled?: boolean;
  biometricEnabled?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
  uid: string;
}

interface WindowProps {
  id: WindowID;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
  key?: React.Key;
}

const Window = ({ 
  id, 
  title, 
  icon, 
  children, 
  onClose, 
  zIndex, 
  onFocus 
}: WindowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      drag
      dragMomentum={false}
      onMouseDown={onFocus}
      style={{ zIndex }}
      className="absolute top-20 left-10 md:left-1/4 w-[90vw] md:w-[600px] max-h-[70vh] glass-effect rounded-lg overflow-hidden window-shadow flex flex-col"
    >
      {/* Window Header */}
      <div className="bg-neon-cyan/10 px-4 py-2 flex items-center justify-between border-b border-neon-cyan/20 cursor-move select-none">
        <div className="flex items-center gap-2">
          <span className="text-neon-cyan">{icon}</span>
          <span className="text-sm font-mono uppercase tracking-wider text-neon-cyan/80">{title}</span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Window Content */}
      <div className="p-6 overflow-y-auto bg-space-black/40 flex-1">
        {children}
      </div>
    </motion.div>
  );
};

const NotificationPanel = ({ notifications, onClose, onMarkAsRead }: { 
  notifications: Notification[], 
  onClose: () => void,
  onMarkAsRead: (id: string) => void 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="absolute top-16 right-4 w-80 bg-[#151619] border border-[#2A2B2F] rounded-xl shadow-2xl z-[100] overflow-hidden"
    >
      <div className="p-4 border-b border-[#2A2B2F] flex items-center justify-between bg-[#1A1B1E]">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#00F2FF]" />
          Notifications
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No new notifications
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`p-3 rounded-lg mb-1 transition-colors cursor-pointer ${n.read ? 'bg-transparent' : 'bg-[#00F2FF]/5 border-l-2 border-[#00F2FF]'}`}
              onClick={() => onMarkAsRead(n.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className={`text-xs font-medium ${n.read ? 'text-gray-300' : 'text-white'}`}>{n.title}</h4>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{n.message}</p>
            </div>
          ))
        )}
      </div>
      {notifications.length > 0 && (
        <div className="p-2 border-t border-[#2A2B2F] bg-[#1A1B1E]">
          <button className="w-full py-2 text-[10px] text-[#00F2FF] hover:bg-[#00F2FF]/10 rounded transition-colors uppercase tracking-wider font-semibold">
            Clear All
          </button>
        </div>
      )}
    </motion.div>
  );
};

const SystemSettings = ({ userProfile, onUpdateSettings }: { 
  userProfile: UserProfile | null, 
  onUpdateSettings: (updates: Partial<UserProfile>) => void 
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#1A1B1E] p-4 rounded-xl border border-[#2A2B2F]">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#00F2FF]" />
          Security Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#151619] rounded-lg border border-[#2A2B2F]">
            <div>
              <p className="text-sm text-white">Two-Factor Authentication</p>
              <p className="text-xs text-gray-500">Secure your account with 2FA</p>
            </div>
            <button 
              onClick={() => onUpdateSettings({ twoFactorEnabled: !userProfile?.twoFactorEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${userProfile?.twoFactorEnabled ? 'bg-[#00F2FF]' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${userProfile?.twoFactorEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#151619] rounded-lg border border-[#2A2B2F]">
            <div>
              <p className="text-sm text-white">Biometric Login</p>
              <p className="text-xs text-gray-500">Use fingerprint or face ID</p>
            </div>
            <button 
              onClick={() => onUpdateSettings({ biometricEnabled: !userProfile?.biometricEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${userProfile?.biometricEnabled ? 'bg-[#00F2FF]' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${userProfile?.biometricEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1B1E] p-4 rounded-xl border border-[#2A2B2F]">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#00F2FF]" />
          Notification Preferences
        </h3>
        <div className="space-y-3">
          {['Sales Alerts', 'Inventory Warnings', 'AI Activity', 'System Updates'].map(pref => (
            <div key={pref} className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{pref}</span>
              <button className="w-10 h-5 rounded-full bg-[#00F2FF] relative">
                <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LiveWallpaper = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let w: number, h: number;
    const particles: any[] = [];
    const particleCount = 60;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    class Particle {
      x: number; y: number; vx: number; vy: number; size: number;
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
      }
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 242, 0.3)';
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0, 255, 242, 0.05)';
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-40" />;
};

const SocialConnectCenter = ({ accounts, activities, onConnect, onDisconnect }: { accounts: SocialAccount[], activities: SocialActivity[], onConnect: (id: string, status?: any, selectedPage?: string) => void, onDisconnect: (id: string) => void }) => {
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState(1); // 1: Credentials, 2: OTP/2FA, 3: Page Selection
  const [loginData, setLoginData] = useState({ username: '', password: '', phone: '', otp: '' });
  const [availablePages, setAvailablePages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');

  const handleLogin = (id: string) => {
    setShowLoginModal(id);
    setLoginStep(1);
    setLoginData({ username: '', password: '', phone: '', otp: '' });
  };

  const nextStep = () => {
    if (loginStep === 1) {
      setLoginStep(2);
    } else if (loginStep === 2) {
      // Simulate fetching pages/accounts after successful 2FA
      const platform = accounts.find(a => a.id === showLoginModal)?.platform;
      let pages: string[] = [];
      if (platform === 'Facebook') pages = ['Fashion Hub BD', 'Tech Gadgets Store', 'Personal Blog'];
      else if (platform === 'Instagram') pages = ['@fashion_hub_official', '@tech_gadgets_store'];
      else if (platform === 'WhatsApp') pages = ['Business Account (+88017...)'];
      else if (platform === 'TikTok') pages = ['FashionHub_TikTok', 'TechReviews_BD'];
      else pages = ['Default Profile'];
      
      setAvailablePages(pages);
      setSelectedPage(pages[0]);
      setLoginStep(3);
    }
  };

  const submitLogin = (id: string) => {
    setIsLoggingIn(id);
    setShowLoginModal(null);
    
    // Simulate network delay
    setTimeout(() => {
      if (loginData.password === 'wrong' || loginData.otp === '0000') {
        onConnect(id, 'Wrong Login');
      } else {
        onConnect(id, 'Connected', selectedPage);
      }
      setIsLoggingIn(null);
      setLoginData({ username: '', password: '', phone: '', otp: '' });
      setLoginStep(1);
      setAvailablePages([]);
      setSelectedPage('');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neon-cyan">Social Connect Center</h3>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <Globe size={12} /> Authentic API Integration Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-neon-cyan/30 transition-all group relative overflow-hidden">
            {isLoggingIn === account.id && (
              <div className="absolute inset-0 bg-space-black/80 flex flex-col items-center justify-center z-10">
                <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-[10px] font-mono text-neon-cyan">Authenticating...</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">{account.icon}</div>
                <div>
                  <div className="font-medium">{account.platform}</div>
                  {account.selectedPage && (
                    <div className="text-[10px] text-neon-cyan font-mono">{account.selectedPage}</div>
                  )}
                </div>
              </div>
              <div className={`text-[10px] px-2 py-0.5 rounded-full ${
                account.status === 'Connected' ? 'bg-emerald-500/20 text-emerald-400' : 
                account.status === 'Wrong Login' ? 'bg-red-500/20 text-red-400' :
                account.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-white/10 text-white/40'
              }`}>
                {account.status}
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleLogin(account.id)}
                disabled={account.status === 'Connected'}
                className={`flex-1 py-2 text-xs rounded transition-all flex items-center justify-center gap-2 ${
                  account.status === 'Connected' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default' 
                  : 'bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/20 text-neon-cyan'
                }`}
              >
                {account.status === 'Connected' ? <><CheckCircle2 size={12} /> Active</> : 'Login'}
              </button>
              
              {account.status === 'Connected' && (
                <button 
                  onClick={() => onDisconnect(account.id)}
                  className="px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-all"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>

            {account.status === 'Connected' && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <Cpu size={10} className="text-neon-cyan" /> AI Managed
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" title="AI Posting Active" />
                  <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-pulse [animation-delay:0.2s]" title="AI Replying Active" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Activity Log */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
          <Zap size={12} className="text-neon-cyan" /> AI Social Activity Log
        </h4>
        <div className="bg-black/40 border border-white/10 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
          {activities.length > 0 ? activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 text-[10px] border-b border-white/5 pb-2 last:border-0">
              <div className="p-1 bg-white/5 rounded text-neon-cyan shrink-0">
                {act.action === 'Post' ? <Share2 size={10} /> : act.action === 'Message' ? <MessageSquare size={10} /> : <MessageCircle size={10} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white/60">{act.platform} - {act.action}</span>
                  <span className="text-white/20">{act.timestamp}</span>
                </div>
                <p className="text-white/40 italic">"{act.content}"</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-4 text-[10px] text-white/20 italic">No AI activity detected yet. Login to start AI management.</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-space-black border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl shadow-neon-cyan/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg">
                    {accounts.find(a => a.id === showLoginModal)?.icon}
                  </div>
                  <h4 className="text-lg font-bold">
                    {loginStep === 3 ? "Select Page/Account" : `Login to ${accounts.find(a => a.id === showLoginModal)?.platform}`}
                  </h4>
                </div>
                <button onClick={() => setShowLoginModal(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
              </div>
              
              <p className="text-xs text-white/40">
                {loginStep === 1 
                  ? (showLoginModal.includes('wa') ? "Enter your phone number to receive a verification code." : "Enter your credentials to allow AGX AI to manage this account.")
                  : loginStep === 2 
                  ? "Enter the 2-Factor Authentication (2FA) code sent to your device."
                  : "Choose the specific page or sub-account you want the AI to manage."
                }
              </p>
              
              <div className="space-y-3">
                {loginStep === 1 ? (
                  <>
                    {showLoginModal.includes('wa') ? (
                      <div className="space-y-1">
                        <label className="text-[10px] text-white/30 uppercase">Phone Number</label>
                        <input 
                          type="tel" 
                          value={loginData.phone}
                          onChange={e => setLoginData({...loginData, phone: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs focus:border-neon-cyan/50 outline-none" 
                          placeholder="+880 1XXX XXXXXX"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] text-white/30 uppercase">Username / Email</label>
                          <input 
                            type="text" 
                            value={loginData.username}
                            onChange={e => setLoginData({...loginData, username: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs focus:border-neon-cyan/50 outline-none" 
                            placeholder="merchant@social.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-white/30 uppercase">Password</label>
                          <input 
                            type="password" 
                            value={loginData.password}
                            onChange={e => setLoginData({...loginData, password: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs focus:border-neon-cyan/50 outline-none" 
                            placeholder="••••••••"
                          />
                        </div>
                      </>
                    )}
                    <button 
                      onClick={nextStep}
                      className="w-full py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/80 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      Next <ArrowRight size={16} />
                    </button>
                  </>
                ) : loginStep === 2 ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/30 uppercase">2FA Verification Code</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        value={loginData.otp}
                        onChange={e => setLoginData({...loginData, otp: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded p-3 text-center text-xl tracking-[0.5em] font-bold focus:border-neon-cyan/50 outline-none" 
                        placeholder="000000"
                      />
                      <p className="text-[8px] text-white/20 text-center">Tip: Use '0000' to simulate a failed verification.</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setLoginStep(1)}
                        className="flex-1 py-3 bg-white/5 text-white font-bold rounded-lg hover:bg-white/10 transition-all text-sm"
                      >
                        Back
                      </button>
                      <button 
                        onClick={nextStep}
                        className="flex-1 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/80 transition-all text-sm"
                      >
                        Verify 2FA
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-white/30 uppercase">Available Pages / Accounts</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {availablePages.map(page => (
                          <div 
                            key={page}
                            onClick={() => setSelectedPage(page)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                              selectedPage === page 
                              ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' 
                              : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
                            }`}
                          >
                            <span className="text-xs font-medium">{page}</span>
                            {selectedPage === page && <CheckCircle2 size={14} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setLoginStep(2)}
                        className="flex-1 py-3 bg-white/5 text-white font-bold rounded-lg hover:bg-white/10 transition-all text-sm"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => submitLogin(showLoginModal)}
                        className="flex-1 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/80 transition-all text-sm"
                      >
                        Connect Page
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Inventory = ({ items, onAdd, onRemove, onGeneratePost }: { items: InventoryItem[], onAdd: (item: InventoryItem) => void, onRemove: (id: string) => void, onGeneratePost: (item: InventoryItem) => void }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', stock: 0, price: 0, discount: 0, minPrice: 0, imageUrl: '' });

  const handleAdd = () => {
    if (newItem.name && newItem.stock >= 0 && newItem.price >= 0) {
      const finalItem = {
        ...newItem,
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: newItem.imageUrl || `https://picsum.photos/seed/${newItem.name}/200/200`
      };
      onAdd(finalItem);
      setNewItem({ name: '', stock: 0, price: 0, discount: 0, minPrice: 0, imageUrl: '' });
      setShowAdd(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem({ ...newItem, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-emerald-accent">Inventory Management</h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all"
        >
          <Plus size={18} />
        </button>
      </div>
      
      {showAdd && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
          <div className="flex gap-3">
            <div className="relative w-16 h-16 rounded bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group">
              {newItem.imageUrl ? (
                <img src={newItem.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <ImageIcon size={24} className="text-white/20" />
              )}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Camera size={16} className="text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <input 
                type="text" 
                placeholder="Product Name" 
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500/50" 
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase">Stock</label>
                  <input 
                    type="number" 
                    placeholder="Stock" 
                    value={newItem.stock || ''}
                    onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500/50" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase">Price ($)</label>
                  <input 
                    type="number" 
                    placeholder="Price" 
                    value={newItem.price || ''}
                    onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})}
                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500/50" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/30 uppercase">Discount (%)</label>
              <input 
                type="number" 
                placeholder="Discount"
                value={newItem.discount || ''}
                onChange={e => setNewItem({...newItem, discount: parseFloat(e.target.value) || 0})}
                className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500/50" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/30 uppercase">Min Price ($)</label>
              <input 
                type="number" 
                placeholder="Min Price"
                value={newItem.minPrice || ''}
                onChange={e => setNewItem({...newItem, minPrice: parseFloat(e.target.value) || 0})}
                className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-emerald-500/50" 
              />
            </div>
          </div>

          <button 
            onClick={handleAdd}
            className="w-full py-2 bg-emerald-500 text-black font-bold rounded hover:bg-emerald-400 transition-all text-xs"
          >
            Add Product to AI Catalog
          </button>
        </motion.div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
        <input 
          type="text" 
          placeholder="Search products..." 
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-neon-cyan/50"
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/20 transition-all group">
            <div className="w-10 h-10 rounded bg-white/5 border border-white/10 overflow-hidden shrink-0">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{item.name}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/40">
                <span>Stock: {item.stock}</span>
                <span className="text-emerald-400">Min: ${item.minPrice}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-mono text-neon-cyan">${item.price.toFixed(2)}</div>
                {item.discount > 0 && <div className="text-[10px] text-emerald-400">-{item.discount}%</div>}
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onGeneratePost(item)}
                  className="p-1 text-neon-cyan hover:bg-neon-cyan/20 rounded"
                  title="Generate AI Post"
                >
                  <Share2 size={12} />
                </button>
                <button 
                  onClick={() => onRemove(item.id)} 
                  className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                  title="Remove Product"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TaliKhata = ({ transactions }: { transactions: Transaction[] }) => {
  const totalSales = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-neon-cyan">Smart Tali-Khata</h3>
        <div className="text-xs text-emerald-400 flex items-center gap-1">
          <TrendingUp size={14} /> +12.5% this week
        </div>
      </div>

      <div className="h-32 w-full mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="sales" stroke="#00f2ff" fillOpacity={1} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="text-[10px] text-emerald-400/70 uppercase">Total Sales</div>
          <div className="text-xl font-mono font-bold">${totalSales.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg">
          <div className="text-[10px] text-neon-cyan/70 uppercase">Orders</div>
          <div className="text-xl font-mono font-bold">{transactions.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Recent Transactions</div>
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-white/40 font-mono">{tx.channel}</span>
              <div>
                <div className="font-medium">{tx.customer}</div>
                <div className="text-[10px] text-white/30">{tx.id}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-emerald-400 font-mono">+${tx.amount.toFixed(2)}</div>
              <div className="text-[10px] text-white/30">{tx.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const AISettings = ({ inventory, transactions, promptOverride }: { inventory: InventoryItem[], transactions: Transaction[], promptOverride?: string | null }) => {
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I am your AI Sales Agent. I have analyzed your inventory and sales data. How can I help you grow your business today?' }
  ]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (promptOverride) {
      setInput(promptOverride);
    }
  }, [promptOverride]);

  const generateAIResponse = async (userPrompt: string) => {
    setIsTyping(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const inventoryContext = inventory.map(item => `${item.name}: ${item.stock} in stock, price $${item.price}, discount ${item.discount}%, min price $${item.minPrice}`).join('\n');
      const salesContext = `Total Sales: $${transactions.reduce((acc, curr) => acc + curr.amount, 0)}, Total Orders: ${transactions.length}`;

      const systemInstruction = `
        You are the AI Sales Agent for AGX AI Sales OS. 
        Your goal is to be professional, persuasive, and helpful to merchants.
        
        You manage all social media interactions (Facebook, Instagram, WhatsApp, X, TikTok, LinkedIn, Red X, YouTube).
        Your tasks include:
        1. Posting engaging content about products.
        2. Replying to messages and comments.
        3. Persuading customers to buy products ("Customer Potano").
        
        NEGOTIATION RULES:
        - You can offer discounts up to the product's listed discount percentage.
        - NEVER sell below the "min price" (floor price) specified in the inventory.
        - Use persuasive language, be friendly but firm on the floor price.
        
        CURRENT BUSINESS DATA:
        INVENTORY:
        ${inventoryContext}
        
        SALES SUMMARY:
        ${salesContext}
        
        Use this data to provide specific advice or simulate customer interactions.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      
      const aiText = response.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'ai', content: aiText }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "Error: AI Brain connection lost. Please check your API configuration." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    generateAIResponse(userMsg);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center gap-3 p-3 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg">
        <Cpu className="text-neon-cyan" />
        <div>
          <div className="text-sm font-bold">AI Brain Status: Active</div>
          <div className="text-[10px] text-white/50">Personality: Professional & Persuasive</div>
        </div>
      </div>

      <div className="flex-1 bg-black/40 rounded-lg p-4 border border-white/10 overflow-y-auto space-y-3 flex flex-col min-h-[200px]">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-[85%] p-3 rounded-lg text-xs leading-relaxed ${
            msg.role === 'ai' 
            ? 'bg-neon-cyan/10 self-start border-l-2 border-neon-cyan text-white/90' 
            : 'bg-white/10 self-end text-white/90'
          }`}>
            {msg.content}
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-[10px] text-neon-cyan animate-pulse">
            <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce" />
            <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.4s]" />
            AI is analyzing data...
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI about your business..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-neon-cyan/50"
        />
        <button 
          onClick={handleSend}
          disabled={isTyping}
          className="p-2 bg-neon-cyan text-black rounded-lg hover:bg-neon-cyan/80 transition-all disabled:opacity-50"
        >
          <MessageSquare size={18} />
        </button>
      </div>
    </div>
  );
};

const SMSGateway = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Smartphone className="text-white/60" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        </div>
        <div>
          <div className="text-sm font-bold">SIM Gateway: Connected</div>
          <div className="text-[10px] text-emerald-400">Signal: Excellent (4G)</div>
        </div>
      </div>
      <Power className="text-emerald-500" size={20} />
    </div>

    <div className="space-y-4">
      <h4 className="text-xs text-white/40 uppercase">Fallback SMS System</h4>
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-xs text-yellow-200/80">
          If your internet connection drops, the system will automatically route notifications via your connected Android SIM Gateway.
        </p>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>SMS Credits Remaining</span>
          <span>450 / 500</span>
        </div>
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: '90%' }} />
        </div>
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [windows, setWindows] = useState<WindowState[]>([
    { id: 'social', title: 'Social Connect', isOpen: false, isMinimized: false, zIndex: 1, icon: <Globe size={16} /> },
    { id: 'inventory', title: 'Inventory', isOpen: false, isMinimized: false, zIndex: 1, icon: <Package size={16} /> },
    { id: 'ledger', title: 'Tali-Khata', isOpen: true, isMinimized: false, zIndex: 10, icon: <BookOpen size={16} /> },
    { id: 'ai', title: 'AI Brain', isOpen: false, isMinimized: false, zIndex: 1, icon: <Cpu size={16} /> },
    { id: 'sms', title: 'SMS Gateway', isOpen: false, isMinimized: false, zIndex: 1, icon: <Smartphone size={16} /> },
    { id: 'profile', title: 'Merchant Profile', isOpen: false, isMinimized: false, zIndex: 1, icon: <User size={16} /> },
    { id: 'settings', title: 'Settings', isOpen: false, isMinimized: false, zIndex: 1, icon: <Settings size={16} /> },
  ]);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialActivities, setSocialActivities] = useState<SocialActivity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const [maxZIndex, setMaxZIndex] = useState(10);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [aiPromptOverride, setAiPromptOverride] = useState<string | null>(null);

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        // Sync user profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          const newProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Merchant',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            role: 'user',
            plan: 'Free'
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userDoc.data());
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Firestore Sync ---
  useEffect(() => {
    if (!user || !isAuthReady) {
      setInventory([]);
      setTransactions([]);
      setSocialAccounts([]);
      return;
    }

    const inventoryQuery = query(collection(db, 'inventory'), where('uid', '==', user.uid));
    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryItem)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inventory'));

    const txQuery = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const socialQuery = query(collection(db, 'socialAccounts'), where('uid', '==', user.uid));
    const unsubSocial = onSnapshot(socialQuery, (snapshot) => {
      const accounts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      // Map icons back since they can't be stored in Firestore
      const mappedAccounts = accounts.map(acc => ({
        ...acc,
        icon: acc.platform === 'Facebook' ? <Facebook className="text-blue-500" /> :
              acc.platform === 'WhatsApp' ? <MessageCircle className="text-green-500" /> :
              acc.platform === 'TikTok' ? <Share2 className="text-pink-500" /> :
              acc.platform === 'Instagram' ? <MessageSquare className="text-purple-500" /> :
              acc.platform === 'X' ? <X className="text-white" /> :
              acc.platform === 'LinkedIn' ? <Globe className="text-blue-400" /> :
              acc.platform === 'Red X' ? <X className="text-red-500" /> :
              acc.platform === 'YouTube' ? <Share2 className="text-red-600" /> :
              <MessageSquare className="text-purple-500" />
      }));
      setSocialAccounts(mappedAccounts);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'socialAccounts'));

    const activityQuery = query(collection(db, 'socialActivities'), where('uid', '==', user.uid));
    const unsubActivity = onSnapshot(activityQuery, (snapshot) => {
      setSocialActivities(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SocialActivity)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'socialActivities'));

    const notificationQuery = query(collection(db, 'notifications'), where('uid', '==', user.uid));
    const unsubNotifications = onSnapshot(notificationQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubInventory();
      unsubTx();
      unsubSocial();
      unsubActivity();
      unsubNotifications();
      unsubProfile();
    };
  }, [user, isAuthReady]);

  const addNotification = async (title: string, message: string, type: Notification['type'] = 'info') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        title,
        message,
        type,
        read: false,
        timestamp: new Date().toISOString(),
        uid: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notifications/${id}`);
    }
  };

  const updateUserSettings = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      addNotification('Settings Updated', 'Your security preferences have been saved.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleWindow = (id: WindowID) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const newZ = maxZIndex + 1;
        setMaxZIndex(newZ);
        return { ...w, isOpen: !w.isOpen, isMinimized: false, zIndex: newZ };
      }
      return w;
    }));
  };

  const focusWindow = (id: WindowID) => {
    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: newZ } : w));
  };

  const closeWindow = (id: WindowID) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
  };

  const connectAccount = async (id: string, status: any = 'Connected') => {
    if (!user) return;
    try {
      const acc = socialAccounts.find(a => a.id.endsWith(`_${id}`)) || [
        { id: 'fb', platform: 'Facebook', name: 'FB Business' },
        { id: 'wa', platform: 'WhatsApp', name: 'WA Business' },
        { id: 'tk', platform: 'TikTok', name: 'TK Shop' },
        { id: 'ig', platform: 'Instagram', name: 'IG Direct' },
        { id: 'x', platform: 'X', name: 'X Pro' },
        { id: 'li', platform: 'LinkedIn', name: 'LI Talent' },
        { id: 'rx', platform: 'Red X', name: 'Red X Elite' },
        { id: 'yt', platform: 'YouTube', name: 'YT Studio' },
      ].find(a => a.id === id);

      if (acc) {
        const docId = `${user.uid}_${id}`;
        const accRef = doc(db, 'socialAccounts', docId);
        await setDoc(accRef, {
          id: docId,
          platform: acc.platform,
          name: acc.name,
          status,
          uid: user.uid
        });

        // Add a simulated AI activity when connected
        if (status === 'Connected') {
          await addDoc(collection(db, 'socialActivities'), {
            platform: acc.platform,
            action: 'Post',
            content: `AI initialized management for ${acc.platform}. Scanning for customer queries...`,
            timestamp: new Date().toLocaleTimeString(),
            uid: user.uid
          });
          addNotification('Account Connected', `Successfully connected to ${acc.platform}. AI is now managing your account.`, 'success');
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `socialAccounts/${id}`);
    }
  };

  const disconnectAccount = async (id: string) => {
    if (!user) return;
    try {
      const docId = id.includes(user.uid) ? id : `${user.uid}_${id}`;
      const accRef = doc(db, 'socialAccounts', docId);
      await updateDoc(accRef, { status: 'Disconnected' });
      addNotification('Account Disconnected', 'Social media account has been disconnected.', 'warning');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialAccounts/${id}`);
    }
  };

  const addInventory = async (item: InventoryItem) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'inventory', item.id), { ...item, uid: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `inventory/${item.id}`);
    }
  };

  const removeInventory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-space-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-neon-cyan text-xs tracking-widest animate-pulse">BOOTING AGX AI OS...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-space-black relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neon-cyan/10 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-neon-cyan rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,242,255,0.3)]">
              <Layout size={40} className="text-black" />
            </div>
            <h1 className="text-4xl font-bold font-mono tracking-tighter text-white">AGX AI SALES OS</h1>
            <p className="text-white/40 max-w-xs mx-auto text-sm">The futuristic operating system for the next generation of global merchants.</p>
          </div>

          <button 
            onClick={handleLogin}
            className="group relative px-8 py-4 bg-white text-black font-bold rounded-xl flex items-center gap-3 mx-auto hover:bg-neon-cyan transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <LogIn size={20} />
            Login with Merchant ID
          </button>

          <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">
            Secure Biometric Authentication Enabled
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-space-black selection:bg-neon-cyan/30">
      <LiveWallpaper />
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-accent/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <header className="h-12 glass-effect flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-neon-cyan rounded flex items-center justify-center">
              <Layout size={14} className="text-black" />
            </div>
            <span className="font-mono font-bold text-neon-cyan tracking-tighter">AGX AI OS</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
            <Wifi size={12} className="text-emerald-500" />
            <span>SERVER: SINGAPORE-01</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-2">
              <Signal size={12} className="text-emerald-500" />
              <span>LATENCY: 24ms</span>
            </div>
            <div className="text-white/40">{currentTime.toLocaleTimeString()}</div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 hover:bg-white/5 rounded-full relative"
            >
              <Bell size={18} />
              {notifications.filter(n => !n.read).length > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-space-black" />
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel 
                  notifications={notifications} 
                  onClose={() => setShowNotifications(false)}
                  onMarkAsRead={markNotificationAsRead}
                />
              )}
            </AnimatePresence>
            <div 
              onClick={() => toggleWindow('profile')}
              className="flex items-center gap-3 pl-3 border-l border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold">{userProfile?.displayName || user.displayName}</div>
                <div className="text-[10px] text-emerald-400">Plan: {userProfile?.plan || 'Enterprise'}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-emerald-accent p-[1px]">
                <div className="w-full h-full rounded-full bg-space-black flex items-center justify-center overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={16} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Area */}
      <main className="flex-1 relative p-6">
        {/* Desktop Shortcuts */}
        <div className="grid grid-flow-row grid-cols-1 gap-6 w-24">
          {windows.filter(w => w.id !== 'profile' && w.id !== 'settings').map((win) => (
            <button
              key={win.id}
              onClick={() => toggleWindow(win.id)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-xl glass-effect flex items-center justify-center group-hover:bg-neon-cyan/10 group-hover:border-neon-cyan/40 transition-all">
                <div className="text-neon-cyan group-hover:scale-110 transition-transform">
                  {win.icon}
                </div>
              </div>
              <span className="text-[10px] font-mono text-white/60 group-hover:text-neon-cyan uppercase tracking-wider text-center">
                {win.title}
              </span>
            </button>
          ))}
          <button
            onClick={() => toggleWindow('settings')}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-xl glass-effect flex items-center justify-center group-hover:bg-neon-cyan/10 group-hover:border-neon-cyan/40 transition-all">
              <div className="text-neon-cyan group-hover:scale-110 transition-transform">
                <Settings size={16} />
              </div>
            </div>
            <span className="text-[10px] font-mono text-white/60 group-hover:text-neon-cyan uppercase tracking-wider text-center">
              Settings
            </span>
          </button>
        </div>

        {/* Windows Manager */}
        <AnimatePresence>
          {windows.map((win) => win.isOpen && (
            <Window
              key={win.id}
              id={win.id}
              title={win.title}
              icon={win.icon}
              zIndex={win.zIndex}
              onClose={() => closeWindow(win.id)}
              onFocus={() => focusWindow(win.id)}
            >
              {win.id === 'social' && (() => {
                const allPlatforms = [
                  { id: 'fb', platform: 'Facebook', name: 'FB Business', icon: <Facebook className="text-blue-500" /> },
                  { id: 'wa', platform: 'WhatsApp', name: 'WA Business', icon: <MessageCircle className="text-green-500" /> },
                  { id: 'tk', platform: 'TikTok', name: 'TK Shop', icon: <Share2 className="text-pink-500" /> },
                  { id: 'ig', platform: 'Instagram', name: 'IG Direct', icon: <MessageSquare className="text-purple-500" /> },
                  { id: 'x', platform: 'X', name: 'X Pro', icon: <X className="text-white" /> },
                  { id: 'li', platform: 'LinkedIn', name: 'LI Talent', icon: <Globe className="text-blue-400" /> },
                  { id: 'rx', platform: 'Red X', name: 'Red X Elite', icon: <X className="text-red-500" /> },
                  { id: 'yt', platform: 'YouTube', name: 'YT Studio', icon: <Share2 className="text-red-600" /> },
                ];

                const mergedSocialAccounts = allPlatforms.map(platform => {
                  const connected = socialAccounts.find(a => a.platform === platform.platform);
                  return connected ? connected : { ...platform, status: 'Disconnected' };
                });

                return <SocialConnectCenter accounts={mergedSocialAccounts} activities={socialActivities} onConnect={connectAccount} onDisconnect={disconnectAccount} />;
              })()}
              {win.id === 'inventory' && <Inventory items={inventory} onAdd={addInventory} onRemove={removeInventory} onGeneratePost={(item) => {
                setAiPromptOverride(`Generate a persuasive social media post for ${item.name}. Price: $${item.price}, Discount: ${item.discount}%. Highlight why customers should buy it now.`);
                toggleWindow('ai');
              }} />}
              {win.id === 'ledger' && <TaliKhata transactions={transactions} />}
              {win.id === 'ai' && <AISettings inventory={inventory} transactions={transactions} promptOverride={aiPromptOverride} />}
              {win.id === 'sms' && <SMSGateway />}
              {win.id === 'settings' && <SystemSettings userProfile={userProfile} onUpdateSettings={updateUserSettings} />}
              {win.id === 'profile' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon-cyan to-emerald-accent p-1 shadow-lg shadow-neon-cyan/20">
                        <div className="w-full h-full rounded-full bg-space-black flex items-center justify-center overflow-hidden">
                          {userProfile?.photoURL || user.photoURL ? (
                            <img src={userProfile?.photoURL || user.photoURL || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User size={48} className="text-white/20" />
                          )}
                        </div>
                      </div>
                      <label className="absolute bottom-0 right-0 p-2 bg-neon-cyan text-black rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                        <Camera size={16} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                const base64 = reader.result as string;
                                await updateUserSettings({ photoURL: base64 });
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        {userProfile?.displayName || user.displayName}
                      </h3>
                      <p className="text-[10px] text-neon-cyan font-mono uppercase tracking-[0.2em] mt-1">Verified Merchant</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-3 bg-white/5 rounded border border-white/5 flex justify-between items-center">
                      <span className="text-xs text-white/60">Subscription</span>
                      <span className="text-xs font-bold text-emerald-400">{userProfile?.plan || 'Enterprise'}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded border border-white/5 flex justify-between items-center">
                      <span className="text-xs text-white/60">Connected Channels</span>
                      <span className="text-xs font-bold">{socialAccounts.filter(a => a.status === 'Connected').length} / 10</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded border border-white/5 flex justify-between items-center">
                      <span className="text-xs text-white/60">AI Tokens Used</span>
                      <span className="text-xs font-bold">1.2M</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut size={14} /> Logout System
                  </button>
                </div>
              )}
            </Window>
          ))}
        </AnimatePresence>
      </main>

      {/* Taskbar */}
      <footer className="h-14 glass-effect flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-lg bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/30 transition-all">
            <Layout size={20} />
          </button>
          <div className="h-6 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            {windows.filter(w => w.isOpen).map(win => (
              <button
                key={win.id}
                onClick={() => focusWindow(win.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all border ${
                  win.zIndex === maxZIndex ? 'bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan' : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                {win.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] font-mono text-white/30 text-center hidden md:block">
          AGX AI OS | Powering Global Merchants | Developed by Golam Rabbi
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </div>
            <div className="text-[8px] font-mono text-white/20">v2.4.0-STABLE</div>
          </div>
          <Settings 
            onClick={() => toggleWindow('settings')}
            size={18} className="text-white/40 hover:text-neon-cyan cursor-pointer transition-colors" 
          />
        </div>
      </footer>
    </div>
  );
}
