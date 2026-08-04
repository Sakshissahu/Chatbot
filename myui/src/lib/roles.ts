import { Sprout, type LucideIcon } from 'lucide-react';

export type RoleId = 'farmer';

export interface RoleConfig {
  id: RoleId;
  label: string;
  icon: LucideIcon;
  tagline: string;
  blurb: string;
  /** example prompts shown as quick-starts on the empty chat */
  suggestions: string[];
  /** dataset name behind this bot (for the source/disclosure UI) */
  corpus: string;
}

// Bot routing now lives backend-side (role -> bot id), so the frontend no
// longer needs RAGFlow chat ids here. This app is Farmer-only.
export const ROLES: Record<RoleId, RoleConfig> = {
  farmer: {
    id: 'farmer',
    label: 'Farmer',
    icon: Sprout,
    tagline: 'Field & flock guidance',
    blurb: 'Crop care, poultry health, biosecurity and on-farm best practice — grounded in IB Group field documentation.',
    corpus: 'Farmer field docs',
    suggestions: [
      'What biosecurity measures are recommended for poultry sheds?',
      'How should I store and handle feed safely?',
      'What are the early warning signs of disease in a flock?',
    ],
  },
};

export const ROLE_LIST: RoleConfig[] = [ROLES.farmer];
