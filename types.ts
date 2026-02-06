
export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  address: string;
  activityType: string;
  orders: Order[];
  createdAt: number;
}

export interface Order {
  id: string;
  service: string;
  details: string;
  timestamp: number;
  status: 'pending' | 'completed';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface AdminSettings {
  adminUsername: string;
  adminPasswordHash: string;
  storeUrl: string;
  phoneNumbers: string[];
  instantInstructions: string;
}

export enum ServiceType {
  MobileApps = 'MobileApps',
  AIAgents = 'AIAgents',
  Ecommerce = 'Ecommerce',
  ERP = 'ERP'
}
