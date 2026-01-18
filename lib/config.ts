import { Timestamp } from 'firebase/firestore';

// ANNUAIRE FIXE
export const STAFF_DIRECTORY: Record<string, string> = {
    "Volkan": "mariages.paris.productions@gmail.com",
    "Feridun": "feridun.kizgin@gmail.com",
    "Yunus": "yunus34@hotmail.fr",
    "Serife": "serifevideography@gmail.com",
    "Steeven": "studios.h265@gmail.com",
    "Taner": "bokehart9@gmail.com",
    "Göksel": "gokseltuzun@gmail.com"
};

export const DEFAULT_STAFF = Object.keys(STAFF_DIRECTORY);

// Configuration
export const COLLECTION_NAME = 'wedding_projects';
export const LEADS_COLLECTION = 'leads';
export const SETTINGS_COLLECTION = 'settings';
export const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/iwf8nbt3tywmywp6u89xgn7e2nar0bbs'; 

// Liens Stripe
export const STRIPE_PRIORITY_LINK = 'https://buy.stripe.com/fZu4gz07eaPzcRt54Y5gc0c'; 
export const STRIPE_RAW_LINK = 'https://buy.stripe.com/cNi5kD5rye1L2cP2WQ5gc0d';
export const STRIPE_ARCHIVE_RESTORE_LINK = 'https://buy.stripe.com/fZu00j3jq4rb5p140U5gc0e';
export const STRIPE_ARCHIVE_LINK = STRIPE_ARCHIVE_RESTORE_LINK; // Alias

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
    'cutting': { label: 'Montage en cours', percent: 50 },
    'grading': { label: 'Etalonnage & Mixage', percent: 75 },
    'partial': { label: 'Livraison Partielle (Clip/Taki)', percent: 85 }, // 👈 NOUVELLE ÉTAPE
    'rendering': { label: 'Export Final', percent: 90 },
    'delivered': { label: 'Livraison Finale', percent: 100 }
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

// Structure Chat Interne
export interface InternalMessage {
    id: string;
    author: string;
    role: string;
    text: string;
    date: string;
}

export interface HistoryLog {
    date: string;
    user: string;
    action: string;
}

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

    // Staff
    photographerName?: string;
    photographerEmail?: string | null;
    videographerName?: string;
    videographerEmail?: string | null;
    managerName?: string;
    managerEmail?: string | null;

    // Livrables & Contenu
    linkPhoto?: string;
    linkVideo?: string;
    coverImage?: string;
    moodboardLink?: string; // 👈 Nouveau
    
    // Options
    isPriority: boolean;
    fastTrackActivationDate?: string | null;
    isArchived?: boolean;
    inviteCount?: number; // 👈 Nouveau

    // Financier
    totalPrice?: number;
    depositAmount?: number;
    teamPayments?: TeamPayment[];
    
    // Communication & Contenu
    messages?: Message[];
    internalChat?: InternalMessage[]; // 👈 Nouveau
    hasUnreadMessage?: boolean;
    albums?: Album[];
    musicInstructions?: string;
    musicLinks?: string;
    adminNotes?: string;

    // Confirmations
    deliveryConfirmed?: boolean; 
    deliveryConfirmationDate?: any;
    deliveryConfirmedPhoto?: boolean;
    deliveryConfirmedPhotoDate?: any;
    deliveryConfirmedVideo?: boolean;
    deliveryConfirmedVideoDate?: any;
    
    // Meta
    lastUpdated?: any;
    createdAt?: any;
    history?: HistoryLog[];
}