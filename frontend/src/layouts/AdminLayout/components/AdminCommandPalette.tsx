import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  Search, Command, ArrowRight, UserPlus, FilePlus, ShieldAlert, 
  BarChart3, Users, Network, CreditCard, Sparkles, UserX, CheckCircle, X, CornerDownLeft
} from 'lucide-react';
import { NavigationTab } from '../../../types/api';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: NavigationTab) => void;
}

type CommandItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  group: string;
  action: () => void;
  color?: string;
};

import { usePermissions } from '../../../context/PermissionsContext';

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({ isOpen, onClose, setActiveTab }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [aiState, setAiState] = useState<'idle' | 'suspend-confirm'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { hasPermission } = usePermissions();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setSelectedIndex(0);
      setAiState('idle');
    }
  }, [isOpen]);

  // Global Ctrl+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (tab: NavigationTab) => {
    setActiveTab(tab);
    onClose();
  };

  const handleAction = (action: string) => {
    alert(`Triggered Admin Action: ${action}`);
    onClose();
  };

  const ALL_COMMANDS: CommandItem[] = useMemo(() => {
    const commands: CommandItem[] = [];
    
    if (hasPermission('VIEW_ANALYTICS_DASHBOARD')) commands.push({ id: 'nav-overview', label: 'Platform Overview', icon: BarChart3, group: 'Navigation', action: () => navigateTo('admin-overview') });
    if (hasPermission('VIEW_USERS')) commands.push({ id: 'nav-users', label: 'User Management', icon: Users, group: 'Navigation', action: () => navigateTo('admin-users') });
    if (hasPermission('VIEW_APIS') || hasPermission('CURATE_MARKETPLACE_FEATURED')) commands.push({ id: 'nav-apis', label: 'API & Marketplace', icon: Network, group: 'Navigation', action: () => navigateTo('admin-apis') });
    if (hasPermission('VIEW_BILLING_INVOICES') || hasPermission('VIEW_SUBSCRIPTIONS')) commands.push({ id: 'nav-billing', label: 'Billing & Payments', icon: CreditCard, group: 'Navigation', action: () => navigateTo('admin-billing') });
    if (hasPermission('VIEW_SYSTEM_LOGS') || hasPermission('VIEW_SECURITY_CENTER')) commands.push({ id: 'nav-reports', label: 'Reports & Security', icon: ShieldAlert, group: 'Navigation', action: () => navigateTo('admin-activity') });
    
    if (hasPermission('EDIT_USER')) commands.push({ id: 'action-user', label: 'Create New User', icon: UserPlus, group: 'Actions', action: () => handleAction('Create New User'), color: '#3b82f6' });
    if (hasPermission('APPROVE_REJECT_APIS')) commands.push({ id: 'action-api', label: 'Approve Pending APIs', icon: FilePlus, group: 'Actions', action: () => handleAction('Approve Pending APIs'), color: '#22c55e' });
    if (hasPermission('TOGGLE_MAINTENANCE_MODE')) commands.push({ id: 'action-maint', label: 'Toggle Maintenance Mode', icon: ShieldAlert, group: 'Actions', action: () => handleAction('Maintenance Mode'), color: '#f59e0b' });
    
    return commands;
  }, [hasPermission, navigateTo]);

  // Filter commands and inject AI intents
  const filteredCommands = useMemo(() => {
    let results = ALL_COMMANDS;
    if (query) {
      results = results.filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));
    }

    // AI Intent Injection
    if (query.toLowerCase().includes('suspend') || query.toLowerCase().includes('unpaid')) {
      results.unshift({
        id: 'ai-suspend',
        label: 'Suspend all users with unpaid invoices',
        icon: Sparkles,
        group: 'AI Actions',
        color: '#a78bfa',
        action: () => setAiState('suspend-confirm')
      });
    }

    return results;
  }, [query, ALL_COMMANDS]);

  // Group the results
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => {
    return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  useEffect(() => {
    setSelectedIndex(0); // Reset selection on query change
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (aiState !== 'idle') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAiState('idle');
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        alert('Executed AI Action: Suspended 4 users.');
        onClose();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && flatItems.length > 0) {
      e.preventDefault();
      flatItems[selectedIndex].action();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      
      <div 
        className="w-full max-w-2xl bg-[#0a0a0f]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transform transition-all duration-300"
        style={{ animation: 'paletteSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        
        {/* Input Header */}
        <div className="flex items-center px-6 py-4 border-b border-white/5 relative">
          {aiState === 'idle' ? (
            <Search size={24} className="text-white/40" />
          ) : (
            <Sparkles size={24} className="text-purple-400 animate-pulse" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={aiState === 'idle' ? "Ask AI, search commands, or go to..." : "Confirming AI Action..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={aiState !== 'idle'}
            className="flex-1 bg-transparent border-none text-white text-xl font-light outline-none ml-4 placeholder-white/20 disabled:opacity-50"
          />
          {aiState === 'idle' && (
            <div className="flex items-center gap-1 text-white/30 text-xs bg-white/5 px-2 py-1 rounded-md">
              <Command size={12} /> K
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
          
          {aiState === 'suspend-confirm' ? (
            <div className="p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-white/80 text-sm bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-start gap-3">
                <Sparkles size={18} className="text-purple-400 mt-0.5 shrink-0" />
                <p>I found <strong>4 users</strong> with unpaid invoices exceeding 30 days. Would you like to suspend their API access immediately?</p>
              </div>
              
              <div className="flex flex-col gap-2">
                {['Acme Corp', 'Globex Inc', 'Initech', 'Soylent Corp'].map((company, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                        <UserX size={14} />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{company}</div>
                        <div className="text-white/40 text-xs">Past due: $4,500.00</div>
                      </div>
                    </div>
                    <div className="text-red-400 text-xs font-semibold uppercase tracking-wider bg-red-500/10 px-2 py-1 rounded">
                      Pending Suspension
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setAiState('idle')} className="px-4 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={() => { alert('Executed!'); onClose(); }} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-500/20 transition-all flex items-center gap-2">
                  <CheckCircle size={16} /> Confirm Suspension (Press Enter)
                </button>
              </div>
            </div>
          ) : (
            // Search Results
            <>
              {Object.keys(groupedCommands).length === 0 ? (
                <div className="p-8 text-center text-white/40 text-sm">
                  No results found for "{query}"
                </div>
              ) : (
                Object.entries(groupedCommands).map(([group, items], groupIndex) => (
                  <div key={group} className="mb-4 last:mb-0">
                    <div className="text-[10px] font-bold text-white/30 px-3 py-2 uppercase tracking-widest sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-md z-10">
                      {group}
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map((item) => {
                        const globalIndex = flatItems.findIndex(i => i.id === item.id);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = item.icon;
                        
                        return (
                          <div
                            key={item.id}
                            ref={el => itemRefs.current[globalIndex] = el}
                            onClick={() => { setSelectedIndex(globalIndex); item.action(); }}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors duration-150 ${
                              isSelected 
                                ? 'bg-white/10 text-white' 
                                : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <Icon 
                              size={18} 
                              className={isSelected && item.group === 'AI Actions' ? 'animate-pulse' : ''}
                              style={{ color: item.color || (isSelected ? '#fff' : 'rgba(255,255,255,0.4)') }} 
                            />
                            <span className="text-sm font-medium">{item.label}</span>
                            
                            {isSelected && (
                              <div className="ml-auto text-white/30 flex items-center gap-1">
                                <CornerDownLeft size={14} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes paletteSlideDown {
          from { opacity: 0; transform: translateY(-20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        /* Thin elegant scrollbar for the palette */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};
