'use client';
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, X } from 'lucide-react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { COLLECTION_NAME, MAKE_WEBHOOK_URL, Project, Message } from '../lib/config';

export default function ChatBox({ project, userType, disabled }: { project: Project, userType: 'admin' | 'client', disabled?: boolean }) {
    const [msgText, setMsgText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messages = project.messages || [];

    // Scroll automatique vers le bas à chaque nouveau message
    useEffect(() => { 
        if(scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
        }
    }, [messages]);

    const handleSend = async () => {
        if(!msgText.trim()) return;
        setSending(true);
        
        const newMessage: Message = { 
            id: Date.now().toString(), 
            author: userType, 
            text: msgText, 
            date: new Date().toISOString() 
        };
        
        const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        
        try {
            await updateDoc(doc(db, colPath, project.id), { 
                messages: arrayUnion(newMessage), 
                hasUnreadMessage: userType === 'client', 
                lastUpdated: serverTimestamp() 
            });

            // Envoi Webhook (Notification)
            if (MAKE_WEBHOOK_URL && !MAKE_WEBHOOK_URL.includes('VOTRE_URL')) {
                const targetEmail = userType === 'client' ? (project.managerEmail || 'admin@raventech.fr') : project.clientEmail;
                
                // On envoie la notif seulement s'il y a un email cible
                if (targetEmail) {
                    fetch(MAKE_WEBHOOK_URL, {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            type: 'new_message', 
                            author: userType, 
                            targetEmail, 
                            clientName: project.clientNames, 
                            msg: msgText, 
                            url: window.location.origin 
                        })
                    }).catch(err => console.error("Erreur webhook chat:", err));
                }
            }
        } catch (error) {
            console.error("Erreur envoi message:", error);
            alert("Erreur lors de l'envoi du message.");
        }

        setMsgText('');
        setSending(false);
    };

    const handleDeleteMessage = async (msgToDelete: Message) => {
        if (!confirm("Supprimer ce message ?")) return;
        const updatedMessages = messages.filter(m => m.id !== msgToDelete.id);
        const colPath = typeof appId !== 'undefined' ? `artifacts/${appId}/public/data/${COLLECTION_NAME}` : COLLECTION_NAME;
        await updateDoc(doc(db, colPath, project.id), { messages: updatedMessages });
    };

    return (
        <div className="flex flex-col h-[400px] border border-stone-200 rounded-xl bg-stone-50 overflow-hidden shadow-sm mt-6">
            <div className="bg-white p-3 border-b flex justify-between items-center">
                <h4 className="font-bold text-sm flex gap-2 items-center text-stone-700">
                    <MessageSquare className="w-4 h-4"/> Messagerie
                </h4>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                    <div className="text-center text-xs text-stone-400 mt-10 italic">
                        Aucun message pour le moment.
                    </div>
                )}
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.author === userType ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm relative group shadow-sm ${
                            m.author === 'admin' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none'
                        }`}>
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <span className={`text-[9px] block mt-1 opacity-70 text-right ${m.author === 'admin' ? 'text-blue-100' : 'text-stone-400'}`}>
                                {new Date(m.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </span>
                            
                            {/* Bouton de suppression (Admin uniquement) */}
                            {userType === 'admin' && !disabled && (
                                <button 
                                    onClick={() => handleDeleteMessage(m)} 
                                    className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200"
                                    title="Supprimer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {!disabled ? (
                <div className="p-3 bg-white border-t flex gap-2 items-center">
                    <input 
                        className="flex-1 bg-stone-100 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 transition-all" 
                        placeholder="Écrivez votre message..." 
                        value={msgText} 
                        onChange={e => setMsgText(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && handleSend()} 
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={sending || !msgText.trim()} 
                        className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                    </button>
                </div>
            ) : (
                <div className="p-3 text-center text-xs text-stone-400 italic bg-stone-50 border-t">
                    Lecture seule (Vous ne pouvez pas répondre)
                </div>
            )}
        </div>
    );
}