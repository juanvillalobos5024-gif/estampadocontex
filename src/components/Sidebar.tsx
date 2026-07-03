import { Paintbrush, Scale, History, Layers, Users, MessageSquareCode } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: { name: string; role: string; initials: string };
}

export default function Sidebar({ activeTab, setActiveTab, currentUser }: SidebarProps) {
  const menuItems = [
    { id: 'pantones', label: 'Catálogo Pantones', icon: Paintbrush, section: 'Operaciones' },
    { id: 'calculadora', label: 'Calculadora Mezcla', icon: Scale, section: 'Operaciones' },
    { id: 'historial', label: 'Historial de Lotes', icon: History, section: 'Operaciones' },
    { id: 'asistente', label: 'Asistente de Color AI', icon: MessageSquareCode, section: 'Operaciones' },
    { id: 'stock', label: 'Stock de Tintas', icon: Layers, section: 'Gestión' },
    { id: 'equipo', label: 'Equipo Estampado', icon: Users, section: 'Gestión' },
  ];

  return (
    <nav className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0 border-r border-slate-800" id="app-sidebar">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl italic text-white shadow-md">T</div>
          <span className="text-xl font-bold tracking-tight text-white">TOCONTEX PRT</span>
        </div>
        
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Operaciones</div>
            <div className="space-y-1">
              {menuItems.filter(item => item.section === 'Operaciones').map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left font-medium ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Gestión</div>
            <div className="space-y-1">
              {menuItems.filter(item => item.section === 'Gestión').map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left font-medium ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-blue-400 shadow-sm text-sm">
            {currentUser.initials}
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
