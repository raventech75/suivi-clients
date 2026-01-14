export const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/iwf8nbt3tywmywp6u89xgn7e2nar0bbs"; 
export const SUPER_ADMINS = ["admin@raventech.fr", "irzzenproductions@gmail.com"]; 
export const STRIPE_ARCHIVE_LINK = "https://buy.stripe.com/3cI3cv3jq2j37x9eFy5gc0b";
export const STRIPE_PRIORITY_LINK = "https://buy.stripe.com/VOTRE_LIEN_PRIORITE"; 

export const DEFAULT_STAFF = ["Feridun", "Volkan", "Ali", "Steeven", "Taner", "Yunus", "Emir", "Serife"];
export const ALBUM_FORMATS = ["30x20", "30x30", "40x30", "40x30 + 2x 18x24", "Autre"];

export const COLLECTION_NAME = 'wedding_projects';
export const LEADS_COLLECTION = 'leads';
export const SETTINGS_COLLECTION = 'settings'; 

export const PHOTO_STEPS: Record<string, { label: string; percent: number }> = {
  'waiting': { label: 'En attente', percent: 5 },
  'culling': { label: 'Tri & Sélection', percent: 30 },
  'editing': { label: 'Retouches & Colo', percent: 65 },
  'exporting': { label: 'Export HD', percent: 90 },
  'delivered': { label: 'Livré', percent: 100 },
  'none': { label: 'Non inclus', percent: 0 }
};

export const VIDEO_STEPS: Record<string, { label: string; percent: number }> = {
  'waiting': { label: 'En attente', percent: 5 },
  'cutting': { label: 'Montage', percent: 35 },
  'grading': { label: 'Étalonnage', percent: 70 },
  'mixing': { label: 'Finalisation', percent: 90 },
  'delivered': { label: 'Livré', percent: 100 },
  'none': { label: 'Non inclus', percent: 0 }
};

export const ALBUM_STATUSES = {
  'pending': 'En attente',
  'selection': 'Sélection reçue',
  'design': 'Mise en page',
  'print': 'Impression',
  'sent': 'Expédié'
};

// --- TYPES ---
export interface Message { id: string; author: 'client' | 'admin'; text: string; date: any; }
export interface Remuneration { name: string; amount: number; note: string; paid?: boolean; }
export interface AlbumOrder { id: string; name: string; format: string; price: number; status: string; stripeLink?: string; paid: boolean; }

export interface Project {
  id: string;
  clientNames: string;
  // Infos Contacts
  clientEmail?: string;
  clientEmail2?: string;
  clientPhone?: string;
  clientPhone2?: string;
  clientAddress?: string; // NOUVEAU
  clientCity?: string;    // NOUVEAU
  adminNotes?: string;    // NOUVEAU (Notes internes)

  weddingDate: string;
  code: string;
  
  statusPhoto: 'waiting' | 'culling' | 'editing' | 'exporting' | 'delivered' | 'none';
  statusVideo: 'waiting' | 'cutting' | 'grading' | 'mixing' | 'delivered' | 'none';
  progressPhoto: number; 
  progressVideo: number;
  
  photographerName: string;
  videographerName: string;
  managerName?: string; 
  managerEmail?: string; 
  onSiteTeam?: string[]; 
  
  coverImage?: string; 
  estimatedDeliveryPhoto?: string;
  estimatedDeliveryVideo?: string;
  linkPhoto?: string;
  linkVideo?: string;
  
  deliveryConfirmed?: boolean;
  deliveryConfirmationDate?: any;

  messages?: Message[]; 
  hasUnreadMessage?: boolean; 
  
  musicLinks?: string; 
  musicInstructions?: string;
  albums?: AlbumOrder[];

  totalPrice?: number;
  depositAmount?: number;
  teamPayments?: Remuneration[];
  financeNotes?: string;
  
  isPriority?: boolean; 
  createdAt: any;
  lastUpdated?: any;
}