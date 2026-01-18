'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore'; // Ajout onSnapshot
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, MAKE_WEBHOOK_URL, Project, Message } from '../lib/config';

export default function ChatBox({ project, userType, disabled = false }: { project: Project, userType: 'admin' | 'client', disabled?: boolean }) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  // 👇 État local pour l'affichage instantané
  const [localMessages, setLocalMessages] = useState<Message[]>(project.messages || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Écoute temps réel spécifique pour ce chat (plus rapide que le refresh global)
  useEffect(() => {
    const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
    const unsub = onSnapshot(doc(db, colPath, project.id), (doc) => {
        if (doc.exists()) {
            const data = doc.data() as Project;
            // On ne met à jour que si le nombre de messages a changé pour éviter les sauts
            if (data.messages && data.messages.length !== localMessages.length) {
                setLocalMessages(data.messages);
            }
        }
    });
    return () => unsub();
  }, [project.id]); // Dépendance stable

  // 2. Scroll automatique vers le bas
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setSending(true);
    const msgText = newMessage.trim();
    
    // Définition de l'auteur
    const authorName = userType === 'admin' ? 'RavenTech Studio' : project.clientNames;
    
    const msg: Message = {
        id: Date.now().toString(),
        author: authorName,
        text: msgText,
        date: new Date().toISOString(),
        isStaff: userType === 'admin'
    };

    // ✨ MAGIE : Affichage instantané (Optimistic UI)
    setLocalMessages(prev => [...prev, msg]);
    setNewMessage(''); // On vide le champ tout de suite

    try {
        const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        
        // A. Sauvegarde BDD
        await updateDoc(doc(db, colPath, project.id), {
            messages: arrayUnion(msg)
        });

        // B. Envoi Webhook Make CORRIGÉ (On envoie les emails !)
        await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'chat',
                projectCode: project.code,
                clientNames: project.clientNames,
                author: authorName,
                text: msgText,
                url: window.location.href,
                // 👇 INDISPENSABLE POUR MAKE : On envoie les destinataires
                clientEmail: project.clientEmail,
                managerEmail: project.managerEmail || '',
                photographerEmail: project.photographerEmail || '',
                videographerEmail: project.videographerEmail || ''
            })
        });

    } catch (error) {
        console.error("Erreur envoi chat:", error);
        alert("Erreur de connexion. Le message sera rétabli au prochain chargement.");
    } finally {
        setSending(false);
    }
  };

  const formatTime = (iso: string) => {
      return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 p-4 border-b border-stone-100 flex justify-between items-center">
            <h4 className="font-serif font-bold text-stone-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500"/> 
                {userType === 'admin' ? `Discussion avec ${project.clientNames}` : "Discussion avec le Studio"}
            </h4>
            <span className="text-[10px] uppercase tracking-widest text-stone-400">Messagerie Sécurisée</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/30">
            {localMessages.length === 0 && (
                <div className="text-center text-stone-400 text-sm italic mt-10">
                    Démarrez la conversation...<br/>
                    <span className="text-xs">Les notifications sont envoyées par email.</span>
                </div>
            )}
            
            {localMessages.map((msg, index) => {
                const isMe = (userType === 'admin' && msg.isStaff) || (userType === 'client' && !msg.isStaff);
                return (
                    <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase">{msg.author}</span>
                            <span className="text-[10px] text-stone-300">{formatTime(msg.date)}</span>
                        </div>
                        <div className={`p-4 rounded-2xl text-sm max-w-[85%] shadow-sm leading-relaxed ${
                            isMe 
                            ? 'bg-stone-900 text-white rounded-tr-sm' 
                            : 'bg-white border border-stone-200 text-stone-600 rounded-tl-sm'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                );
            })}
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-stone-100 flex gap-3 items-center">
            <input 
                disabled={disabled}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all placeholder-stone-400" 
                placeholder="Écrivez votre message..." 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)}
            />
            <button 
                disabled={disabled || sending || !newMessage.trim()} 
                className="bg-stone-900 hover:bg-black text-white p-3 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:shadow-none"
            >
                {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
            </button>
        </form>
    </div>
  );
}