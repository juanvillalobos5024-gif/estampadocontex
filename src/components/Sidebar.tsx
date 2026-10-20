import { 
  Paintbrush, Scale, History, Layers, MessageSquareCode, 
  LogOut, ClipboardList, Palette, Image as ImageIcon, X, ShoppingCart
} from 'lucide-react';
// @ts-ignore
import logoUrl from '@/assets/logo.jpeg';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: { name: string; role: string; initials: string };
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout,
  isOpenMobile = false,
  onCloseMobile
}: SidebarProps) {
  const menuItems = [
    { id: 'pantones', label: 'Catálogo', icon: Paintbrush, section: 'Gestión' },
    { id: 'disenos', label: 'Diseños', icon: Palette, section: 'Gestión' },
    { id: 'tareas', label: 'Tareas', icon: ClipboardList, section: 'Operaciones' },
    { id: 'analizador', label: 'Analizador', icon: ImageIcon, section: 'Operaciones' },
    { id: 'calculadora', label: 'Calculadora', icon: Scale, section: 'Operaciones' },
    { id: 'historial', label: 'Dashboard', icon: History, section: 'Gestión' },
    { id: 'asistente', label: 'Asistente IA', icon: MessageSquareCode, section: 'Operaciones' },
    { id: 'stock', label: 'Inventario', icon: Layers, section: 'Gestión' },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavBody = (isMobile: boolean = false) => (
    <>
      <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-2 mb-6 sm:mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-blue-900 shadow-md border border-blue-700/50">
              <img 
                src={logoUrl} 
                alt="CONTEX Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block leading-none">CONTEX</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block mt-0.5">Estampado</span>
            </div>
          </div>

          {/* Close button inside mobile drawer */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Cerrar menú"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Menus by Section */}
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 px-1">
              Operaciones
            </div>
            <div className="space-y-1">
              {menuItems.filter(item => item.section === 'Operaciones').map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all text-left font-medium cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 font-bold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 px-1">
              Gestión
            </div>
            <div className="space-y-1">
              {menuItems.filter(item => item.section === 'Gestión').map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all text-left font-medium cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 font-bold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* User profile footer con soporte de Tooltip completo en Hover */}
      <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 shrink-0 relative">
        <div className="flex items-center gap-3 justify-between">
          <div 
            className="flex items-center gap-3 overflow-hidden min-w-0 flex-1 group/user relative cursor-pointer"
            title={`${currentUser.name} • ${currentUser.role}`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-blue-400 shadow-sm text-sm shrink-0 group-hover/user:border-blue-500/50 group-hover/user:text-blue-300 transition-colors">
              {currentUser.initials}
            </div>
            <div className="truncate min-w-0 flex-1">
              <p 
                className="text-xs font-bold text-slate-200 truncate group-hover/user:text-blue-300 transition-colors"
                title={currentUser.name}
              >
                {currentUser.name}
              </p>
              <p 
                className="text-[10px] text-slate-500 truncate group-hover/user:text-slate-400 transition-colors"
                title={currentUser.role}
              >
                {currentUser.role}
              </p>
            </div>

            {/* Tooltip flotante enriquecido visible al hacer hover */}
            <div className="absolute bottom-full left-0 mb-3 hidden group-hover/user:flex flex-col bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/80 z-50 pointer-events-none min-w-[220px] max-w-xs animate-in fade-in zoom-in-95 duration-150">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Usuario Conectado</span>
              <span className="font-bold text-slate-100 break-all text-xs text-blue-400">{currentUser.name}</span>
              <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                {currentUser.role}
              </span>
              <div className="absolute top-full left-5 -mt-1 border-4 border-transparent border-t-slate-900/95"></div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-xl transition-colors shrink-0 cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── DESKTOP SIDEBAR (Visible solo en md y superior) ── */}
      <aside 
        className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-full shrink-0 border-r border-slate-800 select-none" 
        id="app-sidebar"
      >
        {renderNavBody(false)}
      </aside>

      {/* ── MOBILE OVERLAY BACKDROP (Visible solo cuando el drawer está abierto en móvil) ── */}
      <div 
        className={`fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 md:hidden transition-opacity duration-300 ${
          isOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* ── MOBILE SLIDE-OVER DRAWER (Visible solo en móvil) ── */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-white flex flex-col h-full shadow-2xl border-r border-slate-800 transform transition-transform duration-300 ease-in-out md:hidden select-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="app-mobile-sidebar"
      >
        {renderNavBody(true)}
      </aside>
    </>
  );
}
