import { useState } from 'react';
import { Users, Plus, Shield, Check, X } from 'lucide-react';
import { TeamMember } from '../types';

interface TeamManagerProps {
  team: TeamMember[];
  onAddMember: (member: TeamMember) => void;
}

export default function TeamManager({ team, onAddMember }: TeamManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Operario de Mezclado');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    onAddMember({
      name,
      role,
      active: true
    });

    setName('');
    setRole('Operario de Mezclado');
    setShowAddForm(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start overflow-hidden" id="team-manager-view">
      
      {/* Columna Principal - Lista de Miembros */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Equipo del Área de Estampado</h3>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cerrar' : 'Agregar Operador'}
          </button>
        </div>

        {/* Formulario Agregar Miembro */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 space-y-4 animate-fade-in">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Nuevo Miembro de Equipo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej: Manuel Castillo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol / Puesto en Taller</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-semibold"
                >
                  <option value="Operario de Mezclado">Operario de Mezclado</option>
                  <option value="Prensista de Toallas">Prensista de Toallas</option>
                  <option value="Auxiliar de Tono">Auxiliar de Tono</option>
                  <option value="Supervisor de Calidad">Supervisor de Calidad</option>
                  <option value="Líder de Serigrafía">Líder de Serigrafía</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white border border-slate-200 text-slate-500 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-xl px-4 py-1.5 text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Añadir al Equipo
              </button>
            </div>
          </form>
        )}

        {/* Lista de Miembros en Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {team.map((member) => (
              <div 
                key={member.id || member.name} 
                className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {/* Initials badge */}
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                    {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">{member.name}</h4>
                    <p className="text-xs text-slate-400 font-semibold">{member.role}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <Check className="w-3 h-3 text-emerald-500" />
                    Activo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Columna Lateral - Información */}
      <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-900">Control de Acceso y Roles</h4>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          El sistema centraliza las fórmulas para garantizar que el tono del estampado en toallas y hamacas sea consistente sin importar qué operario realice el mezclado.
        </p>

        <div className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <h5 className="font-bold text-blue-900 mb-1">Prensistas / Estampadores</h5>
            <p className="text-blue-700 leading-snug text-[11px]">
              Tienen acceso para buscar códigos Pantone y calcular proporciones exactas para sus mallas directamente en la tablet del taller.
            </p>
          </div>

          <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100">
            <h5 className="font-bold text-violet-900 mb-1">Operarios de Mezclado</h5>
            <p className="text-violet-700 leading-snug text-[11px]">
              Tienen permitido registrar el pesaje, asentar las mezclas y realizar deducciones de stock de tintas automáticas en tiempo real.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <h5 className="font-bold text-slate-800 mb-1">Jefe de Área / Laboratorio</h5>
            <p className="text-slate-600 leading-snug text-[11px]">
              Es el único con privilegios para modificar o crear nuevas fórmulas base y realizar auditorías de existencias físicas de tintas.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
