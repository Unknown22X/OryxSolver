import { supabase } from './supabase';

export type ConfigRow = {
  key: string;
  value: unknown;
  is_public: boolean;
  updated_at?: string;
};

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalVersions = {
  terms_version: string;
  privacy_version: string;
  effective_date: string;
};

export type ProductFeature = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type SupportContact = {
  email: string;
};

export type PublicAppConfig = {
  legalVersions: LegalVersions;
  terms: LegalDocument;
  privacy: LegalDocument;
  features: ProductFeature[];
  support: SupportContact;
};

export const DEFAULT_SUPPORT_EMAIL = 'support@oryxsolver.com';

const FALLBACK_LEGAL_VERSIONS: LegalVersions = {
  terms_version: '2026-03-18',
  privacy_version: '2026-03-18',
  effective_date: '2026-03-18',
};

const FALLBACK_TERMS: LegalDocument = {
  title: 'Terms of Service',
  intro: 'These Terms of Service govern your access to and use of OryxSolver across the web application, browser extension, and related services.',
  sections: [
    {
      heading: '1. Acceptance and Scope',
      body: 'By creating an account, accessing, or using OryxSolver, you agree to these Terms and our Privacy Policy. These Terms apply to the website, browser extension, related APIs, support interactions, and any paid or free features we make available.',
    },
    {
      heading: '2. Eligibility and Account Security',
      body: 'You must be legally capable of entering into this agreement. You are responsible for maintaining accurate account information, protecting your login credentials, and all activity that occurs under your account. You must promptly notify us if you believe your account has been compromised.',
    },
    {
      heading: '3. Acceptable Use and Academic Integrity',
      body: 'You may use OryxSolver for lawful educational and productivity purposes. You may not use the service to violate school or employer rules, facilitate cheating, infringe intellectual property rights, probe or bypass security controls, scrape the service at scale, upload unlawful content, or interfere with other users or the platform.',
    },
    {
      heading: '4. User Content and Permissions',
      body: 'You retain ownership of prompts, screenshots, uploads, and other content you submit, subject to rights needed to operate the service. You grant us and our subprocessors a limited license to host, process, transmit, and analyze submitted content solely to provide, secure, support, and improve OryxSolver in accordance with our Privacy Policy.',
    },
    {
      heading: '5. AI Output and No Professional Advice',
      body: 'OryxSolver uses automated systems and AI models to generate outputs. Results may be incomplete, incorrect, biased, or unsuitable for your situation. The service is provided for general educational and informational assistance only and is not legal, financial, medical, academic, or other professional advice. You are responsible for reviewing and validating outputs before relying on them.',
    },
    {
      heading: '6. Paid Plans, Billing, and Auto-Renewal',
      body: 'Some features require payment. Prices, billing intervals, trial terms, and plan features are shown at checkout or in-product. By starting a paid subscription, you expressly agree to recurring charges until cancellation. Lemon Squeezy or another listed billing provider may act as merchant of record, process payments, collect applicable taxes, and manage billing records on our behalf. Taxes, currency conversion, and local fees may be added where required. We may change prices prospectively, and upgrades or downgrades may be prorated or take effect at the next billing cycle depending on the billing provider flow.',
    },
    {
      heading: '7. Cancellation',
      body: 'You may cancel a recurring subscription at any time through the billing controls we provide, the Lemon Squeezy customer portal, or support. Cancellation stops future renewal charges but does not retroactively cancel the current billing period, and access will generally continue through the end of the paid term unless otherwise required by law.',
    },
    {
      heading: '8. Refund Policy',
      body: 'Unless required by law or otherwise stated at checkout, payments for subscriptions and digital services are generally non-refundable once access has been granted. If you were charged in error, billed more than once, or experienced a reproducible technical issue that prevented reasonable access and we cannot fix it within a reasonable time, contact support within 14 days of the charge. We may issue a full or partial refund at our discretion or where required by law. Purchases processed by Lemon Squeezy are also subject to Lemon Squeezy refund and payment handling practices, and Lemon Squeezy may issue refunds or reversals under its own policies, including chargeback-prevention rules.',
    },
    {
      heading: '9. Chargebacks and Payment Disputes',
      body: 'If you believe a charge is incorrect, contact us before filing a chargeback so we can review the issue. Chargebacks, fraudulent payment activity, or repeated payment disputes may result in account review, suspension, or termination. Billing providers such as Lemon Squeezy may handle chargebacks directly and may issue refunds or payment reversals on our behalf.',
    },
    {
      heading: '10. Suspension, Termination, and Availability',
      body: 'We may modify, suspend, or discontinue features at any time, including for maintenance, security, legal compliance, or product changes. We may suspend or terminate access if we reasonably believe you violated these Terms, created risk for the service or others, or used the service unlawfully.',
    },
    {
      heading: '11. Intellectual Property',
      body: 'The OryxSolver service, software, branding, interface design, and related materials are owned by us or our licensors and protected by intellectual property laws. Except as expressly permitted, you may not copy, reverse engineer, distribute, sublicense, or create derivative works from the service.',
    },
    {
      heading: '12. Disclaimers and Limitation of Liability',
      body: 'To the maximum extent permitted by law, the service is provided on an as-is and as-available basis without warranties of any kind, express or implied. We are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenues, goodwill, data, or business opportunity arising from or related to your use of the service.',
    },
    {
      heading: '13. Changes and Contact',
      body: `We may update these Terms from time to time. Material changes may be posted in-product, on our website, or otherwise communicated to users. Your continued use after an updated effective date constitutes acceptance of the revised Terms to the extent permitted by law. For legal questions or notices, contact ${DEFAULT_SUPPORT_EMAIL}.`,
    },
  ],
};

const FALLBACK_PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  intro: 'This Privacy Policy explains what information OryxSolver collects, how it is used, when it is shared, and what choices may be available to you under applicable law.',
  sections: [
    {
      heading: '1. Scope and Contact',
      body: 'This Privacy Policy applies to OryxSolver websites, browser extensions, customer support interactions, and related services. If you have questions or privacy requests, contact privacy@oryxsolver.com.',
    },
    {
      heading: '2. Categories of Information We Collect',
      body: 'We may collect account identifiers such as name, email address, authentication data, and profile image; content you submit such as prompts, screenshots, images, files, and conversation history; device, browser, log, and usage information; billing and subscription status information; support communications; and security or fraud-prevention information.',
    },
    {
      heading: '3. Sources of Information',
      body: 'We collect information directly from you, automatically from your device and browser when you use the service, from authentication providers you choose to use, and from billing or fraud-prevention providers involved in your transactions.',
    },
    {
      heading: '4. Why We Use Information',
      body: 'We use personal information to provide and maintain the service, authenticate users, process prompts and uploads, generate responses, enforce usage limits, personalize settings, process subscriptions, monitor quality, prevent abuse, investigate incidents, comply with legal obligations, and communicate with you about your account or the service.',
    },
    {
      heading: '5. Legal Bases for Processing',
      body: 'Where data protection law requires a legal basis, we generally process information because it is necessary to perform our contract with you, because we have legitimate interests in operating and securing the service, because you consented to specific processing, or because processing is required to comply with legal obligations.',
    },
    {
      heading: '6. Payments and Billing Providers',
      body: 'Payments are handled by third-party billing providers such as Lemon Squeezy. We do not store full payment card details on our own systems. We may receive limited billing information such as purchase status, subscription tier, renewal or cancellation status, and customer identifiers necessary to manage access and support.',
    },
    {
      heading: '7. Sharing and Disclosure',
      body: 'We may share information with service providers that support hosting, analytics, authentication, AI processing, customer support, billing, fraud prevention, and security. We may also disclose information when required by law, to protect rights or safety, in connection with a business transaction, or with your direction.',
    },
    {
      heading: '8. International Transfers',
      body: 'Your information may be processed in countries other than where you live. Where applicable law requires safeguards for cross-border transfers, we will rely on appropriate mechanisms such as contractual protections or other lawful transfer tools.',
    },
    {
      heading: '9. Retention',
      body: 'We retain different categories of personal information for different periods depending on why the information was collected. Account information is generally kept while your account is active and for a reasonable period afterward for security, backup, and dispute-resolution purposes. Prompt history, uploads, and usage records are generally kept until you delete them, close your account, or we no longer need them for service operation, abuse prevention, or legal compliance. Billing and transaction records may be retained for longer where needed for tax, accounting, audit, or legal obligations.',
    },
    {
      heading: '10. Security',
      body: 'We use administrative, technical, and organizational safeguards designed to protect personal information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
    },
    {
      heading: '11. Cookies, Local Storage, and Analytics',
      body: 'We may use cookies, local storage, pixels, analytics tools, and similar technologies to remember preferences, maintain sessions, understand usage, and improve product performance. You can control some of these technologies through browser or device settings, although disabling them may affect functionality.',
    },
    {
      heading: '12. Children’s Privacy',
      body: 'OryxSolver is not directed to young children and we do not knowingly collect personal information from children in violation of applicable law. If you believe a child provided personal information unlawfully, contact us and we will review and take appropriate action.',
    },
    {
      heading: '13. Your Rights and Choices',
      body: 'Depending on your location, you may have rights to access, correct, delete, restrict, object to, or export certain personal information, as well as rights to withdraw consent where processing is based on consent. California residents may also have rights to know, correct, delete, and receive information about certain disclosures of personal information, subject to applicable exceptions. We may need to verify your identity before completing a request, and you can submit requests by contacting privacy@oryxsolver.com.',
    },
    {
      heading: '14. California Privacy Disclosures',
      body: 'If you are a California resident and applicable law covers our processing, you may have rights to know, access, correct, delete, and receive information about disclosures of your personal information. As of the effective date of this policy, we do not sell personal information for money. If we ever engage in selling or sharing personal information in a way that triggers California opt-out rights, we will provide the required notices and honor legally required preference signals, including Global Privacy Control where applicable.',
    },
    {
      heading: '15. Changes to This Policy',
      body: 'We may update this Privacy Policy from time to time to reflect legal, technical, or product changes. We will post the current version with an updated effective date and may provide additional notice when required by law.',
    },
    {
      heading: '16. Contact',
      body: 'For privacy requests, data rights requests, or questions about this Privacy Policy, contact privacy@oryxsolver.com.',
    },
  ],
};

const FALLBACK_FEATURES: ProductFeature[] = [
  {
    id: 'capture',
    title: 'Screenshot solving',
    description: 'Placeholder: highlight a question on the page and send it to OryxSolver without leaving the tab.',
    enabled: true,
  },
  {
    id: 'explanations',
    title: 'Clean worked solutions',
    description: 'Placeholder: answers can show a final answer, ordered steps, and a short explanation that adds context.',
    enabled: true,
  },
  {
    id: 'modes',
    title: 'Solve modes',
    description: 'Placeholder: users can choose the response style before starting a thread.',
    enabled: true,
  },
  {
    id: 'threaded_followups',
    title: 'Threaded follow-ups',
    description: 'Placeholder: keep one main question and continue with follow-up questions inside the same conversation.',
    enabled: true,
  },
  {
    id: 'history_sync',
    title: 'Shared account data',
    description: 'Placeholder: profile, history, and usage should stay in sync between the web app and extension.',
    enabled: true,
  },
];

const FALLBACK_SUPPORT_CONTACT: SupportContact = {
  email: DEFAULT_SUPPORT_EMAIL,
};

export const FALLBACK_PUBLIC_CONFIG: PublicAppConfig = {
  legalVersions: FALLBACK_LEGAL_VERSIONS,
  terms: FALLBACK_TERMS,
  privacy: FALLBACK_PRIVACY,
  features: FALLBACK_FEATURES,
  support: FALLBACK_SUPPORT_CONTACT,
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function parseLegalSections(value: unknown): LegalSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => asObject(section))
    .map((section) => ({
      heading: String(section.heading ?? '').trim(),
      body: String(section.body ?? '').trim(),
    }))
    .filter((section) => section.heading && section.body);
}

function parseLegalDocument(value: unknown, fallback: LegalDocument): LegalDocument {
  const obj = asObject(value);
  const sections = parseLegalSections(obj.sections);
  return {
    title: String(obj.title ?? fallback.title),
    intro: String(obj.intro ?? fallback.intro),
    sections: sections.length > 0 ? sections : fallback.sections,
  };
}

function parseLegalVersions(value: unknown): LegalVersions {
  const obj = asObject(value);
  return {
    terms_version: String(obj.terms_version ?? FALLBACK_LEGAL_VERSIONS.terms_version),
    privacy_version: String(obj.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacy_version),
    effective_date: String(obj.effective_date ?? FALLBACK_LEGAL_VERSIONS.effective_date),
  };
}

function parseFeatures(value: unknown): ProductFeature[] {
  const obj = asObject(value);
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const parsed = rawItems
    .map((item) => asObject(item))
    .map((item, index) => ({
      id: String(item.id ?? `feature_${index + 1}`),
      title: String(item.title ?? ''),
      description: String(item.description ?? ''),
      enabled: item.enabled !== false,
    }))
    .filter((item) => item.title && item.description);
  return parsed.length > 0 ? parsed : FALLBACK_FEATURES;
}

function parseSupportContact(value: unknown): SupportContact {
  const obj = asObject(value);
  const email = String(obj.email ?? DEFAULT_SUPPORT_EMAIL).trim().toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return {
    email: isValidEmail ? email : DEFAULT_SUPPORT_EMAIL,
  };
}

function toPublicConfig(rows: ConfigRow[]): PublicAppConfig {
  const rowMap = new Map<string, unknown>();
  for (const row of rows) rowMap.set(row.key, row.value);

  return {
    legalVersions: parseLegalVersions(rowMap.get('legal_versions')),
    terms: parseLegalDocument(rowMap.get('terms_content'), FALLBACK_TERMS),
    privacy: parseLegalDocument(rowMap.get('privacy_content'), FALLBACK_PRIVACY),
    features: parseFeatures(rowMap.get('product_features')).filter((item) => item.enabled),
    support: parseSupportContact(rowMap.get('support_contact')),
  };
}

export async function fetchPublicAppConfig(): Promise<PublicAppConfig> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key,value,is_public,updated_at')
    .eq('is_public', true)
    .in('key', ['legal_versions', 'terms_content', 'privacy_content', 'product_features', 'support_contact']);

  if (error || !data) {
    if (error) console.error('Failed to load public app config:', error);
    return FALLBACK_PUBLIC_CONFIG;
  }

  return toPublicConfig(data as ConfigRow[]);
}
