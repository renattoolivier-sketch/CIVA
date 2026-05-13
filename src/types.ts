export enum CameraStatus {
  ONLINE = 'online',
  ERROR = 'error',
}

export interface MaintenanceLog {
  id: string;
  cameraId: string;
  locationId: string;
  timestamp: string;
  dataConserto: string;
  descricaoTecnica: string;
  ipLocal: string;
  servidor: string;
}

export interface Camera {
  id: string;
  number: number;
  status: CameraStatus;
  lastMaintenance?: string;
}

export interface Location {
  id: string;
  name: string;
  ip: string;
  server: string;
  secretariatId: string;
  subSecretariat?: string;
  cameras: Camera[];
  mapsLink?: string;
}

export interface Secretariat {
  id: string;
  name: string;
  icon: string;
}
