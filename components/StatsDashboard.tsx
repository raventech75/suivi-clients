'use client';
import React, { useState, useMemo } from 'react';
import { 
  BarChart3, TrendingUp, Calendar, MapPin, 
  BookOpen, Users, DollarSign, PieChart, ArrowLeft 
} from 'lucide-react';
import { Project } from '../lib/config';

export default function StatsDashboard({ projects, onBack }: { projects: Project[], onBack: () => void }) {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('year');
  const [referenceDate, setReferenceDate] = useState(new Date());

  // --- 1. FILTRAGE TEMPOREL ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if(!p.weddingDate) return false;
      const wDate = new Date(p.weddingDate);
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();

      if (period === 'all') return true;
      if (period === 'year') return wDate.getFullYear() === year;
      if (period === 'quarter') {
         const qStart = Math.floor(month / 3) * 3;
         return wDate.getFullYear() === year && wDate.getMonth() >= qStart && wDate.getMonth() < qStart + 3;
      }
      if (period === 'month') return wDate.getFullYear() === year && wDate.getMonth() === month;
      return true;
    });
  }, [projects, period, referenceDate]);

  // --- 2. CALCULS STATISTIQUES ---
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalStaffCost = 0;
    let totalAlbums = 0;
    let fastTrackCount = 0;
    const venueStats: Record<string, number> = {};
    const albumStats: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};

    filteredProjects.forEach(p => {
        // Revenus & Coûts
        totalRevenue += Number(p.totalPrice || 0);
        const projectStaffCost = (p.teamPayments || []).reduce((sum, pay) => sum + (Number(pay.amount)||0), 0);
        totalStaffCost += projectStaffCost;

        // Fast Track
        if (p.isPriority) fastTrackCount++;

        // Salles (Normalisation)
        if (p.weddingVenue) {
            const v = p.weddingVenue.trim().toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // Capitalize
            venueStats[v] = (venueStats[v] || 0) + 1;
        }

        // Albums
        (p.albums || []).forEach(a => {
            totalAlbums++;
            albumStats[a.format] = (albumStats[a.format] || 0) + 1;
        });

        // Evolution mensuelle (pour le mini graph)
        const mKey = new Date(p.weddingDate).toLocaleString('fr-FR', { month: 'short' });
        monthlyRevenue[mKey] = (monthlyRevenue[mKey] || 0) + (p.totalPrice || 0);
    });

    // Tri des salles par popularité
    const sortedVenues = Object.entries(venueStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Top 5

    // Tri des albums
    const sortedAlbums = Object.entries(albumStats).sort(([,a], [,b]) => b - a);

    return { 
        totalRevenue, 
        totalStaffCost, 
        netIncome: totalRevenue - totalStaffCost,
        count: filteredProjects.length,
        fastTrackRate: filteredProjects.length ? Math.round((fastTrackCount / filteredProjects.length) * 100) : 0,
        avgPrice: filteredProjects.length ? Math.round(totalRevenue / filteredProjects.length) : 0,
        sortedVenues,
        sortedAlbums,
        totalAlbums,
        monthlyRevenue
    };
  }, [filteredProjects]);

  // Navigation Temporelle
  const shiftDate = (dir: -1 | 1) => {
      const d = new Date(referenceDate);
      if(period === 'year') d.setFullYear(d.getFullYear() + dir);
      if(period === 'month') d.setMonth(d.getMonth() + dir);
      if(period === 'quarter') d.setMonth(d.getMonth() + (dir * 3));
      setReferenceDate(d);
  };

  const getLabel = () => {
      if(period === 'year') return referenceDate.getFullYear();
      if(period === 'month') return referenceDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      if(period === 'quarter') return `T${Math.floor(referenceDate.getMonth()/3)+1} ${referenceDate.getFullYear()}`;
      return "Depuis le début";
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
                <div className="bg-indigo-600 text-white p-2 rounded-lg"><BarChart3 className="w-5 h-5" /></div>
                <h1 className="font-bold text-stone-900 text-lg">Analytics Studio</h1>
            </div>
            
            <div className="flex items-center bg-stone-100 rounded-lg p-1">
                {(['month', 'quarter', 'year', 'all'] as const).map(p => (
                    <button key={p} onClick={()=>setPeriod(p)} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${period === p ? 'bg-white shadow text-indigo-600' : 'text-stone-500 hover:text-stone-900'}`}>
                        {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trimestre' : p === 'year' ? 'Année' : 'Total'}
                    </button>
                ))}
            </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* NAVIGATEUR DATE */}
        {period !== 'all' && (
            <div className="flex items-center justify-center gap-4 mb-8">
                <button onClick={()=>shiftDate(-1)} className="p-2 hover:bg-white rounded-full transition">◀</button>
                <h2 className="text-2xl font-serif font-bold text-stone-800 capitalize w-48 text-center">{getLabel()}</h2>
                <button onClick={()=>shiftDate(1)} className="p-2 hover:bg-white rounded-full transition">▶</button>
            </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><DollarSign className="w-6 h-6"/></div>
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">+Net</span>
                </div>
                <div className="text-3xl font-bold text-stone-900">{stats.totalRevenue.toLocaleString()} €</div>
                <div className="text-sm text-stone-500 mt-1">Chiffre d'Affaires</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BookOpen className="w-6 h-6"/></div>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">{stats.count} Mariages</span>
                </div>
                <div className="text-3xl font-bold text-stone-900">{stats.avgPrice.toLocaleString()} €</div>
                <div className="text-sm text-stone-500 mt-1">Panier Moyen</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl"><Users className="w-6 h-6"/></div>
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">Salaires</span>
                </div>
                <div className="text-3xl font-bold text-stone-900">{stats.totalStaffCost.toLocaleString()} €</div>
                <div className="text-sm text-stone-500 mt-1">Coûts Équipes</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><TrendingUp className="w-6 h-6"/></div>
                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">Fast Track</span>
                </div>
                <div className="text-3xl font-bold text-stone-900">{stats.fastTrackRate}%</div>
                <div className="text-sm text-stone-500 mt-1">Taux d'adoption</div>
            </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
            
            {/* TOP SALLES */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-500"/> Top Lieux de Réception</h3>
                <div className="space-y-4">
                    {stats.sortedVenues.length > 0 ? stats.sortedVenues.map(([name, count], i) => (
                        <div key={name} className="flex items-center gap-4">
                            <div className="font-mono text-stone-400 w-4 font-bold">#{i+1}</div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm font-bold mb-1">
                                    <span>{name}</span>
                                    <span className="text-stone-500">{count} mariages</span>
                                </div>
                                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${(count / stats.sortedVenues[0][1]) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-stone-400 italic text-sm">Aucune donnée de lieu renseignée.</p>}
                </div>
                <div className="mt-6 p-4 bg-indigo-50 rounded-xl text-xs text-indigo-800">
                    💡 <strong>Conseil Sales :</strong> Contactez ces salles pour devenir leur "Photographe Partenaire" officiel et récupérer 100% de leurs leads.
                </div>
            </div>

            {/* ANALYSE ALBUMS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-purple-500"/> Ventes d'Albums</h3>
                <div className="flex items-center justify-between mb-6 p-4 bg-stone-50 rounded-xl">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-stone-900">{stats.totalAlbums}</div>
                        <div className="text-xs text-stone-500">Albums Vendus</div>
                    </div>
                    <div className="h-8 w-px bg-stone-300"></div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{(stats.totalAlbums / (stats.count || 1)).toFixed(1)}</div>
                        <div className="text-xs text-stone-500">Moyenne / Mariage</div>
                    </div>
                </div>

                <div className="space-y-3">
                     {stats.sortedAlbums.map(([format, count]) => (
                        <div key={format} className="flex items-center justify-between p-3 border rounded-lg hover:bg-stone-50 transition">
                            <span className="font-medium text-sm">{format}</span>
                            <span className="font-bold text-stone-900 bg-stone-100 px-2 py-1 rounded text-xs">{count}</span>
                        </div>
                     ))}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}