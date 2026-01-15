import { Timestamp } from 'firebase/firestore';

export const DEFAULT_STAFF = [
    "Volkan", "Feridun", "Adem", "Burak", "Emre", "Yasin"
];

// Configuration
export const COLLECTION_NAME = 'wedding_projects';
export const LEADS_COLLECTION = 'leads';
export const SETTINGS_COLLECTION = 'settings';
export const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/iwf8nbt3tywmywp6u89xgn7e2nar0bbs'; 

// Liens Stripe
export const STRIPE_PRIORITY_LINK = 'https://buy.stripe.com/test_...'; 
export const STRIPE_ARCHIVE_LINK = 'https://buy.stripe.com/test_...';

export const SUPER_ADMINS = ['irzzenproductions@gmail.com']; 

export const PHOTO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'culling': { label: 'Tri & Sélection', percent: 30 },
    'editing': { label: 'Retouches Colorimétrie', percent: 60 },
    'export': { label: 'Export & Galerie', percent: 90 },
    'delivered': { label: 'Livré', percent: 100 }
};

export const VIDEO_STEPS = {
    'none': { label: 'En attente', percent: 0 },
    'waiting': { label: 'En attente des fichiers', percent: 10 },
    'rushes': { label: 'Dérushage', percent: 25 },
    'cutting': { label: 'Montage Ours', percent: 50 },
    'grading': { label: 'Etalonnage & Mixage', percent: 75 },
    'rendering': { label: 'Export Final', percent: 90 },
    'delivered': { label: 'Livré', percent: 100 }
};

export const ALBUM_STATUSES = {
    'pending': 'En attente choix',
    'design': 'Mise en page',
    'validation': 'Validation Client',
    'printing': 'En impression',
    'sent': 'Expédié'
};

export const ALBUM_FORMATS = ['30x30', '40x30', '25x25', 'Coffret Parent'];

export interface Album {
    id: string;
    name: string;
    format: string;
    status: string;
    paid: boolean;
    price: number;
    stripeLink?: string;
}

export interface Message {
    id: string;
    author: 'admin' | 'client';
    text: string;
    date: any; 
}

export interface HistoryLog {
    date: string;
    user: string;
    action: string;
}

// 👇 NOUVELLE INTERFACE POUR LES PAIEMENTS ÉQUIPE
export interface TeamPayment {
    id: string;
    recipient: string;
    amount: number;
    date: string;
    note?: string;
}

export interface Project {
    id: string;
    code: string;
    clientNames: string;
    clientEmail: string;
    clientPhone: string;
    clientEmail2?: string | null;
    clientPhone2?: string | null;
    clientAddress?: string;
    clientCity?: string;
    weddingDate: string;
    weddingVenue?: string | null;
    weddingVenueZip?: string | null;
    
    // Status
    statusPhoto: keyof typeof PHOTO_STEPS;
    statusVideo: keyof typeof VIDEO_STEPS;
    progressPhoto: number;
    progressVideo: number;
    
    // Dates prévisionnelles
    estimatedDeliveryPhoto?: string;
    estimatedDeliveryVideo?: string;

    // Staff (Noms + Emails)
    photographerName?: string;
    photographerEmail?: string | null;
    videographerName?: string;
    videographerEmail?: string | null;
    managerName?: string;
    managerEmail?: string | null;

    // Livrables
    linkPhoto?: string;
    linkVideo?: string;
    coverImage?: string;
    
    // Options
    isPriority: boolean;
    fastTrackActivationDate?: string | null;
    isArchived?: boolean;

    // Financier
    totalPrice?: number;
    depositAmount?: number;
    teamPayments?: TeamPayment[]; // 👈 J'AI AJOUTÉ CETTE LIGNE MANQUANTE
    
    // Communication & Contenu
    messages?: Message[];
    hasUnreadMessage?: boolean;
    albums?: Album[];
    musicInstructions?: string;
    musicLinks?: string;
    adminNotes?: string;

    // Confirmations de livraison
    deliveryConfirmed?: boolean; 
    deliveryConfirmationDate?: any;
    
    // Nouveaux champs V45
    deliveryConfirmedPhoto?: boolean;
    deliveryConfirmedPhotoDate?: any;
    deliveryConfirmedVideo?: boolean;
    deliveryConfirmedVideoDate?: any;
    
    // Meta
    lastUpdated?: any;
    createdAt?: any;
    history?: HistoryLog[];
}