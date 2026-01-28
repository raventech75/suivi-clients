'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, ShieldAlert, Loader2, Users, Check, UserCheck } from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { MAKE_WEBHOOK_URL, COLLECTION_NAME, Project, InternalMessage } from '../lib/config';

export default function TeamChat({ project, user }: { project: Project, user: any }) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<InternalMessage[]>(project.internalChat || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  // État pour gérer les destinataires sélectionnés
  const [recipients, setRecipients] = useState({
    manager: true,
    photographer: true,
    videographer: true
  });

  useEffect(() => {
    if (project.internalChat) {
        setLocalMessages(project.internalChat);
    }
  }, [project.internalChat]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [localMessages]);

  const toggleRecipient = (role: 'manager' | 'photographer' | 'videographer') => {
      setRecipients(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setSending(true);
    const msgText = newMessage.trim();
    const userName = user.email ? user.email.split('@')[0] : 'Inconnu';
    const userEmail = user.email || '';
    let role = 'Équipe';
    if (user.email?.includes('irzzen')) role = 'Admin';

    // On prépare la liste des gens notifiés pour l'historique (visuel seulement)
    const notifiedRoles = [];
    if (recipients.manager && project.managerEmail) notifiedRoles.push('Manager');
    if (recipients.photographer && project.photographerEmail) notifiedRoles.push('Photo');
    if (recipients.videographer && project.videographerEmail) notifiedRoles.push('Vidéo');

    const msg: InternalMessage = {
        id: Date.now().toString(),
        author: userName,
        role: role,
        text: msgText,
        date: new Date().toISOString()
    };

    setLocalMessages(prev => [...prev, msg]);
    setNewMessage(''); 

    try {
        const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        await updateDoc(doc(db, colPath, project.id), {
            internalChat: arrayUnion(msg)
        });

        // LOGIQUE CIBLÉE : On envoie l'email SEULEMENT si la case est cochée
        const payload = {
            type: 'internal_chat',
            projectCode: project.code,
            clientNames: project.clientNames,
            author: userName,
            senderEmail: userEmail,
            text: msgText,
            // Si la case est cochée ET qu'il y a un email -> on l'envoie. Sinon null.
            managerEmail: (recipients.manager && project.managerEmail) ? project.managerEmail : null,
            photographerEmail: (recipients.photographer && project.photographerEmail) ? project.photographerEmail : null,
            videographerEmail: (recipients.videographer && project.videographerEmail) ? project.videographerEmail : null
        };

        // On n'appelle le webhook que s'il y a au moins un destinataire
        if (payload.managerEmail || payload.photographerEmail || payload.videographerEmail) {
            fetch(MAKE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error("Erreur Webhook Chat", err));
        }

    } catch (error) {
        console.error("Erreur critique Chat:", error);
    } finally {
        setSending(false);
    }
  };

  const formatTime = (iso: string) => {
      if(!iso) return "";
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-amber-50/50 rounded-xl border border-amber-100 overflow-hidden">
        <div className="bg-amber-100/80 p-3 border-b border-amber-200 flex justify-between items-center">
            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4"/> Chat Équipe (Interne)
            </h4>
            <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider">Invisible Client</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
            {localMessages.length === 0 && (
                <div className="text-center text-amber-800/40 text-xs italic mt-10">Aucune note d'équipe.<br/>Utilisez cet espace pour le briefing.</div>
            )}
            
            {localMessages.map((msg, index) => {
                const isMe = user.email && msg.author === user.email.split('@')[0];
                return (
                    <div key={msg.id || index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 rounded">{msg.author}</span>
                            <span className="text-[10px] text-amber-600/70">{formatTime(msg.date)}</span>
                        </div>
                        <div className={`p-3 rounded-lg text-sm max-w-[90%] shadow-sm ${isMe ? 'bg-amber-200 text-amber-900 rounded-tr-none' : 'bg-white border border-amber-100 text-stone-700 rounded-tl-none'}`}>
                            {msg.text}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* BARRE DE SÉLECTION DES DESTINATAIRES */}
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 text-amber-800 font-bold mr-2"><Users className="w-3 h-3"/> Notifier :</span>
            
            {project.managerEmail && (
                <button 
                    type="button"
                    onClick={() => toggleRecipient('manager')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${recipients.manager ? 'bg-amber-200 border-amber-300 text-amber-900' : 'bg-white border-amber-100 text-stone-400'}`}
                >
                    {recipients.manager && <Check className="w-3 h-3"/>} Manager
                </button>
            )}
            
            {project.photographerEmail && (
                <button 
                    type="button"
                    onClick={() => toggleRecipient('photographer')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${recipients.photographer ? 'bg-amber-200 border-amber-300 text-amber-900' : 'bg-white border-amber-100 text-stone-400'}`}
                >
                    {recipients.photographer && <Check className="w-3 h-3"/>} Photo ({project.photographerName})
                </button>
            )}

            {project.videographerEmail && (
                <button 
                    type="button"
                    onClick={() => toggleRecipient('videographer')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${recipients.videographer ? 'bg-amber-200 border-amber-300 text-amber-900' : 'bg-white border-amber-100 text-stone-400'}`}
                >
                    {recipients.videographer && <Check className="w-3 h-3"/>} Vidéo ({project.videographerName})
                </button>
            )}
        </div>

        <form onSubmit={sendMessage} className="p-3 bg-white border-t border-amber-100 flex gap-2">
            <input 
                className="flex-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder-amber-300" 
                placeholder="Message interne..." 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)}
            />
            <button disabled={sending} className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[40px]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
            </button>
        </form>
    </div>
  );
}