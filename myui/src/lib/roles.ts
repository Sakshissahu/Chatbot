import { Sprout, Briefcase, type LucideIcon } from 'lucide-react';

export type RoleId = 'farmer' | 'employee';

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
// longer needs RAGFlow chat ids here.
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
  employee: {
    id: 'employee',
    label: 'Employee',
    icon: Briefcase,
    tagline: 'People & policy desk',
    blurb: 'Leave, benefits, conduct and workplace policy — answered straight from the IB Group HR handbook.',
    corpus: 'HR policy handbook',
    suggestions: [
      'How many earned leave days do I get per year?',
      'What is the policy on working hours and attendance?',
      'How do I claim reimbursement for expenses?',
    ],
  },
};

export const ROLE_LIST: RoleConfig[] = [ROLES.farmer, ROLES.employee];
