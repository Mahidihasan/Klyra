import React, { useState, useEffect, useRef } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Zap, Box } from 'lucide-react';
import { ApiReviewPane } from './ApiReviewPane';
import toast, { Toaster } from 'react-hot-toast';

type ApiStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ApiRequest {
  id: string;
  name: string;
  provider: string;
  version: string;
  submitted: string;
  status: ApiStatus;
  description: string;
}

const INITIAL_DATA: ApiRequest[] = [
  { id: '1', name: 'Global Payment Gateway', provider: 'Stripe Co.', version: '2.1.0', submitted: '2 hours ago', status: 'PENDING', description: 'Unified payment processing API.' },
  { id: '2', name: 'DeepSeek LLM Inference', provider: 'AI Labs', version: '1.0.0', submitted: '5 hours ago', status: 'PENDING', description: 'Low latency inference.' },
  { id: '3', name: 'Real-time Flight Data', provider: 'AeroAPI', version: '1.4.2', submitted: '1 day ago', status: 'PENDING', description: 'Live tracking of flights.' },
  { id: '4', name: 'Weather Forecast Pro', provider: 'MeteoCorp', version: '3.0.1', submitted: '2 days ago', status: 'APPROVED', description: 'High resolution weather data.' },
  { id: '5', name: 'Legacy Auth V1', provider: 'Internal', version: '1.0.0', submitted: '1 week ago', status: 'REJECTED', description: 'Deprecated authentication method.' },
];

const getAvatarColor = (name: string) => {
  const colors = ['from-indigo-500 to-purple-500', 'from-pink-500 to-rose-500', 'from-emerald-400 to-cyan-400', 'from-amber-400 to-orange-500'];
  const charCode = name.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
};

// Sortable Card Component
const SortableCard = ({ api, onClick, isOverlay = false }: { api: ApiRequest, onClick?: () => void, isOverlay?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: api.id, data: { type: 'ApiRequest', api } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  const statusColors = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const statusDots = {
    PENDING: 'bg-amber-400',
    APPROVED: 'bg-emerald-400',
    REJECTED: 'bg-rose-400'
  };

  const cardContent = (
    <div 
      className={`relative p-4 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 shadow-inner group cursor-grab active:cursor-grabbing overflow-hidden ${isOverlay ? 'shadow-2xl shadow-black/80 ring-1 ring-white/20' : 'hover:bg-white/10'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(api.provider)} flex items-center justify-center text-[12px] font-bold text-white shadow-lg`}>
            {api.provider.charAt(0)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight">{api.name}</h4>
            <span className="text-[11px] font-mono text-white/40">v{api.version}</span>
          </div>
        </div>
        
        {/* Glowing Status Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${statusColors[api.status]} text-[10px] font-bold tracking-wider`}>
          <div className={`w-1.5 h-1.5 rounded-full ${statusDots[api.status]} ${api.status === 'PENDING' ? 'animate-pulse' : ''}`} />
          {api.status}
        </div>
      </div>
      
      <p className="text-[12px] text-white/50 mb-3 line-clamp-2 leading-relaxed">
        {api.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1 text-[11px] text-white/30">
          <Clock size={10} />
          {api.submitted}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-[11px] text-indigo-400 font-semibold hover:text-indigo-300">Review</button>
        </div>
      </div>
    </div>
  );

  if (isOverlay) {
    return (
      <motion.div
        initial={{ rotate: 0, scale: 1 }}
        animate={{ rotate: 2, scale: 1.05 }}
        style={{ cursor: 'grabbing' }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardContent}
    </div>
  );
};

// Column Component
const Column = ({ id, title, icon: Icon, colorClass, apis, onReview }: any) => {
  const { setNodeRef } = useSortable({
    id,
    data: { type: 'Column', id },
  });

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full min-h-[500px] bg-[#12121a]/50 rounded-2xl border border-white/5 overflow-hidden">
      <div className={`p-4 border-b border-white/5 flex items-center justify-between ${colorClass}`}>
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <h3 className="font-semibold text-sm tracking-wide">{title}</h3>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-bold">
          {apis.length}
        </div>
      </div>
      
      <div ref={setNodeRef} className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
        {apis.length === 0 ? (
          <>
            <SortableCardSkeleton />
            <SortableCardSkeleton />
            <SortableCardSkeleton />
          </>
        ) : (
          <SortableContext items={apis.map((a: any) => a.id)} strategy={verticalListSortingStrategy}>
            {apis.map((api: any) => (
              <SortableCard key={api.id} api={api} onClick={() => onReview(api)} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
};

const SortableCardSkeleton = () => (
  <div className="relative p-4 rounded-xl backdrop-blur-md bg-white/5 border border-white/10 shadow-inner overflow-hidden mb-3 last:mb-0">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3 w-full">
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden relative shrink-0">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
        <div className="flex flex-col gap-1.5 w-full">
          <div className="w-24 h-3 bg-white/10 rounded overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
          <div className="w-12 h-2 bg-white/5 rounded overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
      <div className="w-16 h-4 rounded-full bg-white/5 overflow-hidden relative shrink-0">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
    <div className="w-full h-8 bg-white/5 rounded mb-3 overflow-hidden relative">
       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
    </div>
    <div className="flex items-center justify-between mt-auto">
      <div className="w-16 h-2 bg-white/5 rounded overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  </div>
);

export const ApprovalQueue = () => {
  const [apis, setApis] = useState<ApiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingApi, setReviewingApi] = useState<ApiRequest | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<ApiStatus | null>(null);
  
  const originalStatusRef = useRef<ApiStatus | null>(null);

  useEffect(() => {
    const fetchApis = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/apis/queue', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const json = await res.json();
          // Assuming backend returns an array of mapped ApiRequests, or Prisma models
          const data = json.data || json;
          const mapped: ApiRequest[] = Array.isArray(data) ? data.map((api: any) => ({
            id: api.id,
            name: api.endpointPath || api.name || 'Unknown Route',
            provider: 'Internal API',
            version: api.currentVersion || api.version || '1.0.0',
            submitted: 'Just now',
            status: api.status === 'ACTIVE' ? 'APPROVED' : (api.status === 'DEPRECATED' ? 'REJECTED' : (api.status === 'TRIPPED' ? 'PENDING' : api.status || 'PENDING')),
            description: api.description || `Traffic canary weight: ${api.canaryWeight || 0}%`
          })) : [];
          setApis(mapped.length > 0 ? mapped : INITIAL_DATA);
        } else {
          setApis(INITIAL_DATA); // Fallback to mock on error
        }
      } catch (err) {
        setApis(INITIAL_DATA);
      } finally {
        setLoading(false);
      }
    };
    fetchApis();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const pending = apis.filter(a => a.status === 'PENDING');
  const approved = apis.filter(a => a.status === 'APPROVED');
  const rejected = apis.filter(a => a.status === 'REJECTED');

  const activeApi = activeId ? apis.find(a => a.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const activeApi = apis.find(a => a.id === event.active.id);
    if (activeApi) {
      originalStatusRef.current = activeApi.status;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    if (activeId === overId) return;

    const isActiveApi = active.data.current?.type === 'ApiRequest';
    const isOverApi = over.data.current?.type === 'ApiRequest';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveApi) return;

    setApis((prev) => {
      const activeIndex = prev.findIndex(a => a.id === activeId);
      
      if (isOverApi) {
        const overIndex = prev.findIndex(a => a.id === overId);
        const overStatus = prev[overIndex].status;
        
        if (prev[activeIndex].status !== overStatus) {
          const updated = [...prev];
          updated[activeIndex].status = overStatus;
          setActiveColumnId(overStatus); // Trigger glow
          return arrayMove(updated, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      }

      if (isOverColumn) {
        const overStatus = overId as ApiStatus;
        if (prev[activeIndex].status !== overStatus) {
          const updated = [...prev];
          updated[activeIndex].status = overStatus;
          setActiveColumnId(overStatus); // Trigger glow
          return arrayMove(updated, activeIndex, updated.length);
        }
      }

      return prev;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setTimeout(() => setActiveColumnId(null), 1000); // Remove glow after 1s

    const draggedId = event.active.id as string;
    const finalApi = apis.find(a => a.id === draggedId);
    
    if (finalApi && originalStatusRef.current && finalApi.status !== originalStatusRef.current) {
      const newStatus = finalApi.status;
      const originalStatus = originalStatusRef.current;
      
      if (newStatus === 'APPROVED' || newStatus === 'REJECTED') {
        const action = newStatus === 'APPROVED' ? 'APPROVE' : 'REJECT';
        
        const moderatePromise = (async () => {
          const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
          const res = await fetch(`/api/v1/admin/apis/${draggedId}/moderate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action })
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Server rejected moderation');
          }
          return await res.json();
        })();

        toast.promise(moderatePromise, {
          loading: `Applying ${newStatus} status...`,
          success: `API ${newStatus} Successfully`,
          error: (err) => {
            // Revert state on failure
            setApis(prev => prev.map(a => a.id === draggedId ? { ...a, status: originalStatus } : a));
            return `Moderation Failed: ${err.message}`;
          }
        }, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
      }
    }
    
    originalStatusRef.current = null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toaster position="bottom-right" />
      <motion.div 
        className="flex flex-col h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] origin-left"
        style={{ 
          transform: reviewingApi ? 'scale(0.95)' : 'scale(1)',
          opacity: reviewingApi ? 0.4 : 1,
          pointerEvents: reviewingApi ? 'none' : 'auto'
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Box size={20} className="text-indigo-400" />
              API Moderation Queue
            </h2>
            <p className="text-sm text-white/50 mt-1">Drag and drop APIs to review, approve, or reject submissions.</p>
          </div>
        </div>

        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full pb-4">
          <div className={`flex flex-col min-w-0 transition-all duration-500 rounded-2xl ${activeColumnId === 'PENDING' ? 'shadow-[0_0_40px_rgba(245,158,11,0.2)]' : ''}`}>
            <Column 
              id="PENDING" 
              title="Pending Review" 
              icon={Clock} 
              colorClass="text-amber-400 bg-amber-400/5"
              apis={pending}
              onReview={setReviewingApi}
            />
          </div>
          <div className={`flex flex-col min-w-0 transition-all duration-500 rounded-2xl ${activeColumnId === 'APPROVED' ? 'shadow-[0_0_40px_rgba(16,185,129,0.2)]' : ''}`}>
            <Column 
              id="APPROVED" 
              title="Approved & Published" 
              icon={CheckCircle2} 
              colorClass="text-emerald-400 bg-emerald-400/5"
              apis={approved}
              onReview={setReviewingApi}
            />
          </div>
          <div className={`flex flex-col min-w-0 transition-all duration-500 rounded-2xl ${activeColumnId === 'REJECTED' ? 'shadow-[0_0_40px_rgba(244,63,94,0.2)]' : ''}`}>
            <Column 
              id="REJECTED" 
              title="Rejected" 
              icon={XCircle} 
              colorClass="text-rose-400 bg-rose-400/5"
              apis={rejected}
              onReview={setReviewingApi}
            />
          </div>
        </div>

        <DragOverlay>
          {activeApi ? <SortableCard api={activeApi} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      </motion.div>

      <AnimatePresence>
      {reviewingApi && (
        <ApiReviewPane 
          api={reviewingApi} 
          onClose={() => setReviewingApi(null)}
          onApprove={(id: string) => {
            setApis(prev => prev.map(a => a.id === id ? { ...a, status: 'APPROVED' } : a));
            setReviewingApi(null);
          }}
          onReject={(id: string) => {
            setApis(prev => prev.map(a => a.id === id ? { ...a, status: 'REJECTED' } : a));
            setReviewingApi(null);
          }}
        />
      )}
      </AnimatePresence>
    </div>
  );
};
