export const helpCategoryPills = [
  {
    id: 'track',
    title: 'Track Shipment',
    description: 'Track and trace your consignments',
    icon: 'package-search',
    color: 'emerald',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    id: 'billing',
    title: 'Billing & Payments',
    description: 'Invoices, payments and refunds',
    icon: 'file-text',
    color: 'blue',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    id: 'account',
    title: 'Account & Profile',
    description: 'Update profile and account settings',
    icon: 'user',
    color: 'amber',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  {
    id: 'vehicle',
    title: 'Vehicle Support',
    description: 'Manage vehicles and documents',
    icon: 'truck',
    color: 'purple',
    iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  {
    id: 'technical',
    title: 'Technical Support',
    description: 'App, website and technical issues',
    icon: 'settings',
    color: 'teal',
    iconBg: 'bg-teal-50 text-teal-600 border-teal-200',
  },
];

// Honest in-app support channels — the platform does NOT publish a public
// helpline/WhatsApp/email, so no fictional phone numbers are shown here.
export const contactChannels = [
  {
    id: 'ticket',
    title: 'Raise a Ticket',
    value: 'Open the ticket form',
    subtext: 'Quickest way — create a ticket from this page',
    icon: 'ticket',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    link: '#raise-ticket',
  },
  {
    id: 'guide',
    title: 'User Guides',
    value: 'Documentation & tutorials',
    subtext: 'Browse the help topics on this page',
    icon: 'guide',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
    link: '#guides',
  },
  {
    id: 'status',
    title: 'Platform Status',
    value: 'Live system status',
    subtext: 'Shown in the status banner below',
    icon: 'status',
    iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
    link: '#status',
  },
];

export const popularHelpTopics = [
  {
    id: 'topic-1',
    title: 'How to create a new consignment?',
    subtitle: 'Step-by-step guide to create and book a new consignment.',
    icon: 'package-search',
    iconColor: 'text-emerald-600 bg-emerald-50',
    answer:
      "Navigate to the 'My Consignments' page from the left sidebar and click on the green 'New Consignment' button. Fill in cargo details, pickup/drop hubs, and vehicle assignment, then submit.",
  },
  {
    id: 'topic-2',
    title: 'How to track my shipment?',
    subtitle: 'Track your shipment in real-time using tracking ID.',
    icon: 'file-text',
    iconColor: 'text-blue-600 bg-blue-50',
    answer:
      "Open 'Live Tracking & GPS' to see all active vehicles on the Leaflet map. You can also search by Consignment ID to inspect live speed, current highway segment, and estimated arrival time.",
  },
  {
    id: 'topic-3',
    title: 'How to add a new vehicle?',
    subtitle: 'Add and manage your vehicles on the platform.',
    icon: 'truck',
    iconColor: 'text-amber-600 bg-amber-50',
    answer:
      "Go to 'My Vehicles' and click 'Add Vehicle'. Provide registration number (e.g. AS 01 GC 9876), vehicle model, payload capacity, insurance validity, and assign an onboarded driver.",
  },
  {
    id: 'topic-4',
    title: 'How to download invoice?',
    subtitle: 'Download and view your invoices and payment history.',
    icon: 'receipt',
    iconColor: 'text-purple-600 bg-purple-50',
    answer:
      "Access 'Delivery History' or 'Reports', find your completed consignment row, and click the Download icon to immediately generate an official GST-compliant tax invoice PDF.",
  },
  {
    id: 'topic-5',
    title: 'What are the payment methods?',
    subtitle: 'Learn about supported payment methods and policies.',
    icon: 'credit-card',
    iconColor: 'text-blue-600 bg-blue-50',
    answer:
      "RAAHI supports direct bank RTGS/NEFT transfers, UPI, corporate fleet cards, and verified Proof of Delivery (POD) escrow payouts with automated settlements.",
  },
];

export const bottomHelpResources = [
  {
    id: 'guide',
    title: 'User Guide',
    description: 'Detailed guides and step-by-step instructions',
    icon: 'book',
  },
  {
    id: 'video',
    title: 'Video Tutorials',
    description: 'Watch videos to learn how things work',
    icon: 'play',
  },
  {
    id: 'status',
    title: 'System Status',
    description: 'Check live system status and announcements',
    icon: 'pulse',
  },
];
