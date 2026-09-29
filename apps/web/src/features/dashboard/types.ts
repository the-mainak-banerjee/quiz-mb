export type Quiz = {
  id: string;
  publicId?: string;
  project: string;
  role: 'host' | 'participant';
  status: 'live' | 'scheduled' | 'draft' | 'completed';
  statusLabel?: string;
  title: string;
  description: string;
  timing: string;
  detail: string;
  action: string;
};
